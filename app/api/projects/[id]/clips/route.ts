/**
 * POST /api/projects/[id]/clips
 *
 * Triggers Fal.ai (Kling Video) generation for each included storyboard scene.
 * Creates render rows and submits jobs to Fal.ai queue API.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { submitImageToVideo } from "@/lib/fal";
import { getMotionPrompt } from "@/lib/style-packs";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  console.log(`[Clips] ===== START clip generation for project ${projectId} =====`);
  console.log(`[Clips] ENV check: FAL_API_KEY exists = ${!!process.env.FAL_API_KEY}`);

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

  // Parse request body for aspect_ratio
  let aspectRatio: "16:9" | "9:16" = "16:9";
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === "object" && "aspect_ratio" in body) {
      aspectRatio = body.aspect_ratio === "9:16" ? "9:16" : "16:9";
    }
  } catch {
    // Default to 16:9
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

    // Use project video_format if available (column may not exist yet, defaults to 16:9)
    const projectFormat = (project as Record<string, unknown>).video_format as string | null | undefined;
    if (projectFormat) {
      aspectRatio = projectFormat === "9:16" ? "9:16" : "16:9";
    }
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
      request_id: string;
    }> = [];

    const errors: string[] = [];

    // Submit each scene to Fal.ai
    for (const scene of scenes) {
      const assetId = scene.asset_id as string;
      const asset = assetMap.get(assetId);

      if (!asset?.storage_path_original) {
        console.warn(`[Clips] Scene ${scene.id} has no asset or storage path, skipping`);
        continue;
      }

      // Create a signed URL for the image
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

      console.log(`[Clips] Submitting scene ${scene.id} to Fal.ai, image: ${imageUrl.substring(0, 80)}...`);

      const motionPrompt = getMotionPrompt(
        (scene.motion_template as string) ?? "push_in"
      );

      try {
        // Submit to Fal.ai
        console.log(`[Clips] Calling submitImageToVideo for scene ${scene.id}...`);
        const falResponse = await submitImageToVideo({
          image_url: imageUrl,
          prompt: motionPrompt,
          duration: "3",
          aspect_ratio: aspectRatio,
        });

        console.log(`[Clips] Fal response for scene ${scene.id}: request_id=${falResponse.request_id}`);

        if (!falResponse?.request_id) {
          console.error(`[Clips] Fal returned no request_id for scene ${scene.id}:`, JSON.stringify(falResponse));
          errors.push(`Scene ${scene.id}: Fal.ai API returned no request_id`);
          continue;
        }

        // Create render row
        console.log(`[Clips] Creating render row for scene ${scene.id}, request_id=${falResponse.request_id}`);
        const { data: render, error: renderError } = await admin
          .from("renders")
          .insert({
            project_id: projectId,
            type: "scene_clip",
            status: "running",
            provider: "fal",
            provider_job_id: falResponse.request_id,
            input_refs: {
              scene_id: scene.id as string,
              asset_id: assetId,
              image_url: imageUrl,
              video_format: aspectRatio,
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
          request_id: falResponse.request_id,
        });
      } catch (falErr) {
        const msg = falErr instanceof Error ? falErr.message : String(falErr);
        console.error(`[Clips] Fal.ai API error for scene ${scene.id}:`, msg, falErr);
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
