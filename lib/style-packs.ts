/**
 * Style Pack Configurations
 *
 * Three built-in style packs for video generation:
 * 1. Modern Clean — Minimal, elegant transitions
 * 2. Luxury Classic — Rich, cinematic feel
 * 3. Bold Dynamic — Energetic, fast-paced
 */

import type { StylePack, StylePackConfig } from "./types";

// ─── Modern Clean ───────────────────────────────────────────────────────────

const modernCleanConfig: StylePackConfig = {
  transitions: ["dissolve_soft", "whip_pan_subtle", "cut"],
  overlays: {
    intro: "fade_in_center",
    lowerThird: "slide_up_minimal",
    priceCard: "scale_in_center",
    bedsBaths: "slide_left_minimal",
    outro: "fade_in_center",
  },
  typography: {
    font: "Inter",
    captionMaxChars: 42,
  },
  safeMargins: {
    vertical: 0.1,
    horizontal: 0.07,
  },
  music: {
    defaultTrack: "ambient_modern",
    volume: 0.3,
  },
};

// ─── Luxury Classic ─────────────────────────────────────────────────────────

const luxuryClassicConfig: StylePackConfig = {
  transitions: ["dissolve_elegant", "fade_black", "dissolve_soft"],
  overlays: {
    intro: "gold_frame_fade",
    lowerThird: "serif_slide_up",
    priceCard: "elegant_card_reveal",
    bedsBaths: "serif_slide_left",
    outro: "gold_frame_fade",
  },
  typography: {
    font: "Playfair Display",
    captionMaxChars: 38,
  },
  safeMargins: {
    vertical: 0.12,
    horizontal: 0.08,
  },
  music: {
    defaultTrack: "cinematic_piano",
    volume: 0.25,
  },
};

// ─── Bold Dynamic ───────────────────────────────────────────────────────────

const boldDynamicConfig: StylePackConfig = {
  transitions: ["whip_pan_fast", "zoom_through", "film_burn", "cut"],
  overlays: {
    intro: "bold_slam_in",
    lowerThird: "bold_slide_up",
    priceCard: "bold_scale_bounce",
    bedsBaths: "bold_slide_left",
    outro: "bold_slam_in",
  },
  typography: {
    font: "Space Grotesk",
    captionMaxChars: 36,
  },
  safeMargins: {
    vertical: 0.1,
    horizontal: 0.07,
  },
  music: {
    defaultTrack: "upbeat_electronic",
    volume: 0.35,
  },
};

// ─── Registry ───────────────────────────────────────────────────────────────

export const STYLE_PACKS: StylePack[] = [
  {
    id: "modern-clean",
    name: "Modern Clean",
    config: modernCleanConfig,
  },
  {
    id: "luxury-classic",
    name: "Luxury Classic",
    config: luxuryClassicConfig,
  },
  {
    id: "bold-dynamic",
    name: "Bold Dynamic",
    config: boldDynamicConfig,
  },
];

export const STYLE_PACK_MAP = new Map<string, StylePack>(
  STYLE_PACKS.map((sp) => [sp.id, sp])
);

/**
 * Get a style pack by ID, falling back to "modern-clean".
 */
export function getStylePack(id: string): StylePack {
  return STYLE_PACK_MAP.get(id) ?? STYLE_PACKS[0]!;
}

/**
 * Get the Kling AI motion prompt for a given motion template.
 * Prompts emphasize CONTINUOUS motion throughout the entire clip duration
 * to prevent the common issue of motion stopping after 1-2 seconds.
 */
export function getMotionPrompt(motionTemplate: string): string {
  const prompts: Record<string, string> = {
    push_in:
      "Continuous smooth dolly push-in camera movement throughout the entire shot duration, slowly and steadily moving forward into the room from start to finish, cinematic real estate interior, elegant forward motion that never stops or pauses, the camera glides deeper into the space for the full clip length",
    pan_left:
      "Continuous smooth horizontal pan sweeping from right to left throughout the entire duration of the shot, revealing the full room panorama, cinematic real estate interior, steady camera rotation that never stops moving, the pan continues smoothly from the first frame to the last",
    pan_right:
      "Continuous smooth horizontal pan sweeping from left to right throughout the entire duration of the shot, revealing the full room panorama, cinematic real estate interior, steady camera rotation that never stops moving, the pan continues smoothly from the first frame to the last",
    tilt_up:
      "Continuous smooth vertical tilt upward throughout the entire shot duration, slowly revealing from floor level up to ceiling and architectural details, cinematic real estate interior, the upward camera tilt never pauses and moves steadily from start to finish",
    tilt_down:
      "Continuous smooth vertical tilt downward throughout the entire shot duration, slowly revealing from ceiling down to floor level and furnishings, cinematic real estate interior, the downward camera tilt never pauses and moves steadily from start to finish",
    orbit:
      "Continuous slow orbital camera movement circling around the room's focal point throughout the entire shot duration, cinematic real estate interior, smooth and steady rotation that never stops, the camera arcs gracefully around the subject from the first frame to the last",
    crane_up:
      "Continuous smooth crane-up camera movement rising vertically throughout the entire shot duration, starting from a low angle and steadily ascending to reveal the full height of the space, cinematic real estate interior, the upward crane motion never pauses from start to finish",
    tracking_left:
      "Continuous smooth lateral tracking shot moving left throughout the entire shot duration, the camera glides sideways along the room revealing depth and dimension, cinematic real estate interior, steady parallel motion that never stops from the first frame to the last",
    tracking_right:
      "Continuous smooth lateral tracking shot moving right throughout the entire shot duration, the camera glides sideways along the room revealing depth and dimension, cinematic real estate interior, steady parallel motion that never stops from the first frame to the last",
    dolly_back:
      "Continuous smooth dolly pull-back camera movement throughout the entire shot duration, slowly and steadily moving backward to reveal the full scope of the room, cinematic real estate interior, elegant backward motion that never stops or pauses from start to finish",
  };

  return (
    prompts[motionTemplate] ??
    "Continuous smooth cinematic camera movement throughout the entire shot duration, real estate interior, steady and elegant motion that never stops from the first frame to the last"
  );
}
