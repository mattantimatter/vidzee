"use client";

import { createClient } from "@/lib/supabase/client";
import type { Asset, CutLength, Project, StoryboardScene } from "@/lib/types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRight,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const ease = [0.23, 1, 0.32, 1] as const;

const STYLE_PACKS = [
  { id: "modern-clean", name: "Modern Clean", description: "Minimal, elegant transitions" },
  { id: "luxury-classic", name: "Luxury Classic", description: "Rich, cinematic feel" },
  { id: "bold-dynamic", name: "Bold Dynamic", description: "Energetic, fast-paced" },
];

const CUT_LENGTHS: { value: CutLength; label: string; scenes: string }[] = [
  { value: "short", label: "Short", scenes: "10–14 scenes (30–45s)" },
  { value: "medium", label: "Medium", scenes: "15–20 scenes (45–60s)" },
  { value: "long", label: "Long", scenes: "21–30 scenes (60–90s)" },
];

/** Human-friendly room type display names */
const ROOM_DISPLAY_NAMES: Record<string, string> = {
  exterior: "Exterior",
  aerial: "Aerial",
  front: "Front",
  entry: "Entry",
  foyer: "Foyer",
  living_room: "Living Room",
  living: "Living Room",
  "living room": "Living Room",
  great_room: "Great Room",
  family_room: "Family Room",
  kitchen: "Kitchen",
  dining_room: "Dining Room",
  dining: "Dining Room",
  "dining room": "Dining Room",
  primary_suite: "Primary Suite",
  primary_bedroom: "Primary Suite",
  master_bedroom: "Primary Suite",
  "master bedroom": "Primary Suite",
  primary_bathroom: "Primary Bath",
  master_bathroom: "Primary Bath",
  "master bathroom": "Primary Bath",
  bedroom: "Bedroom",
  bathroom: "Bathroom",
  office: "Office",
  study: "Study",
  bonus_room: "Bonus Room",
  laundry: "Laundry",
  laundry_room: "Laundry",
  utility: "Utility",
  garage: "Garage",
  pool: "Pool",
  patio: "Patio",
  backyard: "Backyard",
  garden: "Garden",
  deck: "Deck",
  balcony: "Balcony",
  hallway: "Hallway",
  closet: "Closet",
  mudroom: "Mudroom",
  sunroom: "Sunroom",
  basement: "Basement",
  attic: "Attic",
  gym: "Gym",
  theater: "Theater",
  wine_cellar: "Wine Cellar",
  bar: "Bar",
};

