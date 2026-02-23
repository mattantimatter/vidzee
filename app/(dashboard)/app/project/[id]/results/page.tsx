"use client";

import { createClient } from "@/lib/supabase/client";
import type { Project, Render } from "@/lib/types";
import {
  ArrowLeft,
  Download,
  Film,
  Loader2,
  Monitor,
  Play,
  RefreshCw,
  SkipForward,
  Smartphone,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StepNavigation } from "@/components/step-navigation";

const ease = [0.23, 1, 0.32, 1] as const;

/** Parse a playlist render's output_path into clip URLs */
function parsePlaylist(
  render: Render | undefined
): { clips: string[]; totalDuration: number } | null {
  if (!render?.output_path) return null;
  if (!render.output_path.startsWith("playlist:")) return null;
  try {
    const json = render.output_path.slice("playlist:".length);
    const data = JSON.parse(json);
    if (data.type === "playlist" && Array.isArray(data.clips)) {
      return { clips: data.clips, totalDuration: data.totalDuration ?? 0 };
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

/** Check if a render is a real MP4 (not a playlist) */
function isRealVideo(render: Render | undefined): boolean {
  if (!render?.output_path) return false;
  return !render.output_path.startsWith("playlist:");
}

// ─── Playlist Video Player Component ──────────────────────────────────
function PlaylistPlayer({
  clips,
  className,
}: {
  clips: string[];
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleEnded = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      return next < clips.length ? next : 0;
    });
  }, [clips.length]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.load();
      video.play().catch(() => {});
    }
  }, [currentIndex]);

  if (clips.length === 0) return null;

  return (
    <div className={className}>
      <video
        ref={videoRef}
        src={clips[currentIndex]}
        controls
        playsInline
        onEnded={handleEnded}
        className="w-full max-h-full rounded-xl shadow-lg"
      />
      <div className="flex items-center justify-center gap-2 mt-2">
        <span className="text-xs text-neutral-400">
          Clip {currentIndex + 1} of {clips.length}
        </span>
        {clips.length > 1 && (
          <button
            onClick={() =>
              setCurrentIndex((prev) =>
                prev + 1 < clips.length ? prev + 1 : 0
              )
            }
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80"
          >
            <SkipForward className="w-3 h-3" />
            Next
          </button>
        )}
      </div>
    </div>
  );
}

