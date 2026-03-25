import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

const ADMIN_EMAIL = "matt@antimatter.ai";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactNode> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in → go to admin login
  if (!user) {
    redirect("/admin/login");
  }

  // Logged in but not the admin email → deny access
  if (user.email?.toLowerCase() !== ADMIN_EMAIL) {
    redirect("/admin/login?error=access_denied");
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {children}
    </div>
  );
}
