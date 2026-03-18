/**
 * Scene clip video provider abstraction (extend for A/B or fallback providers).
 */

export interface SceneClipProviderSubmitInput {
  prompt: string;
  image_url: string;
  duration: number;
  aspect_ratio: string;
  resolution: "720p" | "480p";
}

export interface SceneClipProvider {
  readonly id: string;
  submit(input: SceneClipProviderSubmitInput): Promise<{ request_id: string }>;
  getStatus(requestId: string): Promise<{ completed: boolean }>;
  getVideoUrl(requestId: string): Promise<{ url: string; duration?: number; num_frames?: number }>;
}
