"use client";

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageSquare,
  Send,
  Loader2,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Sparkles,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant" | "admin";
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  status: string;
  subject: string;
}

export interface SupportChatHandle {
  open: () => void;
}

const SUGGESTED_QUESTIONS = [
  "How do I create a new video project?",
  "Why is my clip generation stuck?",
  "How do credits work?",
  "Can I download individual clips?",
  "How do I export in portrait mode?",
];

export const SupportChat = forwardRef<SupportChatHandle>(function SupportChat(_props, ref) {
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Expose open() method to parent via ref
  useImperativeHandle(ref, () => ({
    open: () => handleOpen(),
  }));

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
      setUnread(0);
    }
  }, [open]);

  const startConversation = useCallback(async (firstMessage?: string) => {
    setLoading(true);
    try {
      // Create conversation
      const res = await fetch("/api/support/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: firstMessage?.slice(0, 80) ?? "Support Request" }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      const data = await res.json() as { conversation: Conversation };
      setConversation(data.conversation);

      // Add welcome message
      const welcome: Message = {
        id: "welcome",
        role: "assistant",
        content: "Hi! I'm the Vidzee AI support agent. I can help you with video generation, credits, exports, and anything else about Vidzee. What can I help you with today?",
        created_at: new Date().toISOString(),
      };
      setMessages([welcome]);

      // If there's a first message, send it
      if (firstMessage) {
        await sendMessage(data.conversation.id, firstMessage, [welcome]);
      }
    } catch {
      setLoading(false);
    }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = async (convId: string, content: string, _currentMessages?: Message[]) => {
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await fetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, content }),
      });

      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json() as { message: { role: string; content: string }; escalated: boolean };

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: data.message.content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      if (data.escalated) {
        setEscalated(true);
        setConversation((prev) => prev ? { ...prev, status: "escalated" } : prev);
      }

      // If chat is closed, increment unread
      if (!open) setUnread((n) => n + 1);
    } catch {
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setInput("");

    if (!conversation) {
      await startConversation(content);
    } else {
      await sendMessage(conversation.id, content, messages);
    }
  };

  const handleSuggestion = async (q: string) => {
    setInput("");
    if (!conversation) {
      await startConversation(q);
    } else {
      await sendMessage(conversation.id, q, messages);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setUnread(0);
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        <AnimatePresence>
          {!open && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpen}
              className="relative w-14 h-14 rounded-full bg-accent shadow-lg shadow-accent/30 flex items-center justify-center text-white"
            >
              <MessageSquare className="w-6 h-6" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                  {unread}
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden"
            style={{ maxHeight: "min(600px, calc(100vh - 6rem))" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-accent text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Vidzee Support</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                    <p className="text-xs text-white/80">
                      {escalated ? "Escalated to team" : "AI Agent · Online"}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Escalation banner */}
            {escalated && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700">Your issue has been escalated to our team. We'll follow up via email.</p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
              {/* Welcome / empty state */}
              {messages.length === 0 && !loading && (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4 text-accent" />
                    </div>
                    <div className="bg-neutral-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-neutral-800 max-w-[85%]">
                      <p>Hi! I'm the Vidzee AI support agent. I can help you with video generation, credits, exports, and anything else. What can I help you with?</p>
                    </div>
                  </div>

                  {/* Suggested questions */}
                  <div className="space-y-2 pl-11">
                    <p className="text-xs text-neutral-400 font-medium">Common questions</p>
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => void handleSuggestion(q)}
                        className="block w-full text-left text-xs px-3 py-2 rounded-xl border border-neutral-200 text-neutral-600 hover:border-accent hover:text-accent hover:bg-accent/5 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-accent animate-spin" />
                </div>
              )}

              {/* Message bubbles */}
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  {m.role !== "user" && (
                    <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                      {m.role === "admin" ? (
                        <span className="text-xs font-bold text-accent">A</span>
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-accent" />
                      )}
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-accent text-white rounded-tr-sm"
                      : m.role === "admin"
                      ? "bg-blue-50 text-blue-900 rounded-tl-sm border border-blue-100"
                      : "bg-neutral-100 text-neutral-800 rounded-tl-sm"
                  }`}>
                    {m.role === "admin" && (
                      <p className="text-xs font-semibold text-blue-600 mb-1">Support Team</p>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {sending && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <div className="bg-neutral-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Resolved state */}
            {conversation?.status === "resolved" && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border-t border-green-100 shrink-0">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <p className="text-xs text-green-700">This conversation has been resolved. Start a new one if you need more help.</p>
              </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 border-t border-neutral-100 shrink-0">
              <div className="flex gap-2 items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                  className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-neutral-50"
                  placeholder="Ask anything about Vidzee..."
                  disabled={sending}
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={sending || !input.trim()}
                  className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent/90 disabled:opacity-40 transition-all shrink-0"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-center text-xs text-neutral-300 mt-2">Powered by Vidzee AI · 98% issues resolved automatically</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
