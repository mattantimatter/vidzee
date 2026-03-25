/**
 * GET  /api/support/messages?conversationId=xxx — get messages in a conversation
 * POST /api/support/messages — send a user message and get Kimi AI response
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const KIMI_SYSTEM_PROMPT = `You are Vidzee Support, an expert AI assistant for Vidzee — an AI-powered real estate video generation platform.

Your role is to help real estate agents and property marketers:
- Upload listing photos and create stunning property videos
- Navigate the storyboard, clip generation, and video editor
- Understand credits and billing (1 credit = 1 video up to 15 photos, 2 credits = 16-30 photos)
- Troubleshoot issues with video generation, music, or exports
- Understand the Stripe payment and credit system

CAPABILITIES YOU CAN HELP WITH:
- How to create a project and upload photos
- How the AI storyboard and scene generation works
- How to edit clips, reorder scenes, and adjust timing
- How background music generation works (AI-generated, matches video length)
- How to export and download the final video
- Credit purchases and pricing (Starter $19/1 credit, Pro $79/5 credits, Agent $149/10 credits)
- Portrait (9:16 for Reels/TikTok) vs Landscape (16:9 for YouTube/MLS) formats
- Troubleshooting stuck generations, failed clips, or render errors

ESCALATION RULES:
- If the user has a billing dispute, refund request, or account access issue → tell them you are escalating to a human agent and set escalate=true
- If the user is frustrated after 2+ failed resolution attempts → escalate
- If the issue requires account-level changes (credit adjustments, account deletion) → escalate
- For all other issues, resolve autonomously

TONE: Professional, warm, concise. No fluff. Get to the answer fast.

When you need to escalate, end your message with exactly: [ESCALATE]`;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

  const admin = createAdminClient();

  // Verify user owns this conversation
  const { data: convo } = await admin
    .from("support_conversations")
    .select("user_id")
    .eq("id", conversationId)
    .single();

  if (!convo || convo.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: messages } = await admin
    .from("support_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ messages: messages ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { conversationId: string; content: string };
  if (!body.conversationId || !body.content?.trim()) {
    return NextResponse.json({ error: "conversationId and content required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify user owns this conversation
  const { data: convo } = await admin
    .from("support_conversations")
    .select("*")
    .eq("id", body.conversationId)
    .single();

  if (!convo || convo.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Save user message
  await admin.from("support_messages").insert({
    conversation_id: body.conversationId,
    role: "user",
    content: body.content.trim(),
  });

  // Update conversation timestamp
  await admin.from("support_conversations").update({
    updated_at: new Date().toISOString(),
  }).eq("id", body.conversationId);

  // Get conversation history for context
  const { data: history } = await admin
    .from("support_messages")
    .select("role, content")
    .eq("conversation_id", body.conversationId)
    .order("created_at", { ascending: true })
    .limit(20);

  // Call Kimi API
  const kimi = new OpenAI({
    apiKey: process.env.KIMI_API_KEY,
    baseURL: process.env.KIMI_BASE_URL ?? "https://api.moonshot.cn/v1",
  });

  const messages = (history ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content as string,
  }));

  let aiContent = "";
  let shouldEscalate = false;

  try {
    const completion = await kimi.chat.completions.create({
      model: "moonshot-v1-8k",
      messages: [
        { role: "system", content: KIMI_SYSTEM_PROMPT },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    aiContent = completion.choices[0]?.message?.content ?? "I'm sorry, I couldn't process your request. Please try again.";

    // Check for escalation signal
    if (aiContent.includes("[ESCALATE]")) {
      shouldEscalate = true;
      aiContent = aiContent.replace("[ESCALATE]", "").trim();
    }
  } catch (err) {
    console.error("Kimi API error:", err);
    aiContent = "I'm having trouble connecting right now. Please try again in a moment, or our team will follow up with you shortly.";
    shouldEscalate = true;
  }

  // Save AI response
  await admin.from("support_messages").insert({
    conversation_id: body.conversationId,
    role: "assistant",
    content: aiContent,
  });

  // Handle escalation
  if (shouldEscalate && convo.status === "open") {
    await admin.from("support_conversations").update({
      status: "escalated",
      escalated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", body.conversationId);
  }

  return NextResponse.json({
    message: { role: "assistant", content: aiContent },
    escalated: shouldEscalate,
  });
}
