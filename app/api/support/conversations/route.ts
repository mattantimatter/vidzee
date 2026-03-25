/**
 * GET  /api/support/conversations — get user's conversations
 * POST /api/support/conversations — create new conversation
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: conversations } = await admin
    .from("support_conversations")
    .select("id, status, subject, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ conversations: conversations ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { subject?: string };
  const admin = createAdminClient();

  const { data: convo, error } = await admin
    .from("support_conversations")
    .insert({
      user_id: user.id,
      user_email: user.email,
      subject: body.subject ?? "Support Request",
      status: "open",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversation: convo });
}
