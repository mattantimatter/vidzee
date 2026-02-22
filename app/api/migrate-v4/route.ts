/**
 * POST /api/migrate-v4?secret=bootstrap
 *
 * Runs database migrations for Round 6:
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
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results: Array<{ step: string; status: string; error?: string }> = [];

  // Helper: run SQL via exec_sql RPC
  async function runSQL(step: string, sql: string) {
    const { error } = await supabase.rpc("exec_sql", { sql_string: sql });
    if (error) {
      results.push({ step, status: "failed", error: error.message });
      return false;
    }
    results.push({ step, status: "success" });
    return true;
  }

  // Step 1: Add video_format column to projects
  await runSQL(
    "add_video_format_column",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_format text DEFAULT '16:9';"
  );

  // Step 2: Create credits table
  await runSQL(
    "create_credits_table",
    `CREATE TABLE IF NOT EXISTS credits (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid REFERENCES auth.users(id) NOT NULL,
      balance integer DEFAULT 0 NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );`
  );

  // Step 3: Create credit_transactions table
  await runSQL(
    "create_credit_transactions_table",
    `CREATE TABLE IF NOT EXISTS credit_transactions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid REFERENCES auth.users(id) NOT NULL,
      amount integer NOT NULL,
      type text NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'bonus')),
      description text,
      stripe_session_id text,
      project_id uuid REFERENCES projects(id),
      created_at timestamptz DEFAULT now()
    );`
  );

  // Step 4: Enable RLS on credits
  await runSQL(
    "enable_rls_credits",
    "ALTER TABLE credits ENABLE ROW LEVEL SECURITY;"
  );

  // Step 5: Enable RLS on credit_transactions
  await runSQL(
    "enable_rls_credit_transactions",
    "ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;"
  );

  // Step 6: RLS policy for credits SELECT
  await runSQL(
    "rls_credits_select",
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'credits' AND policyname = 'Users can view own credits'
      ) THEN
        CREATE POLICY "Users can view own credits" ON credits FOR SELECT USING (auth.uid() = user_id);
      END IF;
    END $$;`
  );

  // Step 7: RLS policy for credit_transactions SELECT
  await runSQL(
    "rls_credit_transactions_select",
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'credit_transactions' AND policyname = 'Users can view own transactions'
      ) THEN
        CREATE POLICY "Users can view own transactions" ON credit_transactions FOR SELECT USING (auth.uid() = user_id);
      END IF;
    END $$;`
  );

  // Step 8: Service role bypass policies
  await runSQL(
    "rls_credits_service_all",
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'credits' AND policyname = 'Service role can manage credits'
      ) THEN
        CREATE POLICY "Service role can manage credits" ON credits FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END $$;`
  );

  await runSQL(
    "rls_transactions_service_all",
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'credit_transactions' AND policyname = 'Service role can manage transactions'
      ) THEN
        CREATE POLICY "Service role can manage transactions" ON credit_transactions FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END $$;`
  );

  // Step 9: Grant 2 free credits to all existing users (test mode bonus)
  // Get all users from auth.users
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    results.push({ step: "grant_free_credits", status: "failed", error: usersError.message });
  } else {
    let credited = 0;
    for (const user of users.users) {
      // Check if user already has a credits row
      const { data: existing } = await supabase
        .from("credits")
        .select("id, balance")
        .eq("user_id", user.id)
        .single();

      if (!existing) {
        // Create new credits row with 2 free credits
        const { error: insertErr } = await supabase.from("credits").insert({
          user_id: user.id,
          balance: 2,
        });
        if (!insertErr) {
          // Log the bonus transaction
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

  return NextResponse.json({ results });
}
