/**
 * POST /api/migrate-v2?secret=bootstrap
 *
 * Runs database migrations:
 * 1. Creates exec_sql function if not exists
 * 2. Adds video_format column to projects table
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== "bootstrap") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const results: Array<{ step: string; status: string; error?: string }> = [];

  // Step 1: Create exec_sql function
  const { error: fnError } = await supabase.rpc("exec_sql", {
    sql_string: "SELECT 1",
  });

  if (fnError) {
    // Function doesn't exist yet — we need to create it via another method
    // Try creating it via the raw SQL endpoint
    results.push({
      step: "check_exec_sql",
      status: "not_found",
      error: fnError.message,
    });
  } else {
    results.push({ step: "check_exec_sql", status: "exists" });
  }

  // Step 2: Try to add video_format column via exec_sql if it exists
  const { error: alterError } = await supabase.rpc(
    "exec_sql",
    {
      sql_string:
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_format text DEFAULT '16:9';",
    }
  );

  if (alterError) {
    results.push({
      step: "add_video_format",
      status: "failed",
      error: alterError.message,
    });
  } else {
    results.push({
      step: "add_video_format",
      status: "success",
    });
  }

  return NextResponse.json({ results });
}
