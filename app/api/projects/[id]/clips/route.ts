/**
 * POST /api/projects/[id]/clips
 *
 * Per-scene Grok Imagine Video (fal.ai) image-to-video for each storyboard scene.
 * Queue jobs; poll via /clips/poll. FAL_KEY or FAL_API_KEY server-side only.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { submitSceneClipToGrok } from "@/lib/scene-clip-submit";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const hasKey = !!(process.env.FAL_KEY ?? process.env.FAL_API_KEY);
  console.log(
    `[Clips] START project=${projectId} fal_key_configured=${hasKey} (Grok Imagine Video / fal)`
  );

  let supabase;
  try {
    supabase = await createClient();
  } catch (err) {
    console.error("[Clips] Supabase client error:", err);
    return NextResponse.json({ error: "Failed to create auth client" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.error("[Clips] Admin client error:", err);
    return NextResponse.json({ error: "Failed to create admin client" }, { status: 500 });
  }

  let aspectRatio: "16:9" | "9:16" = "16:9";
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === "object" && body.aspect_ratio === "9:16") {
      aspectRatio = "9:16";
    }
  } catch {
    /* default */
  }

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const projectFormat = (project as Record<string, unknown>).video_format as
    | string
    | null
    | undefined;
  if (projectFormat === "9:16") aspectRatio = "9:16";

  const { data: scenes, error: scenesError } = await admin
    .from("storyboard_scenes")
    .select("*")
    .eq("project_id", projectId)
    .eq("include", true)
    .order("scene_order");

  if (scenesError) {
    return NextResponse.json(
      { error: `Failed to fetch scenes: ${scenesError.message}` },
      { status: 500 }
    );
  }

  if (!scenes?.length) {
    return NextResponse.json(
      { error: "No included scenes found. Generate a storyboard first." },
      { status: 400 }
    );
  }

  const assetIds = scenes
    .map((s: Record<string, unknown>) => s.asset_id as string)
    .filter(Boolean);

  const { data: assets, error: assetsError } = await admin
    .from("assets")
    .select("*")
    .in("id", assetIds);

  if (assetsError) {
    return NextResponse.json(
      { error: `Failed to fetch assets: ${assetsError.message}` },
      { status: 500 }
    );
  }

  const assetMap = new Map<string, Record<string, unknown>>();
  for (const a of assets ?? []) {
    assetMap.set(a.id as string, a as Record<string, unknown>);
  }

  await admin
    .from("projects")
    .update({ status: "clips_queued", updated_at: new Date().toISOString() })
    .eq("id", projectId);

  const renderResults: Array<{
    scene_id: string;
    render_id: string;
    request_id: string;
  }> = [];
  const errors: string[] = [];

  for (const scene of scenes) {
    const assetId = scene.asset_id as string;
    const asset = assetMap.get(assetId);
    if (!asset?.storage_path_original) {
      errors.push(`Scene ${scene.id}: missing asset or storage path`);
      continue;
    }

    const roomType = (asset.room_type as string) || "interior";

    try {
      const submitted = await submitSceneClipToGrok({
        admin,
        projectId,
        sceneId: scene.id as string,
        assetId,
        storagePathOriginal: asset.storage_path_original as string,
        videoFormat: aspectRatio,
        roomType,
        motionTemplate: scene.motion_template as string | null,
        tagConfidence: null,
        conservativeRetry: false,
      });

      const { data: render, error: renderError } = await admin
        .from("renders")
        .insert({
          project_id: projectId,
          type: "scene_clip",
          status: "running",
          provider: "grok_imagine_fal",
          provider_job_id: submitted.request_id,
          input_refs: submitted.input_refs,
        })
        .select()
        .single();

      if (renderError || !render) {
        console.error("[Clips] render insert:", renderError);
        errors.push(`Scene ${scene.id}: failed to save render`);
        continue;
      }

      console.log(
        `[Clips] Grok Imagine queued scene=${scene.id} request_id=${submitted.request_id}`
      );

      renderResults.push({
        scene_id: scene.id as string,
        render_id: render.id as string,
        request_id: submitted.request_id,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[Clips] scene ${scene.id}:`, msg);
      errors.push(`Scene ${scene.id}: ${msg}`);
    }
  }

  const finalStatus = renderResults.length > 0 ? "clips_generating" : "failed";
  await admin
    .from("projects")
    .update({ status: finalStatus, updated_at: new Date().toISOString() })
    .eq("id", projectId);

  return NextResponse.json({
    success: renderResults.length > 0,
    submitted: renderResults.length,
    renders: renderResults,
    ...(errors.length > 0 && { errors }),
  });
}
