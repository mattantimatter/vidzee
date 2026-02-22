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
  | "preview"
  | "editor_state";
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

// Extended transition types covering all 3 edit styles
export type TransitionType =
  | "cut"
  | "dissolve"
  | "fade_black"
  | "fade_white"
  | "wipe_left"
  | "wipe_right"
  | "zoom_in"
  | "zoom_out"
  | "snap_zoom"
  | "swipe_left"
  | "swipe_right"
  | "rotate_cw"
  | "rotate_ccw";

export type OverlayType =
  | "none"
  | "intro"
  | "lower_third"
  | "price_card"
  | "beds_baths"
  | "outro";

// Task 2: Edit style IDs
export type EditStyleId = "cinematic" | "real-estate-pro" | "dynamic";

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
  editStyle?: EditStyleId;
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

// Task 2: Edit Style definition
export interface EditStyle {
  id: EditStyleId;
  name: string;
  description: string;
  accentColor: string;
  transitions: TransitionType[];
  defaultTransition: TransitionType;
  defaultMusicGenre: string;
  overlayStyle: "cinematic" | "pro" | "dynamic";
  transitionDuration: number; // seconds
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

// Credit system types
export interface CreditBalance {
  id: string;
  user_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: "purchase" | "usage" | "refund" | "bonus";
  description: string | null;
  stripe_session_id: string | null;
  project_id: string | null;
  created_at: string;
}

// Credit pack definitions
export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number; // in USD
  perCredit: number;
  discount: number; // percentage
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "single", name: "Single", credits: 1, price: 12.99, perCredit: 12.99, discount: 0 },
  { id: "pro5", name: "Pro 5", credits: 5, price: 49.99, perCredit: 10.0, discount: 23, popular: true },
  { id: "agency15", name: "Agency 15", credits: 15, price: 119.99, perCredit: 8.0, discount: 38 },
  { id: "enterprise50", name: "Enterprise 50", credits: 50, price: 349.99, perCredit: 7.0, discount: 46 },
];

/**
 * Calculate the credit cost for a video based on photo count.
 * 1 credit = 1 video (up to 15 photos)
 * 2 credits = 1 video (16-30 photos)
 */
export function calculateCreditCost(photoCount: number): number {
  return photoCount <= 15 ? 1 : 2;
}
