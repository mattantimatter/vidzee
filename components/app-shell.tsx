"use client";

import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  HelpCircle,
  Home,
  LogOut,
  Menu,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { VidzeeLogo } from "./vidzee-logo";

const ease = [0.23, 1, 0.32, 1] as const;

/** Collapsed sidebar width in pixels — must match the inline style below */
const SIDEBAR_COLLAPSED_W = 64; // 4rem
/** Expanded sidebar width in pixels — must match the inline style below */
const SIDEBAR_EXPANDED_W = 224; // 14rem

const iconNavItems = [
  { href: "/app", label: "Dashboard", icon: Home },
  { href: "/app/new", label: "New Project", icon: Plus },
  { href: "/app/credits", label: "Credits", icon: Sparkles },
];

const bottomNavItems = [
  { href: "#", label: "Support", icon: HelpCircle },
];

export function AppShell({
  user,
  children,
}: {
  user: User;
  children: ReactNode;
}): ReactNode {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  // Load credit balance
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/credits");
        if (res.ok) {
          const data = await res.json() as { balance: number };
          setCreditBalance(data.balance);
        }
      } catch {
        // ignore
      }
    };
    void load();
  }, [pathname]); // reload on navigation

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "User";

  const expanded = hovered;
  const sidebarW = expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W;

  return (
    <div className="h-screen overflow-hidden bg-background">
      {/* ── Desktop Sidebar — FIXED to left edge, full viewport height ── */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="hidden md:flex fixed top-0 left-0 h-screen flex-col border-r border-border bg-white dark:bg-neutral-900 py-4 shrink-0 overflow-hidden z-40 transition-all duration-300 ease-in-out"
        style={{ width: sidebarW }}
      >
        {/* Logo */}
        <Link href="/" className={`flex items-center gap-2.5 mb-6 h-9 ${expanded ? "px-3" : "justify-center w-full"}`}>
          <VidzeeLogo className="w-8 h-8 shrink-0 text-accent" />
          <span
            className="text-base font-semibold text-neutral-900 dark:text-white whitespace-nowrap transition-opacity duration-200"
            style={{ opacity: expanded ? 1 : 0 }}
          >
            Vidzee
          </span>
        </Link>

        {/* Main nav icons */}
        <nav className={`flex flex-col gap-1 flex-1 ${expanded ? "px-2" : "px-1"}`}>
          {iconNavItems.map((item) => {
            const isActive =
              item.href === "/app"
                ? pathname === "/app"
                : pathname.startsWith(item.href);
            const isCredits = item.href === "/app/credits";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 h-10 rounded-xl transition-colors overflow-hidden ${
                  expanded ? "px-3" : "justify-center px-0 w-10 mx-auto"
                } ${
                  isActive
                    ? "bg-accent/10 text-accent"
                    : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
                title={item.label}
              >
                <div className="relative shrink-0">
                  <item.icon className="w-5 h-5 shrink-0" />
                  {isCredits && creditBalance === 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                  )}
                </div>
                <span
                  className="text-sm font-medium whitespace-nowrap transition-opacity duration-200 flex-1"
                  style={{ opacity: expanded ? 1 : 0, width: expanded ? "auto" : 0 }}
                >
                  {item.label}
                </span>
                {isCredits && expanded && creditBalance !== null && (
                  <span
                    className={`text-xs font-bold tabular-nums transition-opacity duration-200 ${
                      creditBalance === 0 ? "text-red-500" : "text-accent"
                    }`}
                    style={{ opacity: expanded ? 1 : 0 }}
                  >
                    {creditBalance}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom icons */}
        <div className={`flex flex-col gap-1 mt-auto ${expanded ? "px-2" : "px-1"}`}>
          {bottomNavItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 h-10 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors overflow-hidden ${
                expanded ? "px-3" : "justify-center px-0 w-10 mx-auto"
              }`}
              title={item.label}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span
                className="text-sm font-medium whitespace-nowrap transition-opacity duration-200"
                style={{ opacity: expanded ? 1 : 0, width: expanded ? "auto" : 0 }}
              >
                {item.label}
              </span>
            </Link>
          ))}

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className={`flex items-center gap-3 h-10 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors overflow-hidden ${
              expanded ? "px-3" : "justify-center px-0 w-10 mx-auto"
            }`}
            title={`Sign out (${displayName})`}
          >
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-semibold shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span
              className="text-sm font-medium whitespace-nowrap transition-opacity duration-200"
              style={{ opacity: expanded ? 1 : 0, width: expanded ? "auto" : 0 }}
            >
              Sign out
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-neutral-900 border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <VidzeeLogo className="w-7 h-7 text-accent" />
            <span className="font-semibold text-neutral-900 dark:text-white">Vidzee</span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/app/credits"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {creditBalance ?? "—"}
            </Link>
            <Link
              href="/app/new"
              className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center text-accent min-w-[36px]"
            >
              <Plus className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-600 dark:text-neutral-300 min-w-[36px]"
            >
              {sidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-black/50"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease }}
              className="md:hidden fixed left-0 top-14 bottom-0 z-50 w-64 bg-white dark:bg-neutral-900 border-r border-border p-4"
            >
              <nav className="space-y-1">
                {iconNavItems.map((item) => {
                  const isActive =
                    item.href === "/app"
                      ? pathname === "/app"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-accent/10 text-accent"
                          : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                      {item.href === "/app/credits" && creditBalance !== null && (
                        <span className={`ml-auto text-xs font-bold ${creditBalance === 0 ? "text-red-500" : "text-accent"}`}>
                          {creditBalance}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
              <div className="absolute bottom-4 left-4 right-4">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors w-full"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content Area ──
          On desktop (md+), offset left by the collapsed sidebar width (4rem = 64px).
          On mobile, no left offset — full width with top padding for header.
          h-screen + overflow-hidden so each page can scroll independently.
      ── */}
      <main
        className="h-screen pt-14 md:pt-0 md:ml-16 overflow-hidden bg-neutral-50/80 dark:bg-background"
      >
        <div className="h-full flex flex-col min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
}
