"use client";

/**
 * TrimHandle — Task 4
 *
 * Drag-to-trim handles for timeline clips.
 * - Left handle: drag right to trim the start
 * - Right handle: drag left to trim the end
 * - Minimum clip duration: 0.5s
 * - Visual feedback: trimmed area shown as darker region
 */

import { useCallback, useRef, type ReactNode } from "react";

const MIN_DURATION = 0.5; // seconds

interface TrimHandleProps {
  clipId: string;
  trimStart: number;
  trimEnd: number;
  duration: number;
  /** Width of the clip element in pixels — used to convert px to seconds */
  clipWidthPx: number;
  onTrimChange: (clipId: string, trimStart: number, trimEnd: number) => void;
}

export function TrimHandles({
  clipId,
  trimStart,
  trimEnd,
  duration,
  clipWidthPx,
  onTrimChange,
}: TrimHandleProps): ReactNode {
  const draggingRef = useRef<"left" | "right" | null>(null);
  const startXRef = useRef<number>(0);
  const startTrimRef = useRef<number>(0);

  const pxPerSec = clipWidthPx / Math.max(duration, 0.1);

  // ─── Left handle (trim start) ─────────────────────────────────────────

  const handleLeftMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = "left";
      startXRef.current = e.clientX;
      startTrimRef.current = trimStart;

      const onMove = (me: MouseEvent) => {
        const dx = me.clientX - startXRef.current;
        const dSec = dx / pxPerSec;
        const newStart = Math.max(0, Math.min(startTrimRef.current + dSec, trimEnd - MIN_DURATION));
        onTrimChange(clipId, newStart, trimEnd);
      };

      const onUp = () => {
        draggingRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [clipId, trimStart, trimEnd, pxPerSec, onTrimChange]
  );

  // ─── Right handle (trim end) ──────────────────────────────────────────

  const handleRightMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = "right";
      startXRef.current = e.clientX;
      startTrimRef.current = trimEnd;

      const onMove = (me: MouseEvent) => {
        const dx = me.clientX - startXRef.current;
        const dSec = dx / pxPerSec;
        const newEnd = Math.max(trimStart + MIN_DURATION, Math.min(startTrimRef.current + dSec, duration));
        onTrimChange(clipId, trimStart, newEnd);
      };

      const onUp = () => {
        draggingRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [clipId, trimStart, trimEnd, duration, pxPerSec, onTrimChange]
  );

  // ─── Touch support ────────────────────────────────────────────────────

  const handleLeftTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      const touch = e.touches[0];
      if (!touch) return;
      startXRef.current = touch.clientX;
      startTrimRef.current = trimStart;

      const onMove = (te: TouchEvent) => {
        const t = te.touches[0];
        if (!t) return;
        const dx = t.clientX - startXRef.current;
        const dSec = dx / pxPerSec;
        const newStart = Math.max(0, Math.min(startTrimRef.current + dSec, trimEnd - MIN_DURATION));
        onTrimChange(clipId, newStart, trimEnd);
      };

      const onEnd = () => {
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onEnd);
      };

      window.addEventListener("touchmove", onMove, { passive: true });
      window.addEventListener("touchend", onEnd);
    },
    [clipId, trimStart, trimEnd, pxPerSec, onTrimChange]
  );

  const handleRightTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      const touch = e.touches[0];
      if (!touch) return;
      startXRef.current = touch.clientX;
      startTrimRef.current = trimEnd;

      const onMove = (te: TouchEvent) => {
        const t = te.touches[0];
        if (!t) return;
        const dx = t.clientX - startXRef.current;
        const dSec = dx / pxPerSec;
        const newEnd = Math.max(trimStart + MIN_DURATION, Math.min(startTrimRef.current + dSec, duration));
        onTrimChange(clipId, trimStart, newEnd);
      };

      const onEnd = () => {
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onEnd);
      };

      window.addEventListener("touchmove", onMove, { passive: true });
      window.addEventListener("touchend", onEnd);
    },
    [clipId, trimStart, trimEnd, duration, pxPerSec, onTrimChange]
  );

  const trimStartPct = (trimStart / Math.max(duration, 0.1)) * 100;
  const trimEndPct = (trimEnd / Math.max(duration, 0.1)) * 100;

  return (
    <>
      {/* Trimmed-off region at start (darker) */}
      {trimStart > 0 && (
        <div
          className="absolute top-0 bottom-0 left-0 bg-black/50 pointer-events-none z-10"
          style={{ width: `${trimStartPct}%` }}
        />
      )}

      {/* Trimmed-off region at end (darker) */}
      {trimEnd < duration && (
        <div
          className="absolute top-0 bottom-0 right-0 bg-black/50 pointer-events-none z-10"
          style={{ width: `${100 - trimEndPct}%` }}
        />
      )}

      {/* Left trim handle */}
      <div
        className="absolute top-0 bottom-0 z-20 flex items-center justify-center cursor-ew-resize group"
        style={{ left: `${trimStartPct}%`, width: "12px", marginLeft: "-6px" }}
        onMouseDown={handleLeftMouseDown}
        onTouchStart={handleLeftTouchStart}
      >
        <div className="w-1.5 h-8 rounded-full bg-accent shadow-md group-hover:w-2 transition-all" />
      </div>

      {/* Right trim handle */}
      <div
        className="absolute top-0 bottom-0 z-20 flex items-center justify-center cursor-ew-resize group"
        style={{ left: `${trimEndPct}%`, width: "12px", marginLeft: "-6px" }}
        onMouseDown={handleRightMouseDown}
        onTouchStart={handleRightTouchStart}
      >
        <div className="w-1.5 h-8 rounded-full bg-accent shadow-md group-hover:w-2 transition-all" />
      </div>
    </>
  );
}
