/**
 * POST /api/migrate-v4?secret=bootstrap
 *
 * Runs database migrations for Round 6 using direct pg connection.
 * 1. Creates credits table (user credit balances)
 * 2. Creates credit_transactions table (purchase/usage history)
 * 3. Enables RLS and adds policies
 * 4. Adds video_format column to projects (if not exists)
 * 5. Grants 2 free credits to all existing users (test mode)
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
  const postgresUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

  const results: Array<{ step: string; status: string; error?: string }> = [];

  // ─── Approach 1: Use pg direct connection if available ─────────────────────
  if (postgresUrl) {
    try {
      const { Client } = await import("pg");
      const client = new Client({ connectionString: postgresUrl, ssl: { rejectUnauthorized: false } });
      await client.connect();

      const sqlStatements = [
        {
          step: "add_video_format_column",
          sql: "ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_format text DEFAULT '16:9';",
        },
        {
          step: "create_credits_table",
          sql: `CREATE TABLE IF NOT EXISTS credits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  balance integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);`,
        },
        {
          step: "create_credit_transactions_table",
          sql: `CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'bonus')),
  description text,
  stripe_session_id text,
  project_id uuid REFERENCES projects(id),
  created_at timestamptz DEFAULT now()
);`,
        },
        {
          step: "enable_rls_credits",
          sql: "ALTER TABLE credits ENABLE ROW LEVEL SECURITY;",
        },
        {
          step: "enable_rls_credit_transactions",
          sql: "ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;",
        },
        {
          step: "rls_credits_select",
          sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credits' AND policyname = 'Users can view own credits') THEN CREATE POLICY "Users can view own credits" ON credits FOR SELECT USING (auth.uid() = user_id); END IF; END $$;`,
        },
        {
          step: "rls_credit_transactions_select",
          sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_transactions' AND policyname = 'Users can view own transactions') THEN CREATE POLICY "Users can view own transactions" ON credit_transactions FOR SELECT USING (auth.uid() = user_id); END IF; END $$;`,
        },
        {
          step: "rls_credits_service_all",
          sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credits' AND policyname = 'Service role can manage credits') THEN CREATE POLICY "Service role can manage credits" ON credits FOR ALL USING (true) WITH CHECK (true); END IF; END $$;`,
        },
        {
          step: "rls_transactions_service_all",
          sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_transactions' AND policyname = 'Service role can manage transactions') THEN CREATE POLICY "Service role can manage transactions" ON credit_transactions FOR ALL USING (true) WITH CHECK (true); END IF; END $$;`,
        },
      ];

      for (const { step, sql } of sqlStatements) {
        try {
          await client.query(sql);
          results.push({ step, status: "success" });
        } catch (err) {
          results.push({ step, status: "failed", error: err instanceof Error ? err.message : String(err) });
        }
      }

      await client.end();
    } catch (err) {
      results.push({ step: "pg_connection", status: "failed", error: err instanceof Error ? err.message : String(err) });
    }
  } else {
    results.push({
      step: "pg_connection",
      status: "skipped",
      error: "No POSTGRES_URL or DATABASE_URL env var set. Add it to Vercel env vars.",
    });
  }

  // ─── Approach 2: Grant free credits via Supabase admin client ─────────────
  // This works even without DDL since it uses the REST API
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Check if credits table now exists
  const { error: tableCheck } = await supabase.from("credits").select("id").limit(1);
  const creditsTableExists = !tableCheck || !tableCheck.message?.includes("does not exist");

  if (creditsTableExists) {
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      results.push({ step: "grant_free_credits", status: "failed", error: usersError.message });
    } else {
      let credited = 0;
      for (const user of users.users) {
        const { data: existing } = await supabase
          .from("credits")
          .select("id, balance")
          .eq("user_id", user.id)
          .single();

        if (!existing) {
          const { error: insertErr } = await supabase.from("credits").insert({
            user_id: user.id,
            balance: 2,
          });
          if (!insertErr) {
            await supabase.from("credit_transactions").insert({
              user_id: user.id,
              amount: 2,
              type: "bonus",
              description: "Welcome bonus — 2 free credits",
            });
            credited++;
          }
        }
      }
      results.push({ step: "grant_free_credits", status: "success", error: `Credited ${credited} users` });
    }
  } else {
    results.push({
      step: "grant_free_credits",
      status: "skipped",
      error: "Credits table not yet created. Run DDL migrations first.",
    });
  }

  // ─── Return SQL for manual execution if needed ─────────────────────────────
  const manualSQL = `
-- Run this in Supabase SQL Editor if automatic migration failed:
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_format text DEFAULT '16:9';

CREATE TABLE IF NOT EXISTS credits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  balance integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'bonus')),
  description text,
  stripe_session_id text,
  project_id uuid REFERENCES projects(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits" ON credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own transactions" ON credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage credits" ON credits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage transactions" ON credit_transactions FOR ALL USING (true) WITH CHECK (true);
`.trim();

  return NextResponse.json({ results, manualSQL });
}
