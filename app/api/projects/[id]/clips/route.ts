/**
 * POST /api/projects/[id]/clips
 *
 * Triggers Kling AI video generation for each included storyboard scene.
 * Creates render rows and submits jobs to Kling.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createImageToVideoTask } from "@/lib/kling";
import { getMotionPrompt } from "@/lib/style-packs";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  console.log(`[Clips] ===== START clip generation for project ${projectId} =====`);
  console.log(`[Clips] ENV check: KLING_ACCESS_KEY exists = ${!!process.env.KLING_ACCESS_KEY}, KLING_SECRET_KEY exists = ${!!process.env.KLING_SECRET_KEY}`);
  console.log(`[Clips] ENV check: KLING_ACCESS_KEY length = ${process.env.KLING_ACCESS_KEY?.length ?? 0}, KLING_SECRET_KEY length = ${process.env.KLING_SECRET_KEY?.length ?? 0}`);

  // Verify user auth
  let supabase;
  try {
    supabase = await createClient();
    console.log("[Clips] Supabase client created successfully");
  } catch (err) {
    console.error("[Clips] FATAL: Failed to create Supabase client:", err);
    return NextResponse.json({ error: "Failed to create auth client" }, { status: 500 });
  }

  let user;
  try {
    const { data: { user: u } } = await supabase.auth.getUser();
    user = u;
    console.log(`[Clips] Auth check: user = ${user?.id ?? "null"}`);
  } catch (err) {
    console.error("[Clips] FATAL: Failed to get user:", err);
    return NextResponse.json({ error: "Auth check failed" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
    console.log("[Clips] Admin client created successfully");
  } catch (err) {
    console.error("[Clips] FATAL: Failed to create admin client:", err);
    return NextResponse.json({ error: "Failed to create admin client" }, { status: 500 });
  }

  // Verify project ownership
  let project;
  try {
    const { data, error: projectError } = await admin
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (projectError || !data) {
      console.error("[Clips] Project not found:", projectError);
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    project = data;
    console.log(`[Clips] Project found: ${project.title}`);
  } catch (err) {
    console.error("[Clips] FATAL: Project query failed:", err);
    return NextResponse.json({ error: "Project query failed" }, { status: 500 });
  }

  // Get included scenes
  let scenes;
  try {
    const { data, error: scenesError } = await admin
      .from("storyboard_scenes")
      .select("*")
      .eq("project_id", projectId)
      .eq("include", true)
      .order("scene_order");

    if (scenesError) {
      console.error("[Clips] Failed to fetch scenes:", scenesError);
      return NextResponse.json(
        { error: `Failed to fetch scenes: ${scenesError.message}` },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "No included scenes found. Please generate a storyboard first." },
        { status: 400 }
      );
    }

    scenes = data;
    console.log(`[Clips] Found ${scenes.length} included scenes for project ${projectId}`);
  } catch (err) {
    console.error("[Clips] FATAL: Scenes query failed:", err);
    return NextResponse.json({ error: "Scenes query failed" }, { status: 500 });
  }

  // Fetch all assets for this project separately
  let assetMap: Map<string, Record<string, unknown>>;
  try {
    const assetIds = scenes
      .map((s: Record<string, unknown>) => s.asset_id as string)
      .filter(Boolean);

    const { data: assets, error: assetsError } = await admin
      .from("assets")
      .select("*")
      .in("id", assetIds);

    if (assetsError) {
      console.error("[Clips] Failed to fetch assets:", assetsError);
      return NextResponse.json(
        { error: `Failed to fetch assets: ${assetsError.message}` },
        { status: 500 }
      );
    }

    assetMap = new Map<string, Record<string, unknown>>();
    if (assets) {
      for (const asset of assets) {
        assetMap.set(asset.id as string, asset as Record<string, unknown>);
      }
    }
    console.log(`[Clips] Loaded ${assetMap.size} assets for ${scenes.length} scenes`);
  } catch (err) {
    console.error("[Clips] FATAL: Assets query failed:", err);
    return NextResponse.json({ error: "Assets query failed" }, { status: 500 });
  }

  try {
    // Update project status
    await admin
      .from("projects")
      .update({
        status: "clips_queued",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    const renderResults: Array<{
      scene_id: string;
      render_id: string;
      task_id: string;
    }> = [];

    const errors: string[] = [];

    // Submit each scene to Kling AI
    for (const scene of scenes) {
      const assetId = scene.asset_id as string;
      const asset = assetMap.get(assetId);

      if (!asset?.storage_path_original) {
        console.warn(`[Clips] Scene ${scene.id} has no asset or storage path, skipping`);
        continue;
      }

      // Always create a signed URL — skip the HEAD check entirely.
      // Signed URLs are more reliable for external API consumption (Kling).
      let imageUrl: string;
      try {
        const { data: signedData, error: signedError } = await admin.storage
          .from("photos-original")
          .createSignedUrl(asset.storage_path_original as string, 3600);

        if (signedError || !signedData?.signedUrl) {
          console.error(`[Clips] Failed to create signed URL for scene ${scene.id}:`, signedError);
          errors.push(`Scene ${scene.id}: Could not get accessible image URL`);
          continue;
        }
        imageUrl = signedData.signedUrl;
        console.log(`[Clips] Scene ${scene.id} signed URL: ${imageUrl.substring(0, 100)}...`);
      } catch (urlErr) {
        console.error(`[Clips] FATAL: URL generation failed for scene ${scene.id}:`, urlErr);
        errors.push(`Scene ${scene.id}: URL generation failed`);
        continue;
      }

      console.log(`[Clips] Submitting scene ${scene.id} to Kling, image: ${imageUrl.substring(0, 80)}...`);

      const motionPrompt = getMotionPrompt(
        (scene.motion_template as string) ?? "push_in"
      );

      try {
        // Submit to Kling AI
        console.log(`[Clips] Calling createImageToVideoTask for scene ${scene.id}...`);
        const klingResponse = await createImageToVideoTask({
          model_name: "kling-v2-6",
          image: imageUrl,
          prompt: motionPrompt,
          negative_prompt:
            "blurry, distorted, low quality, watermark, text overlay",
          duration: "5",
          mode: "std",
        });

        console.log(`[Clips] Kling response for scene ${scene.id}:`, JSON.stringify(klingResponse).substring(0, 300));

        if (!klingResponse?.data?.task_id) {
          console.error(`[Clips] Kling returned no task_id for scene ${scene.id}:`, JSON.stringify(klingResponse));
          errors.push(`Scene ${scene.id}: Kling API returned no task_id`);
          continue;
        }

        // Create render row
        console.log(`[Clips] Creating render row for scene ${scene.id}, task_id=${klingResponse.data.task_id}`);
        const { data: render, error: renderError } = await admin
          .from("renders")
          .insert({
            project_id: projectId,
            type: "scene_clip",
            status: "running",
            provider: "kling",
            provider_job_id: klingResponse.data.task_id,
            input_refs: {
              scene_id: scene.id as string,
              asset_id: assetId,
              image_url: imageUrl,
            },
          })
          .select()
          .single();

        if (renderError || !render) {
          console.error("[Clips] Failed to create render row:", renderError);
          errors.push(`Scene ${scene.id}: Failed to save render record`);
          continue;
        }

        console.log(`[Clips] Render row created: ${render.id}`);

        renderResults.push({
          scene_id: scene.id as string,
          render_id: render.id as string,
          task_id: klingResponse.data.task_id,
        });
      } catch (klingErr) {
        const msg = klingErr instanceof Error ? klingErr.message : String(klingErr);
        console.error(`[Clips] Kling API error for scene ${scene.id}:`, msg, klingErr);
        errors.push(`Scene ${scene.id}: ${msg}`);
      }
    }

    // Update project status
    const finalStatus = renderResults.length > 0 ? "clips_generating" : "failed";
    await admin
      .from("projects")
      .update({
        status: finalStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    console.log(`[Clips] ===== DONE: Submitted ${renderResults.length} scenes, ${errors.length} errors =====`);

    return NextResponse.json({
      success: renderResults.length > 0,
      submitted: renderResults.length,
      renders: renderResults,
      ...(errors.length > 0 && { errors }),
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Clip generation failed";
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error("[Clips] FATAL generation error:", errorMessage);
    console.error("[Clips] Stack:", errorStack);

    try {
      await admin
        .from("projects")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
    } catch (updateErr) {
      console.error("[Clips] Failed to update project status to failed:", updateErr);
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
