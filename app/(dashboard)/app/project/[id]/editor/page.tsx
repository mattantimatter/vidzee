"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  Project,
  Render,
  StoryboardScene,
  Asset,
  EditorClip,
  EditorOverlay,
  EditorState,
  TransitionType,
  OverlayType,
  EditStyleId,
} from "@/lib/types";
import { getEditStyle, TRANSITION_LABELS } from "@/lib/edit-styles";
import { StyleSelector } from "@/components/style-selector";
import { TransitionPicker } from "@/components/transition-picker";
import { TrimHandles } from "@/components/trim-handle";
import {
  ArrowLeft,
  Film,
  GripVertical,
  Loader2,
  Monitor,
  Music,
  Pause,
  Play,
  Plus,
  Save,
  Smartphone,
  Trash2,
  Type,
  Volume2,
  VolumeX,
  Wand2,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StepNavigation } from "@/components/step-navigation";

// ─── Constants ──────────────────────────────────────────────────────────────

const OVERLAY_OPTIONS: { value: OverlayType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "intro", label: "Intro Title" },
  { value: "lower_third", label: "Lower Third" },
  { value: "price_card", label: "Price Card" },
  { value: "beds_baths", label: "Beds/Baths" },
  { value: "outro", label: "Outro" },
];

const MUSIC_GENRES = [
  { value: "ambient", label: "Ambient" },
  { value: "cinematic piano", label: "Cinematic Piano" },
  { value: "upbeat electronic", label: "Upbeat Electronic" },
  { value: "acoustic", label: "Acoustic" },
];

// ─── Transition CSS Helpers ─────────────────────────────────────────────────

function getTransitionStyle(
  transition: TransitionType,
  progress: number
): React.CSSProperties {
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
}

// ─── Overlay Component ──────────────────────────────────────────────────────

