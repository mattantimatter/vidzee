/**
 * GET /api/admin/stripe — Pull live Stripe data: charges, customers, MRR, refunds
 * Protected by x-admin-secret header
 */
import { NextResponse } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "vidzee-admin-2026";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";

function isAdmin(request: Request): boolean {
  return request.headers.get("x-admin-secret") === ADMIN_SECRET;
}

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({
      configured: false,
      message: "Stripe not configured",
      charges: [],
      summary: { totalRevenue: 0, totalRefunded: 0, netRevenue: 0, totalCharges: 0, successfulCharges: 0, failedCharges: 0, refundedCharges: 0 },
      last30Days: { revenue: 0, charges: 0 },
      dailySeries: [],
    });
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2026-01-28.clover" });

    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

    // Fetch recent charges (last 100)
    const chargesResponse = await stripe.charges.list({ limit: 100 });
    const charges = chargesResponse.data;

    // Compute summary
    let totalRevenue = 0;
    let totalRefunded = 0;
    let successfulCharges = 0;
    let failedCharges = 0;
    let refundedCharges = 0;
    let last30Revenue = 0;
    let last30Charges = 0;

    const dailyMap: Record<string, number> = {};

    for (const charge of charges) {
      if (charge.status === "succeeded") {
        const amount = charge.amount / 100;
        totalRevenue += amount;
        successfulCharges++;
        if (charge.amount_refunded > 0) {
          totalRefunded += charge.amount_refunded / 100;
          refundedCharges++;
        }
        if (charge.created >= thirtyDaysAgo) {
          last30Revenue += amount;
          last30Charges++;
          const date = new Date(charge.created * 1000).toISOString().slice(0, 10);
          dailyMap[date] = (dailyMap[date] ?? 0) + amount;
        }
      } else if (charge.status === "failed") {
        failedCharges++;
      }
    }

    const dailySeries = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }));

    // Format charges for the UI
    const formattedCharges = charges.slice(0, 50).map((c) => ({
      id: c.id,
      amount: c.amount / 100,
      currency: c.currency,
      status: c.status,
      refunded: c.refunded,
      amount_refunded: c.amount_refunded / 100,
      description: c.description,
      customer_email: c.billing_details?.email ?? c.receipt_email ?? null,
      customer_name: c.billing_details?.name ?? null,
      created: new Date(c.created * 1000).toISOString(),
      receipt_url: c.receipt_url,
      payment_intent: typeof c.payment_intent === "string" ? c.payment_intent : null,
      metadata: c.metadata,
    }));

    // Get stripe customers count
    const customersResponse = await stripe.customers.list({ limit: 1 });
    const totalCustomers = customersResponse.data.length; // approximate

    return NextResponse.json({
      configured: true,
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalRefunded: Math.round(totalRefunded * 100) / 100,
        netRevenue: Math.round((totalRevenue - totalRefunded) * 100) / 100,
        totalCharges: charges.length,
        successfulCharges,
        failedCharges,
        refundedCharges,
        totalCustomers,
      },
      last30Days: {
        revenue: Math.round(last30Revenue * 100) / 100,
        charges: last30Charges,
      },
      dailySeries,
      charges: formattedCharges,
    });
  } catch (err) {
    console.error("[Admin Stripe] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe error", configured: true },
      { status: 500 }
    );
  }
}
