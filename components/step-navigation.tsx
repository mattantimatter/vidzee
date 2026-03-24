"use client";

import {
  ArrowLeft,
  ArrowRight,
  LogOut,
  Loader2,
} from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

const ease = [0.23, 1, 0.32, 1] as const;

const STEP_ROUTES = [
  { step: 1, label: "Upload Photos", path: (_id: string) => `/app/new` },
  { step: 2, label: "AI Storyboard", path: (id: string) => `/app/project/${id}/storyboard` },
  { step: 3, label: "Generate Clips", path: (id: string) => `/app/project/${id}/generate` },
  { step: 4, label: "Edit Video", path: (id: string) => `/app/project/${id}/editor` },
  { step: 5, label: "Export", path: (id: string) => `/app/project/${id}/results` },
];

interface StepNavigationProps {
  projectId: string;
  currentStep: number; // 1-5 (Upload, Storyboard, Generate, Edit, Export)
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

  const progressPct = ((currentStep - 1) / (STEP_ROUTES.length - 1)) * 100;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-t border-neutral-200 dark:border-neutral-700 shrink-0">
      {/* Progress bar */}
      <div className="h-0.5 bg-neutral-100 dark:bg-neutral-800 w-full">
        <motion.div
          className="h-full bg-accent rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.6, ease }}
        />
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2 max-w-5xl mx-auto">
          {/* Left: Previous */}
          <div className="flex-1 flex justify-start">
            {hasPrevious && prevStep ? (
              <motion.button
                onClick={() => handleNavigate(prevStep.path(projectId))}
                disabled={saving}
                whileHover={{ x: -2 }}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors disabled:opacity-50 min-h-[40px]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{prevStep.label}</span>
                <span className="sm:hidden">Back</span>
              </motion.button>
            ) : (
              <div />
            )}
          </div>

          {/* Center: Step dots + Save & Exit */}
          <div className="flex flex-col items-center gap-1.5">
            {/* Step dots — hidden on very small screens */}
            <div className="hidden sm:flex items-center gap-1.5">
              {STEP_ROUTES.map((s) => (
                <motion.div
                  key={s.step}
                  animate={{
                    scale: s.step === currentStep ? 1.25 : 1,
                    opacity: s.step <= currentStep ? 1 : 0.3,
                  }}
                  transition={{ duration: 0.2, ease }}
                  className={`rounded-full transition-colors ${
                    s.step < currentStep
                      ? "w-1.5 h-1.5 bg-accent"
                      : s.step === currentStep
                        ? "w-2 h-2 bg-accent"
                        : "w-1.5 h-1.5 bg-neutral-300 dark:bg-neutral-600"
                  }`}
                />
              ))}
            </div>

            <motion.button
              onClick={handleSaveAndExit}
              disabled={saving}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors disabled:opacity-50 min-h-[36px]"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Save & Exit</span>
              <span className="sm:hidden">Exit</span>
            </motion.button>
          </div>

          {/* Right: Next */}
          <div className="flex-1 flex justify-end">
            {hasNext && nextStep ? (
              <motion.button
                onClick={() => handleNavigate(nextStep.path(projectId))}
                disabled={saving}
                whileHover={{ x: 2, boxShadow: "0 4px 16px rgba(14,165,233,0.25)" }}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 active:bg-accent/80 transition-colors disabled:opacity-50 min-h-[40px] shadow-sm shadow-accent/20"
              >
                <span className="hidden sm:inline">{nextStep.label}</span>
                <span className="sm:hidden">Next</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            ) : (
              <div />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