function getDisplayRoomName(roomType: string | null): string {
  if (!roomType) return "Unknown";
  const key = roomType.toLowerCase().trim();
  if (ROOM_DISPLAY_NAMES[key]) return ROOM_DISPLAY_NAMES[key];
  // Try replacing underscores with spaces
  const spaced = key.replace(/_/g, " ");
  if (ROOM_DISPLAY_NAMES[spaced]) return ROOM_DISPLAY_NAMES[spaced];
  // Fallback: title case the original
  return roomType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Room type badge color map */
const ROOM_BADGE_COLORS: Record<string, string> = {
  exterior: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  aerial: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  front: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  entry: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  foyer: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  living: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "living room": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  living_room: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  great_room: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  family_room: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  kitchen: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  dining: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  "dining room": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  dining_room: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  bedroom: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  primary_suite: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  primary_bedroom: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "master bedroom": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  master_bedroom: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  bathroom: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  primary_bathroom: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  "master bathroom": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  master_bathroom: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  office: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  study: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  garage: "bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-400",
  pool: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  patio: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400",
  deck: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400",
  backyard: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400",
  garden: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400",
  laundry: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  laundry_room: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  utility: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  bonus_room: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  hallway: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
};

function getRoomBadgeColor(roomType: string | null): string {
  if (!roomType) return "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400";
  const key = roomType.toLowerCase().trim();
  // Try exact match
  if (ROOM_BADGE_COLORS[key]) return ROOM_BADGE_COLORS[key];
  // Try with underscores replaced
  const underscored = key.replace(/\s+/g, "_");
  if (ROOM_BADGE_COLORS[underscored]) return ROOM_BADGE_COLORS[underscored];
  // Partial match
  for (const [k, v] of Object.entries(ROOM_BADGE_COLORS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400";
}

/* ─── Sortable Scene Row ─────────────────────────────────────────────── */

function SortableSceneRow({
  scene,
  index,
  asset,
  isSelected,
  getAssetUrl,
  onSelect,
  onToggle,
}: {
  scene: StoryboardScene;
  index: number;
  asset: Asset | undefined;
  isSelected: boolean;
  getAssetUrl: (a: Asset) => string;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };

  const roomType = asset?.room_type ?? null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
        isDragging ? "shadow-lg" : ""
      } ${
        isSelected
          ? "border-accent bg-accent/5 ring-1 ring-accent/30"
          : scene.include
            ? "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-accent/30"
            : "border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 opacity-60"
      }`}
    >
      <button
        className="touch-none cursor-grab active:cursor-grabbing shrink-0 p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3.5 h-3.5 text-neutral-300" />
      </button>
      <span className="text-xs font-mono text-neutral-400 w-5 shrink-0">
        {String(index + 1).padStart(2, "0")}
      </span>
      {asset && (
        <div className="w-14 h-10 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-700 shrink-0">
          <img
            src={getAssetUrl(asset)}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">
            {scene.caption ?? getDisplayRoomName(asset?.room_type ?? null) ?? `Scene ${index + 1}`}
          </p>
          {roomType && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide shrink-0 ${getRoomBadgeColor(roomType)}`}
            >
              {getDisplayRoomName(roomType)}
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-400">
          {scene.target_duration_sec}s — {scene.motion_template ?? "auto"}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors shrink-0"
      >
        {scene.include ? (
          <Eye className="w-4 h-4 text-accent" />
        ) : (
          <EyeOff className="w-4 h-4 text-neutral-400" />
        )}
      </button>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */

export default function StoryboardPage(): ReactNode {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [stylePack, setStylePack] = useState("modern-clean");
  const [cutLength, setCutLength] = useState<CutLength>("medium");
  const [selectedScene, setSelectedScene] = useState<StoryboardScene | null>(null);

  // Store the original AI-recommended order for reset
  const originalOrderRef = useRef<StoryboardScene[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    const [projectRes, assetsRes, scenesRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("assets").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("storyboard_scenes").select("*").eq("project_id", projectId).order("scene_order"),
    ]);

    if (projectRes.data) {
      setProject(projectRes.data as Project);
      setStylePack(projectRes.data.style_pack_id ?? "modern-clean");
      setCutLength((projectRes.data.cut_length as CutLength) ?? "medium");
    }
    if (assetsRes.data) setAssets(assetsRes.data as Asset[]);
    if (scenesRes.data) {
      const sceneData = scenesRes.data as StoryboardScene[];
      setScenes(sceneData);
      originalOrderRef.current = [...sceneData];
    }
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const generateStoryboard = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/storyboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style_pack_id: stylePack, cut_length: cutLength }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error("Storyboard generation error:", err);
    }
    setGenerating(false);
  };

  const toggleScene = async (sceneId: string, include: boolean) => {
    await supabase.from("storyboard_scenes").update({ include }).eq("id", sceneId);
    setScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...s, include } : s))
    );
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = scenes.findIndex((s) => s.id === active.id);
    const newIndex = scenes.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(scenes, oldIndex, newIndex);
    setScenes(reordered);

    // Persist new order to database
    const updates = reordered.map((scene, i) => ({
      id: scene.id,
      scene_order: i + 1,
    }));

    for (const u of updates) {
      await supabase
        .from("storyboard_scenes")
        .update({ scene_order: u.scene_order })
        .eq("id", u.id);
    }
  };

  const resetOrder = async () => {
    if (originalOrderRef.current.length === 0) return;
    const original = [...originalOrderRef.current];
    setScenes(original);

    // Persist reset order to database
    for (let i = 0; i < original.length; i++) {
      const scene = original[i];
      if (!scene) continue;
      await supabase
        .from("storyboard_scenes")
        .update({ scene_order: i + 1 })
        .eq("id", scene.id);
    }
  };

  const handleContinue = async () => {
    await supabase
      .from("projects")
      .update({ style_pack_id: stylePack, cut_length: cutLength, status: "storyboard_ready" })
      .eq("id", projectId);
    router.push(`/app/project/${projectId}/generate`);
  };

  const getAssetUrl = (asset: Asset) => {
    if (!asset.storage_path_original) return "";
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

  const includedCount = scenes.filter((s) => s.include).length;
  const estimatedDuration = includedCount * 3;

  const selectedAsset = selectedScene
    ? assets.find((a) => a.id === selectedScene.asset_id)
    : null;

  return (
    <div className="flex gap-6 h-full min-h-0 p-4 md:p-6 lg:p-8">
      {/* Left Panel — Controls & Scene List (independently scrollable) */}
      <div
        className="flex-1 min-w-0 min-h-0 overflow-y-auto overscroll-contain pr-2"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Storyboard
          </h1>
          <p className="text-neutral-500 text-sm mt-1">
            {project?.title ?? "Untitled"} — {assets.length} photos uploaded
          </p>
        </div>

        {/* Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Style Pack */}
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-3">
              Style Pack
            </h3>
            <div className="space-y-2">
              {STYLE_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => setStylePack(pack.id)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border transition-colors text-sm ${
                    stylePack === pack.id
                      ? "border-accent bg-accent/5 text-accent"
                      : "border-neutral-200 dark:border-neutral-600 hover:border-accent/30 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <span className="font-medium">{pack.name}</span>
                  <span className="block text-xs text-neutral-400 mt-0.5">
                    {pack.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Cut Length */}
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-3">
              Video Length
            </h3>
            <div className="space-y-2">
              {CUT_LENGTHS.map((cut) => (
                <button
                  key={cut.value}
                  onClick={() => setCutLength(cut.value)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border transition-colors text-sm ${
                    cutLength === cut.value
                      ? "border-accent bg-accent/5 text-accent"
                      : "border-neutral-200 dark:border-neutral-600 hover:border-accent/30 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <span className="font-medium">{cut.label}</span>
                  <span className="block text-xs text-neutral-400 mt-0.5">
                    {cut.scenes}
                  </span>
                </button>
              ))}
            </div>
            {scenes.length > 0 && (
              <div className="mt-3 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-700 text-xs text-neutral-600 dark:text-neutral-300">
                <span className="font-semibold">{includedCount}</span> scenes
                included — est.{" "}
                <span className="font-semibold">{estimatedDuration}s</span>
              </div>
            )}
          </div>
        </div>

        {/* Generate Button */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={generateStoryboard}
            disabled={generating || assets.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Storyboard...
              </>
            ) : scenes.length > 0 ? (
              <>
                <RefreshCw className="w-4 h-4" />
                Regenerate Storyboard
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate AI Storyboard
              </>
            )}
          </button>

          {scenes.length > 0 && (
            <button
              onClick={resetOrder}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              title="Reset to AI-recommended order"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Order
            </button>
          )}
        </div>

        {/* Scene List with Drag-to-Reorder */}
        {scenes.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={scenes.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 mb-6">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                  Scenes — drag to reorder
                </h3>
                {scenes.map((scene, i) => {
                  const asset = assets.find((a) => a.id === scene.asset_id);
                  const isSelected = selectedScene?.id === scene.id;
                  return (
                    <SortableSceneRow
                      key={scene.id}
                      scene={scene}
                      index={i}
                      asset={asset}
                      isSelected={isSelected}
                      getAssetUrl={getAssetUrl}
                      onSelect={() => setSelectedScene(scene)}
                      onToggle={() => toggleScene(scene.id, !scene.include)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Continue */}
        {scenes.length > 0 && (
          <div className="pb-6">
            <button
              onClick={handleContinue}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-900 dark:bg-white dark:text-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
            >
              Continue to Generate Clips
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Right Panel — Preview (independently scrollable) */}
      <div
        className="hidden lg:flex w-[45%] shrink-0 bg-neutral-100 dark:bg-neutral-800 rounded-2xl items-center justify-center overflow-y-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {selectedAsset ? (
          <motion.div
            key={selectedScene?.id}
            className="flex flex-col items-center p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease }}
          >
            <img
              src={getAssetUrl(selectedAsset)}
              alt=""
              className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-lg"
            />
            <div className="mt-4 text-center">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                {selectedScene?.caption ?? getDisplayRoomName(selectedAsset.room_type) ?? "Scene Preview"}
              </p>
              {selectedAsset.room_type && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold mt-2 ${getRoomBadgeColor(selectedAsset.room_type)}`}
                >
                  {getDisplayRoomName(selectedAsset.room_type)}
                </span>
              )}
              <p className="text-xs text-neutral-400 mt-1">
                {selectedScene?.target_duration_sec}s —{" "}
                {selectedScene?.motion_template ?? "auto"}
              </p>
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
