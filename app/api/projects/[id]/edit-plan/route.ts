/**
 * POST /api/projects/[id]/edit-plan
 *
 * Generates an edit plan using Kimi K2.5 and creates final render rows.
 * This is the last step before video assembly.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateEditPlan } from "@/lib/kimi";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
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

  const admin = createAdminClient();

  // Get project
  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Get completed scene clips
  const { data: renders, error: rendersError } = await admin
    .from("renders")
    .select("*, storyboard_scenes:input_refs")
    .eq("project_id", projectId)
    .eq("type", "scene_clip")
    .eq("status", "done");

  if (rendersError || !renders || renders.length === 0) {
    return NextResponse.json(
      { error: "No completed clips found" },
      { status: 400 }
    );
  }

  // Get scenes for captions and room types
  const { data: scenes } = await admin
    .from("storyboard_scenes")
    .select("*, assets(room_type)")
    .eq("project_id", projectId)
    .eq("include", true)
    .order("scene_order");

  try {
    // Update project status
    await admin
      .from("projects")
      .update({
        status: "render_queued",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    // Build scene data for edit plan
    const sceneData =
      scenes?.map((scene) => {
        const render = renders.find((r) => {
          const refs = r.input_refs as Record<string, string> | null;
          return refs?.scene_id === scene.id;
        });
        const asset = scene.assets as Record<string, unknown> | null;
        return {
          scene_order: scene.scene_order as number,
          clip_id: render?.id ?? "",
          duration_sec: (render?.duration_sec as number) ?? 5,
          caption: scene.caption as string | null,
          room_type: (asset?.room_type as string) ?? null,
        };
      }) ?? [];

    // Generate edit plan via Kimi K2.5
    const editPlan = await generateEditPlan({
      scenes: sceneData,
      stylePackId: (project.style_pack_id as string) ?? "modern-clean",
      propertyInfo: {
        title: project.title as string | null,
        address: project.address as string | null,
        price: project.price as number | null,
        beds: project.beds as number | null,
        baths: project.baths as number | null,
        sqft: project.sqft as number | null,
        agent_name: project.agent_name as string | null,
        brokerage: project.brokerage as string | null,
      },
    });

    // Create final render rows
    await admin.from("renders").insert([
      {
        project_id: projectId,
        type: "final_vertical",
        status: "queued",
        provider: "ffmpeg",
        input_refs: {
          edit_plan: editPlan,
          aspect_ratio: "9:16",
        },
      },
      {
        project_id: projectId,
        type: "final_horizontal",
        status: "queued",
        provider: "ffmpeg",
        input_refs: {
          edit_plan: editPlan,
          aspect_ratio: "16:9",
        },
      },
    ]);

    // Update project status
    await admin
      .from("projects")
      .update({
        status: "rendering",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    return NextResponse.json({
      success: true,
      edit_plan: editPlan,
      total_duration: editPlan.total_duration_sec,
    });
  } catch (err) {
    console.error("Edit plan generation error:", err);

    await admin
      .from("projects")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Edit plan generation failed",
      },
      { status: 500 }
    );
  }
}
