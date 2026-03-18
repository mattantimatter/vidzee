"use client";

import { motion } from "motion/react";
import { Check, Star } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CREDIT_PACKS } from "@/lib/types";

const ease = [0.23, 1, 0.32, 1] as const;

const TRUST_ROW = [
  "Vertical + horizontal exports",
  "1 credit · typical 10–15 photo listing",
  "Larger listings may need extra credits",
] as const;

function packFeatures(pack: (typeof CREDIT_PACKS)[number]): string[] {
  const base = [
    `${pack.credits} video credit${pack.credits !== 1 ? "s" : ""}`,
    "All style packs & music",
    "No subscription — credits don’t expire",
  ];
  if (pack.discount > 0) {
    return [`Save ${pack.discount}% vs Starter`, ...base];
  }
  return base;
}

function PricingCard({
  pack,
  index,
}: {
  pack: (typeof CREDIT_PACKS)[number];
  index: number;
}): ReactNode {
  const popular = pack.popular === true;
  const features = packFeatures(pack);

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease, delay: index * 0.06 }}
      className={`relative flex flex-col rounded-2xl p-6 sm:p-7 ${
        popular
          ? "bg-frame shadow-lg shadow-accent/10 ring-1 ring-accent/30 border border-accent/25 md:-mt-1 md:scale-[1.02] z-10"
          : "bg-frame border border-border hover:border-foreground/15 transition-colors"
      }`}
    >
      {popular && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-background">
            <Star className="h-2.5 w-2.5 fill-current" aria-hidden />
            Most popular
          </span>
        </div>
      )}

      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {pack.name}
      </p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight text-foreground tabular-nums">
          ${pack.price}
        </span>
      </div>
      <p className="mt-0.5 text-sm font-medium text-foreground">
        {pack.credits} credit{pack.credits !== 1 ? "s" : ""}
      </p>
      <p className="text-xs text-muted-foreground">${pack.perCredit.toFixed(2)} per credit</p>

      {pack.discount > 0 && (
        <span className="mt-2 inline-flex w-fit rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          Save {pack.discount}%
        </span>
      )}

      <p className="mt-3 flex-1 text-sm leading-snug text-muted-foreground min-h-[2.5rem]">
        {pack.description}
      </p>

      <Link
        href="/app/credits"
        className={`mt-5 flex min-h-[44px] w-full items-center justify-center rounded-xl text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          popular
            ? "bg-accent text-white hover:bg-accent/90"
            : "bg-foreground text-background hover:bg-foreground/90"
        }`}
      >
        Buy credits
      </Link>

      <div className="mt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Includes
        </p>
        <ul className="mt-3 space-y-2.5">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5">
              <Check
                className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                strokeWidth={2.5}
                aria-hidden
              />
              <span className="text-sm text-foreground leading-snug">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

export function Pricing(): ReactNode {
  return (
    <section
      id="pricing"
      className="w-full scroll-mt-24 bg-background px-6 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease }}
          className="mb-10 text-center sm:mb-14"
        >
          <span className="text-sm font-medium text-muted-foreground">Pricing</span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
            Listing video credits for agents
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg leading-relaxed">
            One credit typically covers a polished short video from a standard{" "}
            <span className="font-medium text-foreground">10–15 photo</span> listing. Buy packs
            when you need them — no monthly minimum.
          </p>
        </motion.div>

        <div className="grid gap-5 sm:gap-6 md:grid-cols-3 lg:items-stretch">
          {CREDIT_PACKS.map((pack, index) => (
            <PricingCard key={pack.id} pack={pack} index={index} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15, duration: 0.45 }}
          className="mt-10 grid gap-4 border-y border-border py-8 sm:grid-cols-3 sm:gap-6"
        >
          {TRUST_ROW.map((line) => (
            <div
              key={line}
              className="flex items-start gap-2 text-center sm:text-left sm:items-center"
            >
              <Check className="mx-auto h-4 w-4 shrink-0 text-accent sm:mx-0" aria-hidden />
              <span className="text-sm text-muted-foreground leading-snug">{line}</span>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.45 }}
          className="mt-10 rounded-2xl border border-border bg-muted/30 p-8 sm:p-10"
        >
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Need higher volume?
          </p>
          <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:justify-between sm:items-center">
            <div className="text-center sm:text-left">
              <h3 className="text-xl font-semibold text-foreground">
                Brokerages & high-volume teams
              </h3>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
                Custom credit blocks, invoicing, and dedicated support for offices producing
                dozens of listing videos per month.
              </p>
            </div>
            <a
              href="mailto:support@vidzee.ai?subject=Enterprise%20pricing"
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl bg-foreground px-8 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Contact sales
            </a>
          </div>
        </motion.div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          New to Vidzee?{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create a free account
          </Link>{" "}
          to upload photos and preview your first video.
        </p>
      </div>
    </section>
  );
}
