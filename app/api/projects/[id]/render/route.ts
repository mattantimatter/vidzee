/**
 * POST /api/projects/[id]/render
 *
 * Video assembly pipeline with two-tier approach:
 *
 * 1. PRIMARY: Download scene clips → ffmpeg concat → upload final MP4
 *    Uses ffmpeg-static (serverExternalPackages in next.config.ts).
 *
 * 2. FALLBACK: If ffmpeg fails (binary missing, timeout, size limit),
 *    store ordered clip URLs as a JSON "playlist" in the render row.
 *    The Results page detects playlist mode and plays clips in sequence.
 *
 * This ensures the route always succeeds regardless of Vercel plan limits.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Resolve the ffmpeg binary path.
 * Tries ffmpeg-static first, then falls back to system ffmpeg.
 */
function getFfmpegPath(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require("ffmpeg-static") as string;
    if (ffmpegStatic) {
      console.log(`[Render] ffmpeg-static resolved to: ${ffmpegStatic}`);
      return ffmpegStatic;
    }
  } catch (e) {
    console.warn("[Render] ffmpeg-static not available:", e instanceof Error ? e.message : e);
  }

  // Try system ffmpeg
  try {
    const { execSync } = require("child_process");
    const which = execSync("which ffmpeg", { encoding: "utf-8" }).trim();
    if (which) {
      console.log(`[Render] System ffmpeg found at: ${which}`);
      return which;
    }
  } catch {
    console.warn("[Render] System ffmpeg not found");
  }

  return null;
}

/**
 * Build ordered clip URLs from Supabase Storage public URLs.
 */
