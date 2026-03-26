"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Handles the case where Supabase redirects the OAuth code to the Site URL (/)
 * instead of /auth/callback. This happens when the redirectTo URL doesn't match
 * the Supabase allowlist. We detect the ?code= param and forward to /auth/callback.
 */
export function OAuthCodeHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      // Forward to the proper callback handler
      router.replace(`/auth/callback?code=${encodeURIComponent(code)}`);
    }
  }, [searchParams, router]);

  return null;
}
