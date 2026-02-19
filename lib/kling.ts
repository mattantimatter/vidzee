/**
 * Kling AI Client — Image-to-Video Generation
 *
 * Uses the Kling AI API (api-singapore.klingai.com) with JWT auth.
 * Access Key + Secret Key are used to sign a JWT token (HS256).
 *
 * API Reference: https://app.klingai.com/global/dev/document-api/apiReference/model/imageToVideo
 */

import { SignJWT } from "jose";

// ─── Configuration ──────────────────────────────────────────────────────────

const KLING_BASE_URL = "https://api-singapore.klingai.com";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface KlingCreateTaskRequest {
  model_name?: string;
  image: string; // URL or base64
  image_tail?: string;
  prompt?: string;
  negative_prompt?: string;
  duration?: "5" | "10";
  mode?: "std" | "pro";
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  callback_url?: string;
  external_task_id?: string;
}

export interface KlingTaskResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string;
    task_status: "submitted" | "processing" | "succeed" | "failed";
    task_status_msg?: string;
    task_info?: {
      external_task_id?: string;
    };
    task_result?: {
      videos?: Array<{
        id: string;
        url: string;
        duration: string;
      }>;
    };
    created_at: number;
    updated_at: number;
  };
}

// ─── JWT Token Generation ───────────────────────────────────────────────────

/**
 * Generate a JWT token for Kling AI API authentication.
 * Token is valid for 30 minutes.
 */
async function generateKlingToken(): Promise<string> {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;

  if (!accessKey || !secretKey) {
    console.error("[Kling] Missing env vars: KLING_ACCESS_KEY =", !!accessKey, ", KLING_SECRET_KEY =", !!secretKey);
    throw new Error(
      `Kling API credentials missing: ACCESS_KEY=${!!accessKey}, SECRET_KEY=${!!secretKey}`
    );
  }

  console.log(`[Kling] Generating JWT with access key (${accessKey.length} chars, prefix: ${accessKey.substring(0, 4)})`);

  try {
    const now = Math.floor(Date.now() / 1000);
    const secret = new TextEncoder().encode(secretKey);

    const token = await new SignJWT({
      iss: accessKey,
      exp: now + 1800, // 30 minutes
      nbf: now - 5,
      iat: now,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .sign(secret);

    console.log(`[Kling] JWT generated successfully (${token.length} chars)`);
    return token;
  } catch (err) {
    console.error("[Kling] JWT generation failed:", err);
    throw new Error(
      `Kling JWT generation failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ─── API Methods ────────────────────────────────────────────────────────────

/**
 * Create an image-to-video generation task.
 */
export async function createImageToVideoTask(
  params: KlingCreateTaskRequest
): Promise<KlingTaskResponse> {
  console.log("[Kling] createImageToVideoTask called");

  const token = await generateKlingToken();

  const body = {
    model_name: params.model_name ?? "kling-v2-6",
    image: params.image,
    ...(params.image_tail && { image_tail: params.image_tail }),
    prompt: params.prompt ?? "",
    negative_prompt: params.negative_prompt ?? "",
    duration: params.duration ?? "5",
    mode: params.mode ?? "std",
    ...(params.aspect_ratio && { aspect_ratio: params.aspect_ratio }),
    ...(params.callback_url && { callback_url: params.callback_url }),
    ...(params.external_task_id && {
      external_task_id: params.external_task_id,
    }),
  };

  console.log(`[Kling] POST ${KLING_BASE_URL}/v1/videos/image2video, image URL length: ${params.image.length}`);

  const res = await fetch(`${KLING_BASE_URL}/v1/videos/image2video`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  console.log(`[Kling] Response status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Kling] API error response: ${text}`);
    throw new Error(`Kling API error ${res.status}: ${text}`);
  }

  const result = (await res.json()) as KlingTaskResponse;
  console.log(`[Kling] Task created: code=${result.code}, task_id=${result.data?.task_id ?? "N/A"}`);
  return result;
}

/**
 * Query the status of an image-to-video task.
 */
export async function queryImageToVideoTask(
  taskId: string
): Promise<KlingTaskResponse> {
  const token = await generateKlingToken();

  const res = await fetch(
    `${KLING_BASE_URL}/v1/videos/image2video/${taskId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kling API error ${res.status}: ${text}`);
  }

  return (await res.json()) as KlingTaskResponse;
}

/**
 * Poll a task until it completes or fails.
 * Returns the final task response.
 *
 * @param taskId - The Kling task ID
 * @param maxAttempts - Maximum number of polling attempts (default: 60)
 * @param intervalMs - Polling interval in milliseconds (default: 10000 = 10s)
 */
export async function pollTaskUntilDone(
  taskId: string,
  maxAttempts = 60,
  intervalMs = 10000
): Promise<KlingTaskResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await queryImageToVideoTask(taskId);

    if (result.data.task_status === "succeed") {
      return result;
    }

    if (result.data.task_status === "failed") {
      throw new Error(
        `Kling task failed: ${result.data.task_status_msg ?? "Unknown error"}`
      );
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Kling task ${taskId} timed out after ${maxAttempts} attempts`);
}

/**
 * Download a video from a Kling URL and return the buffer.
 */
export async function downloadKlingVideo(
  videoUrl: string
): Promise<ArrayBuffer> {
  const res = await fetch(videoUrl);
  if (!res.ok) {
    throw new Error(`Failed to download video: ${res.status}`);
  }
  return res.arrayBuffer();
}