function OverlayDisplay({
  overlay,
  editStyle,
}: {
  overlay: EditorOverlay | undefined;
  editStyle: EditStyleId;
}) {
  if (!overlay || overlay.type === "none") return null;

  const style = getEditStyle(editStyle);
  const accentBg = style.accentColor === "#FFFFFF" ? "#1a1a1a" : style.accentColor;

  const baseClass =
    "absolute text-white pointer-events-none animate-in fade-in duration-500";

  switch (overlay.type) {
    case "intro":
      return (
        <div className={`${baseClass} inset-0 flex items-center justify-center`}>
          <div className="text-center px-4">
            <div
              className="text-2xl md:text-3xl font-bold tracking-tight drop-shadow-lg"
              style={{ fontFamily: style.id === "cinematic" ? "serif" : style.id === "dynamic" ? "system-ui" : "sans-serif" }}
            >
              {overlay.text}
            </div>
          </div>
        </div>
      );
    case "lower_third":
      return (
        <div className={`${baseClass} bottom-4 left-4 right-4`}>
          <div
            className="backdrop-blur-sm rounded-lg px-4 py-2 inline-block"
            style={{ backgroundColor: `${accentBg}CC` }}
          >
            <div className="text-sm font-medium">{overlay.text}</div>
          </div>
        </div>
      );
    case "price_card":
      return (
        <div className={`${baseClass} top-4 right-4`}>
          <div
            className="backdrop-blur-sm rounded-xl px-5 py-3"
            style={{ backgroundColor: `${accentBg}E6` }}
          >
            <div className="text-lg font-bold">{overlay.text}</div>
          </div>
        </div>
      );
    case "beds_baths":
      return (
        <div className={`${baseClass} bottom-4 right-4`}>
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2">
            <div className="text-sm font-medium">{overlay.text}</div>
          </div>
        </div>
      );
    case "outro":
      return (
        <div className={`${baseClass} inset-0 flex items-center justify-center`}>
          <div className="text-center">
            <div className="text-xl font-bold drop-shadow-lg">{overlay.text}</div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

// ─── Main Editor Component ──────────────────────────────────────────────────

export default function EditorPage(): ReactNode {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  // ─── State ──────────────────────────────────────────────────────────────
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editor state
  const [clips, setClips] = useState<EditorClip[]>([]);
  const [overlays, setOverlays] = useState<EditorOverlay[]>([]);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [musicGenre, setMusicGenre] = useState("ambient");
  const [generatingMusic, setGeneratingMusic] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);

  // Task 2: Edit style
  const [editStyle, setEditStyle] = useState<EditStyleId>("real-estate-pro");

  // Task 7: Video format
  const [videoFormat, setVideoFormat] = useState<"16:9" | "9:16">("16:9");

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [transitionProgress, setTransitionProgress] = useState(1);

  // Selection
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  // Drag state (reorder)
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Task 4: Trim handle clip widths
  const clipWidthPx = 96; // 24 * 4 = 96px (w-24)

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Data Loading ───────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const [projectRes, scenesRes, assetsRes, rendersRes, editorStateRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase
        .from("storyboard_scenes")
        .select("*")
        .eq("project_id", projectId)
        .eq("include", true)
        .order("scene_order"),
      supabase.from("assets").select("*").eq("project_id", projectId),
      supabase
        .from("renders")
        .select("*")
        .eq("project_id", projectId)
        .eq("type", "scene_clip")
        .eq("status", "done")
        .order("created_at"),
      supabase
        .from("renders")
        .select("input_refs")
        .eq("project_id", projectId)
        .eq("type", "editor_state")
        .limit(1)
        .single(),
    ]);

    const proj = projectRes.data as Project | null;
    setProject(proj);

    // Task 7: Load video format from project
    const fmt = (proj as Record<string, unknown> | null)?.video_format as string | null | undefined;
    setVideoFormat(fmt === "9:16" ? "9:16" : "16:9");

    const scenes = (scenesRes.data ?? []) as StoryboardScene[];
    const assets = (assetsRes.data ?? []) as Asset[];
    const renders = (rendersRes.data ?? []) as Render[];

    const savedState = editorStateRes.data?.input_refs as EditorState | null;

    if (savedState?.clips && savedState.clips.length > 0) {
      setClips(savedState.clips);
      setOverlays(savedState.overlays ?? []);
      setMusicUrl(savedState.musicUrl ?? null);
      setMusicVolume(savedState.musicVolume ?? 0.3);
      setMusicGenre(savedState.musicGenre ?? "ambient");
      if (savedState.editStyle) setEditStyle(savedState.editStyle);
    } else {
      const editorClips: EditorClip[] = [];

      for (const scene of scenes) {
        const render = renders.find((r) => {
          const refs = r.input_refs as Record<string, string> | null;
          return refs?.scene_id === scene.id;
        });

        if (!render?.output_path) continue;

        const asset = assets.find((a) => a.id === scene.asset_id);
        const clipUrl = supabase.storage
          .from("scene-clips")
          .getPublicUrl(render.output_path).data.publicUrl;

        const thumbnailUrl = asset?.storage_path_original
          ? supabase.storage
              .from("photos-original")
              .getPublicUrl(asset.storage_path_original).data.publicUrl
          : "";

        editorClips.push({
          id: render.id,
          sceneId: scene.id,
          assetId: scene.asset_id ?? "",
          clipUrl,
          thumbnailUrl,
          caption: scene.caption ?? "",
          roomType: asset?.room_type ?? "unknown",
          order: scene.scene_order,
          trimStart: 0,
          trimEnd: render.duration_sec ?? 3,
          duration: render.duration_sec ?? 3,
          transition: "dissolve" as TransitionType,
        });
      }

      setClips(editorClips);

      // Auto-generate default overlays
      const defaultOverlays: EditorOverlay[] = [];
      if (editorClips.length > 0 && proj) {
        const firstClip = editorClips[0];
        if (firstClip) {
          defaultOverlays.push({
            id: `overlay-intro-${firstClip.id}`,
            clipId: firstClip.id,
            type: "intro",
            text: proj.title ?? proj.address ?? "Property Tour",
            startSec: 0,
            durationSec: firstClip.duration,
          });
        }

        if (editorClips.length > 1 && proj.price) {
          const secondClip = editorClips[1];
          if (secondClip) {
            defaultOverlays.push({
              id: `overlay-price-${secondClip.id}`,
              clipId: secondClip.id,
              type: "price_card",
              text: `$${proj.price.toLocaleString()}`,
              startSec: 0,
              durationSec: secondClip.duration,
            });
          }
        }

        if (editorClips.length > 2 && (proj.beds ?? proj.baths)) {
          const thirdClip = editorClips[2];
          if (thirdClip) {
            defaultOverlays.push({
              id: `overlay-bb-${thirdClip.id}`,
              clipId: thirdClip.id,
              type: "beds_baths",
              text: [
                proj.beds ? `${proj.beds} Beds` : null,
                proj.baths ? `${proj.baths} Baths` : null,
                proj.sqft ? `${proj.sqft.toLocaleString()} Sq Ft` : null,
              ]
                .filter(Boolean)
                .join(" · "),
              startSec: 0,
              durationSec: thirdClip.duration,
            });
          }
        }

        for (let i = 3; i < editorClips.length; i++) {
          const clip = editorClips[i];
          if (clip && clip.caption) {
            defaultOverlays.push({
              id: `overlay-lt-${clip.id}`,
              clipId: clip.id,
              type: "lower_third",
              text: clip.caption,
              startSec: 0,
              durationSec: clip.duration,
            });
          }
        }

        const lastClip = editorClips[editorClips.length - 1];
        if (lastClip && proj.agent_name) {
          defaultOverlays.push({
            id: `overlay-outro-${lastClip.id}`,
            clipId: lastClip.id,
            type: "outro",
            text: [proj.agent_name, proj.brokerage].filter(Boolean).join(" · "),
            startSec: 0,
            durationSec: lastClip.duration,
          });
        }
      }

      setOverlays(defaultOverlays);
    }

    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ─── Computed Values ────────────────────────────────────────────────────

  const totalDuration = useMemo(
    () => clips.reduce((sum, clip) => sum + (clip.trimEnd - clip.trimStart), 0),
    [clips]
  );

  const selectedClip = useMemo(
    () => clips.find((c) => c.id === selectedClipId) ?? null,
    [clips, selectedClipId]
  );

  const currentOverlay = useMemo(
    () => overlays.find((o) => clips[currentClipIndex]?.id === o.clipId) ?? undefined,
    [overlays, clips, currentClipIndex]
  );

  const currentStyle = useMemo(() => getEditStyle(editStyle), [editStyle]);

  // Task 7: aspect ratio for preview
  const isPortrait = videoFormat === "9:16";

  // ─── Playback Controls ─────────────────────────────────────────────────

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    if (videoRef.current) videoRef.current.pause();
    if (audioRef.current) audioRef.current.pause();
  }, []);

  const startPlayback = useCallback(() => {
    if (clips.length === 0) return;
    setIsPlaying(true);
    const video = videoRef.current;
    if (video) {
      video.currentTime = clips[currentClipIndex]?.trimStart ?? 0;
      video.play().catch(() => {});
    }
    if (audioRef.current && musicUrl) {
      audioRef.current.volume = musicVolume;
      audioRef.current.play().catch(() => {});
    }
  }, [clips, currentClipIndex, musicUrl, musicVolume]);

  const handleVideoEnded = useCallback(() => {
    const nextIndex = currentClipIndex + 1;
    if (nextIndex >= clips.length) {
      stopPlayback();
      setCurrentClipIndex(0);
      return;
    }
    const nextClip = clips[nextIndex];
    if (!nextClip) return;
    const transition = nextClip.transition;
    if (transition === "cut") {
      setCurrentClipIndex(nextIndex);
      setTransitionProgress(1);
    } else {
      setTransitionProgress(0);
      setCurrentClipIndex(nextIndex);
      let progress = 0;
      const transitionTimer = setInterval(() => {
        progress += 0.05;
        if (progress >= 1) {
          clearInterval(transitionTimer);
          setTransitionProgress(1);
        } else {
          setTransitionProgress(progress);
        }
      }, 25);
    }
  }, [currentClipIndex, clips, stopPlayback]);

  useEffect(() => {
    if (!isPlaying) return;
    const video = videoRef.current;
    const clip = clips[currentClipIndex];
    if (video && clip) {
      video.src = clip.clipUrl;
      video.currentTime = clip.trimStart;
      video.play().catch(() => {});
    }
  }, [currentClipIndex, isPlaying, clips]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (video) {
        setPlaybackTime(video.currentTime);
        const clip = clips[currentClipIndex];
        if (clip && video.currentTime >= clip.trimEnd) {
          handleVideoEnded();
        }
      }
    }, 100);
    playbackTimerRef.current = timer;
    return () => clearInterval(timer);
  }, [isPlaying, currentClipIndex, clips, handleVideoEnded]);

  // ─── Save Editor State ──────────────────────────────────────────────────

  const saveEditorState = useCallback(async () => {
    setSaving(true);
    const editorState: EditorState = {
      clips,
      overlays,
      musicUrl,
      musicVolume,
      musicGenre,
      totalDuration,
      editStyle,
    };

    const { data: existing } = await supabase
      .from("renders")
      .select("id")
      .eq("project_id", projectId)
      .eq("type", "editor_state")
      .limit(1)
      .single();

    if (existing?.id) {
      await supabase
        .from("renders")
        .update({
          input_refs: editorState as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("renders").insert({
        project_id: projectId,
        type: "editor_state",
        status: "done",
        provider: "client",
        input_refs: editorState as unknown as Record<string, unknown>,
      });
    }

    await supabase
      .from("projects")
      .update({ status: "editing", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    setSaving(false);
  }, [clips, overlays, musicUrl, musicVolume, musicGenre, totalDuration, editStyle, projectId, supabase]);

  // ─── Clip Operations ───────────────────────────────────────────────────

  const updateClip = useCallback(
    (clipId: string, updates: Partial<EditorClip>) => {
      setClips((prev) => prev.map((c) => (c.id === clipId ? { ...c, ...updates } : c)));
    },
    []
  );

  const removeClip = useCallback(
    (clipId: string) => {
      setClips((prev) => prev.filter((c) => c.id !== clipId));
      setOverlays((prev) => prev.filter((o) => o.clipId !== clipId));
      if (selectedClipId === clipId) setSelectedClipId(null);
    },
    [selectedClipId]
  );

  const reorderClips = useCallback((fromIndex: number, toIndex: number) => {
    setClips((prev) => {
      const newClips = [...prev];
      const item = newClips[fromIndex];
      if (!item) return prev;
      newClips.splice(fromIndex, 1);
      newClips.splice(toIndex, 0, item);
      return newClips.map((c, i) => ({ ...c, order: i + 1 }));
    });
  }, []);

  // Task 4: Trim handle callback
  const handleTrimChange = useCallback(
    (clipId: string, trimStart: number, trimEnd: number) => {
      updateClip(clipId, { trimStart, trimEnd });
    },
    [updateClip]
  );

  // ─── Overlay Operations ─────────────────────────────────────────────────

  const addOverlay = useCallback(
    (clipId: string, type: OverlayType, text: string) => {
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;
      const newOverlay: EditorOverlay = {
        id: `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        clipId,
        type,
        text,
        startSec: 0,
        durationSec: clip.trimEnd - clip.trimStart,
      };
      setOverlays((prev) => [...prev, newOverlay]);
      setSelectedOverlayId(newOverlay.id);
    },
    [clips]
  );

  const updateOverlay = useCallback(
    (overlayId: string, updates: Partial<EditorOverlay>) => {
      setOverlays((prev) =>
        prev.map((o) => (o.id === overlayId ? { ...o, ...updates } : o))
      );
    },
    []
  );

  const removeOverlay = useCallback(
    (overlayId: string) => {
      setOverlays((prev) => prev.filter((o) => o.id !== overlayId));
      if (selectedOverlayId === overlayId) setSelectedOverlayId(null);
    },
    [selectedOverlayId]
  );

  // ─── Task 2: Style change handler ─────────────────────────────────────

  const handleStyleChange = useCallback(
    (styleId: EditStyleId, defaultTransition: TransitionType, defaultMusicGenre: string) => {
      setEditStyle(styleId);
      setMusicGenre(defaultMusicGenre);
      // Apply default transition to all clips
      setClips((prev) => prev.map((c) => ({ ...c, transition: defaultTransition })));
    },
    []
  );

  // ─── Task 1: Music Generation ──────────────────────────────────────────

  const generateMusic = useCallback(async () => {
    setGeneratingMusic(true);
    setMusicError(null);

    try {
      // Task 1: Pass the FULL video duration (not per-clip)
      const res = await fetch(`/api/projects/${projectId}/music`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: musicGenre,
          duration: Math.max(15, Math.min(120, Math.round(totalDuration))),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMusicError(data.error ?? "Music generation failed");
        setGeneratingMusic(false);
        return;
      }

      if (data.status === "pending" && data.requestId) {
        const pollInterval = setInterval(async () => {
          try {
            const pollRes = await fetch(
              `/api/projects/${projectId}/music?requestId=${data.requestId}`
            );
            const pollData = await pollRes.json();

            if (pollData.status === "completed" && pollData.audioUrl) {
              clearInterval(pollInterval);
              setMusicUrl(pollData.audioUrl);
              setGeneratingMusic(false);
            } else if (pollData.status === "failed") {
              clearInterval(pollInterval);
              setMusicError(pollData.error ?? "Music generation failed");
              setGeneratingMusic(false);
            }
          } catch {
            clearInterval(pollInterval);
            setMusicError("Failed to check music status");
            setGeneratingMusic(false);
          }
        }, 5000);

        setTimeout(() => {
          clearInterval(pollInterval);
          if (generatingMusic) {
            setMusicError("Music generation timed out");
            setGeneratingMusic(false);
          }
        }, 180000);
      } else if (data.audioUrl) {
        setMusicUrl(data.audioUrl);
        setGeneratingMusic(false);
      }
    } catch (err) {
      setMusicError(err instanceof Error ? err.message : "Music generation failed");
      setGeneratingMusic(false);
    }
  }, [projectId, musicGenre, totalDuration, generatingMusic]);

  // ─── Drag & Drop Handlers ──────────────────────────────────────────────

  const handleDragStart = useCallback((_e: React.DragEvent, index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      reorderClips(dragIndex, dragOverIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverIndex, reorderClips]);

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <Film className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-neutral-700 mb-2">
              No clips available
            </h2>
            <p className="text-neutral-500 text-sm mb-6">
              Generate video clips from your storyboard first, then come back to edit them.
            </p>
            <Link
              href={`/app/project/${projectId}/generate`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Go to Generate Clips
            </Link>
          </div>
        </div>
        <StepNavigation projectId={projectId} currentStep={4} />
      </div>
    );
  }

  const currentClip = clips[currentClipIndex];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* ─── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <Link href="/app" className="text-neutral-400 hover:text-neutral-700">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-sm font-semibold text-neutral-900">
                {project?.title ? `Edit: ${project.title}` : "Video Editor"}
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-neutral-400">
                  {clips.length} clips · {totalDuration.toFixed(1)}s total
                </p>
                {/* Task 7: Format badge */}
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 text-[9px] font-medium">
                  {isPortrait ? <Smartphone className="w-2.5 h-2.5" /> : <Monitor className="w-2.5 h-2.5" />}
                  {videoFormat}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={saveEditorState}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>

        {/* ─── Main Content ────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* ─── Preview Player ───────────────────────────────────────── */}
          <div className="lg:flex-1 min-h-0 flex flex-col items-center justify-center bg-neutral-950 p-4 relative">
            {/* Task 7: Respect aspect ratio in preview */}
            <div
              className={`relative bg-black rounded-lg overflow-hidden ${
                isPortrait
                  ? "h-full max-h-[70vh] aspect-[9/16]"
                  : "w-full max-w-2xl aspect-video"
              }`}
            >
              {/* Current video */}
              <video
                ref={videoRef}
                src={currentClip?.clipUrl}
                className="absolute inset-0 w-full h-full object-cover"
                style={
                  transitionProgress < 1 && currentClip
                    ? getTransitionStyle(currentClip.transition, transitionProgress)
                    : undefined
                }
                playsInline
                muted
                onEnded={handleVideoEnded}
              />

              {/* Hidden next video for preloading */}
              <video
                ref={nextVideoRef}
                src={
                  currentClipIndex + 1 < clips.length
                    ? clips[currentClipIndex + 1]?.clipUrl
                    : undefined
                }
                className="hidden"
                preload="auto"
                muted
              />

              {/* Overlay display */}
              <OverlayDisplay overlay={currentOverlay} editStyle={editStyle} />

              {/* Playback controls overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={isPlaying ? stopPlayback : startPlayback}
                    className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{
                        width: `${totalDuration > 0 ? ((clips.slice(0, currentClipIndex).reduce((s, c) => s + (c.trimEnd - c.trimStart), 0) + playbackTime) / totalDuration) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-white/70 tabular-nums">
                    {currentClipIndex + 1}/{clips.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Audio element for music */}
            {musicUrl && (
              <audio ref={audioRef} src={musicUrl} loop preload="auto" />
            )}
          </div>

          {/* ─── Right Panel (Properties) ─────────────────────────────── */}
          <div className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-neutral-200 bg-white overflow-y-auto">

            {/* Task 2: Style Selector */}
            <StyleSelector selectedStyle={editStyle} onStyleChange={handleStyleChange} />

            {/* Music Section */}
            <div className="p-4 border-b border-neutral-100">
              <div className="flex items-center gap-2 mb-3">
                <Music className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                  Background Music
                </h3>
                {/* Task 1: Show total duration */}
                <span className="ml-auto text-[9px] text-neutral-400">
                  {totalDuration.toFixed(0)}s track
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Genre</label>
                  <select
                    value={musicGenre}
                    onChange={(e) => setMusicGenre(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-sm bg-white"
                  >
                    {MUSIC_GENRES.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={generateMusic}
                  disabled={generatingMusic}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  {generatingMusic ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating {totalDuration.toFixed(0)}s track...</>
                  ) : (
                    <><Wand2 className="w-3.5 h-3.5" />Generate Music</>
                  )}
                </button>

                {musicError && <p className="text-xs text-red-500">{musicError}</p>}

                {musicUrl && (
                  <div className="space-y-2">
                    <audio src={musicUrl} controls className="w-full h-8" />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setMusicVolume((v) => (v > 0 ? 0 : 0.3))}
                        className="text-neutral-400 hover:text-neutral-700"
                      >
                        {musicVolume > 0 ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={musicVolume}
                        onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                        className="flex-1 h-1 accent-accent"
                      />
                      <span className="text-xs text-neutral-400 w-8 text-right">
                        {Math.round(musicVolume * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Selected Clip Properties */}
            {selectedClip && (
              <div className="p-4 border-b border-neutral-100">
                <div className="flex items-center gap-2 mb-3">
                  <Film className="w-4 h-4 text-accent" />
                  <h3 className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Clip Properties
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Caption</label>
                    <input
                      type="text"
                      value={selectedClip.caption}
                      onChange={(e) => updateClip(selectedClip.id, { caption: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-sm"
                    />
                  </div>

                  {/* Task 3: Visual transition picker */}
                  <div>
                    <label className="block text-xs text-neutral-500 mb-2">Transition In</label>
                    <TransitionPicker
                      available={currentStyle.transitions}
                      selected={selectedClip.transition}
                      onChange={(t) => updateClip(selectedClip.id, { transition: t })}
                    />
                  </div>

                  {/* Task 4: Trim controls (numeric + drag handles shown on timeline) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">Trim Start</label>
                      <input
                        type="number"
                        min="0"
                        max={selectedClip.trimEnd - 0.5}
                        step="0.1"
                        value={selectedClip.trimStart.toFixed(1)}
                        onChange={(e) =>
                          updateClip(selectedClip.id, { trimStart: parseFloat(e.target.value) })
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">Trim End</label>
                      <input
                        type="number"
                        min={selectedClip.trimStart + 0.5}
                        max={selectedClip.duration}
                        step="0.1"
                        value={selectedClip.trimEnd.toFixed(1)}
                        onChange={(e) =>
                          updateClip(selectedClip.id, { trimEnd: parseFloat(e.target.value) })
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-sm"
                      />
                    </div>
                  </div>

                  {/* Overlay for this clip */}
                  <div className="pt-2 border-t border-neutral-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-neutral-600">Overlay</span>
                      {!overlays.find((o) => o.clipId === selectedClip.id) && (
                        <button
                          onClick={() => addOverlay(selectedClip.id, "lower_third", selectedClip.caption)}
                          className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80"
                        >
                          <Plus className="w-3 h-3" />
                          Add
                        </button>
                      )}
                    </div>

                    {overlays
                      .filter((o) => o.clipId === selectedClip.id)
                      .map((overlay) => (
                        <div key={overlay.id} className="space-y-2 bg-neutral-50 rounded-lg p-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={overlay.type}
                              onChange={(e) => updateOverlay(overlay.id, { type: e.target.value as OverlayType })}
                              className="flex-1 px-2 py-1 rounded border border-neutral-200 text-xs bg-white"
                            >
                              {OVERLAY_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => removeOverlay(overlay.id)}
                              className="text-neutral-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={overlay.text}
                            onChange={(e) => updateOverlay(overlay.id, { text: e.target.value })}
                            placeholder="Overlay text..."
                            className="w-full px-2 py-1 rounded border border-neutral-200 text-xs"
                          />
                        </div>
                      ))}
                  </div>

                  <button
                    onClick={() => removeClip(selectedClip.id)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove Clip
                  </button>
                </div>
              </div>
            )}

            {/* Quick tip when nothing selected */}
            {!selectedClip && (
              <div className="p-4 text-center">
                <Type className="w-8 h-8 text-neutral-200 mx-auto mb-2" />
                <p className="text-xs text-neutral-400">
                  Select a clip on the timeline to edit its properties, transitions, and overlays.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ─── Timeline ────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-neutral-200 bg-neutral-50">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Timeline</span>
            <span className="text-xs text-neutral-400">
              Drag to reorder · Click to select · Drag handles to trim
            </span>
          </div>
          <div
            className="flex gap-1 px-4 pb-3 overflow-x-auto"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {clips.map((clip, index) => {
              const isSelected = clip.id === selectedClipId;
              const isCurrent = index === currentClipIndex;
              const isDragOver = index === dragOverIndex;
              const clipOverlay = overlays.find((o) => o.clipId === clip.id);

              return (
                <div key={clip.id} className="flex items-center gap-1">
                  {/* Transition indicator */}
                  {index > 0 && (
                    <div
                      className="flex-shrink-0 w-6 h-12 flex items-center justify-center cursor-pointer group"
                      onClick={() => setSelectedClipId(clip.id)}
                      title={`Transition: ${TRANSITION_LABELS[clip.transition] ?? clip.transition}`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[7px] font-bold transition-colors ${
                          clip.transition === "cut"
                            ? "border-neutral-300 text-neutral-400"
                            : "border-accent text-accent"
                        } group-hover:border-accent group-hover:text-accent`}
                      >
                        {clip.transition === "cut" ? "C" :
                          clip.transition === "dissolve" ? "D" :
                          clip.transition === "fade_black" ? "F" :
                          clip.transition === "zoom_in" ? "Z" :
                          clip.transition === "snap_zoom" ? "S" :
                          "W"}
                      </div>
                    </div>
                  )}

                  {/* Clip thumbnail with trim handles */}
                  <motion.div
                    draggable
                    onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, index)}
                    onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, index)}
                    onDragEnd={handleDragEnd}
                    onClick={() => {
                      setSelectedClipId(clip.id);
                      if (!isPlaying) {
                        setCurrentClipIndex(index);
                        const video = videoRef.current;
                        if (video) {
                          video.src = clip.clipUrl;
                          video.currentTime = clip.trimStart;
                        }
                      }
                    }}
                    className={`flex-shrink-0 w-24 rounded-lg overflow-hidden cursor-pointer transition-all select-none ${
                      isSelected
                        ? "ring-2 ring-accent shadow-lg scale-105"
                        : isCurrent
                          ? "ring-2 ring-accent/50"
                          : isDragOver
                            ? "ring-2 ring-blue-400"
                            : "ring-1 ring-neutral-200 hover:ring-neutral-300"
                    }`}
                    layout
                    transition={{ duration: 0.2 }}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-neutral-200">
                      {clip.thumbnailUrl ? (
                        <img
                          src={clip.thumbnailUrl}
                          alt={clip.caption}
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="w-4 h-4 text-neutral-400" />
                        </div>
                      )}

                      {/* Task 4: Drag-to-trim handles */}
                      {isSelected && (
                        <TrimHandles
                          clipId={clip.id}
                          trimStart={clip.trimStart}
                          trimEnd={clip.trimEnd}
                          duration={clip.duration}
                          clipWidthPx={clipWidthPx}
                          onTrimChange={handleTrimChange}
                        />
                      )}

                      {/* Drag handle */}
                      <div className="absolute top-0.5 left-0.5 p-0.5 rounded bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="w-2.5 h-2.5" />
                      </div>

                      {/* Duration badge */}
                      <div className="absolute bottom-0.5 right-0.5 px-1 py-0.5 rounded bg-black/60 text-white text-[9px] tabular-nums">
                        {(clip.trimEnd - clip.trimStart).toFixed(1)}s
                      </div>

                      {/* Overlay indicator */}
                      {clipOverlay && (
                        <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-accent flex items-center justify-center">
                          <Type className="w-1.5 h-1.5 text-white" />
                        </div>
                      )}

                      {/* Playing indicator */}
                      {isCurrent && isPlaying && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="w-5 h-5 rounded-full bg-accent/80 flex items-center justify-center">
                            <Play className="w-2.5 h-2.5 text-white ml-0.5" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Label */}
                    <div className="px-1.5 py-1 bg-white">
                      <p className="text-[9px] font-medium text-neutral-700 truncate">
                        {clip.caption || clip.roomType}
                      </p>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Navigation — Step 4 */}
      <StepNavigation
        projectId={projectId}
        currentStep={4}
        onSave={saveEditorState}
      />
    </div>
  );
}
