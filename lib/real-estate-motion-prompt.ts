/**
 * Strict real-estate image-to-video prompts for stable, non-hallucinated motion.
 * Only six motion templates; legacy storyboard values are normalized here.
 */

import type { MotionIntensitySetting } from "./real-estate-video-config";

export type EffectiveMotion =
  | "push_in"
  | "pan_left"
  | "pan_right"
  | "tilt_up"
  | "tilt_down"
  | "subtle_dolly_forward";

const NEGATIVE =
  "No shakiness, jitter, or handheld wobble. No sudden camera acceleration or stops. No melting, morphing, or flowing textures. No hallucinated objects, people, pets, or decor. Do not change room layout, wall positions, or openings. No inconsistent spatial physics. No rubbery or wobbling walls. No duplicated furniture. No warped doorways, windows, mirrors, or tiles. No flicker or exposure pumping.";

function roomGuidance(roomType: string): string {
  const r = roomType.toLowerCase().replace(/\s+/g, " ");
  if (
    /exterior|front|facade|curb|aerial|outdoor|deck|patio|pool|yard|backyard|balcony|garage/.test(
      r
    )
  ) {
    return "Preserve the facade, roof lines, windows, driveway, and landscaping as in the photo.";
  }
  if (/kitchen|pantry/.test(r)) {
    return "Preserve cabinets, counters, appliances, and island geometry; keep straight lines and perspective.";
  }
  if (/bath|powder|wc/.test(r)) {
    return "Preserve mirrors, tile grids, fixtures, and vanishing points; avoid distortion on reflective surfaces.";
  }
  if (/bed|living|family|great|dining|office|study|den|loft/.test(r)) {
    return "Preserve furniture placement, wall lines, windows, and depth cues.";
  }
  if (/hall|laundry|mud|closet|utility|basement|entry|foyer/.test(r)) {
    return "Preserve narrow-space geometry and parallel lines; minimal parallax change.";
  }
  return "Preserve architecture, furnishings, and perspective exactly as shown.";
}

/** Motion copy scaled by intensity (~25% softer than a baseline “slow” move). */
function motionLine(
  motion: EffectiveMotion,
  intensity: MotionIntensitySetting,
  forceMinimal: boolean
): string {
  const tier = forceMinimal ? "minimal" : intensity;

  const amp =
    tier === "minimal"
      ? "extremely slight, almost imperceptible drift (minimal parallax)"
      : tier === "subtle"
        ? "very gentle low-amplitude motion, about 70% slower than typical real estate B-roll"
        : "slow restrained motion, stabilized, no aggressive parallax";

  const lines: Record<EffectiveMotion, string> = {
    push_in: `${amp}; a soft stabilized push-in toward the main subject, depth increases gradually`,
    pan_left: `${amp}; a very slow horizontal pan left across the frame, horizon and verticals stay level`,
    pan_right: `${amp}; a very slow horizontal pan right, horizon and verticals stay level`,
    tilt_up: `${amp}; a very slow upward tilt revealing ceiling height without skewing verticals`,
    tilt_down: `${amp}; a very slow downward tilt toward floor and foreground without skewing verticals`,
    subtle_dolly_forward: `${amp}; a subtle forward dolly like walking slowly into the space, straight-ahead perspective`,
  };

  return lines[motion];
}

export function buildRealEstateVideoPrompt(params: {
  motion: EffectiveMotion;
  roomType: string;
  intensity: MotionIntensitySetting;
  /** Second attempt: ultra-conservative. */
  conservativeRetry?: boolean;
}): string {
  const motion = motionLine(
    params.motion,
    params.intensity,
    params.conservativeRetry === true
  );
  const room = roomGuidance(params.roomType);

  const retryExtra =
    params.conservativeRetry === true
      ? " CRITICAL: Use the smallest possible motion—nearly locked-off with microscopic drift only. Prioritize zero geometry change over visual interest."
      : "";

  return [
    "Generate a subtle, stable real estate camera move from this listing photo.",
    "Preserve the room layout, architecture, furniture placement, proportions, and viewing perspective.",
    `Motion should feel like: ${motion}, captured on a stabilized tripod or gimbal.`,
    "Maintain realistic spatial continuity and consistent geometry from first to last frame.",
    room,
    NEGATIVE,
    "The result must feel like a professional property walkthrough shot, not stylized or fantasy AI footage.",
    retryExtra,
  ].join(" ");
}

const TIGHT_ROOM = /bathroom|kitchen|powder|laundry|closet|mudroom|pantry|wc/i;

/** Prefer push_in for complex geometry; tight interiors = minimal push only. */
export function normalizeToEffectiveMotion(
  template: string | null | undefined,
  roomType: string
): EffectiveMotion {
  const room = roomType || "interior";
  if (TIGHT_ROOM.test(room)) {
    return "push_in";
  }

  const t = (template ?? "push_in").toLowerCase().replace(/-/g, "_");

  const legacyMap: Record<string, EffectiveMotion> = {
    orbit: "push_in",
    crane_up: "tilt_up",
    tracking_left: "pan_left",
    tracking_right: "pan_right",
    dolly_back: "subtle_dolly_forward",
  };

  if (legacyMap[t]) {
    if (TIGHT_ROOM.test(room) && legacyMap[t] !== "push_in") return "push_in";
    return legacyMap[t]!;
  }

  const allowed: EffectiveMotion[] = [
    "push_in",
    "pan_left",
    "pan_right",
    "tilt_up",
    "tilt_down",
    "subtle_dolly_forward",
  ];
  if (allowed.includes(t as EffectiveMotion)) {
    const m = t as EffectiveMotion;
    if (
      TIGHT_ROOM.test(room) &&
      (m === "pan_left" || m === "pan_right" || m === "subtle_dolly_forward")
    ) {
      return "push_in";
    }
    return m;
  }
  return "push_in";
}

/** Low tagging confidence → favor push_in and minimal motion risk. */
export function shouldReduceMotionForConfidence(confidence: number | null | undefined): boolean {
  if (confidence == null || Number.isNaN(confidence)) return false;
  return confidence < 0.45;
}
