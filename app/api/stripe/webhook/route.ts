/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events.
 * On checkout.session.completed → add credits to user's metadata balance.
 * Uses user metadata instead of a credits DB table.
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export async function POST(request: NextRequest) {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2026-01-28.clover",
    });

    let event: import("stripe").Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("[Stripe Webhook] Signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as import("stripe").Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const credits = parseInt(session.metadata?.credits ?? "0", 10);
      const packId = session.metadata?.pack_id ?? "unknown";

      if (!userId || !credits) {
        console.error("[Stripe Webhook] Missing metadata:", session.metadata);
        return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
      }

      // Update user metadata with new credits
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // Get current user metadata
      const { data: fullUser, error: userErr } = await admin.auth.admin.getUserById(userId);
      if (userErr || !fullUser) {
        console.error("[Stripe Webhook] Failed to get user:", userErr);
        return NextResponse.json({ error: "User not found" }, { status: 400 });
      }

      const meta = (fullUser.user.user_metadata ?? {}) as Record<string, unknown>;
      const currentBalance: number = typeof meta.credits === "number" ? meta.credits : 0;
      const newBalance = currentBalance + credits;

      const newTransaction = {
        id: crypto.randomUUID(),
        amount: credits,
        type: "purchase",
        description: `Purchased ${credits} credit${credits > 1 ? "s" : ""} (${packId} pack)`,
        stripe_session_id: session.id,
        created_at: new Date().toISOString(),
      };

      const history: unknown[] = Array.isArray(meta.credit_history) ? meta.credit_history : [];
      const updatedHistory = [newTransaction, ...history].slice(0, 20);

      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...meta,
          credits: newBalance,
          credit_history: updatedHistory,
        },
      });

      if (updateErr) {
        console.error("[Stripe Webhook] Failed to update user credits:", updateErr);
        return NextResponse.json({ error: "Failed to update credits" }, { status: 500 });
      }

      console.log(`[Stripe Webhook] Added ${credits} credits to user ${userId} (new balance: ${newBalance})`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Stripe Webhook] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook error" },
      { status: 500 }
    );
  }
}
