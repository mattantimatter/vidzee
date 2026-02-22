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
 *
 * Task 5 improvements:
 * - Every prompt includes "continuous", "throughout the entire duration", "from first frame to last frame"
 * - Specific camera speed descriptions: "slow and steady", "gradually accelerating"
 * - Scene-specific context: "revealing architectural details", "showcasing the room's depth"
 * - Room-type-specific motion recommendations are now embedded in the storyboard AI prompt
 */
export function getMotionPrompt(motionTemplate: string): string {
  const prompts: Record<string, string> = {
    push_in:
      "Continuous slow and steady dolly push-in camera movement throughout the entire clip duration from first frame to last frame, gradually moving forward into the room revealing architectural details and depth, cinematic real estate interior, the camera glides deeper into the space at a constant pace without stopping, pausing, or reversing at any point",

    pan_left:
      "Continuous smooth horizontal pan sweeping from right to left throughout the entire clip duration from first frame to last frame, slowly and steadily revealing the full room panorama and showcasing the room's width, cinematic real estate interior, the camera rotation never stops or hesitates, maintaining a constant speed from start to finish",

    pan_right:
      "Continuous smooth horizontal pan sweeping from left to right throughout the entire clip duration from first frame to last frame, slowly and steadily revealing the full room panorama and showcasing the room's width, cinematic real estate interior, the camera rotation never stops or hesitates, maintaining a constant speed from start to finish",

    tilt_up:
      "Continuous smooth vertical tilt upward throughout the entire clip duration from first frame to last frame, slowly and steadily revealing from floor level up to ceiling and architectural details such as crown molding, beams, and height, cinematic real estate interior, the upward camera tilt maintains constant speed without pausing",

    tilt_down:
      "Continuous smooth vertical tilt downward throughout the entire clip duration from first frame to last frame, slowly and steadily revealing from ceiling down to floor level showcasing flooring materials and furnishings, cinematic real estate interior, the downward camera tilt maintains constant speed without pausing",

    orbit:
      "Continuous slow orbital camera movement circling around the room's focal point throughout the entire clip duration from first frame to last frame, the camera arcs gracefully around the subject at a slow and steady pace showcasing the room's depth and three-dimensional space, cinematic real estate interior, the orbital motion never stops or slows down",

    crane_up:
      "Continuous smooth crane-up camera movement rising vertically throughout the entire clip duration from first frame to last frame, starting from a low angle and gradually accelerating upward to reveal the full height of the space and architectural grandeur, cinematic real estate interior, the upward crane motion maintains consistent velocity from start to finish",

    tracking_left:
      "Continuous smooth lateral tracking shot moving left throughout the entire clip duration from first frame to last frame, the camera glides sideways along the room at a slow and steady pace revealing depth and dimension and showcasing the room's full length, cinematic real estate interior, the lateral motion never stops or pauses",

    tracking_right:
      "Continuous smooth lateral tracking shot moving right throughout the entire clip duration from first frame to last frame, the camera glides sideways along the room at a slow and steady pace revealing depth and dimension and showcasing the room's full length, cinematic real estate interior, the lateral motion never stops or pauses",

    dolly_back:
      "Continuous smooth dolly pull-back camera movement throughout the entire clip duration from first frame to last frame, slowly and steadily moving backward to reveal the full scope of the room and its relationship to adjacent spaces, cinematic real estate interior, the backward motion maintains constant speed without stopping or reversing",
  };

  return (
    prompts[motionTemplate] ??
    "Continuous smooth cinematic camera movement throughout the entire clip duration from first frame to last frame, real estate interior, slow and steady motion that never stops or pauses, showcasing the room's architectural details and depth"
  );
}

/**
 * Determine the best motion template for a given room type.
 * Used in storyboard generation to assign scene-appropriate camera motion.
 *
 * Task 5: Room-type-specific motion assignment:
 * - Exterior shots → orbit or tracking shot
 * - Long rooms (hallways, kitchens) → push_in or tracking
 * - Bathrooms/small rooms → slow pan
 * - Living rooms/open spaces → crane or orbit
 * - Pool/outdoor → pull_back or orbit
 */
export function getBestMotionForRoom(roomType: string): string {
  const roomMotionMap: Record<string, string> = {
    // Exterior/aerial — sweeping reveal
    aerial: "orbit",
    exterior: "pan_left",
    front: "pan_right",

    // Entry/transition spaces
    entry: "push_in",
    foyer: "push_in",
    hallway: "tracking_right",

    // Main living spaces — showcase the room's depth
    living_room: "orbit",
    great_room: "crane_up",
    family_room: "pan_left",

    // Dining — reveal the table setting
    dining_room: "orbit",
    dining: "orbit",

    // Kitchen — follow the countertop line
    kitchen: "tracking_right",

    // Primary suite — intimate, inviting
    primary_suite: "push_in",
    primary_bedroom: "push_in",
    master_bedroom: "dolly_back",

    // Primary bathroom — reveal fixtures
    primary_bathroom: "tilt_up",
    master_bathroom: "crane_up",

    // Secondary bedrooms
    bedroom: "push_in",

    // Bathrooms/small rooms — slow pan
    bathroom: "pan_left",

    // Office/study
    office: "pan_right",
    study: "pan_left",

    // Bonus/flex spaces
    bonus_room: "tracking_left",

    // Utility spaces
    laundry: "tracking_right",
    laundry_room: "tracking_right",
    utility: "push_in",
    garage: "tracking_left",
    mudroom: "push_in",
    basement: "tracking_right",

    // Outdoor — pull_back or orbit
    patio: "dolly_back",
    deck: "dolly_back",
    backyard: "pan_left",
    pool: "orbit",
    garden: "crane_up",
    balcony: "pan_right",
  };

  const key = roomType.toLowerCase().replace(/\s+/g, "_").trim();
  return roomMotionMap[key] ?? "push_in";
}
