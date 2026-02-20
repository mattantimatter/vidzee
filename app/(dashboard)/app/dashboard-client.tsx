"use client";

import type { Project } from "@/lib/types";
import {
  Clock,
  Film,
  Plus,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { type ReactNode } from "react";

const ease = [0.23, 1, 0.32, 1] as const;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-neutral-400" },
  uploading: { label: "Uploading", color: "bg-yellow-400" },
  tagging: { label: "Analyzing", color: "bg-blue-400" },
  storyboard_ready: { label: "Storyboard Ready", color: "bg-blue-500" },
  clips_queued: { label: "Clips Queued", color: "bg-orange-400" },
  clips_generating: { label: "Generating Clips", color: "bg-orange-500" },
  clips_ready: { label: "Clips Ready", color: "bg-green-400" },
  details_ready: { label: "Details Ready", color: "bg-green-500" },
  render_queued: { label: "Render Queued", color: "bg-purple-400" },
  rendering: { label: "Rendering", color: "bg-purple-500" },
  complete: { label: "Complete", color: "bg-green-600" },
  failed: { label: "Failed", color: "bg-red-500" },
};

function getProjectLink(project: Project): string {
  switch (project.status) {
    case "draft":
    case "uploading":
      return `/app/project/${project.id}/storyboard`;
    case "tagging":
    case "storyboard_ready":
      return `/app/project/${project.id}/storyboard`;
    case "clips_queued":
    case "clips_generating":
    case "clips_ready":
      return `/app/project/${project.id}/generate`;
    case "details_ready":
    case "render_queued":
    case "rendering":
      return `/app/project/${project.id}/details`;
    case "complete":
      return `/app/project/${project.id}/results`;
    default:
      return `/app/project/${project.id}/storyboard`;
  }
}

function ProjectCard({ project }: { project: Project }): ReactNode {
  const status = STATUS_LABELS[project.status] ?? {
    label: project.status,
    color: "bg-neutral-400",
  };
  const link = getProjectLink(project);

  return (
    <Link href={link} className="block">
      <motion.div
        whileHover={{ y: -2 }}
        className="group relative border border-neutral-200 dark:border-neutral-700 rounded-2xl p-3.5 sm:p-4 md:p-5 bg-white dark:bg-neutral-800 hover:shadow-md transition-all cursor-pointer"
      >
        {/* Compact row layout on mobile, original layout on larger screens */}
        <div className="flex items-center gap-3 sm:block">
          {/* Icon - smaller on mobile */}
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 sm:mb-4">
            <Film className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title + Status row */}
            <div className="flex items-center justify-between gap-2 sm:mb-1">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 truncate text-sm">
                {project.title ?? project.address ?? "Untitled Project"}
              </h3>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`w-2 h-2 rounded-full ${status.color}`} />
                <span className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                  {status.label}
                </span>
              </div>
            </div>

            {/* Address + Date row on mobile, stacked on desktop */}
            <div className="flex items-center justify-between gap-2 sm:block">
              {project.address && (
                <p className="text-xs text-neutral-400 truncate">
                  {project.address}
                  {project.city ? `, ${project.city}` : ""}
                </p>
              )}
              <div className="flex items-center gap-1.5 text-xs text-neutral-400 shrink-0 sm:mt-3">
                <Clock className="w-3 h-3" />
                <span className="hidden sm:inline">
                  {new Date(project.updated_at).toLocaleDateString()}
                </span>
                <span className="sm:hidden">
                  {new Date(project.updated_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export function DashboardClient({
  projects,
}: {
  projects: Project[];
}): ReactNode {
  return (
    <div className="overflow-y-auto px-3 py-4 sm:p-4 md:p-6 lg:p-8 max-w-6xl mx-auto h-full">
      {/* Header — stacked on mobile to prevent overlap */}
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Projects
          </h1>
          <p className="text-neutral-500 text-xs sm:text-sm mt-0.5 sm:mt-1">
            Your listing video projects
          </p>
        </div>
        <Link
          href="/app/new"
          className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-accent text-white text-xs sm:text-sm font-medium hover:bg-accent/90 transition-colors min-h-[40px] sm:min-h-[44px] shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Project</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      {projects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="text-center py-12 sm:py-16 md:py-20 border border-dashed border-neutral-200 dark:border-neutral-700 rounded-2xl bg-white dark:bg-neutral-800"
        >
          <Film className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
            No projects yet
          </h2>
          <p className="text-neutral-400 text-sm mb-5 px-4">
            Create your first listing video project to get started.
          </p>
          <Link
            href="/app/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            Create Your First Video
          </Link>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 md:gap-4"
        >
          {projects.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05, ease }}
            >
              <ProjectCard project={project} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
