"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { VidzeeLogo } from "@/components/vidzee-logo";
import {
  Users,
  DollarSign,
  Zap,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ChevronRight,
  X,
  Send,
  Activity,
  CreditCard,
  BarChart3,
  Shield,
  LogOut,
  Search,
  Plus,
  Minus,
  ExternalLink,
  Wifi,
  WifiOff,
  UserCheck,
  UserX,
  Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// ── Constants ──────────────────────────────────────────────────────────────────
const ADMIN_SECRET = "vidzee-admin-2026";

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

interface StripeData {
  configured: boolean;
  summary?: {
    totalRevenue: number;
    totalRefunded: number;
    netRevenue: number;
    totalCharges: number;
    successfulCharges: number;
    failedCharges: number;
    refundedCharges: number;
    totalCustomers: number;
  };
  last30Days?: { revenue: number; charges: number };
  dailySeries?: { date: string; amount: number }[];
  charges?: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    refunded: boolean;
    amount_refunded: number;
    description: string | null;
    customer_email: string | null;
    customer_name: string | null;
    created: string;
    receipt_url: string | null;
    payment_intent: string | null;
    metadata: Record<string, string>;
  }[];
}

interface SessionData {
  summary: {
    totalUsers: number;
    activeLast24h: number;
    activeLastWeek: number;
    activeLastMonth: number;
    neverSignedIn: number;
    confirmed: number;
    unconfirmed: number;
  };
  providerBreakdown: { provider: string; count: number }[];
  dauSeries: { date: string; count: number }[];
  signupSeries: { date: string; count: number }[];
  recentSessions: {
    user_id: string;
    email: string;
    last_sign_in: string;
    provider: string;
    created_at: string;
  }[];
}

interface UserDetail {
  user: {
    id: string;
    email: string;
    created_at: string;
    last_sign_in: string;
    email_confirmed_at: string | null;
    phone: string | null;
    provider: string;
    providers: string[];
    user_metadata: Record<string, unknown>;
  };
  credits: { balance: number; updated_at: string | null };
  transactions: {
    id: string;
    amount: number;
    type: string;
    description: string;
    created_at: string;
  }[];
  projects: {
    id: string;
    name: string;
    status: string;
    created_at: string;
    updated_at: string;
  }[];
  supportConversations: {
    id: string;
    status: string;
    subject: string;
    created_at: string;
  }[];
}

