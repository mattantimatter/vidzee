"use client";

import { createClient } from "@/lib/supabase/client";
import type { Render, StoryboardScene, Asset } from "@/lib/types";
import {
  ArrowRight,
  CheckCircle2,
  Film,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

const ease = [0.23, 1, 0.32, 1] as const;

const STATUS_CONFIG: Record<
  string,
  { icon: typeof Loader2; color: string; label: string }
> = {
  queued: { icon: Film, color: "text-neutral-400", label: "Queued" },
  running: { icon: Loader2, color: "text-orange-500", label: "Generating" },
  done: { icon: CheckCircle2, color: "text-green-500", label: "Done" },
  failed: { icon: XCircle, color: "text-red-500", label: "Failed" },
};

export default function GeneratePage(): ReactNode {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const supabase = createClient();

  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [renders, setRenders] = useState<Render[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [scenesRes, assetsRes, rendersRes] = await Promise.all([
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
        .order("created_at"),
    ]);

    if (scenesRes.data) setScenes(scenesRes.data as StoryboardScene[]);
    if (assetsRes.data) setAssets(assetsRes.data as Asset[]);
    if (rendersRes.data) setRenders(rendersRes.data as Render[]);
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel(`renders-${projectId}`)
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

  const startGeneration = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/clips`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error || "Generation failed";
        const errorDetails = data.errors ? `\n\nDetails:\n${data.errors.join("\n")}` : "";
        alert(`Clip generation error: ${errorMsg}${errorDetails}`);
      } else {
        if (data.errors && data.errors.length > 0) {
          alert(`Some clips had issues:\n${data.errors.join("\n")}\n\n${data.submitted} clips submitted successfully.`);
        }
        await loadData();
      }
    } catch (err) {
      console.error("Generation error:", err);
      alert(`Network error: ${err instanceof Error ? err.message : "Failed to connect"}`);
    }
    setGenerating(false);
  };

  const retryScene = async (renderId: string) => {
    await supabase
      .from("renders")
      .update({ status: "queued", error: null })
      .eq("id", renderId);
    await loadData();
  };

  const getAssetUrl = (assetId: string | null) => {
    if (!assetId) return "";
    const asset = assets.find((a) => a.id === assetId);
    if (!asset?.storage_path_original) return "";
    const { data } = supabase.storage
      .from("photos-original")
      .getPublicUrl(asset.storage_path_original);
    return data.publicUrl;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const doneCount = renders.filter((r) => r.status === "done").length;
  const totalCount = scenes.length;
  const allDone = doneCount === totalCount && totalCount > 0;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  const selectedScene = scenes.find((s) => s.id === selectedSceneId);
  const selectedAsset = selectedScene
    ? assets.find((a) => a.id === selectedScene.asset_id)
    : null;
  const selectedRender = selectedScene
    ? renders.find(
        (r) =>
          r.input_refs &&
          (r.input_refs as Record<string, string>).scene_id === selectedScene.id
      )
    : null;

  return (
    <div className="flex gap-6 h-full p-4 md:p-6 lg:p-8">
      {/* Left Panel */}
      <div
        className="flex-1 min-w-0 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Generate Clips
            </h1>
            <p className="text-neutral-500 text-sm mt-1">
              {totalCount} scenes — {doneCount} complete
            </p>
          </div>
          {!allDone && renders.length === 0 && (
            <button
              onClick={startGeneration}
              disabled={generating || scenes.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Generate All Clips
                </>
              )}
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {renders.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-neutral-500">Overall Progress</span>
              <span className="font-semibold text-neutral-700">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-accent rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease }}
              />
            </div>
          </div>
        )}

        {/* Scene Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {scenes.map((scene, i) => {
            const render = renders.find(
              (r) =>
                r.input_refs &&
                (r.input_refs as Record<string, string>).scene_id === scene.id
            );
            const status = render?.status ?? "queued";
            const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.queued!;
            const Icon = config.icon;
            const isSelected = selectedSceneId === scene.id;

            return (
              <motion.div
                key={scene.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03, ease }}
                onClick={() => setSelectedSceneId(scene.id)}
                className={`border rounded-xl overflow-hidden bg-white cursor-pointer transition-all ${
                  isSelected
                    ? "border-accent ring-1 ring-accent/30"
                    : "border-neutral-200 hover:border-accent/30"
                }`}
              >
                <div className="relative aspect-video bg-neutral-100">
                  <img
                    src={getAssetUrl(scene.asset_id)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <Icon
                      className={`w-5 h-5 ${config.color} ${
                        status === "running" ? "animate-spin" : ""
                      }`}
                    />
                  </div>
                </div>
                <div className="p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-700">
                      Scene {i + 1}
                    </span>
                    <span className={`text-xs ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  {scene.caption && (
                    <p className="text-xs text-neutral-400 mt-0.5 truncate">
                      {scene.caption}
                    </p>
                  )}
                  {status === "failed" && render && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        retryScene(render.id);
                      }}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Continue */}
        {allDone && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-center"
          >
            <p className="text-green-600 font-medium mb-3 text-sm">
              All clips generated successfully!
            </p>
            <button
              onClick={() =>
                router.push(`/app/project/${projectId}/details`)
              }
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors"
            >
              Continue to Listing Details
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </div>

      {/* Right Panel — Preview */}
      <div className="hidden lg:flex w-[45%] shrink-0 bg-neutral-100 rounded-2xl items-center justify-center overflow-hidden">
        {selectedAsset ? (
          <motion.div
            key={selectedSceneId}
            className="flex flex-col items-center p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease }}
          >
            <img
              src={getAssetUrl(selectedScene?.asset_id ?? null)}
              alt=""
              className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-lg"
            />
            <div className="mt-4 text-center">
              <p className="text-sm font-medium text-neutral-700">
                {selectedScene?.caption ?? selectedAsset.room_type ?? "Scene Preview"}
              </p>
              {selectedRender && (
                <p className="text-xs text-neutral-400 mt-1">
                  Status: {selectedRender.status}
                  {selectedRender.duration_sec
                    ? ` — ${selectedRender.duration_sec}s`
                    : ""}
                </p>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center text-neutral-400">
            <Play className="w-12 h-12 mb-3 text-neutral-300" />
            <p className="text-sm font-medium">Select a scene to preview</p>
          </div>
        )}
      </div>
    </div>
  );
}
