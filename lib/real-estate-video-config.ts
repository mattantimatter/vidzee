/**
 * Defaults for listing clip generation (Grok Imagine Video via fal.ai).
 * FAL_KEY (preferred) or FAL_API_KEY — server-side only.
 */

export const GROK_I2V_ENDPOINT = "xai/grok-imagine-video/image-to-video" as const;

/** Short per-scene clips (seconds). Grok accepts integer duration. */
export const DEFAULT_CLIP_DURATION_SEC = 5;

export const DEFAULT_RESOLUTION = "720p" as const;
export type ClipResolution = "720p" | "480p";

export type MotionIntensitySetting = "minimal" | "subtle" | "standard";

export function getMotionIntensityFromEnv(): MotionIntensitySetting {
  const v = (process.env.VIDEO_MOTION_INTENSITY ?? "subtle").toLowerCase();
  if (v === "minimal" || v === "standard") return v;
  return "subtle";
}

export function getClipResolutionFromEnv(): ClipResolution {
  const v = (process.env.VIDEO_CLIP_RESOLUTION ?? "720p").toLowerCase();
  return v === "480p" ? "480p" : "720p";
}

export function aspectRatioForVideoFormat(
  format: "16:9" | "9:16"
): "16:9" | "9:16" {
  return format;
}
