"use client";

import {
  ArrowLeft,
  ArrowRight,
  LogOut,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

const STEP_ROUTES = [
  { step: 1, label: "Upload Photos", path: (_id: string) => `/app/new` },
  { step: 2, label: "AI Storyboard", path: (id: string) => `/app/project/${id}/storyboard` },
  { step: 3, label: "Generate Clips", path: (id: string) => `/app/project/${id}/generate` },
  { step: 4, label: "Listing Details", path: (id: string) => `/app/project/${id}/details` },
  { step: 5, label: "Final Video", path: (id: string) => `/app/project/${id}/results` },
];

interface StepNavigationProps {
  projectId: string;
  currentStep: number; // 1-5
  onSave?: () => Promise<void>;
}

export function StepNavigation({
  projectId,
  currentStep,
  onSave,
}: StepNavigationProps): ReactNode {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const hasPrevious = currentStep > 1;
  const hasNext = currentStep < 5;

  const prevStep = STEP_ROUTES[currentStep - 2];
  const nextStep = STEP_ROUTES[currentStep];

  const handleNavigate = async (path: string) => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave();
      } catch (err) {
        console.error("Save error:", err);
      }
      setSaving(false);
    }
    router.push(path);
  };

  const handleSaveAndExit = async () => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave();
      } catch (err) {
        console.error("Save error:", err);
      }
      setSaving(false);
    }
    router.push("/app");
  };

  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-t border-neutral-200 dark:border-neutral-700 px-4 py-3 shrink-0">
      <div className="flex items-center justify-between gap-2 max-w-5xl mx-auto">
        {/* Left: Previous */}
        <div className="flex-1 flex justify-start">
          {hasPrevious && prevStep ? (
            <button
              onClick={() =>
                handleNavigate(prevStep.path(projectId))
              }
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 min-h-[40px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{prevStep.label}</span>
              <span className="sm:hidden">Back</span>
            </button>
          ) : (
            <div />
          )}
        </div>

        {/* Center: Save & Exit */}
        <button
          onClick={handleSaveAndExit}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 min-h-[40px]"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Save & Exit</span>
          <span className="sm:hidden">Exit</span>
        </button>

        {/* Right: Next */}
        <div className="flex-1 flex justify-end">
          {hasNext && nextStep ? (
            <button
              onClick={() =>
                handleNavigate(nextStep.path(projectId))
              }
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50 min-h-[40px]"
            >
              <span className="hidden sm:inline">{nextStep.label}</span>
              <span className="sm:hidden">Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}
