"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { VidzeeLogo } from "./vidzee-logo";

const footerLinks = {
  product: [
    { label: "Features", href: "#" },
    { label: "Pricing", href: "#pricing" },
    { label: "Style Packs", href: "#" },
  ],
  company: [
    { label: "About", href: "#" },
    { label: "Help Center", href: "#" },
    { label: "Terms", href: "/terms" },
    { label: "Privacy", href: "/privacy" },
  ],
  social: [
    { label: "Instagram", href: "#" },
    { label: "TikTok", href: "#" },
    { label: "YouTube", href: "#" },
  ],
};

export function Footer(): ReactNode {
  return (
    <footer className="relative pt-38 mt-24 mx-2.5 max-[850px]:mx-0">
      {/* CTA card — floats above the footer */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 w-full max-w-5xl">
        <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl/15">
          <div
            className="absolute inset-0 bg-center bg-no-repeat brightness-150 blur scale-125"
            style={{ backgroundImage: "url(/BG.jpg)", backgroundSize: "150%" }}
            aria-hidden="true"
          />
          {/* Dark overlay for text contrast on gradient background */}
          <div className="absolute inset-0 bg-black/30" aria-hidden="true" />

          <div className="relative z-10 flex flex-col items-center text-center px-12 py-24 max-[850px]:px-6 max-[850px]:py-6 max-[850px]:pt-12">
            <h2 className="text-6xl max-[850px]:text-3xl text-white font-medium tracking-tight max-w-2xl mb-14 max-[850px]:mb-8">
              Ready to create your first listing video?
            </h2>

            <Link href="/signup">
              <span className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-white/90 text-neutral-900 rounded-xl text-base font-semibold transition-colors">
                Get Started Free
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer body — cyan/blue accent background, all text white */}
      <div className="bg-accent rounded-tr-[3rem] rounded-tl-[3rem] pt-96 pb-16 max-[850px]:pt-72">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-start justify-between gap-12 max-[850px]:flex-col max-[850px]:gap-10">
            {/* Logo */}
            <a
              href="/"
              className="flex items-center gap-2"
              aria-label="Vidzee home"
            >
              <VidzeeLogo className="w-8 h-8 text-white" />
              <span className="text-xl font-semibold text-white leading-0">
                Vidzee
              </span>
            </a>

            <nav
              className="flex gap-16 max-[850px]:gap-10 max-[850px]:flex-wrap"
              aria-label="Footer navigation"
            >
              <div>
                <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4">
                  Product
                </h3>
                <ul className="space-y-2">
                  {footerLinks.product.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-white hover:text-white/70 transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4">
                  Company
                </h3>
                <ul className="space-y-2">
                  {footerLinks.company.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-white hover:text-white/70 transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4">
                  Social
                </h3>
                <ul className="space-y-2">
                  {footerLinks.social.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-white hover:text-white/70 transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          </div>

          <div className="mt-16 pt-6 border-t border-white/20">
            <p className="text-sm text-white/60 text-center">
              &copy; {new Date().getFullYear()} Vidzee. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
