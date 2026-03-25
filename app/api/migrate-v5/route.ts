/**
 * POST /api/migrate-v5 — Create support tables and api_usage_logs
 * Uses pg directly to run DDL (Supabase REST API doesn't support DDL)
 */
import { NextResponse } from "next/server";
import { Pool } from "pg";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "vidzee-admin-2026";

// Build the Postgres connection string from Supabase URL
function getConnectionString(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  // Extract project ref from URL: https://iiwsgivctcqlfqabytxp.supabase.co
  const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");
  // Supabase direct DB connection: postgres://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
  // The service role key is NOT the DB password. Use the SUPABASE_DB_PASSWORD if available.
  const dbPassword = process.env.SUPABASE_DB_PASSWORD ?? serviceKey;
  return `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
}

const SQL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS support_conversations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email text,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'escalated', 'resolved', 'closed')),
    subject text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    resolved_at timestamptz,
    escalated_at timestamptz,
    admin_notes text,
    satisfaction_rating integer CHECK (satisfaction_rating BETWEEN 1 AND 5)
  )`,
  `CREATE TABLE IF NOT EXISTS support_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid REFERENCES support_conversations(id) ON DELETE CASCADE NOT NULL,
    role text NOT NULL CHECK (role IN ('user', 'assistant', 'admin')),
    content text NOT NULL,
    created_at timestamptz DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS api_usage_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    provider text NOT NULL,
    endpoint text NOT NULL,
    success boolean NOT NULL DEFAULT true,
    duration_ms integer,
    cost_usd numeric(10, 6),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_support_conversations_user_id ON support_conversations(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_support_conversations_status ON support_conversations(status)`,
  `CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_id ON support_messages(conversation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at)`,
  `ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_conversations' AND policyname = 'Service role full access conversations') THEN
      CREATE POLICY "Service role full access conversations" ON support_conversations FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_messages' AND policyname = 'Service role full access messages') THEN
      CREATE POLICY "Service role full access messages" ON support_messages FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'api_usage_logs' AND policyname = 'Service role full access api_logs') THEN
      CREATE POLICY "Service role full access api_logs" ON api_usage_logs FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$`,
];

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connString = getConnectionString();
  const pool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });

  const results: { sql: string; ok: boolean; error?: string }[] = [];

  let client;
  try {
    client = await pool.connect();
  } catch (e: unknown) {
    await pool.end();
    return NextResponse.json({
      error: "Failed to connect to database",
      detail: String(e),
      connString: connString.replace(/:[^:@]+@/, ":***@"),
    }, { status: 500 });
  }

  try {
    for (const sql of SQL_STATEMENTS) {
      try {
        await client.query(sql);
        results.push({ sql: sql.slice(0, 60), ok: true });
      } catch (e: unknown) {
        const msg = String(e);
        if (msg.includes("already exists") || msg.includes("duplicate")) {
          results.push({ sql: sql.slice(0, 60), ok: true });
        } else {
          results.push({ sql: sql.slice(0, 60), ok: false, error: msg.slice(0, 200) });
        }
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({
    results,
    failed: failed.length,
    total: results.length,
    success: failed.length === 0,
  });
}
