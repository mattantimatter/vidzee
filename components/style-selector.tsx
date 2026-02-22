"use client";

/**
 * StyleSelector — Task 2
 *
 * Displays 3 edit style options (Cinematic, Real Estate Pro, Dynamic)
 * at the top of the editor. Selecting a style auto-applies:
 * - Default transition type to all clips
 * - Music genre
 * - Overlay visual style
 */

import { EDIT_STYLES } from "@/lib/edit-styles";
import type { EditStyleId, TransitionType } from "@/lib/types";
import { Film, Zap, Star } from "lucide-react";
import type { ReactNode } from "react";

const STYLE_ICONS: Record<EditStyleId, ReactNode> = {
  cinematic: <Film className="w-4 h-4" />,
  "real-estate-pro": <Star className="w-4 h-4" />,
  dynamic: <Zap className="w-4 h-4" />,
};

interface StyleSelectorProps {
  selectedStyle: EditStyleId;
  onStyleChange: (styleId: EditStyleId, defaultTransition: TransitionType, defaultMusicGenre: string) => void;
}

export function StyleSelector({ selectedStyle, onStyleChange }: StyleSelectorProps): ReactNode {
  return (
    <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
          Edit Style
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {EDIT_STYLES.map((style) => {
          const isSelected = style.id === selectedStyle;
          return (
            <button
              key={style.id}
              onClick={() =>
                onStyleChange(
                  style.id,
                  style.defaultTransition,
                  style.defaultMusicGenre
                )
              }
              className={`relative flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl border text-center transition-all duration-200 ${
                isSelected
                  ? "border-accent bg-accent/5 shadow-sm"
                  : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
              }`}
            >
              {/* Color swatch */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white shadow-sm"
                style={{ backgroundColor: style.accentColor === "#FFFFFF" ? "#1a1a1a" : style.accentColor }}
              >
                {STYLE_ICONS[style.id]}
              </div>

              <div>
                <p className={`text-[11px] font-semibold leading-tight ${isSelected ? "text-accent" : "text-neutral-700"}`}>
                  {style.name}
                </p>
                <p className="text-[9px] text-neutral-400 leading-tight mt-0.5 hidden sm:block">
                  {style.description.split(",")[0]}
                </p>
              </div>

              {isSelected && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
