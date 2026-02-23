/**
 * POST /api/migrate-v4?secret=bootstrap
 *
 * Simplified migration for Round 6:
 * - Credits system now uses user metadata (no new tables needed)
 * - Only migration needed: add video_format column to projects table
 *
 * Since we can't run DDL via the REST API without exec_sql,
 * this route returns the SQL to run manually plus checks table status.
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

  const results: Array<{ step: string; status: string; note?: string }> = [];

  // Check if video_format column exists on projects
  const { error: vfError } = await supabase
    .from("projects")
    .select("video_format")
    .limit(1);

  const videoFormatExists = !vfError || !vfError.message?.includes("video_format");

  results.push({
    step: "check_video_format_column",
    status: videoFormatExists ? "exists" : "missing",
    note: videoFormatExists
      ? "video_format column already exists on projects table"
      : "Need to add video_format column — run manual SQL below",
  });

  // Credits system: check if user metadata approach is working
  // (no new tables needed — credits stored in auth.users.user_metadata)
  results.push({
    step: "credits_system",
    status: "metadata_based",
    note: "Credits stored in auth.users.user_metadata.credits — no DB tables needed",
  });

  // Grant welcome credits to all existing users via metadata
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    results.push({ step: "grant_welcome_credits", status: "failed", note: usersError.message });
  } else {
    let credited = 0;
    for (const user of users.users) {
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      if (typeof meta.credits === "undefined") {
        const welcomeTransaction = {
          id: crypto.randomUUID(),
          amount: 2,
          type: "bonus",
          description: "Welcome bonus — 2 free credits",
          created_at: new Date().toISOString(),
        };
        const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...meta,
            credits: 2,
            credit_history: [welcomeTransaction],
          },
        });
        if (!updateErr) credited++;
      }
    }
    results.push({
      step: "grant_welcome_credits",
      status: "success",
      note: `Granted 2 welcome credits to ${credited} new users`,
    });
  }

  const manualSQL = videoFormatExists
    ? null
    : `-- Run this in Supabase SQL Editor to add video_format column:
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_format text DEFAULT '16:9';`;

  return NextResponse.json({ results, manualSQL });
}
