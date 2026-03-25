"use client";

import { createClient } from "@/lib/supabase/client";
import { VidzeeLogo } from "@/components/vidzee-logo";
import { Loader2, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

const ADMIN_EMAIL = "matt@antimatter.ai";
const ease = [0.23, 1, 0.32, 1] as const;

export default function AdminLoginPage(): ReactNode {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    if (searchParams.get("error") === "access_denied") {
      setError("Access denied. This portal is restricted to authorized administrators.");
    }
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Enforce admin-only email before even hitting Supabase
    if (email.toLowerCase().trim() !== ADMIN_EMAIL) {
      setError("Access denied. This portal is restricted to authorized administrators.");
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-24 bg-neutral-950">
      <motion.div
        initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <VidzeeLogo className="w-7 h-7 text-accent" />
            <span className="text-lg font-semibold text-white">Vidzee</span>
          </div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-accent" />
            <h1 className="text-xl font-semibold text-white tracking-tight">
              Admin Portal
            </h1>
          </div>
          <p className="text-sm text-neutral-400">
            Restricted access — authorized personnel only
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="matt@antimatter.ai"
              required
              autoComplete="username"
              className="w-full px-4 py-3 rounded-xl border border-neutral-700 bg-neutral-900 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-xl border border-neutral-700 bg-neutral-900 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Sign in to Admin
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-neutral-600 mt-8">
          Not an admin?{" "}
          <a href="/login" className="text-neutral-400 hover:text-white transition-colors">
            Go to app login
          </a>
        </p>
      </motion.div>
    </main>
  );
}
