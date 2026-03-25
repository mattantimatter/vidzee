"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  DollarSign,
  Zap,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  ChevronRight,
  X,
  Send,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AdminStats {
  overview: {
    totalUsers: number;
    totalProjects: number;
    totalRevenue: number;
    totalTransactions: number;
  };
  userGrowthSeries: { date: string; count: number }[];
  revenueSeries: { date: string; amount: number }[];
  recentUsers: {
    id: string;
    email: string;
    created_at: string;
    last_sign_in: string;
    credits?: number;
    projects?: number;
  }[];
  apiUsage: { provider: string; count: number; errors: number; avg_duration_ms: number }[];
  supportStats: { open: number; escalated: number; resolved: number; total: number };
  recentConversations: {
    id: string;
    user_email: string;
    status: string;
    subject: string;
    created_at: string;
    updated_at: string;
  }[];
  recentTransactions: {
    id: string;
    user_id: string;
    amount: number;
    type: string;
    description: string;
    created_at: string;
    stripe_session_id?: string;
  }[];
}

interface SupportMessage {
  id: string;
  role: "user" | "assistant" | "admin";
  content: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const ADMIN_SECRET = "vidzee-admin-2026";

async function fetchStats(): Promise<AdminStats | null> {
  try {
    const res = await fetch("/api/admin/stats", {
      headers: { "x-admin-secret": ADMIN_SECRET },
    });
    if (!res.ok) return null;
    return res.json() as Promise<AdminStats>;
  } catch {
    return null;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-blue-50 text-blue-700 border border-blue-200",
    escalated: "bg-red-50 text-red-700 border border-red-200",
    resolved: "bg-green-50 text-green-700 border border-green-200",
    closed: "bg-neutral-100 text-neutral-500 border border-neutral-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-neutral-100 text-neutral-500"}`}>
      {status}
    </span>
  );
}

// Simple sparkline using SVG
function Sparkline({ data, color = "#3b82f6" }: { data: number[]; color?: string }) {
  if (data.length < 2) return <div className="h-10 flex items-center text-xs text-neutral-400">No data</div>;
  const max = Math.max(...data, 1);
  const w = 120;
  const h = 40;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Support Conversation Drawer ────────────────────────────────────────────────

function SupportDrawer({
  conversationId,
  onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [convo, setConvo] = useState<AdminStats["recentConversations"][0] | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("open");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/support?id=${conversationId}`, {
      headers: { "x-admin-secret": ADMIN_SECRET },
    });
    if (res.ok) {
      const data = await res.json() as { conversation: AdminStats["recentConversations"][0]; messages: SupportMessage[] };
      setConvo(data.conversation);
      setMessages(data.messages);
      setNotes((data.conversation as { admin_notes?: string }).admin_notes ?? "");
      setStatus(data.conversation.status);
    }
  }, [conversationId]);

  useEffect(() => { void load(); }, [load]);

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    await fetch("/api/admin/support", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
      body: JSON.stringify({ id: conversationId, admin_reply: reply, admin_notes: notes, status }),
    });
    setReply("");
    await load();
    setSending(false);
  };

  const updateStatus = async (newStatus: string) => {
    setStatus(newStatus);
    await fetch("/api/admin/support", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
      body: JSON.stringify({ id: conversationId, status: newStatus, admin_notes: notes }),
    });
    await load();
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
      className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white border-l border-neutral-200 shadow-2xl z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
        <div>
          <p className="font-semibold text-neutral-900 text-sm">{convo?.user_email ?? "Loading..."}</p>
          <p className="text-xs text-neutral-500 mt-0.5">{convo?.subject}</p>
        </div>
        <div className="flex items-center gap-2">
          {convo && <StatusBadge status={status} />}
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status controls */}
      <div className="flex gap-2 px-5 py-3 border-b border-neutral-100 bg-neutral-50">
        {["open", "escalated", "resolved", "closed"].map((s) => (
          <button
            key={s}
            onClick={() => void updateStatus(s)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              status === s ? "bg-accent text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
              m.role === "user"
                ? "bg-neutral-100 text-neutral-800 rounded-tl-sm"
                : m.role === "admin"
                ? "bg-accent text-white rounded-tr-sm"
                : "bg-blue-50 text-blue-900 rounded-tr-sm border border-blue-100"
            }`}>
              {m.role === "assistant" && (
                <p className="text-xs font-semibold mb-1 opacity-60">AI Agent</p>
              )}
              {m.role === "admin" && (
                <p className="text-xs font-semibold mb-1 opacity-80">You (Admin)</p>
              )}
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              <p className="text-xs opacity-50 mt-1">{formatDate(m.created_at)}</p>
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-center text-neutral-400 text-sm py-8">No messages yet</p>
        )}
      </div>

      {/* Admin notes */}
      <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50">
        <label className="text-xs font-medium text-neutral-500 block mb-1">Internal Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            void fetch("/api/admin/support", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
              body: JSON.stringify({ id: conversationId, admin_notes: notes }),
            });
          }}
          rows={2}
          className="w-full text-xs rounded-lg border border-neutral-200 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Add internal notes (not visible to user)..."
        />
      </div>

      {/* Reply box */}
      <div className="px-5 py-4 border-t border-neutral-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendReply(); } }}
            className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            placeholder="Reply to user..."
          />
          <button
            onClick={() => void sendReply()}
            disabled={sending || !reply.trim()}
            className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent/90 disabled:opacity-40 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Admin Page ────────────────────────────────────────────────────────────

type Tab = "overview" | "users" | "transactions" | "api" | "support";

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [supportFilter, setSupportFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchStats();
    setStats(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: TrendingUp },
    { id: "users", label: "Users", icon: Users },
    { id: "transactions", label: "Revenue", icon: DollarSign },
    { id: "api", label: "API Usage", icon: Activity },
    { id: "support", label: "Support", icon: MessageSquare },
  ];

  if (loading) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-white">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <p className="text-sm text-neutral-500">Loading admin dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-white">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-neutral-600">Failed to load admin data.</p>
            <button onClick={() => void load()} className="mt-3 text-sm text-accent hover:underline">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  const filteredConvos = supportFilter === "all"
    ? stats.recentConversations
    : stats.recentConversations.filter((c) => c.status === supportFilter);

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Admin Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Vidzee internal operations</p>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-neutral-100 shrink-0 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              tab === t.id
                ? "text-accent border-b-2 border-accent bg-accent/5"
                : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.id === "support" && stats.supportStats.escalated > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                {stats.supportStats.escalated}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="p-6 space-y-6">
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Users", value: stats.overview.totalUsers.toLocaleString(), icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
                { label: "Total Revenue", value: `$${stats.overview.totalRevenue.toLocaleString()}`, icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
                { label: "Total Projects", value: stats.overview.totalProjects.toLocaleString(), icon: Zap, color: "text-purple-600", bg: "bg-purple-50" },
                { label: "Support Tickets", value: stats.supportStats.total.toLocaleString(), icon: MessageSquare, color: "text-orange-600", bg: "bg-orange-50" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm">
                  <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center mb-3`}>
                    <kpi.icon className={`w-4.5 h-4.5 ${kpi.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-neutral-900">{kpi.value}</p>
                  <p className="text-xs text-neutral-500 mt-1">{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* User Growth */}
              <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm">
                <h3 className="font-semibold text-neutral-800 text-sm mb-4">User Growth (30 days)</h3>
                {stats.userGrowthSeries.length > 0 ? (
                  <div className="space-y-2">
                    <Sparkline data={stats.userGrowthSeries.map((d) => d.count)} color="#3b82f6" />
                    <div className="flex justify-between text-xs text-neutral-400">
                      <span>{formatShortDate(stats.userGrowthSeries[0]?.date ?? "")}</span>
                      <span>{formatShortDate(stats.userGrowthSeries[stats.userGrowthSeries.length - 1]?.date ?? "")}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {stats.userGrowthSeries.slice(-7).map((d) => (
                        <div key={d.date} className="flex items-center justify-between text-xs">
                          <span className="text-neutral-400">{formatShortDate(d.date)}</span>
                          <span className="font-semibold text-blue-600">+{d.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 py-4">No new users in the last 30 days</p>
                )}
              </div>

              {/* Revenue */}
              <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm">
                <h3 className="font-semibold text-neutral-800 text-sm mb-4">Revenue (30 days)</h3>
                {stats.revenueSeries.length > 0 ? (
                  <div className="space-y-2">
                    <Sparkline data={stats.revenueSeries.map((d) => d.amount)} color="#10b981" />
                    <div className="flex justify-between text-xs text-neutral-400">
                      <span>{formatShortDate(stats.revenueSeries[0]?.date ?? "")}</span>
                      <span>{formatShortDate(stats.revenueSeries[stats.revenueSeries.length - 1]?.date ?? "")}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {stats.revenueSeries.slice(-7).map((d) => (
                        <div key={d.date} className="flex items-center justify-between text-xs">
                          <span className="text-neutral-400">{formatShortDate(d.date)}</span>
                          <span className="font-semibold text-green-600">${d.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 py-4">No revenue in the last 30 days</p>
                )}
              </div>
            </div>

            {/* Support summary */}
            <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-neutral-800 text-sm mb-4">Support Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 mx-auto mb-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-neutral-900">{stats.supportStats.open}</p>
                  <p className="text-xs text-neutral-500">Open</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 mx-auto mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <p className="text-2xl font-bold text-neutral-900">{stats.supportStats.escalated}</p>
                  <p className="text-xs text-neutral-500">Escalated</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-50 mx-auto mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold text-neutral-900">{stats.supportStats.resolved}</p>
                  <p className="text-xs text-neutral-500">Resolved</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Users ── */}
        {tab === "users" && (
          <div className="p-6">
            <div className="bg-white border border-neutral-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100">
                <h3 className="font-semibold text-neutral-800 text-sm">All Users ({stats.recentUsers.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Email</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Joined</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Last Active</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Credits</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Projects</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {stats.recentUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-5 py-3.5 text-neutral-800 font-medium">{u.email}</td>
                        <td className="px-5 py-3.5 text-neutral-500">{formatDate(u.created_at)}</td>
                        <td className="px-5 py-3.5 text-neutral-500">{u.last_sign_in ? formatDate(u.last_sign_in) : "—"}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`font-semibold ${(u.credits ?? 0) === 0 ? "text-red-500" : "text-accent"}`}>
                            {u.credits ?? 0}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-neutral-600 font-medium">{u.projects ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Transactions ── */}
        {tab === "transactions" && (
          <div className="p-6 space-y-4">
            {/* Revenue summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-neutral-500 mb-1">Total Revenue</p>
                <p className="text-3xl font-bold text-green-600">${stats.overview.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-neutral-500 mb-1">Total Purchases</p>
                <p className="text-3xl font-bold text-neutral-900">{stats.overview.totalTransactions}</p>
              </div>
            </div>

            <div className="bg-white border border-neutral-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100">
                <h3 className="font-semibold text-neutral-800 text-sm">Recent Transactions</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Description</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Date</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Credits</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {stats.recentTransactions.map((t) => {
                      const match = (t.description as string)?.match(/\$(\d+)/);
                      const dollars = match && match[1] ? parseInt(match[1]) : null;
                      return (
                        <tr key={t.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-5 py-3.5 text-neutral-700">{t.description ?? "—"}</td>
                          <td className="px-5 py-3.5 text-neutral-500">{formatDate(t.created_at as string)}</td>
                          <td className="px-5 py-3.5 text-right font-semibold text-accent">+{t.amount}</td>
                          <td className="px-5 py-3.5 text-right font-semibold text-green-600">
                            {dollars ? `$${dollars}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {stats.recentTransactions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-neutral-400">No transactions yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── API Usage ── */}
        {tab === "api" && (
          <div className="p-6">
            <div className="bg-white border border-neutral-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100">
                <h3 className="font-semibold text-neutral-800 text-sm">API Usage (Last 30 Days)</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Logged after each provider call</p>
              </div>
              {stats.apiUsage.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Provider</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Calls</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Errors</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Error Rate</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Avg Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {stats.apiUsage.map((a) => {
                        const errorRate = a.count > 0 ? ((a.errors / a.count) * 100).toFixed(1) : "0";
                        return (
                          <tr key={a.provider} className="hover:bg-neutral-50 transition-colors">
                            <td className="px-5 py-3.5 font-semibold text-neutral-800 capitalize">{a.provider}</td>
                            <td className="px-5 py-3.5 text-right text-neutral-700">{a.count.toLocaleString()}</td>
                            <td className="px-5 py-3.5 text-right">
                              <span className={a.errors > 0 ? "text-red-500 font-semibold" : "text-neutral-400"}>{a.errors}</span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <span className={parseFloat(errorRate) > 5 ? "text-red-500 font-semibold" : "text-neutral-500"}>{errorRate}%</span>
                            </td>
                            <td className="px-5 py-3.5 text-right text-neutral-500">{a.avg_duration_ms.toLocaleString()}ms</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-5 py-10 text-center">
                  <Activity className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-400">No API usage logged yet.</p>
                  <p className="text-xs text-neutral-400 mt-1">Logs will appear here as users generate videos and music.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Support ── */}
        {tab === "support" && (
          <div className="p-6 space-y-4">
            {/* Filter tabs */}
            <div className="flex gap-2">
              {["all", "open", "escalated", "resolved"].map((f) => (
                <button
                  key={f}
                  onClick={() => setSupportFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    supportFilter === f
                      ? "bg-accent text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === "escalated" && stats.supportStats.escalated > 0 && (
                    <span className="ml-1.5 bg-red-500 text-white rounded-full w-4 h-4 inline-flex items-center justify-center text-xs">
                      {stats.supportStats.escalated}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="bg-white border border-neutral-100 rounded-2xl shadow-sm overflow-hidden">
              {filteredConvos.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <MessageSquare className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-400">No conversations in this category.</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-50">
                  {filteredConvos.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedConvo(c.id)}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-neutral-50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-neutral-800 text-sm truncate">{c.user_email}</p>
                          <StatusBadge status={c.status} />
                        </div>
                        <p className="text-xs text-neutral-500 truncate">{c.subject}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">{formatDate(c.updated_at)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Support Drawer */}
      <AnimatePresence>
        {selectedConvo && (
          <SupportDrawer
            conversationId={selectedConvo}
            onClose={() => setSelectedConvo(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