export default function ResultsPage(): ReactNode {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [renders, setRenders] = useState<Render[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    const [projectRes, rendersRes, clipRendersRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase
        .from("renders")
        .select("*")
        .eq("project_id", projectId)
        .in("type", ["final_vertical", "final_horizontal", "preview"])
        .order("created_at"),
      // Fetch one scene_clip render to infer video_format if not on project
      supabase
        .from("renders")
        .select("input_refs")
        .eq("project_id", projectId)
        .eq("type", "scene_clip")
        .limit(1),
    ]);

    if (projectRes.data) {
      const proj = projectRes.data as Project & { video_format?: string | null };
      // If video_format column missing from project, infer from scene_clip input_refs
      if (!proj.video_format && clipRendersRes.data && clipRendersRes.data.length > 0) {
        const clipRefs = (clipRendersRes.data[0] as { input_refs?: Record<string, unknown> | null }).input_refs;
        if (clipRefs?.video_format) {
          (proj as unknown as Record<string, unknown>).video_format = clipRefs.video_format as string;
        }
      }
      setProject(proj);
    }
    if (rendersRes.data) setRenders(rendersRes.data as Render[]);
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Poll for render completion
  useEffect(() => {
    const hasRunning = renders.some(
      (r) => r.status === "running" || r.status === "queued"
    );

    if (hasRunning && !pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(() => {
        void loadData();
      }, 5000);
    } else if (!hasRunning && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [renders, loadData]);

  useEffect(() => {
    const channel = supabase
      .channel(`results-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "renders",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          void loadData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, supabase, loadData]);

  const triggerRender = async () => {
    setTriggering(true);
    try {
      const editPlanRes = await fetch(`/api/projects/${projectId}/edit-plan`, {
        method: "POST",
      });
      const editPlanData = await editPlanRes.json();

      if (!editPlanRes.ok) {
        alert(`Edit plan error: ${editPlanData.error || "Unknown error"}`);
        setTriggering(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 55000);

      try {
        const renderRes = await fetch(`/api/projects/${projectId}/render`, {
          method: "POST",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const renderData = await renderRes.json();
        if (!renderRes.ok) {
          console.error("[Results] Render error:", renderData);
        }
      } catch {
        clearTimeout(timeoutId);
      }

      await loadData();
    } catch (err) {
      console.error("Render trigger error:", err);
      alert(
        `Error: ${err instanceof Error ? err.message : "Failed to start rendering"}`
      );
    }
    setTriggering(false);
  };

  const getDownloadUrl = (render: Render) => {
    if (!render.output_path || !isRealVideo(render)) return null;
    const { data } = supabase.storage
      .from("final-exports")
      .getPublicUrl(render.output_path);
    return data.publicUrl;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  // ─── Task 7: Determine the single format that was generated ─────────────
  // Use project.video_format to decide which render to show.
  // Fall back to checking which render actually exists.
  const projectFormat = (project as (Project & { video_format?: string | null }) | null)?.video_format;
  const isPortrait = projectFormat === "9:16";

  // Find the matching render for the generated format
  const verticalRender = renders.find((r) => r.type === "final_vertical");
  const horizontalRender = renders.find((r) => r.type === "final_horizontal");

  // The primary render is the one matching the project's video_format
  // If video_format is 9:16 → show vertical; if 16:9 → show horizontal
  // If both exist (legacy), show the one matching the format; if neither, show whichever exists
  let primaryRender: Render | undefined;
  let primaryType: "vertical" | "horizontal";
  let primaryLabel: string;
  let primaryDescription: string;

  if (isPortrait) {
    primaryRender = verticalRender ?? horizontalRender;
    primaryType = "vertical";
    primaryLabel = "Vertical (9:16)";
    primaryDescription = "Optimized for Reels, TikTok, and Stories";
  } else {
    primaryRender = horizontalRender ?? verticalRender;
    primaryType = "horizontal";
    primaryLabel = "Horizontal (16:9)";
    primaryDescription = "Optimized for YouTube and MLS";
  }

  // If we have both renders (legacy), show both but highlight the primary
  const hasBothRenders = verticalRender && horizontalRender;

  const hasDoneRenders =
    verticalRender?.status === "done" || horizontalRender?.status === "done";
  const isRendering =
    project?.status === "rendering" ||
    project?.status === "render_queued" ||
    renders.some((r) => r.status === "running" || r.status === "queued");
  const isComplete = project?.status === "complete" || hasDoneRenders;

  const primaryUrl = primaryRender ? getDownloadUrl(primaryRender) : null;
  const primaryPlaylist = parsePlaylist(primaryRender);
  const hasVideo =
    primaryRender?.status === "done" &&
    (primaryUrl || primaryPlaylist);

  // Format icon
  const FormatIcon = isPortrait ? Smartphone : Monitor;

  // ─── Render format card ─────────────────────────────────────────────────
  const renderFormatCard = (
    render: Render | undefined,
    type: "vertical" | "horizontal",
    label: string,
    description: string,
    delay: number,
    isPrimary: boolean
  ) => {
    if (!render) return null;
    const isReal = isRealVideo(render);
    const downloadUrl = isReal ? getDownloadUrl(render) : null;
    const playlist = parsePlaylist(render);

    return (
      <motion.div
        key={type}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, ease }}
        className={`border rounded-xl p-4 bg-white transition-all ${
          isPrimary
            ? "border-accent ring-1 ring-accent/30"
            : "border-neutral-200"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              {type === "vertical" ? (
                <Smartphone className="w-4 h-4 text-neutral-400" />
              ) : (
                <Monitor className="w-4 h-4 text-neutral-400" />
              )}
              <h3 className="text-sm font-semibold text-neutral-800">{label}</h3>
              {isPrimary && (
                <span className="px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[9px] font-semibold uppercase tracking-wider">
                  Generated
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">{description}</p>
            {render.status === "done" && playlist && (
              <p className="text-xs text-blue-500 mt-0.5">
                {playlist.clips.length} clips — plays in sequence
              </p>
            )}
          </div>
          {render.status === "done" && downloadUrl && (
            <a
              href={downloadUrl}
              download
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
          )}
          {(render.status === "running" || render.status === "queued") && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Rendering...
            </div>
          )}
          {render.status === "failed" && (
            <span className="text-xs text-red-500">Failed</span>
          )}
        </div>
      </motion.div>
    );
  };

  // ─── Video preview ──────────────────────────────────────────────────────
  const videoPreview = () => {
    if (!hasVideo) return null;

    if (primaryPlaylist) {
      return (
        <PlaylistPlayer
          clips={primaryPlaylist.clips}
          className={`w-full ${isPortrait ? "max-w-[280px] mx-auto" : ""}`}
        />
      );
    }

    if (primaryUrl) {
      return (
        <div className={`w-full ${isPortrait ? "max-w-[280px] mx-auto" : ""}`}>
          <video
            key={primaryUrl}
            src={primaryUrl}
            controls
            playsInline
            className="w-full rounded-xl shadow-lg"
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 p-4 md:p-6 lg:p-8 overflow-hidden">
        {/* Left Panel — Controls */}
        <div
          className="flex-1 min-w-0 overflow-y-auto"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <Link
            href="/app"
            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 mb-3"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Dashboard
          </Link>

          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-neutral-900 mb-1">
            {project?.title ?? "Results"}
          </h1>

          {/* Format badge */}
          <div className="flex items-center gap-2 mb-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 text-xs font-medium">
              <FormatIcon className="w-3.5 h-3.5" />
              {isPortrait ? "Portrait 9:16" : "Landscape 16:9"}
            </div>
            <p className="text-neutral-500 text-sm">
              {isComplete && hasDoneRenders
                ? "Your video is ready"
                : isRendering
                  ? "Rendering..."
                  : "Generate your final video"}
            </p>
          </div>

          {/* Render trigger */}
          {!isComplete && !isRendering && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12 border border-dashed border-neutral-200 rounded-2xl mb-6 bg-white"
            >
              <Film className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <h2 className="text-base font-semibold text-neutral-700 mb-1">
                Ready to render
              </h2>
              <p className="text-neutral-400 text-sm mb-5 max-w-sm mx-auto">
                Generate your final {isPortrait ? "vertical (9:16)" : "horizontal (16:9)"} video
                with captions, overlays, and transitions.
              </p>
              <button
                onClick={triggerRender}
                disabled={triggering}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 min-h-[44px]"
              >
                {triggering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Film className="w-4 h-4" />
                    Generate Final Video
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* Rendering state */}
          {isRendering && !hasDoneRenders && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 border border-neutral-200 rounded-2xl mb-6 bg-white"
            >
              <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-3" />
              <h2 className="text-base font-semibold text-neutral-700 mb-1">
                Rendering your video
              </h2>
              <p className="text-neutral-400 text-sm">
                This may take a few minutes. You can leave and come back.
              </p>
            </motion.div>
          )}

          {/* Video format card(s) — Task 7: show only the generated format */}
          {(primaryRender || (verticalRender || horizontalRender)) && (
            <div className="space-y-3">
              {hasBothRenders ? (
                // Legacy: show both but mark the primary
                <>
                  {renderFormatCard(
                    verticalRender,
                    "vertical",
                    "Vertical (9:16)",
                    "Optimized for Reels, TikTok, and Stories",
                    0.1,
                    isPortrait
                  )}
                  {renderFormatCard(
                    horizontalRender,
                    "horizontal",
                    "Horizontal (16:9)",
                    "Optimized for YouTube and MLS",
                    0.2,
                    !isPortrait
                  )}
                </>
              ) : (
                // New: show only the matching format
                renderFormatCard(
                  primaryRender,
                  primaryType,
                  primaryLabel,
                  primaryDescription,
                  0.1,
                  true
                )
              )}
            </div>
          )}

          {/* Mobile Video Preview */}
          {hasVideo && (
            <div className="lg:hidden mt-4">
              <div className="bg-neutral-100 rounded-2xl p-4">
                {videoPreview()}
              </div>
            </div>
          )}

          {/* Regenerate */}
          {isComplete && hasDoneRenders && (
            <div className="mt-6 text-center">
              <button
                onClick={triggerRender}
                disabled={triggering}
                className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-700 disabled:opacity-50 min-h-[44px]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate video
              </button>
            </div>
          )}
        </div>

        {/* Right Panel — Video Preview (Desktop only) */}
        <div className="hidden lg:flex w-[45%] shrink-0 bg-neutral-100 rounded-2xl items-center justify-center overflow-hidden">
          {hasVideo ? (
            <motion.div
              key={primaryType}
              className="flex flex-col items-center p-4 w-full h-full justify-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease }}
            >
              {videoPreview()}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center text-neutral-400">
              <Play className="w-12 h-12 mb-3 text-neutral-300" />
              <p className="text-sm font-medium">
                {isRendering
                  ? "Video is being rendered..."
                  : "Video preview will appear here"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Step Navigation — Step 5 (no next) */}
      <StepNavigation projectId={projectId} currentStep={5} />
    </div>
  );
}
