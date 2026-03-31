/**
 * GET  /api/admin/users/[id] — Get full user profile with projects, transactions, support history
 * POST /api/admin/users/[id] — Adjust user credits
 * Protected by x-admin-secret header
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "vidzee-admin-2026";

function isAdmin(request: Request): boolean {
  return request.headers.get("x-admin-secret") === ADMIN_SECRET;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId } = await params;
  const supabase = createAdminClient();

  // Get user from auth
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const user = userData.user;

  // Get credit balance and transaction history
  const { data: credits } = await supabase
    .from("credits")
    .select("balance, updated_at")
    .eq("user_id", userId)
    .single();

  const { data: transactions } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Get projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Get support conversations
  let supportConversations: unknown[] = [];
  try {
    const { data: convos } = await supabase
      .from("support_conversations")
      .select("id, status, subject, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    supportConversations = convos ?? [];
  } catch {
    // Table may not exist
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in: user.last_sign_in_at,
      email_confirmed_at: user.email_confirmed_at,
      phone: user.phone,
      provider: user.app_metadata?.provider ?? "email",
      providers: user.app_metadata?.providers ?? [],
      user_metadata: user.user_metadata,
    },
    credits: {
      balance: credits?.balance ?? 0,
      updated_at: credits?.updated_at ?? null,
    },
    transactions: transactions ?? [],
    projects: projects ?? [],
    supportConversations,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId } = await params;
  const body = await request.json() as {
    action: "adjust_credits" | "ban_user";
    amount?: number;
    reason?: string;
  };

  const supabase = createAdminClient();

  if (body.action === "adjust_credits") {
    const amount = body.amount ?? 0;
    if (amount === 0) {
      return NextResponse.json({ error: "Amount cannot be zero" }, { status: 400 });
    }

    // Get current balance
    const { data: existing } = await supabase
      .from("credits")
      .select("balance")
      .eq("user_id", userId)
      .single();

    const currentBalance = (existing?.balance as number) ?? 0;
    const newBalance = Math.max(0, currentBalance + amount);

    // Upsert credits
    await supabase
      .from("credits")
      .upsert({ user_id: userId, balance: newBalance, updated_at: new Date().toISOString() });

    // Record transaction
    await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount,
      type: "admin_adjustment",
      description: `Admin adjustment: ${amount > 0 ? "+" : ""}${amount} credits${body.reason ? ` — ${body.reason}` : ""}`,
    });

    return NextResponse.json({ ok: true, newBalance });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
