/**
 * POST /api/projects/[id]/music — Generate background music via Fal.ai Beatoven
 * GET  /api/projects/[id]/music?requestId=xxx — Poll for music generation status
 *
 * Uses the Fal.ai queue pattern:
 * 1. POST to submit → get request_id
 * 2. GET status → check if COMPLETED
 * 3. GET result → get audio URL
 *
 * The generated audio URL is returned to the client, which saves it
 * as part of the editor state in the renders table.
 */

import { NextResponse, type NextRequest } from "next/server";

const FAL_API_KEY = process.env.FAL_API_KEY ?? "";
const FAL_QUEUE_URL = "https://queue.fal.run/beatoven/music-generation";
const FAL_STATUS_URL = "https://queue.fal.run/beatoven/music-generation/requests";

// ─── POST: Submit music generation ──────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params; // consume params (project ID available if needed for logging)

  if (!FAL_API_KEY) {
    return NextResponse.json(
      { error: "FAL_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const genre = body.genre ?? "ambient";
    const duration = Math.max(15, Math.min(120, body.duration ?? 30));

    // Build the prompt based on genre
    const genrePrompts: Record<string, string> = {
      ambient:
        "Calm ambient background music for a luxury real estate property video tour, soft pads, gentle atmosphere, elegant and modern",
      "cinematic piano":
        "Cinematic piano background music for an upscale real estate property tour, emotional, elegant, inspiring, soft strings accompaniment",
      "upbeat electronic":
        "Upbeat electronic background music for a modern real estate property showcase, energetic but not overwhelming, clean production, contemporary feel",
      acoustic:
        "Warm acoustic guitar background music for a cozy real estate home tour, inviting, friendly, natural feel, light percussion",
    };

    const prompt =
      genrePrompts[genre] ??
      "Background music for a real estate property video tour, elegant and professional";

    // Submit to Fal.ai queue
    const submitRes = await fetch(FAL_QUEUE_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        duration,
      }),
    });

    if (!submitRes.ok) {
      const errorText = await submitRes.text();
      console.error("[Music] Fal.ai submit error:", submitRes.status, errorText);
      return NextResponse.json(
        {
          error: `Music generation failed: ${submitRes.status}`,
          details: errorText,
        },
        { status: submitRes.status }
      );
    }

    const submitData = await submitRes.json();
    const requestId = submitData.request_id;

    if (!requestId) {
      // If the response already contains the audio URL (synchronous response)
      const audioUrl =
        submitData.audio?.url ??
        submitData.audio_file?.url ??
        submitData.output?.url ??
        submitData.url;

      if (audioUrl) {
        return NextResponse.json({
          status: "completed",
          audioUrl,
        });
      }

      return NextResponse.json(
        { error: "No request_id or audio URL in response", raw: submitData },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "pending",
      requestId,
    });
  } catch (err) {
    console.error("[Music] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ─── GET: Check music generation status ─────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params; // consume params

  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId");

  if (!requestId) {
    return NextResponse.json(
      { error: "requestId is required" },
      { status: 400 }
    );
  }

  if (!FAL_API_KEY) {
    return NextResponse.json(
      { error: "FAL_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    // Check status
    const statusRes = await fetch(`${FAL_STATUS_URL}/${requestId}/status`, {
      headers: {
        Authorization: `Key ${FAL_API_KEY}`,
      },
    });

    if (!statusRes.ok) {
      const errorText = await statusRes.text();
      console.error("[Music] Status check error:", statusRes.status, errorText);
      return NextResponse.json(
        { status: "failed", error: `Status check failed: ${statusRes.status}` },
        { status: 200 }
      );
    }

    const statusData = await statusRes.json();
    const queueStatus = statusData.status;

    if (queueStatus === "COMPLETED") {
      // Fetch the result
      const resultRes = await fetch(`${FAL_STATUS_URL}/${requestId}`, {
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
        },
      });

      if (!resultRes.ok) {
        return NextResponse.json(
          { status: "failed", error: "Failed to fetch result" },
          { status: 200 }
        );
      }

      const resultData = await resultRes.json();
      const audioUrl =
        resultData.audio?.url ??
        resultData.audio_file?.url ??
        resultData.output?.url ??
        resultData.url;

      if (audioUrl) {
        return NextResponse.json({
          status: "completed",
          audioUrl,
        });
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
