/**
 * Migration script for Vidzee v4
 * Creates credits and credit_transactions tables
 * Run with: node scripts/migrate-v4.mjs
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://iiwsgivctcqlfqabytxp.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpd3NnaXZjdGNxbGZxYWJ5dHhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ5MDkzOSwiZXhwIjoyMDg3MDY2OTM5fQ.dK8HRh29fdXd1XNqR57_5culzeovRIVpDerZdxS5srQ";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function checkTable(tableName) {
  const { error } = await supabase.from(tableName).select("id").limit(1);
  if (error && error.code === "PGRST205") return false; // table not found
  if (error && error.message.includes("relation") && error.message.includes("does not exist")) return false;
  return true;
}

async function main() {
  console.log("Vidzee v4 Migration Script");
  console.log("==========================");

  // Check existing tables
  const creditsExists = await checkTable("credits");
  const txExists = await checkTable("credit_transactions");

  console.log(`credits table: ${creditsExists ? "EXISTS" : "MISSING"}`);
  console.log(`credit_transactions table: ${txExists ? "EXISTS" : "MISSING"}`);

  // Check video_format column
  const { error: vfError } = await supabase
    .from("projects")
    .select("video_format")
    .limit(1);
  const vfExists = !vfError || !vfError.message.includes("video_format");
  console.log(`projects.video_format: ${vfExists ? "EXISTS" : "MISSING"}`);

  // Try to use exec_sql RPC (may not exist)
  const { error: rpcError } = await supabase.rpc("exec_sql", {
    sql_string: "SELECT 1",
  });
  if (rpcError) {
    console.log(`exec_sql RPC: NOT AVAILABLE (${rpcError.message})`);
    console.log("\nNote: exec_sql RPC function is not available.");
    console.log("Tables need to be created via Supabase dashboard SQL editor.");
    console.log("\nSQL to run in Supabase SQL Editor:");
    console.log("-----------------------------------");
    console.log(`
-- Step 1: Add video_format to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_format text DEFAULT '16:9';

-- Step 2: Create credits table
CREATE TABLE IF NOT EXISTS credits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  balance integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 3: Create credit_transactions table
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

-- Step 4: Enable RLS
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Step 5: RLS Policies
CREATE POLICY "Users can view own credits" ON credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own transactions" ON credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage credits" ON credits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage transactions" ON credit_transactions FOR ALL USING (true) WITH CHECK (true);
`);
    return;
  }

  // If exec_sql is available, run migrations
  const steps = [
    {
      name: "add_video_format_column",
      sql: "ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_format text DEFAULT '16:9';",
    },
    {
      name: "create_credits_table",
      sql: `CREATE TABLE IF NOT EXISTS credits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  balance integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);`,
    },
    {
      name: "create_credit_transactions_table",
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
      name: "enable_rls_credits",
      sql: "ALTER TABLE credits ENABLE ROW LEVEL SECURITY;",
    },
    {
      name: "enable_rls_credit_transactions",
      sql: "ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;",
    },
    {
      name: "rls_credits_select",
      sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credits' AND policyname = 'Users can view own credits') THEN CREATE POLICY "Users can view own credits" ON credits FOR SELECT USING (auth.uid() = user_id); END IF; END $$;`,
    },
    {
      name: "rls_credit_transactions_select",
      sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_transactions' AND policyname = 'Users can view own transactions') THEN CREATE POLICY "Users can view own transactions" ON credit_transactions FOR SELECT USING (auth.uid() = user_id); END IF; END $$;`,
    },
    {
      name: "rls_credits_service_all",
      sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credits' AND policyname = 'Service role can manage credits') THEN CREATE POLICY "Service role can manage credits" ON credits FOR ALL USING (true) WITH CHECK (true); END IF; END $$;`,
    },
    {
      name: "rls_transactions_service_all",
      sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_transactions' AND policyname = 'Service role can manage transactions') THEN CREATE POLICY "Service role can manage transactions" ON credit_transactions FOR ALL USING (true) WITH CHECK (true); END IF; END $$;`,
    },
  ];

  for (const step of steps) {
    const { error } = await supabase.rpc("exec_sql", { sql_string: step.sql });
    if (error) {
      console.log(`  ✗ ${step.name}: ${error.message}`);
    } else {
      console.log(`  ✓ ${step.name}`);
    }
  }

  // Grant free credits to existing users
  const { data: users, error: usersError } =
    await supabase.auth.admin.listUsers();
  if (usersError) {
    console.log(`  ✗ grant_free_credits: ${usersError.message}`);
  } else {
    let credited = 0;
    for (const user of users.users) {
      const { data: existing } = await supabase
        .from("credits")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!existing) {
        const { error: insertErr } = await supabase
          .from("credits")
          .insert({ user_id: user.id, balance: 2 });
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
    console.log(`  ✓ grant_free_credits: Credited ${credited} users`);
  }

  console.log("\nMigration complete!");
}

main().catch(console.error);
