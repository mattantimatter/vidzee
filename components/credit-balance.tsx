"use client";

/**
 * CreditBalance — Shows current credit balance in the sidebar/header.
 * Clicking navigates to the credits page.
 */

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export function CreditBalance({ expanded }: { expanded?: boolean }): ReactNode {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/credits");
        if (res.ok) {
          const data = await res.json() as { balance: number };
          setBalance(data.balance);
        }
      } catch {
        // ignore
      }
    };
    void load();
  }, []);

  return (
    <Link
      href="/app/credits"
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 transition-colors group"
      title="Credits"
    >
      <div className="relative shrink-0">
        <Sparkles className="w-4 h-4 text-accent" />
        {balance !== null && balance === 0 && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
        )}
      </div>
      {expanded && (
        <div className="flex items-center justify-between flex-1 min-w-0">
          <span className="text-sm text-neutral-700 truncate">Credits</span>
          <span className={`text-xs font-semibold tabular-nums ${
            balance === 0 ? "text-red-500" : "text-accent"
          }`}>
            {balance ?? "—"}
          </span>
        </div>
      )}
    </Link>
  );
}
