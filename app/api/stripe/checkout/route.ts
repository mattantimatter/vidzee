/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for purchasing credit packs.
 * Returns the checkout URL for redirect.
 *
 * Body: { packId: "single" | "pro5" | "agency15" | "enterprise50" }
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { CREDIT_PACKS } from "@/lib/types";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://vidzee.vercel.app";

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
    // Dynamically import Stripe to avoid issues if key is not set
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2026-01-28.clover",
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Vidzee ${pack.name} Credits`,
              description: `${pack.credits} video credit${pack.credits > 1 ? "s" : ""} for Vidzee real estate videos`,
            },
            unit_amount: Math.round(pack.price * 100), // cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${APP_URL}/app/credits?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${APP_URL}/app/credits?cancelled=true`,
      metadata: {
        user_id: user.id,
        pack_id: pack.id,
        credits: pack.credits.toString(),
      },
      ...(user.email ? { customer_email: user.email } : {}),
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error("[Stripe] Checkout error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe error" },
      { status: 500 }
    );
  }
}
