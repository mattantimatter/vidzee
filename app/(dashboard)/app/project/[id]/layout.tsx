/**
 * Project layout — wraps all project sub-pages with a persistent progress bar.
 * The progress bar reads the project status from the DB and shows the workflow steps.
 */

import { createClient } from "@/lib/supabase/server";
import { ProjectProgressBar } from "@/components/project-progress-bar";
import type { ProjectStatus } from "@/lib/types";
import type { ReactNode } from "react";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;

  // Fetch project status server-side for the progress bar
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .single();

  const status = (project?.status ?? "draft") as ProjectStatus;

  return (
    <div className="flex flex-col h-full min-h-0">
      <ProjectProgressBar projectId={projectId} status={status} />
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}
