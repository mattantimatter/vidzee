/**
 * Migration script to add edit_state and music_url columns to projects table
 * Run with: node scripts/run-migration.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://iiwsgivctcqlfqabytxp.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpd3NnaXZjdGNxbGZxYWJ5dHhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ5MDkzOSwiZXhwIjoyMDg3MDY2OTM5fQ.dK8HRh29fdXd1XNqR57_5culzeovRIVpDerZdxS5srQ";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== Running Round 5 Migration ===\n");

  // Method 1: Try exec_sql RPC
  console.log("Trying exec_sql RPC...");
  const { data: d1, error: e1 } = await supabase.rpc("exec_sql", {
    sql_string:
      "ALTER TABLE projects ADD COLUMN IF NOT EXISTS edit_state jsonb; ALTER TABLE projects ADD COLUMN IF NOT EXISTS music_url text;",
  });

  if (!e1) {
    console.log("✅ exec_sql succeeded:", d1);
    return;
  }
  console.log("  exec_sql not available:", e1.message);

  // Method 2: Check if columns already exist
  console.log("\nChecking if columns already exist...");
  const { data: d2, error: e2 } = await supabase
    .from("projects")
    .select("id, edit_state, music_url")
    .limit(0);

  if (!e2) {
    console.log("✅ Columns already exist! No migration needed.");
    return;
  }
  console.log("  Columns missing:", e2.message);

  // Method 3: Try using the Supabase REST API with a raw query
  console.log("\nTrying Supabase REST API raw query...");
  const endpoints = [
    `${SUPABASE_URL}/pg/query`,
    `${SUPABASE_URL}/sql`,
    `${SUPABASE_URL}/rest/v1/rpc/query`,
  ];

  const sql =
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS edit_state jsonb; ALTER TABLE projects ADD COLUMN IF NOT EXISTS music_url text;";

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      });
      const text = await res.text();
      if (res.ok) {
        console.log(`✅ ${endpoint} succeeded:`, text);
        return;
      }
      console.log(`  ${endpoint}: ${res.status} ${text.substring(0, 100)}`);
    } catch (e) {
      console.log(`  ${endpoint}: ERROR ${e.message}`);
    }
  }

  console.log("\n❌ All methods failed.");
  console.log(
    "\nPlease run this SQL manually in the Supabase SQL Editor (https://supabase.com/dashboard/project/iiwsgivctcqlfqabytxp/sql):"
  );
  console.log(
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS edit_state jsonb;"
  );
  console.log(
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS music_url text;"
  );
}

main().catch(console.error);
