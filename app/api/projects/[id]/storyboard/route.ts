/**
 * POST /api/projects/[id]/storyboard
 *
 * Generates an AI storyboard using OpenAI gpt-4.1-mini (with Kimi fallback).
 * - Tags rooms in uploaded photos
 * - Creates ordered storyboard scenes
 * - Saves to storyboard_scenes table
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateStoryboard } from "@/lib/kimi";
import { CUT_LENGTH_RANGES, type CutLength } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  // Verify user auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body
  const body = (await request.json()) as {
    style_pack_id?: string;
    cut_length?: CutLength;
  };
  const stylePackId = body.style_pack_id ?? "modern-clean";
  // cut_length is auto-calculated from photo count (see below after fetching assets)
  // If explicitly provided, use it; otherwise auto-calculate
  const explicitCutLength: CutLength | undefined = body.cut_length;

  const admin = createAdminClient();

  // Verify project ownership
  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    console.error("[Storyboard] Project not found:", projectError);
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Get assets
  const { data: assets, error: assetsError } = await admin
    .from("assets")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at");

  if (assetsError || !assets || assets.length === 0) {
    console.error("[Storyboard] No assets found:", assetsError);
    return NextResponse.json(
      { error: "No assets found for project" },
      { status: 400 }
    );
  }

  // Auto-calculate cut_length from photo count if not explicitly provided
  // 10-14 photos → short, 15-20 → medium, 21-30 → long
  function autoCutLength(photoCount: number): CutLength {
    if (photoCount <= 14) return "short";
    if (photoCount <= 20) return "medium";
    return "long";
  }
  const cutLength: CutLength = explicitCutLength ?? autoCutLength(assets.length);
  const sceneRange = CUT_LENGTH_RANGES[cutLength] ?? CUT_LENGTH_RANGES.medium;

  console.log(`[Storyboard] Starting generation for project ${projectId}, ${assets.length} assets, cut_length=${cutLength} (${explicitCutLength ? "explicit" : "auto"})`);

  try {
    // Update project status
    await admin
      .from("projects")
      .update({
        status: "tagging",
        style_pack_id: stylePackId,
        cut_length: cutLength,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    // Build asset URLs for AI
    const assetInputs = assets.map((asset) => {
      const { data: urlData } = admin.storage
        .from("photos-original")
        .getPublicUrl(asset.storage_path_original ?? "");
      return {
        id: asset.id as string,
        room_type: asset.room_type as string | null,
        storage_url: urlData.publicUrl,
      };
    });

    console.log(`[Storyboard] Calling AI with ${assetInputs.length} assets, style=${stylePackId}, cut=${cutLength}`);

    // Generate storyboard via OpenAI (with Kimi fallback)
    const storyboard = await generateStoryboard({
      assets: assetInputs,
      stylePackId,
      cutLength,
      sceneRange,
      propertyTitle: project.title as string | undefined,
    });

    console.log(`[Storyboard] AI returned ${storyboard.scenes.length} scenes, ${storyboard.room_tags.length} room tags`);

    // Update room tags on assets
    for (const tag of storyboard.room_tags) {
      await admin
        .from("assets")
        .update({
          room_type: tag.room_type,
          room_confidence: tag.confidence,
        })
        .eq("id", tag.asset_id);
    }

    // Delete existing scenes for this project
    await admin
      .from("storyboard_scenes")
      .delete()
      .eq("project_id", projectId);

    // Insert new scenes
    const sceneRows = storyboard.scenes.map((scene) => ({
      project_id: projectId,
      asset_id: scene.asset_id,
      scene_order: scene.scene_order,
      include: true,
      target_duration_sec: scene.target_duration_sec,
      motion_template: scene.motion_template,
      caption: scene.caption,
    }));

    const { error: insertError } = await admin
      .from("storyboard_scenes")
      .insert(sceneRows);

    if (insertError) {
      throw new Error(`Failed to insert scenes: ${insertError.message}`);
    }

    // Update project status
    await admin
      .from("projects")
      .update({
        status: "storyboard_ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    console.log(`[Storyboard] Successfully generated storyboard for project ${projectId}`);

    return NextResponse.json({
      success: true,
      scenes: storyboard.scenes.length,
      narrative: storyboard.narrative_arc,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Storyboard generation failed";
    console.error("[Storyboard] Generation error:", errorMessage, err);

    // Update project status to failed
    await admin
      .from("projects")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
