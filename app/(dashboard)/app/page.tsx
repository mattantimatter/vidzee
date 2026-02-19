import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage(): Promise<ReactNode> {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  return <DashboardClient projects={(projects as Project[] | null) ?? []} />;
}
