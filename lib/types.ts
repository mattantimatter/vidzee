/**
 * Database types for Vidzee
 */

export type ProjectStatus =
  | "draft"
  | "uploading"
  | "tagging"
  | "storyboard_ready"
  | "clips_queued"
  | "clips_generating"
  | "clips_ready"
  | "editing"
  | "details_ready"
  | "render_queued"
  | "rendering"
  | "complete"
  | "failed";

export type CutLength = "short" | "medium" | "long";

export type RenderType =
  | "scene_clip"
  | "final_vertical"
  | "final_horizontal"
  | "preview";

export type RenderStatus = "queued" | "running" | "failed" | "done";

export type MotionTemplate =
  | "push_in"
  | "pan_left"
  | "pan_right"
  | "tilt_up"
  | "tilt_down"
  | "orbit"
  | "crane_up"
  | "tracking_left"
  | "tracking_right"
  | "dolly_back";

export type TransitionType =
  | "cut"
  | "dissolve"
  | "fade_black"
  | "wipe_left"
  | "wipe_right";

export type OverlayType =
  | "none"
  | "intro"
  | "lower_third"
  | "price_card"
  | "beds_baths"
  | "outro";

export interface EditorClip {
  id: string;
  sceneId: string;
  assetId: string;
  clipUrl: string;
  thumbnailUrl: string;
  caption: string;
  roomType: string;
  order: number;
  trimStart: number;
  trimEnd: number;
  duration: number;
  transition: TransitionType;
}

export interface EditorOverlay {
  id: string;
  clipId: string;
  type: OverlayType;
  text: string;
  startSec: number;
  durationSec: number;
}

export interface EditorState {
  clips: EditorClip[];
  overlays: EditorOverlay[];
  musicUrl: string | null;
  musicVolume: number;
  musicGenre: string;
  totalDuration: number;
}

export interface Project {
  id: string;
  user_id: string;
  title: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  highlights: string | null;
  agent_name: string | null;
  agent_phone: string | null;
  brokerage: string | null;
  logo_path: string | null;
  style_pack_id: string;
  cut_length: CutLength;
  video_format?: string | null;
  status: ProjectStatus;
  edit_state?: EditorState | null;
  music_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  project_id: string;
  storage_path_original: string | null;
  storage_path_normalized: string | null;
  width: number | null;
  height: number | null;
  hash: string | null;
  quality_score: number | null;
  room_type: string | null;
  room_confidence: number | null;
  flags: Record<string, boolean>;
  created_at: string;
}

export interface StoryboardScene {
  id: string;
  project_id: string;
  asset_id: string | null;
  scene_order: number;
  include: boolean;
  target_duration_sec: number;
  motion_template: MotionTemplate | null;
  caption: string | null;
  created_at: string;
}

export interface Render {
  id: string;
  project_id: string;
  type: RenderType;
  status: RenderStatus;
  provider: string | null;
  provider_job_id: string | null;
  input_refs: Record<string, unknown>;
  output_path: string | null;
  duration_sec: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface StylePackConfig {
  transitions: string[];
  overlays: {
    intro: string;
    lowerThird: string;
    priceCard: string;
    bedsBaths: string;
    outro: string;
  };
  typography: {
    font: string;
    captionMaxChars: number;
  };
  safeMargins: {
    vertical: number;
    horizontal: number;
  };
  music: {
    defaultTrack: string;
    volume: number;
  };
}

export interface StylePack {
  id: string;
  name: string;
  config: StylePackConfig;
}

// Cut length scene count ranges
export const CUT_LENGTH_RANGES: Record<CutLength, { min: number; max: number }> = {
  short: { min: 10, max: 14 },
  medium: { min: 15, max: 20 },
  long: { min: 21, max: 30 },
};

export const MAX_VIDEO_DURATION_SEC = 90;
export const MAX_PHOTOS = 30;
export const MIN_PHOTOS = 10;
