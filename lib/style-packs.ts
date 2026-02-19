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
 */
export function getMotionPrompt(motionTemplate: string): string {
  const prompts: Record<string, string> = {
    push_in:
      "Smooth slow push-in camera movement, cinematic real estate interior shot, steady dolly forward",
    pan_left:
      "Smooth horizontal pan from right to left, cinematic real estate shot, steady camera movement",
    pan_right:
      "Smooth horizontal pan from left to right, cinematic real estate shot, steady camera movement",
    tilt_up:
      "Smooth vertical tilt upward, cinematic real estate shot revealing ceiling and architectural details",
    tilt_down:
      "Smooth vertical tilt downward, cinematic real estate shot revealing floor and furnishings",
  };

  return (
    prompts[motionTemplate] ??
    "Smooth cinematic camera movement, real estate interior shot, steady and elegant"
  );
}
