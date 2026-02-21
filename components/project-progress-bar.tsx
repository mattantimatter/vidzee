"use client";

import type { ProjectStatus } from "@/lib/types";
import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Step {
  id: number;
  label: string;
  shortLabel: string;
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
    shortLabel: "Photos",
    href: (id) => `/app/project/${id}/storyboard`,
    completedStatuses: [
      "tagging",
      "storyboard_ready",
      "clips_queued",
      "clips_generating",
      "clips_ready",
      "editing",
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
    shortLabel: "Storyboard",
    href: (id) => `/app/project/${id}/storyboard`,
    completedStatuses: [
      "clips_queued",
      "clips_generating",
      "clips_ready",
      "editing",
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
    shortLabel: "Clips",
    href: (id) => `/app/project/${id}/generate`,
    completedStatuses: [
      "clips_ready",
      "editing",
      "details_ready",
      "render_queued",
      "rendering",
      "complete",
    ],
    activeStatuses: ["clips_queued", "clips_generating"],
  },
  {
    id: 4,
    label: "Edit Video",
    shortLabel: "Edit",
    href: (id) => `/app/project/${id}/editor`,
    completedStatuses: [
      "details_ready",
      "render_queued",
      "rendering",
      "complete",
    ],
    activeStatuses: ["clips_ready", "editing"],
  },
  {
    id: 5,
    label: "Export",
    shortLabel: "Export",
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
  // Find the current step index for the mobile "Step X of Y" display
  const currentStepIndex = STEPS.findIndex(
    (step) => step.activeStatuses.includes(status)
  );
  const completedStepCount = STEPS.filter((step) =>
    step.completedStatuses.includes(status)
  ).length;
  const displayStep = currentStepIndex >= 0 ? currentStepIndex + 1 : completedStepCount + 1;

  return (
    <>
      {/* ─── Desktop Progress Bar ─── */}
      <div className="hidden sm:flex items-center gap-1 px-4 py-2.5 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 overflow-x-auto shrink-0">
        {STEPS.map((step, i) => {
          const isCompleted = step.completedStatuses.includes(status);
          const isActive = step.activeStatuses.includes(status);
          const isClickable = isCompleted || isActive;

          const stepEl = (
            <div
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
              <span className="hidden md:inline">{step.label}</span>
              <span className="md:hidden">{step.shortLabel}</span>
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

      {/* ─── Mobile Progress Bar (compact) ─── */}
      <div className="sm:hidden flex items-center justify-between px-4 py-2 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 shrink-0">
        <div className="flex items-center gap-2">
          {STEPS.map((step) => {
            const isCompleted = step.completedStatuses.includes(status);
            const isActive = step.activeStatuses.includes(status);
            const isClickable = isCompleted || isActive;

            const dot = (
              <div
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  isCompleted
                    ? "bg-green-500"
                    : isActive
                      ? "bg-accent"
                      : "bg-neutral-200 dark:bg-neutral-700"
                }`}
              />
            );

            return isClickable ? (
              <Link key={step.id} href={step.href(projectId)}>
                {dot}
              </Link>
            ) : (
              <div key={step.id}>{dot}</div>
            );
          })}
        </div>
        <span className="text-xs font-medium text-neutral-500">
          Step {Math.min(displayStep, STEPS.length)} of {STEPS.length}
          {currentStepIndex >= 0 && STEPS[currentStepIndex] && (
            <span className="ml-1.5 text-neutral-700 dark:text-neutral-300">
              {STEPS[currentStepIndex].shortLabel}
            </span>
          )}
        </span>
      </div>
    </>
  );
}
