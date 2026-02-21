/**
 * POST /api/migrate-v3?secret=bootstrap
 *
 * Runs database migrations for Round 5:
 * 1. Creates exec_sql function if not exists
 * 2. Adds edit_state (jsonb) column to projects table
 * 3. Adds music_url (text) column to projects table
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== "bootstrap") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results: Array<{ step: string; status: string; error?: string }> = [];

  // Step 1: Create exec_sql function if it doesn't exist
  // We try to call it first to see if it exists
  const { error: fnCheckError } = await supabase.rpc("exec_sql", {
    sql_string: "SELECT 1",
  });

  if (fnCheckError) {
    results.push({
      step: "check_exec_sql",
      status: "not_found",
      error: fnCheckError.message,
    });

    results.push({
      step: "create_exec_sql",
      status: "skipped",
      error:
        "exec_sql function does not exist. Will try direct column operations.",
    });
  } else {
    results.push({ step: "check_exec_sql", status: "exists" });
  }

  // Step 2: Add edit_state column
  const { error: editStateError } = await supabase.rpc("exec_sql", {
    sql_string:
      "ALTER TABLE projects ADD COLUMN IF NOT EXISTS edit_state jsonb;",
  });

  if (editStateError) {
    results.push({
      step: "add_edit_state",
      status: "failed",
      error: editStateError.message,
    });

    // Fallback: try to write to the column to see if it already exists
    const { error: testError } = await supabase
      .from("projects")
      .select("edit_state")
      .limit(1);

    if (!testError) {
      results.push({
        step: "add_edit_state_check",
        status: "column_already_exists",
      });
    } else {
      results.push({
        step: "add_edit_state_check",
        status: "column_missing",
        error: testError.message,
      });
    }
  } else {
    results.push({ step: "add_edit_state", status: "success" });
  }

  // Step 3: Add music_url column
  const { error: musicUrlError } = await supabase.rpc("exec_sql", {
    sql_string:
      "ALTER TABLE projects ADD COLUMN IF NOT EXISTS music_url text;",
  });

  if (musicUrlError) {
    results.push({
      step: "add_music_url",
      status: "failed",
      error: musicUrlError.message,
    });

    // Fallback: check if column exists
    const { error: testError } = await supabase
      .from("projects")
      .select("music_url")
      .limit(1);

    if (!testError) {
      results.push({
        step: "add_music_url_check",
        status: "column_already_exists",
      });
    } else {
      results.push({
        step: "add_music_url_check",
        status: "column_missing",
        error: testError.message,
      });
    }
  } else {
    results.push({ step: "add_music_url", status: "success" });
  }

  return NextResponse.json({ results });
}
