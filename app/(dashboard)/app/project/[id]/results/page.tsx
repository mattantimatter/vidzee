"use client";

import { createClient } from "@/lib/supabase/client";
import type { Project, Render } from "@/lib/types";
import {
  ArrowLeft,
  Download,
  Film,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { StepNavigation } from "@/components/step-navigation";

const ease = [0.23, 1, 0.32, 1] as const;

export default function ResultsPage(): ReactNode {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [renders, setRenders] = useState<Render[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<"vertical" | "horizontal">(
    "vertical"
  );

  const loadData = useCallback(async () => {
    const [projectRes, rendersRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase
        .from("renders")
        .select("*")
        .eq("project_id", projectId)
        .in("type", ["final_vertical", "final_horizontal", "preview"])
        .order("created_at"),
    ]);

    if (projectRes.data) setProject(projectRes.data as Project);
    if (rendersRes.data) setRenders(rendersRes.data as Render[]);
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
    try {
      await fetch(`/api/projects/${projectId}/edit-plan`, {
        method: "POST",
      });
      await loadData();
    } catch (err) {
      console.error("Render trigger error:", err);
    }
  };

  const getDownloadUrl = (render: Render) => {
    if (!render.output_path) return null;
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

  const verticalRender = renders.find((r) => r.type === "final_vertical");
  const horizontalRender = renders.find((r) => r.type === "final_horizontal");
  const isComplete = project?.status === "complete";
  const isRendering =
    project?.status === "rendering" || project?.status === "render_queued";

  const currentRender =
    activeVideo === "vertical" ? verticalRender : horizontalRender;
  const currentUrl = currentRender ? getDownloadUrl(currentRender) : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 flex gap-6 p-4 md:p-6 lg:p-8 overflow-hidden">
        {/* Left Panel — Controls */}
        <div className="flex-1 min-w-0 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <Link
            href="/app"
            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 mb-3"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Dashboard
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-1">
            {project?.title ?? "Results"}
          </h1>
          <p className="text-neutral-500 text-sm mb-6">
            {isComplete
              ? "Your videos are ready for download"
              : isRendering
                ? "Your videos are being rendered..."
                : "Generate your final videos"}
          </p>

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
                Generate your final vertical (9:16) and horizontal (16:9) videos
                with captions, overlays, and transitions.
              </p>
              <button
                onClick={triggerRender}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                <Film className="w-4 h-4" />
                Generate Final Videos
              </button>
            </motion.div>
          )}

          {/* Rendering state */}
          {isRendering && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 border border-neutral-200 rounded-2xl mb-6 bg-white"
            >
              <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-3" />
              <h2 className="text-base font-semibold text-neutral-700 mb-1">
                Rendering your videos
              </h2>
              <p className="text-neutral-400 text-sm">
                This may take a few minutes. You can leave and come back.
              </p>
            </motion.div>
          )}

          {/* Video format selector */}
          {(verticalRender || horizontalRender) && (
            <div className="space-y-3">
              {/* Vertical */}
              {verticalRender && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, ease }}
                  onClick={() => setActiveVideo("vertical")}
                  className={`border rounded-xl p-4 bg-white cursor-pointer transition-all ${
                    activeVideo === "vertical"
                      ? "border-accent ring-1 ring-accent/30"
                      : "border-neutral-200 hover:border-accent/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-800">
                        Vertical (9:16)
                      </h3>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Optimized for Reels, TikTok, and Stories
                      </p>
                    </div>
                    {verticalRender.output_path && (
                      <a
                        href={getDownloadUrl(verticalRender) ?? "#"}
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    )}
                    {verticalRender.status === "running" && (
                      <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Rendering...
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Horizontal */}
              {horizontalRender && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, ease }}
                  onClick={() => setActiveVideo("horizontal")}
                  className={`border rounded-xl p-4 bg-white cursor-pointer transition-all ${
                    activeVideo === "horizontal"
                      ? "border-accent ring-1 ring-accent/30"
                      : "border-neutral-200 hover:border-accent/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-800">
                        Horizontal (16:9)
                      </h3>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Optimized for YouTube and MLS
                      </p>
                    </div>
                    {horizontalRender.output_path && (
                      <a
                        href={getDownloadUrl(horizontalRender) ?? "#"}
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    )}
                    {horizontalRender.status === "running" && (
                      <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Rendering...
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Regenerate */}
          {isComplete && (
            <div className="mt-6 text-center">
              <button
                onClick={triggerRender}
                className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate videos with different settings
              </button>
            </div>
          )}
        </div>

        {/* Right Panel — Video Preview */}
        <div className="hidden lg:flex w-[45%] shrink-0 bg-neutral-100 rounded-2xl items-center justify-center overflow-hidden">
          {currentUrl && currentRender?.output_path ? (
            <motion.div
              key={activeVideo}
              className="flex flex-col items-center p-4 w-full h-full"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease }}
            >
              <div
                className={`flex-1 flex items-center justify-center w-full ${
                  activeVideo === "vertical" ? "max-w-[280px]" : ""
                }`}
              >
                <video
                  src={currentUrl}
                  controls
                  className="max-w-full max-h-full rounded-xl shadow-lg"
                />
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center text-neutral-400">
              <Play className="w-12 h-12 mb-3 text-neutral-300" />
              <p className="text-sm font-medium">
                {isRendering
                  ? "Video is being rendered..."
                  : "Select a format to preview"}
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
