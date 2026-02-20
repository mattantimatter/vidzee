"use client";

import { createClient } from "@/lib/supabase/client";
import { MAX_PHOTOS, MIN_PHOTOS } from "@/lib/types";
import {
  ArrowRight,
  ImagePlus,
  Loader2,
  Play,
  Upload,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import { StepNavigation } from "@/components/step-navigation";

const ease = [0.23, 1, 0.32, 1] as const;

interface FileWithPreview {
  file: File;
  id: string;
  preview: string;
  progress: number;
  uploaded: boolean;
  error: string | null;
}

export default function NewProjectPage(): ReactNode {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const imageFiles = fileArray.filter((f) =>
        f.type.startsWith("image/")
      );

      const remaining = MAX_PHOTOS - files.length;
      const toAdd = imageFiles.slice(0, remaining);

      const withPreviews: FileWithPreview[] = toAdd.map((file) => ({
        file,
        id: uuidv4(),
        preview: URL.createObjectURL(file),
        progress: 0,
        uploaded: false,
        error: null,
      }));

      setFiles((prev) => [...prev, ...withPreviews]);
    },
    [files.length]
  );

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) URL.revokeObjectURL(file.preview);
      if (selectedPreview === file?.preview) setSelectedPreview(null);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleCreate = async () => {
    if (files.length < MIN_PHOTOS) return;
    setUploading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          title: title || "Untitled Project",
          status: "uploading",
        })
        .select()
        .single();

      if (projectError || !project)
        throw projectError ?? new Error("Failed to create project");

      for (let i = 0; i < files.length; i++) {
        const f = files[i]!;
        const ext = f.file.name.split(".").pop() ?? "jpg";
        const storagePath = `${project.id}/${f.id}.${ext}`;

        const formData = new FormData();
        formData.append("file", f.file);
        formData.append("bucket", "photos-original");
        formData.append("path", storagePath);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes
            .json()
            .catch(() => ({ error: "Upload failed" }));
          setFiles((prev) =>
            prev.map((file) =>
              file.id === f.id
                ? {
                    ...file,
                    error:
                      (errData as { error: string }).error ?? "Upload failed",
                  }
                : file
            )
          );
          continue;
        }

        await supabase.from("assets").insert({
          project_id: project.id,
          storage_path_original: storagePath,
          width: null,
          height: null,
        });

        setFiles((prev) =>
          prev.map((file) =>
            file.id === f.id
              ? { ...file, progress: 100, uploaded: true }
              : file
          )
        );
      }

      await supabase
        .from("projects")
        .update({ status: "draft" })
        .eq("id", project.id);

      router.push(`/app/project/${project.id}/storyboard`);
    } catch (err) {
      console.error("Upload error:", err);
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 flex gap-6 p-4 md:p-6 lg:p-8">
        {/* Left Panel — Content / Upload */}
        <div className="flex-1 min-w-0 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
          >
            <h1 className="text-2xl font-semibold tracking-tight mb-1 text-neutral-900">
              Create New Project
            </h1>
            <p className="text-neutral-500 mb-6 text-sm">
              Upload {MIN_PHOTOS}–{MAX_PHOTOS} listing photos to get started.
            </p>

            {/* Title */}
            <div className="mb-5">
              <label
                htmlFor="title"
                className="block text-sm font-medium text-neutral-700 mb-1.5"
              >
                Project title{" "}
                <span className="text-neutral-400">(optional)</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., 123 Main St Listing Video"
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow text-sm"
              />
            </div>

            {/* Drop Zone */}
            <div
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
                dragActive
                  ? "border-accent bg-accent/5"
                  : "border-neutral-200 hover:border-accent/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => e.target.files && addFiles(e.target.files)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-neutral-700 mb-1">
                Drop photos here or click to browse
              </p>
              <p className="text-xs text-neutral-400">
                JPG, PNG, WebP — {MIN_PHOTOS} to {MAX_PHOTOS} photos
              </p>
            </div>

            {/* Photo count */}
            <div className="flex items-center justify-between mt-3 text-xs">
              <span className="text-neutral-500">
                {files.length} / {MAX_PHOTOS} photos
              </span>
              {files.length > 0 && files.length < MIN_PHOTOS && (
                <span className="text-orange-500">
                  Need at least {MIN_PHOTOS - files.length} more
                </span>
              )}
            </div>

            {/* Preview Grid */}
            <AnimatePresence>
              {files.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 mt-5"
                >
                  {files.map((f) => (
                    <motion.div
                      key={f.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className={`relative aspect-square rounded-xl overflow-hidden group cursor-pointer ring-2 transition-all ${
                        selectedPreview === f.preview
                          ? "ring-accent"
                          : "ring-transparent"
                      }`}
                      onClick={() => setSelectedPreview(f.preview)}
                    >
                      <img
                        src={f.preview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {f.uploaded && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                          <span className="text-white text-lg">&#10003;</span>
                        </div>
                      )}
                      {f.error && (
                        <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                          <span className="text-white text-xs px-1">Error</span>
                        </div>
                      )}
                      {!uploading && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(f.id);
                          }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Create Button */}
            <motion.button
              onClick={handleCreate}
              disabled={files.length < MIN_PHOTOS || uploading}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors text-sm"
              whileHover={
                files.length >= MIN_PHOTOS && !uploading
                  ? { scale: 1.01 }
                  : {}
              }
              whileTap={
                files.length >= MIN_PHOTOS && !uploading
                  ? { scale: 0.99 }
                  : {}
              }
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading photos...
                </>
              ) : (
                <>
                  <ImagePlus className="w-4 h-4" />
                  Create Project & Upload
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </motion.div>
        </div>

        {/* Right Panel — Preview Area */}
        <div className="hidden lg:flex w-[45%] shrink-0 bg-neutral-100 rounded-2xl items-center justify-center overflow-hidden">
          {selectedPreview ? (
            <motion.img
              key={selectedPreview}
              src={selectedPreview}
              alt="Selected photo preview"
              className="max-w-full max-h-full object-contain p-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease }}
            />
          ) : (
            <div className="flex flex-col items-center text-neutral-400">
              <Play className="w-12 h-12 mb-3 text-neutral-300" />
              <p className="text-sm font-medium">Select a photo to preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Step Navigation — Step 1 (no previous, no projectId yet for new) */}
      <StepNavigation projectId="" currentStep={1} />
    </div>
  );
}
