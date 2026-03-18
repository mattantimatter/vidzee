/**
 * POST /api/projects/[id]/clips/poll
 *
 * Polls fal.ai queue for Grok Imagine Video scene_clip renders.
 * One automatic conservative re-submit per render on API failure or bad output metadata.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  downloadGrokVideo,
  grokGetQueueStatus,
  grokGetResult,
} from "@/lib/video-providers/grok-imagine";
import { resubmitSceneClipFromRender } from "@/lib/scene-clip-submit";
import { NextResponse } from "next/server";

function isLikelyUnstableOutput(video: {
  duration?: number;
  num_frames?: number;
}): boolean {
  if (video.duration != null && video.duration < 2.25) return true;
  if (video.num_frames != null && video.num_frames < 45) return true;
  return false;
}

export async function POST(
  _request: Request,
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

  const admin = createAdminClient();

  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: renders, error: rendersError } = await admin
    .from("renders")
    .select("*")
    .eq("project_id", projectId)
    .eq("type", "scene_clip")
    .in("status", ["running", "queued"]);

  if (rendersError) {
    return NextResponse.json({ error: "Failed to fetch renders" }, { status: 500 });
  }

  if (!renders?.length) {
    return NextResponse.json({ message: "No running renders", updated: 0 });
  }

  let completedCount = 0;
  let failedCount = 0;
  let retriedCount = 0;

  for (const render of renders) {
    const requestId = render.provider_job_id as string;
    if (!requestId) continue;

    const refs = (render.input_refs ?? {}) as Record<string, unknown>;
    const autoUsed = refs.auto_conservative_retry_used === true;

    const scheduleConservativeRetry = async (reason: string): Promise<boolean> => {
      if (autoUsed) return false;
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
            markAutoRetryUsed: true,
          }
        );
        await admin
          .from("renders")
          .update({
            provider_job_id: request_id,
            status: "running",
            error: `Auto-retry (conservative): ${reason}`,
            input_refs: {
              ...input_refs,
              auto_conservative_retry_used: true,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", render.id);
        console.log(
          `[Clips poll] Grok auto-retry render=${render.id} reason=${reason} new_request=${request_id}`
        );
        retriedCount++;
        return true;
      } catch (e) {
        console.error(`[Clips poll] auto-retry failed render=${render.id}:`, e);
        return false;
      }
    };

    try {
      const statusResult = await grokGetQueueStatus(requestId);

      if (statusResult.status !== "COMPLETED") {
        continue;
      }

      let video: {
        url: string;
        duration?: number;
        num_frames?: number;
      };

      try {
        const res = await grokGetResult(requestId);
        video = res.video;
      } catch (resultErr) {
        const msg =
          resultErr instanceof Error ? resultErr.message : String(resultErr);
        console.error(`[Clips poll] Grok result error render=${render.id}:`, msg);
        const scheduled = await scheduleConservativeRetry(`result_error: ${msg.slice(0, 120)}`);
        if (!scheduled) {
          await admin
            .from("renders")
            .update({
              status: "failed",
              error: msg.slice(0, 500),
              updated_at: new Date().toISOString(),
            })
            .eq("id", render.id);
          failedCount++;
        }
        continue;
      }

      if (isLikelyUnstableOutput(video)) {
        const scheduled = await scheduleConservativeRetry("short_output_metadata");
        if (scheduled) continue;
      }

      const videoUrl = video.url;
      if (!videoUrl) {
        await admin
          .from("renders")
          .update({
            status: "failed",
            error: "No video URL in Grok result",
            updated_at: new Date().toISOString(),
          })
          .eq("id", render.id);
        failedCount++;
        continue;
      }

      const videoBuffer = await downloadGrokVideo(videoUrl);
      const storagePath = `${projectId}/${render.id}.mp4`;

      const { error: uploadError } = await admin.storage
        .from("scene-clips")
        .upload(storagePath, videoBuffer, {
          contentType: "video/mp4",
          upsert: true,
        });

      if (uploadError) {
        console.error("[Clips poll] upload:", uploadError);
      }

      const durationSec =
        typeof video.duration === "number" && video.duration > 0
          ? Math.round(video.duration * 10) / 10
          : 5;

      await admin
        .from("renders")
        .update({
          status: "done",
          output_path: storagePath,
          duration_sec: durationSec,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", render.id);

      completedCount++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Clips poll] render=${render.id}:`, errMsg);

      if (errMsg.includes("404") || errMsg.includes("not found")) {
        const scheduled = await scheduleConservativeRetry("request_not_found");
        if (!scheduled) {
          await admin
            .from("renders")
            .update({
              status: "failed",
              error: errMsg.slice(0, 500),
              updated_at: new Date().toISOString(),
            })
            .eq("id", render.id);
          failedCount++;
        }
      }
    }
  }

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
    autoRetried: retriedCount,
    allDone,
  });
}
