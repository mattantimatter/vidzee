/**
 * GET /api/admin/users — list all users with credit balances
 * Protected by x-admin-secret header
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function isAdmin(request: Request): boolean {
  const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "vidzee-admin-2026";
  return request.headers.get("x-admin-secret") === ADMIN_SECRET;
}

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const users = usersData?.users ?? [];

  // Get credit balances for all users
  const { data: credits } = await supabase.from("credits").select("user_id, balance");
  const creditMap = Object.fromEntries(
    (credits ?? []).map((c) => [c.user_id as string, c.balance as number])
  );

  // Get project counts per user
  const { data: projects } = await supabase.from("projects").select("user_id");
  const projectMap: Record<string, number> = {};
  for (const p of projects ?? []) {
    const uid = p.user_id as string;
    projectMap[uid] = (projectMap[uid] ?? 0) + 1;
  }

  const result = users.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in: u.last_sign_in_at,
    credits: creditMap[u.id] ?? 0,
    projects: projectMap[u.id] ?? 0,
  }));

  return NextResponse.json({ users: result });
}