interface SupportMessage {
  id: string;
  role: "user" | "assistant" | "admin";
  content: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDateShort(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function timeAgo(d: string | null | undefined) {
  if (!d) return "never";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateShort(d);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-blue-50 text-blue-700 border border-blue-100",
    escalated: "bg-red-50 text-red-700 border border-red-100",
    resolved: "bg-green-50 text-green-700 border border-green-100",
    closed: "bg-neutral-100 text-neutral-500 border border-neutral-200",
    succeeded: "bg-green-50 text-green-700 border border-green-100",
    failed: "bg-red-50 text-red-700 border border-red-100",
    refunded: "bg-yellow-50 text-yellow-700 border border-yellow-100",
    complete: "bg-green-50 text-green-700 border border-green-100",
    editing: "bg-neutral-100 text-neutral-600 border border-neutral-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? "bg-neutral-100 text-neutral-600"}`}>
      {status}
    </span>
  );
}

// ── Mini Bar Chart ─────────────────────────────────────────────────────────────
function MiniBarChart({ data, color = "#3B82F6" }: { data: { date: string; value: number }[]; color?: string }) {
  if (!data.length) return <div className="h-16 flex items-center justify-center text-xs text-neutral-400">No data</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-0.5 h-16">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
          <div
            className="w-full rounded-sm transition-opacity group-hover:opacity-70"
            style={{ height: `${Math.max(2, (d.value / max) * 56)}px`, backgroundColor: color }}
          />
          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
            {formatDateShort(d.date)}: {d.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = "text-accent", bg = "bg-neutral-50" }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  bg?: string;
}) {
  return (
    <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Support Drawer ─────────────────────────────────────────────────────────────
function SupportDrawer({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [convo, setConvo] = useState<{ user_email: string; subject: string; status: string; admin_notes: string } | null>(null);
  const [status, setStatus] = useState("open");
  const [notes, setNotes] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/support?id=${conversationId}`, {
      headers: { "x-admin-secret": ADMIN_SECRET },
    });
    if (!res.ok) return;
    const data = await res.json() as { conversation: typeof convo & { status: string; admin_notes: string }; messages: SupportMessage[] };
    setConvo(data.conversation);
    setMessages(data.messages ?? []);
    setStatus(data.conversation?.status ?? "open");
    setNotes(data.conversation?.admin_notes ?? "");
  }, [conversationId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const updateStatus = async (s: string) => {
    setStatus(s);
    await fetch("/api/admin/support", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
      body: JSON.stringify({ id: conversationId, status: s }),
    });
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    await fetch("/api/admin/support", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
      body: JSON.stringify({ id: conversationId, admin_reply: reply.trim() }),
    });
    setReply("");
    await load();
    setSending(false);
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
      className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white border-l border-neutral-200 shadow-2xl z-50 flex flex-col"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
        <div>
          <p className="font-semibold text-neutral-900 text-sm">{convo?.user_email ?? "Loading..."}</p>
          <p className="text-xs text-neutral-500 mt-0.5">{convo?.subject ?? "Support conversation"}</p>
        </div>
        <div className="flex items-center gap-2">
          {convo && <StatusBadge status={status} />}
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex gap-2 px-5 py-3 border-b border-neutral-100 bg-neutral-50">
        {["open", "escalated", "resolved", "closed"].map((s) => (
          <button
            key={s}
            onClick={() => void updateStatus(s)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${status === s ? "bg-accent text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100"}`}
          >
            {s}
          </button>
        ))}
      </div>
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
              {m.role === "assistant" && <p className="text-xs font-semibold mb-1 opacity-60">AI Agent</p>}
              {m.role === "admin" && <p className="text-xs font-semibold mb-1 opacity-80">You (Admin)</p>}
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              <p className="text-xs opacity-50 mt-1">{timeAgo(m.created_at)}</p>
            </div>
          </div>
        ))}
        {messages.length === 0 && <p className="text-center text-neutral-400 text-sm py-8">No messages yet</p>}
        <div ref={messagesEndRef} />
      </div>
      <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50">
        <label className="text-xs font-medium text-neutral-500 block mb-1">Internal Notes (not visible to user)</label>
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
          placeholder="Add internal notes..."
        />
      </div>
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

