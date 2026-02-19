/**
 * POST /api/projects/[id]/clips/poll
 *
 * Polls Kling AI for the status of all running clip renders.
 * Updates render rows and downloads completed videos to Supabase Storage.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { queryImageToVideoTask, downloadKlingVideo } from "@/lib/kling";
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

  // Get running renders
  const { data: renders, error: rendersError } = await admin
    .from("renders")
    .select("*")
    .eq("project_id", projectId)
    .eq("type", "scene_clip")
    .in("status", ["running", "queued"]);

  if (rendersError) {
    return NextResponse.json(
      { error: "Failed to fetch renders" },
      { status: 500 }
    );
  }

  if (!renders || renders.length === 0) {
    return NextResponse.json({ message: "No running renders", updated: 0 });
  }

  let completedCount = 0;
  let failedCount = 0;

  for (const render of renders) {
    const taskId = render.provider_job_id as string;
    if (!taskId) continue;

    try {
      const result = await queryImageToVideoTask(taskId);

      if (result.data.task_status === "succeed") {
        const videoUrl = result.data.task_result?.videos?.[0]?.url;

        if (videoUrl) {
          // Download and upload to Supabase Storage
          const videoBuffer = await downloadKlingVideo(videoUrl);
          const storagePath = `${projectId}/${render.id}.mp4`;

          const { error: uploadError } = await admin.storage
            .from("scene-clips")
            .upload(storagePath, videoBuffer, {
              contentType: "video/mp4",
              upsert: true,
            });

          if (uploadError) {
            console.error("Upload error:", uploadError);
          }

          await admin
            .from("renders")
            .update({
              status: "done",
              output_path: storagePath,
              duration_sec: parseFloat(
                result.data.task_result?.videos?.[0]?.duration ?? "5"
              ),
              updated_at: new Date().toISOString(),
            })
            .eq("id", render.id);

          completedCount++;
        }
      } else if (result.data.task_status === "failed") {
        await admin
          .from("renders")
          .update({
            status: "failed",
            error: result.data.task_status_msg ?? "Unknown error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", render.id);

        failedCount++;
      }
      // If still processing, leave as-is
    } catch (err) {
      console.error(`Error polling render ${render.id}:`, err);
    }
  }

  // Check if all renders are done
  const { data: allRenders } = await admin
    .from("renders")
    .select("status")
    .eq("project_id", projectId)
    .eq("type", "scene_clip");

  const allDone = allRenders?.every(
    (r) => r.status === "done" || r.status === "failed"
  );

  if (allDone) {
    const hasFailures = allRenders?.some((r) => r.status === "failed");
    await admin
      .from("projects")
      .update({
        status: hasFailures ? "failed" : "clips_ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
  }

  return NextResponse.json({
    completed: completedCount,
    failed: failedCount,
    allDone,
  });
}
