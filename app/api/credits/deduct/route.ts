/**
 * POST /api/credits/deduct
 *
 * Deducts credits when starting video generation.
 * Body: { projectId: string, photoCount: number }
 *
 * Uses the `credits` and `credit_transactions` Supabase DB tables.
 * Returns: { success: true, newBalance: number, creditsUsed: number }
 */
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { calculateCreditCost } from "@/lib/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
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

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId, photoCount } = body as { projectId: string; photoCount: number };
  if (!projectId || !photoCount) {
    return NextResponse.json({ error: "projectId and photoCount required" }, { status: 400 });
  }

  const creditsRequired = calculateCreditCost(photoCount);

  const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Get current balance from DB
  const { data: creditsRow } = await admin
    .from("credits")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  const currentBalance: number = (creditsRow?.balance as number) ?? 0;

  if (currentBalance < creditsRequired) {
    return NextResponse.json(
      {
        error: "Insufficient credits",
        currentBalance,
        creditsRequired,
        shortfall: creditsRequired - currentBalance,
      },
      { status: 402 } // Payment Required
    );
  }

  const newBalance = currentBalance - creditsRequired;

  // Update balance
  await admin
    .from("credits")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  // Record transaction
  await admin.from("credit_transactions").insert({
    user_id: user.id,
    amount: -creditsRequired,
    type: "usage",
    description: `Video generation — ${photoCount} photos (${creditsRequired} credit${creditsRequired > 1 ? "s" : ""})`,
    project_id: projectId,
  });

  return NextResponse.json({
    success: true,
    newBalance,
    creditsUsed: creditsRequired,
  });
}