function buildClipUrls(
  orderedClips: Array<Record<string, unknown>>,
  supabaseUrl: string
): string[] {
  return orderedClips
    .filter((c) => c.output_path)
    .map((c) => {
      const outputPath = c.output_path as string;
      return `${supabaseUrl}/storage/v1/object/public/scene-clips/${outputPath}`;
    });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  console.log(`[Render] ===== START video assembly for project ${projectId} =====`);

  // Verify user auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // Verify project ownership
  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Get queued final render rows
  const { data: finalRenders, error: rendersError } = await admin
    .from("renders")
    .select("*")
    .eq("project_id", projectId)
    .in("type", ["final_vertical", "final_horizontal"])
    .eq("status", "queued");

  if (rendersError) {
    return NextResponse.json(
      { error: "Failed to fetch render rows" },
      { status: 500 }
    );
  }

  if (!finalRenders || finalRenders.length === 0) {
    return NextResponse.json(
      { message: "No queued final renders found" },
      { status: 200 }
    );
  }

  // Get all completed scene clips
  const { data: sceneClips, error: clipsError } = await admin
    .from("renders")
    .select("*")
    .eq("project_id", projectId)
    .eq("type", "scene_clip")
    .eq("status", "done")
    .order("created_at");

  if (clipsError || !sceneClips || sceneClips.length === 0) {
    return NextResponse.json(
      { error: "No completed scene clips found" },
      { status: 400 }
    );
  }

  // Get scenes for ordering
  const { data: scenes } = await admin
    .from("storyboard_scenes")
    .select("*")
    .eq("project_id", projectId)
    .eq("include", true)
    .order("scene_order");

  // Sort clips by scene order
  const sceneOrderMap = new Map<string, number>();
  if (scenes) {
    for (const scene of scenes) {
      sceneOrderMap.set(scene.id as string, scene.scene_order as number);
    }
  }

  const orderedClips = [...sceneClips].sort((a, b) => {
    const aRefs = a.input_refs as Record<string, string> | null;
    const bRefs = b.input_refs as Record<string, string> | null;
    const aOrder = sceneOrderMap.get(aRefs?.scene_id ?? "") ?? 999;
    const bOrder = sceneOrderMap.get(bRefs?.scene_id ?? "") ?? 999;
    return aOrder - bOrder;
  });

  console.log(`[Render] Found ${orderedClips.length} scene clips to concatenate`);

  // Calculate total duration from clips
  const totalDuration = orderedClips.reduce(
    (sum, c) => sum + ((c.duration_sec as number) ?? 3),
    0
  );

  // Mark all final renders as running
  for (const render of finalRenders) {
    await admin
      .from("renders")
      .update({
        status: "running",
        updated_at: new Date().toISOString(),
      })
      .eq("id", render.id);
  }

  // ─── Try ffmpeg concat first ─────────────────────────────────────────
  const ffmpegPath = getFfmpegPath();
  let ffmpegSuccess = false;

  if (ffmpegPath) {
    const tmpDir = path.join("/tmp", `vidzee-render-${projectId}-${Date.now()}`);

    try {
      await fs.mkdir(tmpDir, { recursive: true });

      // Download all clips
      console.log(`[Render] Downloading ${orderedClips.length} clips...`);
      const clipPaths: string[] = [];

      for (let i = 0; i < orderedClips.length; i++) {
        const clip = orderedClips[i];
        const outputPath = clip.output_path as string;
        if (!outputPath) continue;

        const clipFile = path.join(tmpDir, `clip_${String(i).padStart(3, "0")}.mp4`);

        // Download via public URL (faster than Supabase SDK download)
        const clipUrl = `${supabaseUrl}/storage/v1/object/public/scene-clips/${outputPath}`;
        const res = await fetch(clipUrl);
        if (!res.ok) {
          console.error(`[Render] Failed to download clip ${i}: HTTP ${res.status}`);
          continue;
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        await fs.writeFile(clipFile, buffer);
        clipPaths.push(clipFile);
        console.log(`[Render] Downloaded clip ${i + 1}/${orderedClips.length} (${(buffer.length / 1024).toFixed(0)}KB)`);
      }

      if (clipPaths.length === 0) {
        throw new Error("No clips could be downloaded");
      }

      // Create concat list
      const concatListPath = path.join(tmpDir, "concat.txt");
      await fs.writeFile(
        concatListPath,
        clipPaths.map((p) => `file '${p}'`).join("\n")
      );

      // Run ffmpeg concat (stream copy — no re-encoding, very fast)
      const outputFile = path.join(tmpDir, "final.mp4");
      console.log(`[Render] Running ffmpeg concat with ${clipPaths.length} clips...`);

      await execFileAsync(ffmpegPath, [
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concatListPath,
        "-c", "copy",
        "-movflags", "+faststart",
        outputFile,
      ], {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      });

      // Verify output
      const stats = await fs.stat(outputFile);
      console.log(`[Render] ffmpeg output: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      if (stats.size === 0) {
        throw new Error("Output file is empty");
      }

      // Upload to final-exports bucket
      const fileBuffer = await fs.readFile(outputFile);

      // Upload same file for both vertical and horizontal (same source clips)
      for (const render of finalRenders) {
        const storagePath = `${projectId}/${render.id}.mp4`;
        console.log(`[Render] Uploading ${render.type} to final-exports/${storagePath}...`);

        const { error: uploadError } = await admin.storage
          .from("final-exports")
          .upload(storagePath, fileBuffer, {
            contentType: "video/mp4",
            upsert: true,
          });

        if (uploadError) {
          console.error(`[Render] Upload error for ${render.type}:`, uploadError);
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        await admin
          .from("renders")
          .update({
            status: "done",
            output_path: storagePath,
            duration_sec: totalDuration,
            updated_at: new Date().toISOString(),
          })
          .eq("id", render.id);

        console.log(`[Render] ${render.type} complete (ffmpeg)`);
      }

      ffmpegSuccess = true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Render] ffmpeg pipeline failed: ${errMsg}`);
      console.warn("[Render] Falling back to playlist mode...");
    } finally {
      // Clean up temp directory
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  } else {
    console.warn("[Render] No ffmpeg binary available, using playlist mode");
  }

  // ─── Fallback: Playlist mode ─────────────────────────────────────────
  // Store ordered clip URLs as JSON in output_path, prefixed with "playlist:"
  // The Results page detects this prefix and plays clips in sequence.
  if (!ffmpegSuccess) {
    try {
      const clipUrls = buildClipUrls(orderedClips, supabaseUrl);
      console.log(`[Render] Playlist mode: ${clipUrls.length} clip URLs`);

      // Store as a JSON string prefixed with "playlist:" so the frontend can detect it
      const playlistData = JSON.stringify({
        type: "playlist",
        clips: clipUrls,
        totalDuration,
      });

      for (const render of finalRenders) {
        await admin
          .from("renders")
          .update({
            status: "done",
            output_path: `playlist:${playlistData}`,
            duration_sec: totalDuration,
            provider: "playlist",
            updated_at: new Date().toISOString(),
          })
          .eq("id", render.id);

        console.log(`[Render] ${render.type} complete (playlist mode)`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Render] Playlist fallback also failed:`, errMsg);

      for (const render of finalRenders) {
        await admin
          .from("renders")
          .update({
            status: "failed",
            error: errMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", render.id);
      }

      await admin
        .from("projects")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);

      return NextResponse.json({ error: errMsg }, { status: 500 });
    }
  }

  // Mark project as complete
  await admin
    .from("projects")
    .update({
      status: "complete",
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  const mode = ffmpegSuccess ? "ffmpeg" : "playlist";
  console.log(`[Render] ===== DONE (${mode} mode) =====`);

  return NextResponse.json({
    success: true,
    mode,
    renders: finalRenders.map((r) => ({
      id: r.id,
      type: r.type,
    })),
  });
}
