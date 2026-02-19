"use client";

import { ArrowDownRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { VidzeeLogo } from "./vidzee-logo";

const ease = [0.23, 1, 0.32, 1] as const;

function HamburgerIcon({ isOpen }: { isOpen: boolean }): ReactNode {
  return (
    <div className="w-8 h-4 relative flex flex-col justify-between cursor-pointer">
      <motion.span
        className="block h-0.5 w-full bg-foreground origin-center rounded-full"
        animate={isOpen ? { rotate: 45, y: 4.5 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.25, ease }}
      />
      <motion.span
        className="block h-0.5 w-full bg-foreground origin-center rounded-full"
        animate={isOpen ? { rotate: -45, y: -9.5 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.25, ease }}
      />
    </div>
  );
}

const CornerSVG = ({ className }: { className: string }) => (
  <svg className={className} width="50" height="50" viewBox="0 0 50 50" fill="none" aria-hidden="true">
    <path d="M5.50871e-06 0C-0.00788227 37.3001 8.99616 50.0116 50 50H5.50871e-06V0Z" fill="currentColor" />
  </svg>
);

export function Header(): ReactNode {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobile = () => setMobileMenuOpen(false);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease }}
      className="fixed shadow-2xl/20 rounded-b-4xl top-2.5 left-1/2 -translate-x-1/2 w-full max-w-5xl max-[1200px]:max-w-2xl bg-frame z-9998 max-[850px]:top-0 max-[850px]:left-0 max-[850px]:right-0 max-[850px]:translate-x-0 max-[850px]:w-full max-[850px]:max-w-none max-[850px]:rounded-none max-[850px]:rounded-b-4xl max-[850px]:overflow-hidden"
    >
      <div className="h-20 max-[850px]:h-18 flex items-center justify-between px-4 max-[850px]:px-6">
        <Link href="/" className="flex items-center gap-2 ml-4 max-[850px]:ml-0">
          <VidzeeLogo className="w-7 h-7 text-foreground" />
          <span className="text-lg font-semibold text-foreground leading-0 max-[1200px]:hidden max-[850px]:inline">Vidzee</span>
        </Link>

        <nav className="flex items-center gap-1 max-[1200px]:gap-0 max-[850px]:hidden">
          <a href="#features" className="px-4 py-2 max-[1200px]:px-3 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors rounded-full hover:bg-foreground/5">
            Features
          </a>
          <a href="#how-it-works" className="px-4 py-2 max-[1200px]:px-3 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors rounded-full hover:bg-foreground/5">
            How it Works
          </a>
          <a href="#pricing" className="px-4 py-2 max-[1200px]:px-3 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors rounded-full hover:bg-foreground/5">
            Pricing
          </a>
        </nav>

        <div className="flex items-center gap-4 max-[850px]:hidden">
          <Link href="/login" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
            Sign in
          </Link>
          <Link href="/signup" className="group relative inline-flex items-center">
            <span className="absolute right-0 inset-y-0 w-[calc(100%-1.5rem)] rounded-xl bg-accent" />
            <span className="relative z-10 px-5 py-3 rounded-xl bg-foreground text-background text-sm font-medium">Get Started Free</span>
            <span className="relative -left-px z-10 w-10 h-10 rounded-xl flex items-center justify-center text-white">
              <ArrowDownRight className="w-4 h-4 transition-transform duration-300 group-hover:-rotate-45" />
            </span>
          </Link>
        </div>

        <button
          className="hidden max-[850px]:flex items-center justify-center w-10 h-10"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          <HamburgerIcon isOpen={mobileMenuOpen} />
        </button>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="hidden max-[850px]:block overflow-hidden"
          >
            <div className="px-6 pb-4">
              <nav className="space-y-0">
                <a href="#features" className="flex items-center justify-between py-4 text-base font-medium text-foreground border-b border-foreground/10" onClick={closeMobile}>
                  Features
                </a>
                <a href="#how-it-works" className="flex items-center justify-between py-4 text-base font-medium text-foreground border-b border-foreground/10" onClick={closeMobile}>
                  How it Works
                </a>
                <a href="#pricing" className="flex items-center justify-between py-4 text-base font-medium text-foreground" onClick={closeMobile}>
                  Pricing
                </a>
              </nav>

              <div className="flex items-center justify-between pt-8 pb-2">
                <Link href="/login" className="text-base font-medium text-foreground" onClick={closeMobile}>
                  Sign in
                </Link>
                <Link href="/signup" className="group relative inline-flex items-center" onClick={closeMobile}>
                  <span className="absolute right-0 inset-y-0 w-[calc(100%-1.5rem)] rounded-2xl bg-accent" />
                  <span className="relative z-10 px-5 py-3 rounded-2xl bg-foreground text-background text-sm font-medium">Get Started Free</span>
                  <span className="relative -left-px z-10 w-10 h-10 rounded-2xl flex items-center justify-center text-white">
                    <ArrowDownRight className="w-4 h-4 transition-transform duration-300 group-hover:-rotate-45" />
                  </span>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CornerSVG className="absolute top-0 -left-12.25 rotate-180 text-frame pointer-events-none max-[850px]:hidden" />
      <CornerSVG className="absolute top-0 -right-12.25 rotate-90 text-frame pointer-events-none max-[850px]:hidden" />
    </motion.header>
  );
}
