/**
 * POST /api/projects/[id]/music — Generate background music via Fal.ai stable-audio
 * GET  /api/projects/[id]/music?requestId=xxx — Poll for music generation status
 *
 * Uses fal-ai/stable-audio (Stable Audio Open) — reliable, fast, supports custom duration.
 * Input: { prompt, seconds_total }
 * Output: { audio_file: { url } }
 *
 * Music is generated for the FULL video duration (not per-clip).
 */
import { NextResponse, type NextRequest } from "next/server";

const FAL_API_KEY = process.env.FAL_KEY ?? process.env.FAL_API_KEY ?? "";
const FAL_ENDPOINT = "fal-ai/stable-audio";
const FAL_QUEUE_URL = `https://queue.fal.run/${FAL_ENDPOINT}`;
const FAL_STATUS_URL = `https://queue.fal.run/${FAL_ENDPOINT}/requests`;

// ─── POST: Submit music generation ──────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;

  if (!FAL_API_KEY) {
    return NextResponse.json(
      { error: "FAL_KEY or FAL_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const genre = (body.genre ?? "ambient") as string;

    // Accept total video duration from caller.
    // Stable Audio supports up to 190s; clamp between 10s and 180s.
    const totalDuration = typeof body.duration === "number" ? body.duration : 30;
    const seconds_total = Math.max(10, Math.min(180, Math.round(totalDuration)));

    console.log(`[Music] Generating ${seconds_total}s track for genre: ${genre}`);

    // Build prompt based on genre
    const genrePrompts: Record<string, string> = {
      ambient:
        "Calm ambient background music for a luxury real estate property video tour, soft pads, gentle atmosphere, elegant and modern, no vocals",
      "cinematic piano":
        "Cinematic piano background music for an upscale real estate property tour, emotional, elegant, inspiring, soft strings, no vocals",
      "upbeat electronic":
        "Upbeat electronic background music for a modern real estate property showcase, energetic but not overwhelming, clean production, contemporary feel, no vocals",
      acoustic:
        "Warm acoustic guitar background music for a cozy real estate home tour, inviting, friendly, natural feel, light percussion, no vocals",
      jazz:
        "Smooth jazz background music for an elegant real estate property tour, sophisticated, warm, professional, no vocals",
      orchestral:
        "Orchestral background music for a luxury real estate property video, sweeping, cinematic, grand, inspiring, no vocals",
    };

    const normalizedGenre = genre.toLowerCase();
    const prompt =
      genrePrompts[genre] ??
      genrePrompts[normalizedGenre] ??
      "Background music for a real estate property video tour, elegant and professional, no vocals";

    // Submit to Fal.ai queue
    const submitRes = await fetch(FAL_QUEUE_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        seconds_total,
        steps: 100,
      }),
    });

    if (!submitRes.ok) {
      const errorText = await submitRes.text();
      console.error("[Music] Fal.ai submit error:", submitRes.status, errorText);
      return NextResponse.json(
        { error: `Music generation failed: ${submitRes.status}`, details: errorText },
        { status: submitRes.status }
      );
    }

    const submitData = await submitRes.json() as { request_id?: string; audio_file?: { url: string } };
    const requestId = submitData.request_id;

    if (!requestId) {
      // Synchronous response (unlikely but handle it)
      const audioUrl = submitData.audio_file?.url;
      if (audioUrl) {
        return NextResponse.json({ status: "completed", audioUrl, duration: seconds_total });
      }
      return NextResponse.json(
        { error: "No request_id or audio URL in response", raw: submitData },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: "pending", requestId, duration: seconds_total });
  } catch (err) {
    console.error("[Music] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ─── GET: Poll music generation status ──────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;

  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId");

  if (!requestId) {
    return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  }

  if (!FAL_API_KEY) {
    return NextResponse.json(
      { error: "FAL_KEY or FAL_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    // Check queue status
    const statusRes = await fetch(`${FAL_STATUS_URL}/${requestId}/status`, {
      headers: { Authorization: `Key ${FAL_API_KEY}` },
    });

    if (!statusRes.ok) {
      const errorText = await statusRes.text();
      console.error("[Music] Status check error:", statusRes.status, errorText);
      return NextResponse.json(
        { status: "failed", error: `Status check failed: ${statusRes.status}` },
        { status: 200 }
      );
    }

    const statusData = await statusRes.json() as { status: string; queue_position?: number; error?: string };
    const queueStatus = statusData.status;

    if (queueStatus === "COMPLETED") {
      // Fetch the result
      const resultRes = await fetch(`${FAL_STATUS_URL}/${requestId}`, {
        headers: { Authorization: `Key ${FAL_API_KEY}` },
      });

      if (!resultRes.ok) {
        return NextResponse.json(
          { status: "failed", error: "Failed to fetch result" },
          { status: 200 }
        );
      }

      const resultData = await resultRes.json() as { audio_file?: { url: string }; audio?: { url: string }; url?: string };
      const audioUrl =
        resultData.audio_file?.url ??
        resultData.audio?.url ??
        resultData.url;

      if (audioUrl) {
        return NextResponse.json({ status: "completed", audioUrl });
      }

      return NextResponse.json({
        status: "completed",
        error: "No audio URL in result",
        raw: resultData,
      });
    }

    if (queueStatus === "FAILED") {
      return NextResponse.json({
        status: "failed",
        error: statusData.error ?? "Music generation failed",
      });
    }

    // Still processing
    return NextResponse.json({
      status: "pending",
      queueStatus,
      position: statusData.queue_position,
    });
  } catch (err) {
    console.error("[Music] Status check error:", err);
    return NextResponse.json(
      { status: "failed", error: err instanceof Error ? err.message : "Unknown error" },
      { status: 200 }
    );
  }
}
