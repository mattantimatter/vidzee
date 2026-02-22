"use client";

/**
 * TransitionPicker — Task 3
 *
 * Visual transition selector with animated previews on hover.
 * Shows only the transitions available for the current edit style.
 */

import { TRANSITION_LABELS } from "@/lib/edit-styles";
import type { TransitionType } from "@/lib/types";
import { useEffect, useRef, useState, type ReactNode } from "react";

// ─── Mini animated preview ────────────────────────────────────────────────────

function TransitionPreview({ transition }: { transition: TransitionType }): ReactNode {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const DURATION = 800; // ms

  useEffect(() => {
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const p = Math.min(elapsed / DURATION, 1);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Loop
        setTimeout(() => {
          startRef.current = null;
          setProgress(0);
          rafRef.current = requestAnimationFrame(animate);
        }, 400);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [transition]);

  const getStyle = (): React.CSSProperties => {
    switch (transition) {
      case "dissolve":
        return { opacity: progress };
      case "fade_black":
        return { opacity: progress < 0.5 ? 0 : (progress - 0.5) * 2 };
      case "fade_white":
        return { opacity: progress < 0.5 ? 0 : (progress - 0.5) * 2, filter: `brightness(${progress < 0.5 ? 5 : 1})` };
      case "wipe_left":
        return { clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` };
      case "wipe_right":
        return { clipPath: `inset(0 0 0 ${(1 - progress) * 100}%)` };
      case "zoom_in":
        return { transform: `scale(${1 + (1 - progress) * 0.5})`, opacity: progress };
      case "zoom_out":
        return { transform: `scale(${0.5 + progress * 0.5})`, opacity: progress };
      case "snap_zoom":
        return { transform: `scale(${progress < 0.5 ? 1 + (0.5 - progress) * 2 : 1})`, opacity: progress < 0.3 ? 0 : (progress - 0.3) / 0.7 };
      case "swipe_left":
        return { transform: `translateX(${(1 - progress) * 100}%)` };
      case "swipe_right":
        return { transform: `translateX(${-(1 - progress) * 100}%)` };
      case "rotate_cw":
        return { transform: `rotate(${(1 - progress) * 90}deg) scale(${0.8 + progress * 0.2})`, opacity: progress };
      case "rotate_ccw":
        return { transform: `rotate(${-(1 - progress) * 90}deg) scale(${0.8 + progress * 0.2})`, opacity: progress };
      default:
        return { opacity: 1 };
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden rounded bg-neutral-800">
      {/* Background (previous clip) */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-600 to-neutral-800" />
      {/* Foreground (next clip) */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-accent/60 to-accent/20"
        style={getStyle()}
      />
      {/* Cut: just show a flash */}
      {transition === "cut" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-0.5 h-4 bg-white/60" />
        </div>
      )}
    </div>
  );
}

// ─── Transition Picker ────────────────────────────────────────────────────────

interface TransitionPickerProps {
  available: TransitionType[];
  selected: TransitionType;
  onChange: (t: TransitionType) => void;
}

export function TransitionPicker({ available, selected, onChange }: TransitionPickerProps): ReactNode {
  const [hovered, setHovered] = useState<TransitionType | null>(null);

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {available.map((t) => {
        const isSelected = t === selected;
        const isHovered = t === hovered;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            onMouseEnter={() => setHovered(t)}
            onMouseLeave={() => setHovered(null)}
            title={TRANSITION_LABELS[t]}
            className={`flex flex-col items-center gap-1 p-1 rounded-lg border transition-all ${
              isSelected
                ? "border-accent bg-accent/5"
                : "border-neutral-200 bg-white hover:border-neutral-300"
            }`}
          >
            <div className="w-full h-8">
              {isHovered || isSelected ? (
                <TransitionPreview transition={t} />
              ) : (
                <div className="w-full h-full rounded bg-neutral-100 flex items-center justify-center">
                  <div className={`w-3 h-3 rounded-sm ${isSelected ? "bg-accent" : "bg-neutral-300"}`} />
                </div>
              )}
            </div>
            <span className={`text-[8px] font-medium leading-tight text-center ${isSelected ? "text-accent" : "text-neutral-500"}`}>
              {TRANSITION_LABELS[t]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
