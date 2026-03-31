/**
 * GET /api/admin/sessions — Session and login analytics
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

  // Get all users for session analytics
  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const users = usersData?.users ?? [];

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Active users by time window (based on last_sign_in_at)
  const activeLast24h = users.filter(
    (u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= last24h
  ).length;
  const activeLastWeek = users.filter(
    (u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= last7d
  ).length;
  const activeLastMonth = users.filter(
    (u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= last30d
  ).length;

  // Provider breakdown
  const providerMap: Record<string, number> = {};
  for (const u of users) {
    const provider = (u.app_metadata?.provider as string) ?? "email";
    providerMap[provider] = (providerMap[provider] ?? 0) + 1;
  }

  // Daily active users (last 30 days) — based on last_sign_in_at
  const dauMap: Record<string, number> = {};
  for (const u of users) {
    if (u.last_sign_in_at) {
      const d = new Date(u.last_sign_in_at);
      if (d >= last30d) {
        const key = d.toISOString().slice(0, 10);
        dauMap[key] = (dauMap[key] ?? 0) + 1;
      }
    }
  }
  const dauSeries = Object.entries(dauMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // New signups per day (last 30 days)
  const signupMap: Record<string, number> = {};
  for (const u of users) {
    const d = new Date(u.created_at);
    if (d >= last30d) {
      const key = d.toISOString().slice(0, 10);
      signupMap[key] = (signupMap[key] ?? 0) + 1;
    }
  }
  const signupSeries = Object.entries(signupMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // Users who have never signed in (signed up but never logged in)
  const neverSignedIn = users.filter((u) => !u.last_sign_in_at).length;

  // Users confirmed vs unconfirmed
  const confirmed = users.filter((u) => u.email_confirmed_at).length;
  const unconfirmed = users.length - confirmed;

  // Recent sessions (last 20 sign-ins)
  const recentSessions = users
    .filter((u) => u.last_sign_in_at)
    .sort((a, b) =>
      new Date(b.last_sign_in_at!).getTime() - new Date(a.last_sign_in_at!).getTime()
    )
    .slice(0, 20)
    .map((u) => ({
      user_id: u.id,
      email: u.email,
      last_sign_in: u.last_sign_in_at,
      provider: (u.app_metadata?.provider as string) ?? "email",
      created_at: u.created_at,
    }));

  return NextResponse.json({
    summary: {
      totalUsers: users.length,
      activeLast24h,
      activeLastWeek,
      activeLastMonth,
      neverSignedIn,
      confirmed,
      unconfirmed,
    },
    providerBreakdown: Object.entries(providerMap).map(([provider, count]) => ({
      provider,
      count,
    })),
    dauSeries,
    signupSeries,
    recentSessions,
  });
}
