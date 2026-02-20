/**
 * Fal.ai Client — Image-to-Video Generation via Kling Video
 *
 * Uses the Fal.ai queue API (REST, no SDK needed).
 * Submits image-to-video jobs to fal-ai/kling-video/o3/standard/image-to-video.
 *
 * Environment variable: FAL_API_KEY
 */

// ─── Configuration ──────────────────────────────────────────────────────────

const FAL_QUEUE_BASE = "https://queue.fal.run";
// Full model path used for job submission
const FAL_MODEL_SUBMIT = "fal-ai/kling-video/o3/standard/image-to-video";
// Base model path used for status/result checks (Fal.ai routes these to the root model)
const FAL_MODEL_BASE = "fal-ai/kling-video";

function getFalApiKey(): string {
  const key = process.env.FAL_API_KEY;
  if (!key) {
    throw new Error("FAL_API_KEY environment variable is not set");
  }
  return key;
}

function getAuthHeader(): Record<string, string> {
  return {
    Authorization: `Key ${getFalApiKey()}`,
    "Content-Type": "application/json",
  };
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FalSubmitParams {
  image_url: string;
  prompt: string;
  duration?: string; // "3" or "5", default "3"
  aspect_ratio?: "16:9" | "9:16" | "1:1";
}

export interface FalSubmitResponse {
  status: string; // "IN_QUEUE"
  request_id: string;
  response_url: string;
  status_url: string;
  cancel_url: string;
}

export interface FalStatusResponse {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
}

export interface FalVideoResult {
  video: {
    url: string;
    content_type: string;
    file_name: string;
    file_size: number;
  };
}

// ─── API Methods ────────────────────────────────────────────────────────────

/**
 * Submit an image-to-video job to the Fal.ai queue.
 */
export async function submitImageToVideo(
  params: FalSubmitParams
): Promise<FalSubmitResponse> {
  console.log("[Fal] submitImageToVideo called");
  console.log(`[Fal] Image URL: ${params.image_url.substring(0, 100)}...`);
  console.log(`[Fal] Prompt: ${params.prompt.substring(0, 80)}`);

  const body = {
    image_url: params.image_url,
    prompt: params.prompt,
    duration: params.duration ?? "3",
    aspect_ratio: params.aspect_ratio ?? "16:9",
  };

  const url = `${FAL_QUEUE_BASE}/${FAL_MODEL_SUBMIT}`;
  console.log(`[Fal] POST ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: getAuthHeader(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Fal] Submit error ${res.status}: ${text}`);
    throw new Error(`Fal.ai API error ${res.status}: ${text}`);
  }

  const result = (await res.json()) as FalSubmitResponse;
  console.log(`[Fal] Job submitted: request_id=${result.request_id}, status=${result.status}`);
  return result;
}

/**
 * Check the status of a Fal.ai job.
 */
export async function checkVideoStatus(
  requestId: string
): Promise<FalStatusResponse> {
  const url = `${FAL_QUEUE_BASE}/${FAL_MODEL_BASE}/requests/${requestId}/status`;

  const res = await fetch(url, {
    method: "GET",
    headers: getAuthHeader(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fal.ai status check error ${res.status}: ${text}`);
  }

  return (await res.json()) as FalStatusResponse;
}

/**
 * Get the result of a completed Fal.ai job.
 */
export async function getVideoResult(
  requestId: string
): Promise<FalVideoResult> {
  const url = `${FAL_QUEUE_BASE}/${FAL_MODEL_BASE}/requests/${requestId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: getAuthHeader(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fal.ai result fetch error ${res.status}: ${text}`);
  }

  return (await res.json()) as FalVideoResult;
}

/**
 * Download a video from a Fal.ai CDN URL.
 * No auth needed — direct CDN link.
 */
export async function downloadFalVideo(
  videoUrl: string
): Promise<ArrayBuffer> {
  console.log(`[Fal] Downloading video from ${videoUrl.substring(0, 80)}...`);
  const res = await fetch(videoUrl);
  if (!res.ok) {
    throw new Error(`Failed to download video: ${res.status}`);
  }
  return res.arrayBuffer();
}