// ── User Detail Drawer ─────────────────────────────────────────────────────────
function UserDrawer({ userId, onClose, onSelectConvo }: {
  userId: string;
  onClose: () => void;
  onSelectConvo: (id: string) => void;
}) {
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustMsg, setAdjustMsg] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch(`/api/admin/users/${userId}`, {
        headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (res.ok) setData(await res.json() as UserDetail);
      setLoading(false);
    })();
  }, [userId]);

  const adjustCredits = async (sign: 1 | -1) => {
    const amount = parseInt(adjustAmount) * sign;
    if (!amount || isNaN(amount)) return;
    setAdjusting(true);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
      body: JSON.stringify({ action: "adjust_credits", amount, reason: adjustReason }),
    });
    const result = await res.json() as { ok: boolean; newBalance: number };
    if (result.ok && data) {
      setData({ ...data, credits: { ...data.credits, balance: result.newBalance } });
      setAdjustMsg(`Balance updated to ${result.newBalance} credits`);
      setAdjustAmount("");
      setAdjustReason("");
      setTimeout(() => setAdjustMsg(""), 3000);
    }
    setAdjusting(false);
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
      className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white border-l border-neutral-200 shadow-2xl z-50 flex flex-col overflow-y-auto"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 sticky top-0 bg-white z-10">
        <div>
          <p className="font-semibold text-neutral-900 text-sm">{data?.user.email ?? "Loading..."}</p>
          <p className="text-xs text-neutral-500 mt-0.5">User Profile</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <RefreshCw className="w-5 h-5 text-neutral-300 animate-spin" />
        </div>
      ) : data ? (
        <div className="flex-1 px-5 py-4 space-y-5">
          {/* User info */}
          <div className="bg-neutral-50 rounded-2xl p-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: "Joined", value: formatDateShort(data.user.created_at) },
                { label: "Last Sign In", value: timeAgo(data.user.last_sign_in) },
                { label: "Provider", value: data.user.provider, capitalize: true },
                { label: "Email Verified", value: data.user.email_confirmed_at ? "Yes" : "No", color: data.user.email_confirmed_at ? "text-green-600" : "text-red-500" },
              ].map(({ label, value, capitalize, color }) => (
                <div key={label}>
                  <p className="text-neutral-400 mb-0.5">{label}</p>
                  <p className={`font-medium ${color ?? "text-neutral-700"} ${capitalize ? "capitalize" : ""}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Credits */}
          <div className="bg-white border border-neutral-100 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-neutral-800">Credits</p>
              <span className="text-2xl font-bold text-accent">{data.credits.balance}</span>
            </div>
            <div className="space-y-2">
              <input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="w-full text-sm rounded-lg border border-neutral-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Amount to add or remove..."
              />
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full text-sm rounded-lg border border-neutral-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Reason (optional)..."
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void adjustCredits(1)}
                  disabled={adjusting || !adjustAmount}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
                <button
                  onClick={() => void adjustCredits(-1)}
                  disabled={adjusting || !adjustAmount}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 disabled:opacity-40 transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
              {adjustMsg && <p className="text-xs text-green-600 font-medium">{adjustMsg}</p>}
            </div>
          </div>

          {/* Projects */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Projects ({data.projects.length})</p>
            {data.projects.length === 0 ? (
              <p className="text-xs text-neutral-400">No projects yet</p>
            ) : (
              <div className="space-y-1.5">
                {data.projects.slice(0, 10).map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-neutral-50 rounded-xl px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{p.name}</p>
                      <p className="text-xs text-neutral-400">{formatDateShort(p.created_at)}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Credit history */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Credit History ({data.transactions.length})</p>
            {data.transactions.length === 0 ? (
              <p className="text-xs text-neutral-400">No transactions yet</p>
            ) : (
              <div className="space-y-1.5">
                {data.transactions.slice(0, 15).map((t) => (
                  <div key={t.id} className="flex items-center justify-between bg-neutral-50 rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-neutral-700 truncate">{t.description}</p>
                      <p className="text-xs text-neutral-400">{timeAgo(t.created_at)}</p>
                    </div>
                    <span className={`text-sm font-bold ml-3 ${t.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                      {t.amount > 0 ? "+" : ""}{t.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Support conversations */}
          {data.supportConversations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Support ({data.supportConversations.length})</p>
              <div className="space-y-1.5">
                {data.supportConversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { onClose(); onSelectConvo(c.id); }}
                    className="w-full flex items-center justify-between bg-neutral-50 rounded-xl px-3 py-2.5 hover:bg-neutral-100 transition-colors text-left"
                  >
                    <div>
                      <p className="text-xs font-medium text-neutral-700">{c.subject ?? "Support chat"}</p>
                      <p className="text-xs text-neutral-400">{timeAgo(c.created_at)}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">User not found</div>
      )}
    </motion.div>
  );
}

// ── Main Admin Page ────────────────────────────────────────────────────────────
type Tab = "overview" | "stripe" | "users" | "sessions" | "transactions" | "api" | "support";

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [stripeData, setStripeData] = useState<StripeData | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [supportFilter, setSupportFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/admin/stats", { headers: { "x-admin-secret": ADMIN_SECRET } });
    if (res.ok) setStats(await res.json() as AdminStats);
  }, []);

  const loadStripe = useCallback(async () => {
    const res = await fetch("/api/admin/stripe", { headers: { "x-admin-secret": ADMIN_SECRET } });
    if (res.ok) setStripeData(await res.json() as StripeData);
  }, []);

  const loadSessions = useCallback(async () => {
    const res = await fetch("/api/admin/sessions", { headers: { "x-admin-secret": ADMIN_SECRET } });
    if (res.ok) setSessionData(await res.json() as SessionData);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadStats(), loadStripe(), loadSessions()]);
    setLoading(false);
  }, [loadStats, loadStripe, loadSessions]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const refresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  const filteredConvos = (stats?.recentConversations ?? []).filter(
    (c) => supportFilter === "all" || c.status === supportFilter
  );

  const filteredUsers = (stats?.recentUsers ?? []).filter(
    (u) => !userSearch || u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "stripe", label: "Revenue", icon: DollarSign },
    { id: "users", label: "Users", icon: Users },
    { id: "sessions", label: "Sessions", icon: Activity },
    { id: "transactions", label: "Transactions", icon: CreditCard },
    { id: "api", label: "API Usage", icon: Zap },
    { id: "support", label: "Support", icon: MessageSquare },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="text-sm text-neutral-500">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <VidzeeLogo className="w-7 h-7 text-accent" />
          <div className="h-5 w-px bg-neutral-200" />
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold text-neutral-700">Admin Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void refresh()}
            disabled={refreshing}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => void handleSignOut()}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="bg-white border-b border-neutral-100 px-6 sticky top-[65px] z-20">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? "border-accent text-accent"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.id === "support" && (stats?.supportStats.escalated ?? 0) > 0 && (
                <span className="ml-1 bg-red-500 text-white rounded-full w-4 h-4 inline-flex items-center justify-center text-xs">
                  {stats!.supportStats.escalated}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">

        {/* ── Overview ── */}
        {tab === "overview" && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total Users" value={stats.overview.totalUsers.toLocaleString()} sub="All time" color="text-blue-600" bg="bg-blue-50" />
              <StatCard icon={Zap} label="Total Projects" value={stats.overview.totalProjects.toLocaleString()} sub="All time" color="text-purple-600" bg="bg-purple-50" />
              <StatCard icon={DollarSign} label="Total Revenue" value={`$${stats.overview.totalRevenue.toLocaleString()}`} sub="From purchases" color="text-green-600" bg="bg-green-50" />
              <StatCard icon={CreditCard} label="Transactions" value={stats.overview.totalTransactions.toLocaleString()} sub="Credit purchases" color="text-orange-600" bg="bg-orange-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">User Growth (30 days)</p>
                <MiniBarChart data={stats.userGrowthSeries.map((d) => ({ date: d.date, value: d.count }))} color="#3B82F6" />
              </div>
              <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">Revenue (30 days)</p>
                <MiniBarChart data={stats.revenueSeries.map((d) => ({ date: d.date, value: d.amount }))} color="#10B981" />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={MessageSquare} label="Open Tickets" value={stats.supportStats.open} color="text-blue-600" bg="bg-blue-50" />
              <StatCard icon={AlertTriangle} label="Escalated" value={stats.supportStats.escalated} color="text-red-600" bg="bg-red-50" />
              <StatCard icon={CheckCircle} label="Resolved" value={stats.supportStats.resolved} color="text-green-600" bg="bg-green-50" />
              <StatCard icon={Activity} label="Total Chats" value={stats.supportStats.total} color="text-purple-600" bg="bg-purple-50" />
            </div>

            <div className="bg-white border border-neutral-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-50 flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-800">Recent Users</p>
                <button onClick={() => setTab("users")} className="text-xs text-accent hover:underline">View all</button>
              </div>
              <div className="divide-y divide-neutral-50">
                {stats.recentUsers.slice(0, 5).map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUser(u.id)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold shrink-0">
                      {(u.email?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate">{u.email}</p>
                      <p className="text-xs text-neutral-400">Joined {timeAgo(u.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-accent">{u.credits ?? 0} cr</p>
                      <p className="text-xs text-neutral-400">{u.projects ?? 0} projects</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-300 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Stripe Revenue ── */}
        {tab === "stripe" && (
          <div className="space-y-6">
            {!stripeData?.configured ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-8 text-center">
                <CreditCard className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
                <p className="font-semibold text-yellow-800 text-lg">Stripe Not Configured</p>
                <p className="text-sm text-yellow-700 mt-2 max-w-sm mx-auto">Add <code className="bg-yellow-100 px-1 rounded">STRIPE_SECRET_KEY</code> to your Vercel environment variables to see live Stripe data.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon={DollarSign} label="Total Revenue" value={`$${(stripeData.summary?.totalRevenue ?? 0).toLocaleString()}`} sub="All time gross" color="text-green-600" bg="bg-green-50" />
                  <StatCard icon={TrendingUp} label="Net Revenue" value={`$${(stripeData.summary?.netRevenue ?? 0).toLocaleString()}`} sub="After refunds" color="text-emerald-600" bg="bg-emerald-50" />
                  <StatCard icon={DollarSign} label="Last 30 Days" value={`$${(stripeData.last30Days?.revenue ?? 0).toLocaleString()}`} sub={`${stripeData.last30Days?.charges ?? 0} charges`} color="text-blue-600" bg="bg-blue-50" />
                  <StatCard icon={CreditCard} label="Successful" value={stripeData.summary?.successfulCharges ?? 0} sub={`${stripeData.summary?.failedCharges ?? 0} failed`} color="text-purple-600" bg="bg-purple-50" />
                </div>

                <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">Daily Revenue (30 days)</p>
                  <MiniBarChart data={(stripeData.dailySeries ?? []).map((d) => ({ date: d.date, value: d.amount }))} color="#10B981" />
                </div>

                <div className="bg-white border border-neutral-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-neutral-50">
                    <p className="text-sm font-semibold text-neutral-800">Recent Charges</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-neutral-50">
                        <tr>
                          {["Customer", "Amount", "Status", "Date", "Receipt"].map((h) => (
                            <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-50">
                        {(stripeData.charges ?? []).map((c) => (
                          <tr key={c.id} className="hover:bg-neutral-50 transition-colors">
                            <td className="px-5 py-3.5">
                              <p className="text-sm font-medium text-neutral-800">{c.customer_email ?? c.customer_name ?? "—"}</p>
                              <p className="text-xs text-neutral-400">{c.metadata?.pack_id ?? c.description ?? c.id.slice(0, 12)}</p>
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="text-sm font-semibold text-neutral-800">${c.amount.toFixed(2)}</p>
                              {c.amount_refunded > 0 && <p className="text-xs text-red-500">-${c.amount_refunded.toFixed(2)}</p>}
                            </td>
                            <td className="px-5 py-3.5"><StatusBadge status={c.refunded ? "refunded" : c.status} /></td>
                            <td className="px-5 py-3.5 text-sm text-neutral-500">{timeAgo(c.created)}</td>
                            <td className="px-5 py-3.5">
                              {c.receipt_url ? (
                                <a href={c.receipt_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-xs flex items-center gap-1">
                                  View <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(stripeData.charges ?? []).length === 0 && (
                      <div className="px-5 py-10 text-center">
                        <CreditCard className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                        <p className="text-sm text-neutral-400">No charges yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Users ── */}
        {tab === "users" && stats && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white"
              />
            </div>
            <div className="bg-white border border-neutral-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-50">
                <p className="text-sm font-semibold text-neutral-800">{filteredUsers.length} users</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50">
                    <tr>
                      {["User", "Credits", "Projects", "Last Active", "Joined"].map((h, i) => (
                        <th key={h} className={`px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {filteredUsers.map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => setSelectedUser(u.id)}
                        className="hover:bg-neutral-50 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold shrink-0">
                              {(u.email?.[0] ?? "?").toUpperCase()}
                            </div>
                            <p className="text-sm font-medium text-neutral-800">{u.email}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`text-sm font-semibold ${(u.credits ?? 0) === 0 ? "text-red-500" : "text-accent"}`}>{u.credits ?? 0}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm text-neutral-600">{u.projects ?? 0}</td>
                        <td className="px-5 py-3.5 text-right text-sm text-neutral-500">{timeAgo(u.last_sign_in)}</td>
                        <td className="px-5 py-3.5 text-right text-sm text-neutral-500">{formatDateShort(u.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className="px-5 py-10 text-center">
                    <Users className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm text-neutral-400">No users found.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Sessions ── */}
        {tab === "sessions" && sessionData && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Wifi} label="Active (24h)" value={sessionData.summary.activeLast24h} sub="Unique users" color="text-green-600" bg="bg-green-50" />
              <StatCard icon={TrendingUp} label="Active (7d)" value={sessionData.summary.activeLastWeek} sub="Unique users" color="text-blue-600" bg="bg-blue-50" />
              <StatCard icon={Activity} label="Active (30d)" value={sessionData.summary.activeLastMonth} sub="Unique users" color="text-purple-600" bg="bg-purple-50" />
              <StatCard icon={WifiOff} label="Never Signed In" value={sessionData.summary.neverSignedIn} sub="Signed up only" color="text-neutral-400" bg="bg-neutral-100" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">Daily Active Users (30 days)</p>
                <MiniBarChart data={sessionData.dauSeries.map((d) => ({ date: d.date, value: d.count }))} color="#8B5CF6" />
              </div>
              <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">New Signups (30 days)</p>
                <MiniBarChart data={sessionData.signupSeries.map((d) => ({ date: d.date, value: d.count }))} color="#3B82F6" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">Auth Providers</p>
                <div className="space-y-3">
                  {sessionData.providerBreakdown.map((p) => {
                    const pct = Math.round((p.count / Math.max(sessionData.summary.totalUsers, 1)) * 100);
                    return (
                      <div key={p.provider}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <div className="flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-neutral-400" />
                            <span className="font-medium text-neutral-700 capitalize">{p.provider}</span>
                          </div>
                          <span className="text-neutral-500">{p.count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">Email Verification</p>
                <div className="space-y-3">
                  {[
                    { label: "Verified", count: sessionData.summary.confirmed, icon: UserCheck, color: "text-green-500", bar: "bg-green-500" },
                    { label: "Unverified", count: sessionData.summary.unconfirmed, icon: UserX, color: "text-red-400", bar: "bg-red-400" },
                  ].map(({ label, count, icon: Icon, color, bar }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-3.5 h-3.5 ${color}`} />
                          <span className="font-medium text-neutral-700">{label}</span>
                        </div>
                        <span className="text-neutral-500">{count}</span>
                      </div>
                      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div className={`h-full ${bar} rounded-full`} style={{ width: `${Math.round((count / Math.max(sessionData.summary.totalUsers, 1)) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white border border-neutral-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-50">
                <p className="text-sm font-semibold text-neutral-800">Recent Sessions</p>
              </div>
              <div className="divide-y divide-neutral-50">
                {sessionData.recentSessions.map((s) => (
                  <button
                    key={s.user_id}
                    onClick={() => setSelectedUser(s.user_id)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold shrink-0">
                      {(s.email?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate">{s.email}</p>
                      <p className="text-xs text-neutral-400 capitalize">{s.provider} · Joined {formatDateShort(s.created_at)}</p>
                    </div>
                    <p className="text-xs text-neutral-500 shrink-0">{timeAgo(s.last_sign_in)}</p>
                    <ChevronRight className="w-4 h-4 text-neutral-300 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Transactions ── */}
        {tab === "transactions" && stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <StatCard icon={DollarSign} label="Total Revenue" value={`$${stats.overview.totalRevenue.toLocaleString()}`} sub="All time" color="text-green-600" bg="bg-green-50" />
              <StatCard icon={CreditCard} label="Total Purchases" value={stats.overview.totalTransactions} sub="Credit pack purchases" color="text-purple-600" bg="bg-purple-50" />
            </div>
            <div className="bg-white border border-neutral-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-50">
                <p className="text-sm font-semibold text-neutral-800">Recent Transactions</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50">
                    <tr>
                      {["User", "Description", "Credits", "Date"].map((h, i) => (
                        <th key={h} className={`px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide ${i < 2 ? "text-left" : "text-right"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {stats.recentTransactions.map((t) => {
                      const user = stats.recentUsers.find((u) => u.id === t.user_id);
                      return (
                        <tr key={t.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-5 py-3.5">
                            <button onClick={() => setSelectedUser(t.user_id)} className="text-sm font-medium text-accent hover:underline text-left">
                              {user?.email ?? t.user_id.slice(0, 12) + "..."}
                            </button>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-neutral-600 max-w-xs truncate">{t.description}</td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={`text-sm font-bold ${t.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                              {t.amount > 0 ? "+" : ""}{t.amount}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right text-sm text-neutral-500">{timeAgo(t.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {stats.recentTransactions.length === 0 && (
                  <div className="px-5 py-10 text-center">
                    <CreditCard className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm text-neutral-400">No transactions yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── API Usage ── */}
        {tab === "api" && stats && (
          <div className="bg-white border border-neutral-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-50">
              <p className="text-sm font-semibold text-neutral-800">API Usage (Last 30 Days)</p>
              <p className="text-xs text-neutral-400 mt-0.5">Logged after each provider call</p>
            </div>
            {stats.apiUsage.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50">
                    <tr>
                      {["Provider", "Calls", "Errors", "Error Rate", "Avg Latency"].map((h, i) => (
                        <th key={h} className={`px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                      ))}
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
        )}

        {/* ── Support ── */}
        {tab === "support" && stats && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {["all", "open", "escalated", "resolved"].map((f) => (
                <button
                  key={f}
                  onClick={() => setSupportFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    supportFilter === f ? "bg-accent text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
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
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        c.status === "escalated" ? "bg-red-500" : c.status === "open" ? "bg-blue-500" : "bg-neutral-300"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-medium text-neutral-800 text-sm truncate">{c.user_email}</p>
                          <StatusBadge status={c.status} />
                        </div>
                        <p className="text-xs text-neutral-500 truncate">{c.subject ?? "Support conversation"}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">{timeAgo(c.updated_at)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Drawers */}
      <AnimatePresence>
        {selectedConvo && (
          <SupportDrawer
            key="support-drawer"
            conversationId={selectedConvo}
            onClose={() => setSelectedConvo(null)}
          />
        )}
        {selectedUser && !selectedConvo && (
          <UserDrawer
            key="user-drawer"
            userId={selectedUser}
            onClose={() => setSelectedUser(null)}
            onSelectConvo={(id) => { setSelectedUser(null); setSelectedConvo(id); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
