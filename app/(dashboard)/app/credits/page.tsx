"use client";

/**
 * Credits & Billing — Credit packs for real estate listing videos.
 * Three-pack grid + trust row + full-width enterprise CTA.
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

const TRUST_POINTS = [
  "Includes vertical + horizontal exports",
  "Designed for standard 10–15 photo listings",
  "Extra-long listings may use additional credits",
] as const;

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
    <div className="h-full min-h-0 flex flex-col overflow-y-auto bg-neutral-100/90 dark:bg-neutral-950">
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200/80 dark:border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white mb-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
          >
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900 dark:text-white">
              Buy video credits
            </h1>
            <p className="mt-2 text-base text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
              One credit typically covers a polished short video from a standard{" "}
              <span className="font-medium text-neutral-800 dark:text-neutral-200">10–15 photo</span>{" "}
              listing. Purchase packs that match how you list.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-green-50 dark:bg-green-950/40 border border-green-200/80 dark:border-green-900 text-green-800 dark:text-green-300"
          >
            <CheckCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{successMessage}</p>
          </motion.div>
        )}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900 text-red-800 dark:text-red-300"
          >
            <XCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{errorMessage}</p>
          </motion.div>
        )}

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease }}
          className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm"
        >
          <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                Your balance
              </p>
              {loading ? (
                <div className="h-10 w-24 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
              ) : (
                <p className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-white tracking-tight tabular-nums">
                  {balance ?? 0}{" "}
                  <span className="text-lg font-medium text-neutral-500 dark:text-neutral-400">
                    credit{(balance ?? 0) !== 1 ? "s" : ""}
                  </span>
                </p>
              )}
            </div>
            <div className="shrink-0 w-12 h-12 rounded-xl bg-accent/10 dark:bg-accent/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-accent" aria-hidden />
            </div>
          </div>
        </motion.section>

        <section>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease }}
            className="mb-6 sm:mb-8"
          >
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
              Credit packs
            </h2>
            <p className="mt-1.5 text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-2xl">
              Pay per pack. Credits never expire. Use them when you&apos;re ready to generate.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 lg:items-stretch">
            {CREDIT_PACKS.map((pack, index) => {
              const popular = pack.popular;
              return (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 + index * 0.05, ease }}
                  className={`relative flex flex-col rounded-2xl border bg-white dark:bg-neutral-900 p-5 sm:p-5 transition-all duration-200 ${
                    popular
                      ? "border-accent/40 dark:border-accent/50 shadow-lg shadow-accent/10 dark:shadow-accent/5 ring-1 ring-accent/20 md:-mt-1 md:mb-1 md:scale-[1.02] z-10"
                      : "border-neutral-200/90 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-md dark:hover:shadow-none"
                  }`}
                >
                  {popular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[10px] font-bold uppercase tracking-widest shadow-sm">
                        <Star className="w-2.5 h-2.5 fill-current" aria-hidden />
                        Most popular
                      </span>
                    </div>
                  )}

                  <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-2">
                    {pack.name}
                  </p>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white tabular-nums">
                      ${pack.price}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mt-0.5">
                    {pack.credits} credit{pack.credits !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-0.5">
                    ${pack.perCredit.toFixed(2)} / credit
                  </p>

                  {pack.discount > 0 && (
                    <span className="inline-flex mt-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md w-fit border border-emerald-100 dark:border-emerald-900/50">
                      Save {pack.discount}% vs single
                    </span>
                  )}

                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-3 leading-snug flex-1 min-h-[2.5rem]">
                    {pack.description}
                  </p>

                  <button
                    type="button"
                    onClick={() => handlePurchase(pack.id)}
                    disabled={purchasing !== null}
                    className={`mt-4 w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950 disabled:opacity-50 ${
                      popular
                        ? "bg-accent text-white hover:bg-accent/90 focus-visible:ring-accent"
                        : "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 focus-visible:ring-neutral-400"
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
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6"
          >
            {TRUST_POINTS.map((text) => (
              <div
                key={text}
                className="flex items-start gap-2.5 text-sm text-neutral-600 dark:text-neutral-400"
              >
                <CheckCircle className="w-4 h-4 shrink-0 text-accent mt-0.5" aria-hidden />
                <span className="leading-snug">{text}</span>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-10"
          >
            <p className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-500 mb-3">
              Need higher volume?
            </p>
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-neutral-50 to-white dark:from-neutral-900 dark:to-neutral-900/80 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  Enterprise & brokerages
                </h3>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 max-w-xl">
                  Custom credit volumes, invoicing, and onboarding for offices that need dozens of
                  listing videos per month.
                </p>
              </div>
              <a
                href="mailto:support@vidzee.ai?subject=Enterprise%20pricing%20inquiry"
                className="shrink-0 inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 rounded-xl text-sm font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-offset-neutral-950"
              >
                Get custom pricing
              </a>
            </div>
          </motion.div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease }}
          className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm p-6 sm:p-7"
        >
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-3">
            How credits work
          </h2>
          <ul className="space-y-2.5 text-sm text-neutral-600 dark:text-neutral-400">
            <li className="flex gap-2">
              <span className="text-accent shrink-0">·</span>
              One credit = one short video (10–15 photos). More photos may cost 2 credits.
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0">·</span>
              Credits never expire. Purchases are non-refundable — see Terms.
            </li>
          </ul>
        </motion.section>

        {transactions.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2, ease }}
          >
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-3">
              Transaction history
            </h2>
            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-800/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Credits
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-neutral-50 dark:border-neutral-800/80 last:border-0 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30"
                    >
                      <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap text-xs">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                        {tx.description ?? tx.type}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold tabular-nums ${
                          tx.amount > 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"
                        }`}
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount}
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
