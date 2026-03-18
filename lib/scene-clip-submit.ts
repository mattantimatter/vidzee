/**
 * Shared logic to submit one listing photo to Grok Imagine Video (fal queue).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aspectRatioForVideoFormat,
  DEFAULT_CLIP_DURATION_SEC,
  getClipResolutionFromEnv,
  getMotionIntensityFromEnv,
  type MotionIntensitySetting,
} from "@/lib/real-estate-video-config";
import {
  buildRealEstateVideoPrompt,
  normalizeToEffectiveMotion,
  shouldReduceMotionForConfidence,
  type EffectiveMotion,
} from "@/lib/real-estate-motion-prompt";
import { grokSubmitImageToVideo, type GrokAspectRatio } from "@/lib/video-providers/grok-imagine";

export interface SceneClipSubmitContext {
  admin: SupabaseClient;
  projectId: string;
  sceneId: string;
  assetId: string;
  storagePathOriginal: string;
  videoFormat: "16:9" | "9:16";
  roomType: string;
  motionTemplate: string | null | undefined;
  /** From room_tags / asset tagging if available */
  tagConfidence: number | null | undefined;
  conservativeRetry: boolean;
  /** Override env intensity (e.g. after QA retry) */
  motionIntensityOverride?: MotionIntensitySetting;
  /** Force motion (e.g. push_in on conservative QA retry) */
  effectiveMotionOverride?: EffectiveMotion;
}

export interface SceneClipSubmitResult {
  request_id: string;
  image_url: string;
  input_refs: Record<string, unknown>;
}

export async function submitSceneClipToGrok(
  ctx: SceneClipSubmitContext
): Promise<SceneClipSubmitResult> {
  const { data: signed, error: signErr } = await ctx.admin.storage
    .from("photos-original")
    .createSignedUrl(ctx.storagePathOriginal, 3600);

  if (signErr || !signed?.signedUrl) {
    throw new Error(
      signErr?.message ?? "Could not create signed URL for source image"
    );
  }

  const imageUrl = signed.signedUrl;
  let intensity =
    ctx.motionIntensityOverride ?? getMotionIntensityFromEnv();
  if (shouldReduceMotionForConfidence(ctx.tagConfidence)) {
    intensity = "minimal";
  }
  if (ctx.conservativeRetry) {
    intensity = "minimal";
  }

  const motion =
    ctx.effectiveMotionOverride ??
    normalizeToEffectiveMotion(ctx.motionTemplate, ctx.roomType);
  const prompt = buildRealEstateVideoPrompt({
    motion,
    roomType: ctx.roomType,
    intensity,
    conservativeRetry: ctx.conservativeRetry,
  });

  const ar = aspectRatioForVideoFormat(ctx.videoFormat) as GrokAspectRatio;
  const resolution = getClipResolutionFromEnv();

  const { request_id } = await grokSubmitImageToVideo({
    prompt,
    image_url: imageUrl,
    duration: DEFAULT_CLIP_DURATION_SEC,
    aspect_ratio: ar,
    resolution,
  });

  return {
    request_id,
    image_url: imageUrl,
    input_refs: {
      scene_id: ctx.sceneId,
      asset_id: ctx.assetId,
      image_url: imageUrl,
      video_format: ctx.videoFormat,
      provider_model: "xai/grok-imagine-video/image-to-video",
      effective_motion: motion,
      motion_template_source: ctx.motionTemplate ?? null,
      room_type: ctx.roomType,
      motion_intensity: intensity,
      conservative_retry: ctx.conservativeRetry,
      duration_sec: DEFAULT_CLIP_DURATION_SEC,
      resolution,
      auto_conservative_retry_used: false,
    },
  };
}

/** Re-queue from an existing scene_clip render (failed QA or API error). */
export async function resubmitSceneClipFromRender(
  admin: SupabaseClient,
  render: {
    id: string;
    project_id: string;
    input_refs: unknown;
  },
  opts: {
    conservativeRetry: boolean;
    effectiveMotionOverride?: EffectiveMotion;
    markAutoRetryUsed?: boolean;
  }
): Promise<{ request_id: string; input_refs: Record<string, unknown> }> {
  const refs = (render.input_refs ?? {}) as Record<string, unknown>;
  const assetId = refs.asset_id as string;
  const sceneId = refs.scene_id as string;
  const videoFormat = (refs.video_format as "16:9" | "9:16") || "16:9";

  if (!assetId || !sceneId) {
    throw new Error("Render missing asset_id or scene_id in input_refs");
  }

  const { data: asset, error } = await admin
    .from("assets")
    .select("storage_path_original, room_type")
    .eq("id", assetId)
    .single();

  if (error || !asset?.storage_path_original) {
    throw new Error("Could not load asset for resubmit");
  }

  const roomType =
    (refs.room_type as string) ||
    (asset.room_type as string) ||
    "interior";
  const motionTemplate = (refs.motion_template_source as string) ?? "push_in";

  const ctx: SceneClipSubmitContext = {
    admin,
    projectId: render.project_id,
    sceneId,
    assetId,
    storagePathOriginal: asset.storage_path_original as string,
    videoFormat,
    roomType,
    motionTemplate,
    tagConfidence: null,
    conservativeRetry: opts.conservativeRetry,
  };
  if (opts.effectiveMotionOverride != null) {
    ctx.effectiveMotionOverride = opts.effectiveMotionOverride;
  }
  const result = await submitSceneClipToGrok(ctx);

  const nextRefs = {
    ...refs,
    ...result.input_refs,
    auto_conservative_retry_used:
      opts.markAutoRetryUsed === true
        ? true
        : (refs.auto_conservative_retry_used as boolean) === true,
  };

  return { request_id: result.request_id, input_refs: nextRefs };
}
