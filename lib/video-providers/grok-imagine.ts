/**
 * Grok Imagine Video (image-to-video) via fal.ai — server-side only.
 * Queue submit / status / result. Use FAL_KEY or FAL_API_KEY.
 */

import { fal } from "@fal-ai/client";
import {
  GROK_I2V_ENDPOINT,
  type ClipResolution,
} from "@/lib/real-estate-video-config";

export function configureFalCredentials(): void {
  const key = process.env.FAL_KEY ?? process.env.FAL_API_KEY;
  if (!key) {
    throw new Error(
      "FAL_KEY (or FAL_API_KEY) is required for scene clip generation."
    );
  }
  fal.config({ credentials: key });
}

export type GrokAspectRatio =
  | "auto"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:2"
  | "1:1"
  | "2:3"
  | "3:4";

export interface GrokI2VInput {
  prompt: string;
  image_url: string;
  duration: number;
  aspect_ratio: GrokAspectRatio;
  resolution: ClipResolution;
}

export async function grokSubmitImageToVideo(
  input: GrokI2VInput
): Promise<{ request_id: string }> {
  configureFalCredentials();
  const queued = (await fal.queue.submit(GROK_I2V_ENDPOINT, {
    input: {
      prompt: input.prompt,
      image_url: input.image_url,
      duration: input.duration,
      aspect_ratio: input.aspect_ratio,
      resolution: input.resolution,
    },
  })) as { request_id?: string; requestId?: string };
  const request_id = queued.request_id ?? queued.requestId;
  if (!request_id) {
    throw new Error("fal queue submit returned no request_id");
  }
  return { request_id };
}

export async function grokGetQueueStatus(requestId: string) {
  configureFalCredentials();
  return fal.queue.status(GROK_I2V_ENDPOINT, { requestId, logs: false });
}

export interface GrokVideoFile {
  url: string;
  content_type?: string;
  file_name?: string;
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
  num_frames?: number;
}

export async function grokGetResult(requestId: string): Promise<{
  video: GrokVideoFile;
  requestId: string;
}> {
  configureFalCredentials();
  const res = await fal.queue.result(GROK_I2V_ENDPOINT, { requestId });
  const data = res.data as { video: GrokVideoFile };
  if (!data?.video?.url) {
    throw new Error("Grok Imagine Video result missing video URL");
  }
  return { video: data.video, requestId: res.requestId };
}

/** Direct CDN fetch — no auth. */
export async function downloadGrokVideo(videoUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(videoUrl);
  if (!res.ok) {
    throw new Error(`Failed to download video: ${res.status}`);
  }
  return res.arrayBuffer();
}
