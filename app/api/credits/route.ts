/**
 * GET /api/credits — Get current user's credit balance and transaction history
 * POST /api/credits — Add test credits (test mode only)
 */

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
  return supabase.auth.getUser();
}

export async function GET() {
  const { data: { user }, error: authError } = await getAuthUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Get credit balance
  const { data: credits } = await admin
    .from("credits")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // Get recent transactions
  const { data: transactions } = await admin
    .from("credit_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    balance: credits?.balance ?? 0,
    transactions: transactions ?? [],
  });
}

// POST: Add test credits (only works when Stripe is not configured)
export async function POST(request: NextRequest) {
  const { data: { user }, error: authError } = await getAuthUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only allow in test mode (no Stripe key)
  const body = await request.json();
  const { testPackId } = body as { testPackId?: string };

  if (!testPackId) {
    return NextResponse.json({ error: "testPackId required" }, { status: 400 });
  }

  const { CREDIT_PACKS } = await import("@/lib/types");
  const pack = CREDIT_PACKS.find((p) => p.id === testPackId);
  if (!pack) {
    return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Upsert credits
  const { data: existing } = await admin
    .from("credits")
    .select("id, balance")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    await admin
      .from("credits")
      .update({
        balance: existing.balance + pack.credits,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await admin.from("credits").insert({
      user_id: user.id,
      balance: pack.credits,
    });
  }

  // Log transaction
  await admin.from("credit_transactions").insert({
    user_id: user.id,
    amount: pack.credits,
    type: "purchase",
    description: `[TEST] Purchased ${pack.credits} credit${pack.credits > 1 ? "s" : ""} (${pack.name} pack)`,
  });

  return NextResponse.json({
    success: true,
    creditsAdded: pack.credits,
    message: `Added ${pack.credits} test credits`,
  });
}
