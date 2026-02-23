/**
 * GET /api/credits — Get current user's credit balance
 * POST /api/credits — Add test credits (test mode only)
 *
 * Uses Supabase user metadata to store credit balance.
 * No new DB tables required — balance stored in auth.users.user_metadata.credits
 * Transaction history stored in user_metadata.credit_history (last 20 entries)
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

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  const { data: { user }, error: authError } = await getAuthUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();

  // Get the full user record to access metadata
  const { data: fullUser, error: userErr } = await admin.auth.admin.getUserById(user.id);
  if (userErr || !fullUser) {
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }

  const meta = (fullUser.user.user_metadata ?? {}) as Record<string, unknown>;
  const balance: number = typeof meta.credits === "number" ? meta.credits : 0;
  const transactions: unknown[] = Array.isArray(meta.credit_history) ? meta.credit_history : [];

  // If this is the first time the user visits, grant 2 welcome credits
  if (typeof meta.credits === "undefined") {
    const welcomeTransaction = {
      id: crypto.randomUUID(),
      amount: 2,
      type: "bonus",
      description: "Welcome bonus — 2 free credits",
      created_at: new Date().toISOString(),
    };
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...meta,
        credits: 2,
        credit_history: [welcomeTransaction],
      },
    });
    return NextResponse.json({
      balance: 2,
      transactions: [welcomeTransaction],
    });
  }

  return NextResponse.json({
    balance,
    transactions,
  });
}

// POST: Add test credits (only works when Stripe is not configured)
export async function POST(request: NextRequest) {
  const { data: { user }, error: authError } = await getAuthUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Get current metadata
  const { data: fullUser, error: userErr } = await admin.auth.admin.getUserById(user.id);
  if (userErr || !fullUser) {
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }

  const meta = (fullUser.user.user_metadata ?? {}) as Record<string, unknown>;
  const currentBalance: number = typeof meta.credits === "number" ? meta.credits : 0;
  const newBalance = currentBalance + pack.credits;

  const newTransaction = {
    id: crypto.randomUUID(),
    amount: pack.credits,
    type: "purchase",
    description: `[TEST] Purchased ${pack.credits} credit${pack.credits > 1 ? "s" : ""} (${pack.name} pack)`,
    created_at: new Date().toISOString(),
  };

  const history: unknown[] = Array.isArray(meta.credit_history) ? meta.credit_history : [];
  const updatedHistory = [newTransaction, ...history].slice(0, 20); // keep last 20

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...meta,
      credits: newBalance,
      credit_history: updatedHistory,
    },
  });

  return NextResponse.json({
    success: true,
    creditsAdded: pack.credits,
    newBalance,
    message: `Added ${pack.credits} test credits`,
  });
}
