"use client";

import type { ProjectStatus } from "@/lib/types";
import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Step {
  id: number;
  label: string;
  href: (projectId: string) => string;
  /** Statuses that indicate this step is complete */
  completedStatuses: ProjectStatus[];
  /** Statuses that indicate this step is currently active */
  activeStatuses: ProjectStatus[];
}

const STEPS: Step[] = [
  {
    id: 1,
    label: "Upload Photos",
    href: (id) => `/app/project/${id}/upload`,
    completedStatuses: [
      "tagging",
      "storyboard_ready",
      "clips_queued",
      "clips_generating",
      "clips_ready",
      "details_ready",
      "render_queued",
      "rendering",
      "complete",
    ],
    activeStatuses: ["uploading"],
  },
  {
    id: 2,
    label: "AI Storyboard",
    href: (id) => `/app/project/${id}/storyboard`,
    completedStatuses: [
      "clips_queued",
      "clips_generating",
      "clips_ready",
      "details_ready",
      "render_queued",
      "rendering",
      "complete",
    ],
    activeStatuses: ["tagging", "storyboard_ready"],
  },
  {
    id: 3,
    label: "Generate Clips",
    href: (id) => `/app/project/${id}/generate`,
    completedStatuses: [
      "clips_ready",
      "details_ready",
      "render_queued",
      "rendering",
      "complete",
    ],
    activeStatuses: ["clips_queued", "clips_generating"],
  },
  {
    id: 4,
    label: "Listing Details",
    href: (id) => `/app/project/${id}/details`,
    completedStatuses: [
      "details_ready",
      "render_queued",
      "rendering",
      "complete",
    ],
    activeStatuses: [],
  },
  {
    id: 5,
    label: "Final Video",
    href: (id) => `/app/project/${id}/results`,
    completedStatuses: ["complete"],
    activeStatuses: ["render_queued", "rendering"],
  },
];

interface ProjectProgressBarProps {
  projectId: string;
  status: ProjectStatus;
}

export function ProjectProgressBar({
  projectId,
  status,
}: ProjectProgressBarProps) {
  return (
    <div className="flex items-center gap-1 px-4 py-2.5 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 overflow-x-auto">
      {STEPS.map((step, i) => {
        const isCompleted = step.completedStatuses.includes(status);
        const isActive = step.activeStatuses.includes(status);
        const isClickable = isCompleted || isActive;

        const stepEl = (
          <div
            key={step.id}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              isCompleted
                ? "text-green-600 dark:text-green-400"
                : isActive
                  ? "text-accent bg-accent/5"
                  : "text-neutral-400 dark:text-neutral-500"
            } ${isClickable ? "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800" : "cursor-default"}`}
          >
            {isCompleted ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  isActive
                    ? "bg-accent text-white"
                    : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                }`}
              >
                {step.id}
              </span>
            )}
            {step.label}
          </div>
        );

        return (
          <div key={step.id} className="flex items-center gap-1">
            {isClickable ? (
              <Link href={step.href(projectId)}>{stepEl}</Link>
            ) : (
              stepEl
            )}
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-3 h-3 text-neutral-300 dark:text-neutral-600 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
