/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for purchasing credit packs.
 * Returns the checkout URL for redirect.
 *
 * Body: { packId: "starter" | "pro" | "agent" }
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { CREDIT_PACKS } from "@/lib/types";
import type Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://vidzee.vercel.app";

// Stripe Price IDs — created via setup script
const STRIPE_PRICE_IDS: Record<string, string> = {
  starter: "price_1TEdu42QOheDC14xB3O9OdcN",
  pro: "price_1TEdu52QOheDC14xZwR1nBGi",
  agent: "price_1TEdu52QOheDC14x8OOltJJs",
};

export async function POST(request: NextRequest) {
  // Get authenticated user
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
  const { packId } = body as { packId: string };

  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) {
    return NextResponse.json({ error: "Invalid pack ID" }, { status: 400 });
  }

  // If Stripe is not configured, return test mode response
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({
      testMode: true,
      message: "Stripe not configured — use test mode",
      pack,
      checkoutUrl: `${APP_URL}/app/credits?test_purchase=${packId}&credits=${pack.credits}`,
    });
  }

  try {
    const StripeLib = (await import("stripe")).default;
    const stripe = new StripeLib(STRIPE_SECRET_KEY, {
      apiVersion: "2026-01-28.clover",
    });

    const priceId = STRIPE_PRICE_IDS[packId];

    // Build line item — use saved Price ID if available, otherwise build inline
    let lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
    if (priceId) {
      lineItem = { price: priceId, quantity: 1 };
    } else {
      lineItem = {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Vidzee ${pack.name} Credits`,
            description: `${pack.credits} video credit${pack.credits > 1 ? "s" : ""} for Vidzee real estate videos`,
          },
          unit_amount: Math.round(pack.price * 100),
        },
        quantity: 1,
      };
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [lineItem],
      mode: "payment",
      success_url: `${APP_URL}/app/credits?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${APP_URL}/app/credits?cancelled=true`,
      metadata: {
        user_id: user.id,
        pack_id: pack.id,
        credits: pack.credits.toString(),
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          pack_id: pack.id,
          credits: pack.credits.toString(),
        },
      },
      allow_promotion_codes: true,
    };

    if (user.email) {
      sessionParams.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error("[Stripe] Checkout error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe error" },
      { status: 500 }
    );
  }
}
