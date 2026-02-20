/**
 * POST /api/projects/[id]/render
 *
 * Video assembly pipeline: downloads scene clips from Supabase Storage,
 * concatenates them with ffmpeg into a final video, uploads to final-exports bucket.
 *
 * Processes queued final_vertical and final_horizontal render rows.
 *
 * Uses ffmpeg-static for a bundled ffmpeg binary that works on Vercel.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const maxDuration = 60; // Vercel serverless max timeout

/**
 * Resolve the ffmpeg binary path.
 * Tries ffmpeg-static first, then falls back to system ffmpeg.
 */
function getFfmpegPath(): string {
  try {
    // ffmpeg-static provides a pre-built static binary
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require("ffmpeg-static") as string;
    if (ffmpegStatic) return ffmpegStatic;
  } catch {
    // Not installed
  }
  return "ffmpeg"; // System ffmpeg fallback
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

  // Get all completed scene clips in order
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

  // Create temp directory
  const tmpDir = path.join("/tmp", `vidzee-render-${projectId}-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  const results: Array<{ render_id: string; type: string; status: string }> = [];

  try {
    // Download all scene clips to temp directory
    console.log(`[Render] Downloading ${orderedClips.length} clips...`);
    const clipPaths: string[] = [];

    for (let i = 0; i < orderedClips.length; i++) {
      const clip = orderedClips[i];
      const outputPath = clip.output_path as string;
      if (!outputPath) continue;

      const clipFile = path.join(tmpDir, `clip_${String(i).padStart(3, "0")}.mp4`);

      // Download from Supabase Storage
      const { data: fileData, error: downloadError } = await admin.storage
        .from("scene-clips")
        .download(outputPath);

      if (downloadError || !fileData) {
        console.error(`[Render] Failed to download clip ${outputPath}:`, downloadError);
        continue;
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      await fs.writeFile(clipFile, buffer);
      clipPaths.push(clipFile);
      console.log(`[Render] Downloaded clip ${i + 1}/${orderedClips.length}: ${outputPath} (${buffer.length} bytes)`);
    }

    if (clipPaths.length === 0) {
      throw new Error("No clips could be downloaded");
    }

    // Create ffmpeg concat list file
    const concatListPath = path.join(tmpDir, "concat.txt");
    const concatContent = clipPaths
      .map((p) => `file '${p}'`)
      .join("\n");
    await fs.writeFile(concatListPath, concatContent);

    const ffmpegPath = getFfmpegPath();
    console.log(`[Render] Using ffmpeg at: ${ffmpegPath}`);

    // Process each final render (vertical and horizontal)
    for (const render of finalRenders) {
      const renderType = render.type as string;

      console.log(`[Render] Processing ${renderType}...`);

      // Mark as running
      await admin
        .from("renders")
        .update({
          status: "running",
          updated_at: new Date().toISOString(),
        })
        .eq("id", render.id);

      try {
        const outputFile = path.join(tmpDir, `final_${renderType}.mp4`);

        // Simple concat using concat demuxer (fastest — no re-encoding)
        const ffmpegArgs = [
          "-y",
          "-f", "concat",
          "-safe", "0",
          "-i", concatListPath,
          "-c", "copy",
          "-movflags", "+faststart",
          outputFile,
        ];

        console.log(`[Render] Running ffmpeg concat...`);

        try {
          const { stderr } = await execFileAsync(ffmpegPath, ffmpegArgs, {
            timeout: 45000,
            maxBuffer: 10 * 1024 * 1024,
          });
          if (stderr) console.log(`[Render] ffmpeg stderr (last 300): ${stderr.slice(-300)}`);
        } catch (concatErr) {
          // If concat copy fails (different codecs/resolutions), try re-encoding
          console.warn(`[Render] Concat copy failed, trying re-encode:`, concatErr instanceof Error ? concatErr.message : concatErr);

          const reencodeArgs = [
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concatListPath,
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            "-shortest",
            outputFile,
          ];

          const { stderr: reencodeStderr } = await execFileAsync(
            ffmpegPath,
            reencodeArgs,
            { timeout: 50000, maxBuffer: 10 * 1024 * 1024 }
          );
          if (reencodeStderr) {
            console.log(`[Render] Re-encode stderr (last 300): ${reencodeStderr.slice(-300)}`);
          }
        }

        // Verify output file exists
        const stats = await fs.stat(outputFile);
        console.log(`[Render] Output file size: ${stats.size} bytes`);

        if (stats.size === 0) {
          throw new Error("Output file is empty");
        }

        // Upload to final-exports bucket
        const storagePath = `${projectId}/${render.id}.mp4`;
        const fileBuffer = await fs.readFile(outputFile);

        console.log(`[Render] Uploading to final-exports/${storagePath} (${fileBuffer.length} bytes)...`);
        const { error: uploadError } = await admin.storage
          .from("final-exports")
          .upload(storagePath, fileBuffer, {
            contentType: "video/mp4",
            upsert: true,
          });

        if (uploadError) {
          console.error(`[Render] Upload error:`, uploadError);
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Calculate total duration from clips
        const totalDuration = orderedClips.reduce(
          (sum, c) => sum + ((c.duration_sec as number) ?? 3),
          0
        );

        // Update render row as done
        await admin
          .from("renders")
          .update({
            status: "done",
            output_path: storagePath,
            duration_sec: totalDuration,
            updated_at: new Date().toISOString(),
          })
          .eq("id", render.id);

        results.push({
          render_id: render.id as string,
          type: renderType,
          status: "done",
        });

        console.log(`[Render] ${renderType} complete!`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Render] ${renderType} failed:`, errMsg);

        await admin
          .from("renders")
          .update({
            status: "failed",
            error: errMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", render.id);

        results.push({
          render_id: render.id as string,
          type: renderType,
          status: "failed",
        });
      }
    }

    // Check if all final renders are done
    const anyDone = results.some((r) => r.status === "done");

    await admin
      .from("projects")
      .update({
        status: anyDone ? "complete" : "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    console.log(`[Render] ===== DONE: ${results.length} renders processed =====`);

    return NextResponse.json({
      success: anyDone,
      results,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Render] FATAL error:`, errMsg);

    // Mark all queued renders as failed
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
  } finally {
    // Clean up temp directory
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
