/**
 * GET /api/admin/stats — aggregate stats for admin dashboard
 * Protected by x-admin-secret header
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "vidzee-admin-2026";

function isAdmin(request: Request): boolean {
  return request.headers.get("x-admin-secret") === ADMIN_SECRET;
}

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // ── Users ──────────────────────────────────────────────────────────────────
  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const users = usersData?.users ?? [];

  // User growth: new users per day for last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const growthMap: Record<string, number> = {};
  for (const u of users) {
    const d = new Date(u.created_at);
    if (d >= thirtyDaysAgo) {
      const key = d.toISOString().slice(0, 10);
      growthMap[key] = (growthMap[key] ?? 0) + 1;
    }
  }
  const userGrowthSeries = Object.entries(growthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // ── Projects ───────────────────────────────────────────────────────────────
  const { count: totalProjects } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true });

  // ── Credits / Revenue ──────────────────────────────────────────────────────
  const { data: transactions } = await supabase
    .from("credit_transactions")
    .select("id, user_id, amount, type, description, created_at, stripe_session_id")
    .eq("type", "purchase")
    .order("created_at", { ascending: false })
    .limit(200);

  const purchaseTxns = transactions ?? [];

  // Derive dollar amounts from description (e.g. "Starter Pack — 1 credit ($19)")
  let totalRevenue = 0;
  const revenueMap: Record<string, number> = {};
  for (const t of purchaseTxns) {
    const match = (t.description as string)?.match(/\$(\d+)/);
    const dollars = match ? parseInt(match[1]) : 0;
    totalRevenue += dollars;
    const d = new Date(t.created_at as string);
    if (d >= thirtyDaysAgo) {
      const key = d.toISOString().slice(0, 10);
      revenueMap[key] = (revenueMap[key] ?? 0) + dollars;
    }
  }
  const revenueSeries = Object.entries(revenueMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }));

  // ── Credit balances per user ───────────────────────────────────────────────
  const { data: credits } = await supabase.from("credits").select("user_id, balance");
  const creditMap = Object.fromEntries(
    (credits ?? []).map((c) => [c.user_id as string, c.balance as number])
  );

  // ── Project counts per user ────────────────────────────────────────────────
  const { data: projects } = await supabase.from("projects").select("user_id");
  const projectMap: Record<string, number> = {};
  for (const p of projects ?? []) {
    const uid = p.user_id as string;
    projectMap[uid] = (projectMap[uid] ?? 0) + 1;
  }

  // ── Recent users ───────────────────────────────────────────────────────────
  const recentUsers = users
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 100)
    .map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at,
      credits: creditMap[u.id] ?? 0,
      projects: projectMap[u.id] ?? 0,
    }));

  // ── API Usage ──────────────────────────────────────────────────────────────
  let apiUsage: { provider: string; count: number; errors: number; avg_duration_ms: number }[] = [];
  try {
    const { data: apiLogs } = await supabase
      .from("api_usage_logs")
      .select("provider, success, duration_ms")
      .gte("created_at", thirtyDaysAgo.toISOString());

    const providerMap: Record<string, { count: number; errors: number; totalMs: number }> = {};
    for (const log of apiLogs ?? []) {
      const p = log.provider as string;
      if (!providerMap[p]) providerMap[p] = { count: 0, errors: 0, totalMs: 0 };
      providerMap[p].count++;
      if (!log.success) providerMap[p].errors++;
      providerMap[p].totalMs += (log.duration_ms as number) ?? 0;
    }
    apiUsage = Object.entries(providerMap).map(([provider, v]) => ({
      provider,
      count: v.count,
      errors: v.errors,
      avg_duration_ms: v.count > 0 ? Math.round(v.totalMs / v.count) : 0,
    }));
  } catch {
    // Table may not exist yet — return empty
    apiUsage = [];
  }

  // ── Support ────────────────────────────────────────────────────────────────
  let supportStats = { open: 0, escalated: 0, resolved: 0, total: 0 };
  let recentConversations: unknown[] = [];
  try {
    const { data: convos } = await supabase
      .from("support_conversations")
      .select("id, user_email, status, subject, created_at, updated_at, admin_notes")
      .order("updated_at", { ascending: false })
      .limit(100);

    const all = convos ?? [];
    recentConversations = all;
    supportStats = {
      open: all.filter((c) => c.status === "open").length,
      escalated: all.filter((c) => c.status === "escalated").length,
      resolved: all.filter((c) => c.status === "resolved" || c.status === "closed").length,
      total: all.length,
    };
  } catch {
    // Table may not exist yet
  }

  return NextResponse.json({
    overview: {
      totalUsers: users.length,
      totalProjects: totalProjects ?? 0,
      totalRevenue,
      totalTransactions: purchaseTxns.length,
    },
    userGrowthSeries,
    revenueSeries,
    recentUsers,
    apiUsage,
    supportStats,
    recentConversations,
    recentTransactions: purchaseTxns.slice(0, 50),
  });
}
