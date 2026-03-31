/**
 * GET /api/credits — Get current user's credit balance and transaction history
 * POST /api/credits — Add test credits (dev/test mode only)
 *
 * Uses the `credits` and `credit_transactions` Supabase DB tables.
 * Service role is required for writes (bypasses RLS).
 */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
  });
  return supabase.auth.getUser();
}

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Ensure a credits row exists for the user; grant welcome bonus on first visit. */
async function ensureCreditsRow(
  admin: ReturnType<typeof getAdminClient>,
  userId: string
): Promise<number> {
  const { data: existing } = await admin
    .from("credits")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (existing) return existing.balance as number;

  // First visit — create row with 100 welcome credits
  const { data: inserted } = await admin
    .from("credits")
    .insert({ user_id: userId, balance: 100 })
    .select("balance")
    .single();

  // Record welcome bonus transaction
  await admin.from("credit_transactions").insert({
    user_id: userId,
    amount: 100,
    type: "bonus",
    description: "Welcome bonus — 100 free credits",
  });

  return (inserted?.balance as number) ?? 100;
}

export async function GET() {
  const {
    data: { user },
    error: authError,
  } = await getAuthUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();
  const balance = await ensureCreditsRow(admin, user.id);

  const { data: transactions } = await admin
    .from("credit_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    balance,
    transactions: transactions ?? [],
  });
}

/** POST: Add test credits — only works when STRIPE_SECRET_KEY is not set */
export async function POST(request: NextRequest) {
  const {
    data: { user },
    error: authError,
  } = await getAuthUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Block test credits in production (when Stripe is configured)
  if (process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Test credits unavailable in production" },
      { status: 403 }
    );
  }

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

  const admin = getAdminClient();
  const currentBalance = await ensureCreditsRow(admin, user.id);
  const newBalance = currentBalance + pack.credits;

  await admin
    .from("credits")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  await admin.from("credit_transactions").insert({
    user_id: user.id,
    amount: pack.credits,
    type: "purchase",
    description: `[TEST] Purchased ${pack.credits} credit${pack.credits > 1 ? "s" : ""} (${pack.name} pack)`,
  });

  return NextResponse.json({
    success: true,
    creditsAdded: pack.credits,
    newBalance,
    message: `Added ${pack.credits} test credits`,
  });
}
