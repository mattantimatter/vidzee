/**
 * POST /api/projects/[id]/clips/poll
 *
 * Polls Fal.ai for the status of all running clip renders.
 * Updates render rows and downloads completed videos to Supabase Storage.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkVideoStatus, getVideoResult, downloadFalVideo } from "@/lib/fal";
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
    const requestId = render.provider_job_id as string;
    if (!requestId) continue;

    try {
      // Check status via Fal.ai
      const statusResult = await checkVideoStatus(requestId);

      if (statusResult.status === "COMPLETED") {
        // Get the result with video URL
        const result = await getVideoResult(requestId);
        const videoUrl = result.video?.url;

        if (videoUrl) {
          // Download video from Fal CDN (no auth needed)
          const videoBuffer = await downloadFalVideo(videoUrl);
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
              duration_sec: 3, // Default 3s for Fal.ai Kling
              updated_at: new Date().toISOString(),
            })
            .eq("id", render.id);

          completedCount++;
        }
      } else if (
        statusResult.status === "IN_QUEUE" ||
        statusResult.status === "IN_PROGRESS"
      ) {
        // Still running — leave as-is
      } else {
        // Unknown status — treat as failed
        await admin
          .from("renders")
          .update({
            status: "failed",
            error: `Unexpected status: ${statusResult.status}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", render.id);

        failedCount++;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error polling render ${render.id}:`, errMsg);

      // If the error indicates a permanent failure, mark as failed
      if (errMsg.includes("404") || errMsg.includes("not found")) {
        await admin
          .from("renders")
          .update({
            status: "failed",
            error: errMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", render.id);
        failedCount++;
      }
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
