"use client";

/**
 * Credits & Billing — Premium purchase flow for video generation credits.
 * ReactBits Pro–inspired layout: clear hierarchy, rounded cards, emphasized best-value plan.
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
import { motion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

const ease = [0.23, 1, 0.32, 1] as const;

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

  const handlePurchase = async (packId: string) => {
    setPurchasing(packId);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json() as { checkoutUrl?: string; error?: string };

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.error) {
        setErrorMessage(data.error);
        setPurchasing(null);
      }
    } catch {
      setErrorMessage("Failed to start checkout. Please try again.");
      setPurchasing(null);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-y-auto bg-neutral-100/90">
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-neutral-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
          >
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">
              Credits & Billing
            </h1>
            <p className="mt-1 text-base text-neutral-600 max-w-xl">
              Purchase credits to generate polished short-form real estate videos in minutes.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10 sm:space-y-14">
        {/* Success / Error banners */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-green-50 border border-green-200/80 text-green-800"
          >
            <CheckCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{successMessage}</p>
          </motion.div>
        )}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-200/80 text-red-800"
          >
            <XCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{errorMessage}</p>
          </motion.div>
        )}

        {/* Current Balance — premium card ─────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease }}
          className="rounded-3xl bg-white border border-neutral-200/80 shadow-sm overflow-hidden"
        >
          <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                Current balance
              </p>
              {loading ? (
                <div className="h-12 w-28 bg-neutral-100 rounded-xl animate-pulse" />
              ) : (
                <p className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight">
                  {balance ?? 0}
                  <span className="text-xl font-medium text-neutral-500 ml-2">
                    credit{(balance ?? 0) !== 1 ? "s" : ""}
                  </span>
                </p>
              )}
              <p className="mt-3 text-sm text-neutral-600 max-w-md">
                1 credit = 1 short real estate video (10–15 photos). Larger listings may use more credits.
              </p>
            </div>
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-accent" aria-hidden />
            </div>
          </div>
        </motion.section>

        {/* Pricing section ───────────────────────────────────────────────── */}
        <section className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease }}
          >
            <h2 className="text-xl sm:text-2xl font-semibold text-neutral-900 tracking-tight">
              Choose the right credit pack
            </h2>
            <p className="mt-1 text-neutral-600">
              Most agents use 1 credit for a standard 10–15 photo property video.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {CREDIT_PACKS.map((pack, index) => (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.12 + index * 0.05, ease }}
                className={`relative flex flex-col rounded-3xl border bg-white p-6 sm:p-6 transition-all duration-200 hover:shadow-lg ${
                  pack.popular
                    ? "border-accent/50 ring-2 ring-accent/20 shadow-md"
                    : "border-neutral-200/80 hover:border-neutral-300"
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent text-white text-xs font-semibold shadow-sm">
                      <Star className="w-3 h-3" aria-hidden />
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan label */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider ${
                      pack.popular ? "bg-accent/15 text-accent" : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    {pack.name}
                  </span>
                </div>

                {/* Credits + price */}
                <div className="mb-1">
                  <span className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">
                    ${pack.price}
                  </span>
                </div>
                <p className="text-sm text-neutral-500 mb-4">
                  {pack.credits} credit{pack.credits !== 1 ? "s" : ""} · ${pack.perCredit.toFixed(2)} per credit
                </p>
                {pack.discount > 0 && (
                  <p className="text-xs font-semibold text-green-600 mb-4">
                    Save {pack.discount}%
                  </p>
                )}

                {/* Description */}
                <p className="text-sm text-neutral-600 mb-6 flex-1">
                  {pack.description}
                </p>

                {/* CTA */}
                <button
                  type="button"
                  onClick={() => handlePurchase(pack.id)}
                  disabled={purchasing !== null}
                  className={`w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                    pack.popular
                      ? "bg-accent text-white hover:bg-accent/90 focus:ring-accent/50"
                      : "bg-neutral-900 text-white hover:bg-neutral-800 focus:ring-neutral-400"
                  }`}
                >
                  {purchasing === pack.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  ) : (
                    <CreditCard className="w-4 h-4" aria-hidden />
                  )}
                  {purchasing === pack.id ? "Processing…" : "Buy now"}
                </button>
              </motion.div>
            ))}

            {/* Enterprise / Contact card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.32, ease }}
              className="relative flex flex-col rounded-3xl border border-neutral-200/80 bg-white p-6 sm:p-6 transition-all duration-200 hover:shadow-lg hover:border-neutral-300"
            >
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider bg-neutral-100 text-neutral-700">
                  Enterprise
                </span>
              </div>
              <div className="mb-1">
                <span className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
                  Custom
                </span>
              </div>
              <p className="text-sm text-neutral-500 mb-4">
                Volume pricing for teams and brokerages
              </p>
              <p className="text-sm text-neutral-600 mb-6 flex-1">
                Tailored credit packs and dedicated support for high-volume listing video needs.
              </p>
              <a
                href="mailto:support@vidzee.ai?subject=Enterprise%20credits%20inquiry"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-400"
              >
                Contact us
              </a>
            </motion.div>
          </div>
        </section>

        {/* How credits work — premium explanation ─────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease }}
          className="rounded-3xl bg-white border border-neutral-200/80 shadow-sm p-6 sm:p-8"
        >
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            How credits work
          </h2>
          <ul className="space-y-3 text-sm text-neutral-600">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden />
              <span>One credit generates one short real estate video (10–15 photos).</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden />
              <span>Larger listings with more photos may require extra credits per video.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden />
              <span>Credits never expire. Unused credits remain in your account.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden />
              <span>Purchases are non-refundable. See Terms of Service for details.</span>
            </li>
          </ul>
        </motion.section>

        {/* Transaction history ───────────────────────────────────────────── */}
        {transactions.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25, ease }}
          >
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Transaction history
            </h2>
            <div className="rounded-3xl border border-neutral-200/80 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80">
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="text-right px-5 py-3.5 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Credits
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-neutral-700">
                        {tx.description ?? tx.type}
                      </td>
                      <td
                        className={`px-5 py-3.5 text-right font-semibold tabular-nums ${
                          tx.amount > 0 ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}
