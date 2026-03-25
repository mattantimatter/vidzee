/**
 * GET  /api/admin/support — list conversations
 * POST /api/admin/support — update conversation (add admin note, change status)
 * Protected by x-admin-secret header
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function isAdmin(request: Request): boolean {
  const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "vidzee-admin-2026";
  return request.headers.get("x-admin-secret") === ADMIN_SECRET;
}

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // open | escalated | resolved | all
  const conversationId = searchParams.get("id");

  const supabase = createAdminClient();

  if (conversationId) {
    // Get full conversation with messages
    const { data: convo } = await supabase
      .from("support_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    const { data: messages } = await supabase
      .from("support_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    return NextResponse.json({ conversation: convo, messages: messages ?? [] });
  }

  let query = supabase
    .from("support_conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: conversations } = await query;
  return NextResponse.json({ conversations: conversations ?? [] });
}

export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    id: string;
    status?: string;
    admin_notes?: string;
    admin_reply?: string;
  };

  const supabase = createAdminClient();

  // Update conversation
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) {
    updates.status = body.status;
    if (body.status === "resolved" || body.status === "closed") {
      updates.resolved_at = new Date().toISOString();
    }
  }
  if (body.admin_notes !== undefined) {
    updates.admin_notes = body.admin_notes;
  }

  await supabase.from("support_conversations").update(updates).eq("id", body.id);

  // If admin is sending a reply, add it as a message
  if (body.admin_reply) {
    await supabase.from("support_messages").insert({
      conversation_id: body.id,
      role: "admin",
      content: body.admin_reply,
    });
  }

  return NextResponse.json({ ok: true });
}
