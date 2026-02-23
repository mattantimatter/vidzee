/**
 * POST /api/credits/deduct
 *
 * Deducts credits when starting video generation.
 * Body: { projectId: string, photoCount: number }
 *
 * Uses Supabase user metadata — no new DB tables required.
 * Returns: { success: true, newBalance: number, creditsUsed: number }
 */
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { calculateCreditCost } from "@/lib/types";

export async function POST(request: NextRequest) {
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

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Get current metadata
  const { data: fullUser, error: userErr } = await admin.auth.admin.getUserById(user.id);
  if (userErr || !fullUser) {
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }

  const meta = (fullUser.user.user_metadata ?? {}) as Record<string, unknown>;
  const currentBalance: number = typeof meta.credits === "number" ? meta.credits : 0;

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

  const newTransaction = {
    id: crypto.randomUUID(),
    amount: -creditsRequired,
    type: "usage",
    description: `Video generation — ${photoCount} photos (${creditsRequired} credit${creditsRequired > 1 ? "s" : ""})`,
    project_id: projectId,
    created_at: new Date().toISOString(),
  };

  const history: unknown[] = Array.isArray(meta.credit_history) ? meta.credit_history : [];
  const updatedHistory = [newTransaction, ...history].slice(0, 20);

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...meta,
      credits: newBalance,
      credit_history: updatedHistory,
    },
  });

  return NextResponse.json({
    success: true,
    newBalance,
    creditsUsed: creditsRequired,
  });
}
