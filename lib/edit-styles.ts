/**
 * Edit Style Configurations — Task 2
 *
 * Three edit styles inspired by Envato After Effects templates:
 * 1. Cinematic — Dark, dramatic (inspired by Cinematic Trailer Titles AE template)
 * 2. Real Estate Pro — Clean, professional with teal accent (inspired by Real Estate AE template)
 * 3. Dynamic — Energetic, fast-paced (inspired by Sport Fast Transition Premiere template)
 */

import type { EditStyle, EditStyleId, TransitionType } from "./types";

// ─── Cinematic Style ─────────────────────────────────────────────────────────

const cinematicStyle: EditStyle = {
  id: "cinematic",
  name: "Cinematic",
  description: "Dark, dramatic aesthetic with elegant typography",
  accentColor: "#FFFFFF",
  transitions: ["cut", "dissolve", "fade_black", "fade_white"],
  defaultTransition: "dissolve",
  defaultMusicGenre: "cinematic piano",
  overlayStyle: "cinematic",
  transitionDuration: 0.8,
};

// ─── Real Estate Pro Style ───────────────────────────────────────────────────

const realEstateProStyle: EditStyle = {
  id: "real-estate-pro",
  name: "Real Estate Pro",
  description: "Clean, professional with teal accent branding",
  accentColor: "#00D4AA",
  transitions: ["cut", "wipe_left", "wipe_right", "dissolve"],
  defaultTransition: "wipe_left",
  defaultMusicGenre: "ambient",
  overlayStyle: "pro",
  transitionDuration: 0.5,
};

// ─── Dynamic Style ───────────────────────────────────────────────────────────

const dynamicStyle: EditStyle = {
  id: "dynamic",
  name: "Dynamic",
  description: "Energetic, fast-paced with bold transitions",
  accentColor: "#FF4500",
  transitions: [
    "cut",
    "zoom_in",
    "zoom_out",
    "snap_zoom",
    "swipe_left",
    "swipe_right",
    "rotate_cw",
    "rotate_ccw",
  ],
  defaultTransition: "zoom_in",
  defaultMusicGenre: "upbeat electronic",
  overlayStyle: "dynamic",
  transitionDuration: 0.3,
};

// ─── Registry ────────────────────────────────────────────────────────────────

export const EDIT_STYLES: EditStyle[] = [
  cinematicStyle,
  realEstateProStyle,
  dynamicStyle,
];

export const EDIT_STYLE_MAP = new Map<EditStyleId, EditStyle>(
  EDIT_STYLES.map((s) => [s.id, s])
);

export function getEditStyle(id: EditStyleId | string | undefined): EditStyle {
  return EDIT_STYLE_MAP.get(id as EditStyleId) ?? realEstateProStyle;
}

// ─── Transition display names ─────────────────────────────────────────────────

export const TRANSITION_LABELS: Record<TransitionType, string> = {
  cut: "Cut",
  dissolve: "Dissolve",
  fade_black: "Fade to Black",
  fade_white: "Fade to White",
  wipe_left: "Wipe Left",
  wipe_right: "Wipe Right",
  zoom_in: "Zoom In",
  zoom_out: "Zoom Out",
  snap_zoom: "Snap Zoom",
  swipe_left: "Swipe Left",
  swipe_right: "Swipe Right",
  rotate_cw: "Rotate CW",
  rotate_ccw: "Rotate CCW",
};

// ─── CSS helpers for transitions ─────────────────────────────────────────────

/**
 * Get the CSS style for a transition at a given progress (0-1).
 * Used in the preview player to animate transitions between clips.
 */
export function getTransitionCSS(
  transition: TransitionType,
  progress: number
): React.CSSProperties {
  switch (transition) {
    case "dissolve":
      return { opacity: progress };
    case "fade_black":
      return { opacity: progress < 0.5 ? 0 : (progress - 0.5) * 2 };
    case "fade_white":
      return {
        opacity: progress < 0.5 ? 0 : (progress - 0.5) * 2,
        filter: `brightness(${progress < 0.5 ? 10 : 1 + (1 - progress) * 9})`,
      };
    case "wipe_left":
      return { clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` };
    case "wipe_right":
      return { clipPath: `inset(0 0 0 ${(1 - progress) * 100}%)` };
    case "zoom_in": {
      const scale = 1 + (1 - progress) * 0.5;
      return {
        transform: `scale(${scale})`,
        opacity: progress,
      };
    }
    case "zoom_out": {
      const scale = 0.5 + progress * 0.5;
      return {
        transform: `scale(${scale})`,
        opacity: progress,
      };
    }
    case "snap_zoom": {
      const snap = progress < 0.5 ? 1 + (0.5 - progress) * 2 : 1;
      return {
        transform: `scale(${snap})`,
        opacity: progress < 0.3 ? 0 : (progress - 0.3) / 0.7,
      };
    }
    case "swipe_left":
      return {
        transform: `translateX(${(1 - progress) * 100}%)`,
      };
    case "swipe_right":
      return {
        transform: `translateX(${-(1 - progress) * 100}%)`,
      };
    case "rotate_cw": {
      const deg = (1 - progress) * 90;
      return {
        transform: `rotate(${deg}deg) scale(${0.8 + progress * 0.2})`,
        opacity: progress,
      };
    }
    case "rotate_ccw": {
      const deg = -(1 - progress) * 90;
      return {
        transform: `rotate(${deg}deg) scale(${0.8 + progress * 0.2})`,
        opacity: progress,
      };
    }
    default:
      return { opacity: 1 };
  }
}

// ─── Overlay CSS classes per style ───────────────────────────────────────────

/**
 * Get Tailwind CSS classes for an overlay based on the current edit style.
 */
export function getOverlayClasses(
  overlayType: string,
  styleId: EditStyleId | string | undefined
): string {
  const style = getEditStyle(styleId);

  if (style.id === "cinematic") {
    switch (overlayType) {
      case "intro":
        return "absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/80 via-black/40 to-transparent";
      case "lower_third":
        return "absolute bottom-6 left-6 right-6";
      case "price_card":
        return "absolute top-6 right-6";
      case "beds_baths":
        return "absolute bottom-6 right-6";
      case "outro":
        return "absolute inset-0 flex items-center justify-center bg-black/70";
      default:
        return "";
    }
  }

  if (style.id === "real-estate-pro") {
    switch (overlayType) {
      case "intro":
        return "absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/60 to-transparent";
      case "lower_third":
        return "absolute bottom-4 left-4 right-4";
      case "price_card":
        return "absolute top-4 right-4";
      case "beds_baths":
        return "absolute bottom-4 right-4";
      case "outro":
        return "absolute inset-0 flex items-center justify-center bg-black/80";
      default:
        return "";
    }
  }

  if (style.id === "dynamic") {
    switch (overlayType) {
      case "intro":
        return "absolute inset-0 flex items-center justify-center";
      case "lower_third":
        return "absolute bottom-4 left-4 right-4";
      case "price_card":
        return "absolute top-4 right-4";
      case "beds_baths":
        return "absolute bottom-4 right-4";
      case "outro":
        return "absolute inset-0 flex items-center justify-center";
      default:
        return "";
    }
  }

  return "";
}
