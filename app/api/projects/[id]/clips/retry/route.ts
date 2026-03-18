/**
 * POST /api/projects/[id]/clips/retry
 * Body: { render_id: string }
 * Re-submits a failed scene_clip to Grok Imagine Video (conservative prompt).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resubmitSceneClipFromRender } from "@/lib/scene-clip-submit";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    render_id?: string;
  };
  const renderId = body.render_id;
  if (!renderId || typeof renderId !== "string") {
    return NextResponse.json({ error: "render_id required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: render, error } = await admin
    .from("renders")
    .select("*")
    .eq("id", renderId)
    .eq("project_id", projectId)
    .eq("type", "scene_clip")
    .single();

  if (error || !render) {
    return NextResponse.json({ error: "Render not found" }, { status: 404 });
  }

  const { data: project } = await admin
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .single();
  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (render.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed scene clips can be retried" },
      { status: 400 }
    );
  }

  try {
    const { request_id, input_refs } = await resubmitSceneClipFromRender(
      admin,
      {
        id: render.id as string,
        project_id: projectId,
        input_refs: render.input_refs,
      },
      {
        conservativeRetry: true,
        effectiveMotionOverride: "push_in",
        markAutoRetryUsed: false,
      }
    );

    const refs = input_refs as Record<string, unknown>;
    refs.auto_conservative_retry_used = false;
    refs.manual_retry_count =
      Number((render.input_refs as Record<string, unknown>)?.manual_retry_count ?? 0) + 1;

    await admin
      .from("renders")
      .update({
        status: "running",
        provider_job_id: request_id,
        provider: "grok_imagine_fal",
        error: null,
        output_path: null,
        input_refs: refs,
        updated_at: new Date().toISOString(),
      })
      .eq("id", renderId);

    await admin
      .from("projects")
      .update({ status: "clips_generating", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    return NextResponse.json({
      ok: true,
      request_id,
      render_id: renderId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Clips retry]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
