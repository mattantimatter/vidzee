"use client";

/**
 * Credits & Billing Page — Task 6
 *
 * Shows:
 * - Current credit balance
 * - Credit pack options with pricing
 * - Transaction history
 * - Stripe checkout integration
 */

import { CREDIT_PACKS, type CreditTransaction } from "@/lib/types";
import {
  ArrowLeft,
  CheckCircle,
  CreditCard,
  Loader2,
  Sparkles,
  Star,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CreditsPage(): ReactNode {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const searchParams = useSearchParams();

  // ─── Load balance ────────────────────────────────────────────────────────

  const loadCredits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/credits");
      if (res.ok) {
        const data = await res.json() as { balance: number; transactions: CreditTransaction[] };
        setBalance(data.balance);
        setTransactions(data.transactions);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCredits();
  }, [loadCredits]);

  // ─── Handle return from Stripe ────────────────────────────────────────────

  useEffect(() => {
    const success = searchParams.get("success");
    const cancelled = searchParams.get("cancelled");
    const testPurchase = searchParams.get("test_purchase");
    const testCredits = searchParams.get("credits");

    if (success === "true") {
      setSuccessMessage("Payment successful! Your credits have been added.");
      void loadCredits();
    } else if (cancelled === "true") {
      setErrorMessage("Purchase cancelled.");
    } else if (testPurchase && testCredits) {
      // Test mode: add credits via API
      const addTestCredits = async () => {
        setPurchasing(testPurchase);
        try {
          const res = await fetch("/api/credits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ testPackId: testPurchase }),
          });
          if (res.ok) {
            const data = await res.json() as { creditsAdded: number };
            setSuccessMessage(`[Test Mode] Added ${data.creditsAdded} credits to your account!`);
            void loadCredits();
          }
        } catch {
          // ignore
        } finally {
          setPurchasing(null);
        }
      };
      void addTestCredits();
    }
  }, [searchParams, loadCredits]);

  // ─── Purchase handler ─────────────────────────────────────────────────────

  const handlePurchase = async (packId: string) => {
    setPurchasing(packId);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json() as { checkoutUrl?: string; testMode?: boolean; error?: string };

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.error) {
        setErrorMessage(data.error);
        setPurchasing(null);
      }
    } catch (err) {
      setErrorMessage("Failed to start checkout. Please try again.");
      setPurchasing(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/app" className="text-neutral-400 hover:text-neutral-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Credits & Billing</h1>
            <p className="text-sm text-neutral-500">Purchase credits to generate real estate videos</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Success / Error banners */}
        {successMessage && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{successMessage}</p>
          </div>
        )}
        {errorMessage && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800">
            <XCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{errorMessage}</p>
          </div>
        )}

        {/* Current Balance */}
        <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl p-6 border border-accent/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600 mb-1">Current Balance</p>
              {loading ? (
                <div className="h-10 w-24 bg-neutral-200 rounded-lg animate-pulse" />
              ) : (
                <p className="text-4xl font-bold text-neutral-900">
                  {balance ?? 0}
                  <span className="text-lg font-medium text-neutral-500 ml-2">
                    credit{(balance ?? 0) !== 1 ? "s" : ""}
                  </span>
                </p>
              )}
              <p className="text-xs text-neutral-500 mt-1">
                1 credit = 1 video (up to 15 photos) · 2 credits = 1 video (16–30 photos)
              </p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
          </div>
        </div>

        {/* Credit Packs */}
        <div>
          <h2 className="text-base font-semibold text-neutral-900 mb-4">Buy Credits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className={`relative bg-white rounded-2xl border p-5 flex flex-col gap-4 transition-shadow hover:shadow-md ${
                  pack.popular
                    ? "border-accent shadow-sm ring-1 ring-accent/20"
                    : "border-neutral-200"
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent text-white text-[10px] font-semibold shadow-sm">
                      <Star className="w-2.5 h-2.5" />
                      Most Popular
                    </span>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
                    {pack.name}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-neutral-900">{pack.credits}</span>
                    <span className="text-sm text-neutral-500">credit{pack.credits > 1 ? "s" : ""}</span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    ${pack.perCredit.toFixed(2)} per credit
                  </p>
                </div>

                <div className="flex-1">
                  <p className="text-2xl font-bold text-neutral-900">
                    ${pack.price.toFixed(2)}
                  </p>
                  {pack.discount > 0 && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-semibold">
                      Save {pack.discount}%
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handlePurchase(pack.id)}
                  disabled={purchasing !== null}
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    pack.popular
                      ? "bg-accent text-white hover:bg-accent/90"
                      : "bg-neutral-900 text-white hover:bg-neutral-800"
                  } disabled:opacity-50`}
                >
                  {purchasing === pack.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                  {purchasing === pack.id ? "Loading..." : "Buy Now"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing notes */}
        <div className="bg-neutral-100 rounded-xl p-4 text-sm text-neutral-600 space-y-1">
          <p className="font-medium text-neutral-700">How credits work</p>
          <p>• Each credit generates one complete real estate video (up to 15 photos)</p>
          <p>• Projects with 16–30 photos cost 2 credits</p>
          <p>• Credits never expire</p>
          <p>• Unused credits are refundable within 30 days</p>
        </div>

        {/* Transaction History */}
        {transactions.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-neutral-900 mb-4">Transaction History</h2>
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Description</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-neutral-50 last:border-0">
                      <td className="px-4 py-3 text-neutral-500 text-xs whitespace-nowrap">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {tx.description ?? tx.type}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${
                        tx.amount > 0 ? "text-green-600" : "text-red-500"
                      }`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
