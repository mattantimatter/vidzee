import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const SQL_STATEMENTS = [
  // Support conversations
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
  // Support messages
  `CREATE TABLE IF NOT EXISTS support_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid REFERENCES support_conversations(id) ON DELETE CASCADE NOT NULL,
    role text NOT NULL CHECK (role IN ('user', 'assistant', 'admin')),
    content text NOT NULL,
    created_at timestamptz DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
  )`,
  // API usage logs
  `CREATE TABLE IF NOT EXISTS api_usage_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
    provider text NOT NULL,
    endpoint text NOT NULL,
    status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout')),
    duration_ms integer,
    cost_usd numeric(10, 6),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
  )`,
  // Admin users allowlist
  `CREATE TABLE IF NOT EXISTS admin_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
  )`,
  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_support_conversations_user_id ON support_conversations(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_support_conversations_status ON support_conversations(status)`,
  `CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_id ON support_messages(conversation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id ON api_usage_logs(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at)`,
  // RLS
  `ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY`,
  // Policies
  `DROP POLICY IF EXISTS "Users can view own conversations" ON support_conversations`,
  `CREATE POLICY "Users can view own conversations" ON support_conversations FOR SELECT USING (auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can create conversations" ON support_conversations`,
  `CREATE POLICY "Users can create conversations" ON support_conversations FOR INSERT WITH CHECK (auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can update own conversations" ON support_conversations`,
  `CREATE POLICY "Users can update own conversations" ON support_conversations FOR UPDATE USING (auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can view own messages" ON support_messages`,
  `CREATE POLICY "Users can view own messages" ON support_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM support_conversations WHERE id = support_messages.conversation_id AND user_id = auth.uid())
  )`,
  `DROP POLICY IF EXISTS "Users can create messages" ON support_messages`,
  `CREATE POLICY "Users can create messages" ON support_messages FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM support_conversations WHERE id = support_messages.conversation_id AND user_id = auth.uid())
  )`,
  `DROP POLICY IF EXISTS "Service role full access conversations" ON support_conversations`,
  `CREATE POLICY "Service role full access conversations" ON support_conversations FOR ALL USING (true) WITH CHECK (true)`,
  `DROP POLICY IF EXISTS "Service role full access messages" ON support_messages`,
  `CREATE POLICY "Service role full access messages" ON support_messages FOR ALL USING (true) WITH CHECK (true)`,
  `DROP POLICY IF EXISTS "Service role full access api_logs" ON api_usage_logs`,
  `CREATE POLICY "Service role full access api_logs" ON api_usage_logs FOR ALL USING (true) WITH CHECK (true)`,
  `DROP POLICY IF EXISTS "Service role full access admin_users" ON admin_users`,
  `CREATE POLICY "Service role full access admin_users" ON admin_users FOR ALL USING (true) WITH CHECK (true)`,
];

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (secret !== (process.env.ADMIN_SECRET ?? "vidzee-admin-2026")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const results: { sql: string; ok: boolean; error?: string }[] = [];

  for (const sql of SQL_STATEMENTS) {
    const { error } = await supabase.rpc("exec_sql", { sql_string: sql }).single();
    if (error && !error.message.includes("already exists")) {
      results.push({ sql: sql.slice(0, 60), ok: false, error: error.message });
    } else {
      results.push({ sql: sql.slice(0, 60), ok: true });
    }
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({ results, failed: failed.length, total: results.length });
}
