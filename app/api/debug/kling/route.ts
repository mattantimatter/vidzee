/**
 * GET /api/debug/kling
 *
 * Debug endpoint to test Kling AI JWT generation and basic API connectivity.
 * Returns diagnostic information about env vars, JWT generation, and a test API call.
 */

import { SignJWT } from "jose";
import { NextResponse } from "next/server";

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      KLING_ACCESS_KEY_exists: !!process.env.KLING_ACCESS_KEY,
      KLING_ACCESS_KEY_length: process.env.KLING_ACCESS_KEY?.length ?? 0,
      KLING_ACCESS_KEY_prefix: process.env.KLING_ACCESS_KEY?.substring(0, 4) ?? "N/A",
      KLING_SECRET_KEY_exists: !!process.env.KLING_SECRET_KEY,
      KLING_SECRET_KEY_length: process.env.KLING_SECRET_KEY?.length ?? 0,
      KLING_SECRET_KEY_prefix: process.env.KLING_SECRET_KEY?.substring(0, 4) ?? "N/A",
    },
    jose_import: false,
    jwt_generation: false,
    jwt_token_preview: null as string | null,
    api_test: null as unknown,
  };

  // Test 1: jose import
  try {
    // SignJWT is already imported at top level — if we got here, import succeeded
    diagnostics.jose_import = true;
  } catch (err) {
    diagnostics.jose_import = false;
    diagnostics.jose_error = err instanceof Error ? err.message : String(err);
  }

  // Test 2: JWT generation
  let token: string | null = null;
  try {
    const accessKey = process.env.KLING_ACCESS_KEY;
    const secretKey = process.env.KLING_SECRET_KEY;

    if (!accessKey || !secretKey) {
      diagnostics.jwt_error = "Missing KLING_ACCESS_KEY or KLING_SECRET_KEY";
    } else {
      const now = Math.floor(Date.now() / 1000);
      const secret = new TextEncoder().encode(secretKey);

      token = await new SignJWT({
        iss: accessKey,
        exp: now + 1800,
        nbf: now - 5,
        iat: now,
      })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .sign(secret);

      diagnostics.jwt_generation = true;
      diagnostics.jwt_token_preview = token
        ? `${token.substring(0, 30)}...${token.substring(token.length - 10)}`
        : null;
      diagnostics.jwt_token_length = token?.length ?? 0;
    }
  } catch (err) {
    diagnostics.jwt_generation = false;
    diagnostics.jwt_error = err instanceof Error ? err.message : String(err);
    diagnostics.jwt_stack = err instanceof Error ? err.stack : undefined;
  }

  // Test 3: Kling API connectivity (simple GET to check auth)
  if (token) {
    try {
      // Try a lightweight API call — query a non-existent task to check auth
      const res = await fetch(
        "https://api-singapore.klingai.com/v1/videos/image2video/test-nonexistent-task",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }

      diagnostics.api_test = {
        status: res.status,
        statusText: res.statusText,
        response: parsed,
        auth_working: res.status !== 401 && res.status !== 403,
      };
    } catch (err) {
      diagnostics.api_test = {
        error: err instanceof Error ? err.message : String(err),
        auth_working: false,
      };
    }
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
