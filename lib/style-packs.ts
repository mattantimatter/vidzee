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
 * @deprecated Scene clips use buildRealEstateVideoPrompt() + normalizeToEffectiveMotion().
 * Kept for any legacy call sites.
 */
export function getMotionPrompt(motionTemplate: string): string {
  return motionTemplate;
}

/**
 * Assign motion template per room type for storyboard (Grok-friendly, stable moves).
 * Uses: push_in, pan_left, pan_right, tilt_*, subtle_dolly_forward only at assignment;
 * legacy values are normalized at generation time.
 */
export function getBestMotionForRoom(roomType: string): string {
  const roomMotionMap: Record<string, string> = {
    aerial: "push_in",
    exterior: "pan_left",
    front: "push_in",

    entry: "subtle_dolly_forward",
    foyer: "subtle_dolly_forward",
    hallway: "subtle_dolly_forward",

    living_room: "subtle_dolly_forward",
    great_room: "pan_left",
    family_room: "pan_right",

    dining_room: "pan_left",
    dining: "push_in",

    kitchen: "push_in",

    primary_suite: "push_in",
    primary_bedroom: "push_in",
    master_bedroom: "push_in",

    primary_bathroom: "push_in",
    master_bathroom: "push_in",

    bedroom: "push_in",

    bathroom: "push_in",

    office: "pan_right",
    study: "push_in",

    bonus_room: "subtle_dolly_forward",

    laundry: "push_in",
    laundry_room: "push_in",
    utility: "push_in",
    garage: "subtle_dolly_forward",
    mudroom: "push_in",
    basement: "subtle_dolly_forward",

    patio: "pan_left",
    deck: "pan_right",
    backyard: "pan_left",
    pool: "push_in",
    garden: "tilt_up",
    balcony: "pan_right",
  };

  const key = roomType.toLowerCase().replace(/\s+/g, "_").trim();
  return roomMotionMap[key] ?? "push_in";
}
