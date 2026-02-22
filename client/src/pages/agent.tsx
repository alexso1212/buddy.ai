import { useState, useRef, useEffect, useCallback } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import AiMessageBubble from "@/components/ai/AiMessageBubble";
import AiInputBar from "@/components/ai/AiInputBar";
import { Trash2, Sparkles, ListPlus, BarChart3, Users, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActionPayload {
  actionType: string;
  data: Record<string, any>;
  summary: string;
  confidence?: number;
  missingFields?: string[];
  followUpQuestion?: string;
}

interface FollowUpData {
  message: string;
  partialData: Record<string, any>;
  questions: {
    field: string;
    label: string;
    emoji: string;
    options: { label: string; value: any }[];
    allowCustom?: boolean;
  }[];
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  type?: "text" | "confirm" | "multi_confirm" | "follow_up";
  action?: ActionPayload;
  actions?: ActionPayload[];
  confirmed?: boolean | null;
  actionConfirmed?: (boolean | null)[];
  skipped?: boolean;
  actionSkipped?: boolean[];
  followUp?: FollowUpData;
  followUpSubmitted?: boolean;
}

const STORAGE_KEY = "ai_chat_history";

const defaultWelcomeMessage: Message = {
  id: "msg-1-0",
  role: "assistant",
  content: "你好！我是 AI 助手，可以帮你管理任务、创建项目、查询进度。请告诉我你需要什么帮助？",
  type: "text",
};

const SUGGESTIONS = [
  { text: "创建新任务", icon: ListPlus },
  { text: "查看项目进度", icon: BarChart3 },
  { text: "分析团队负载", icon: Users },
  { text: "查询待办事项", icon: CheckSquare },
];

let msgCounter = 0;
function nextId() {
  return `msg-${++msgCounter}-${Date.now()}`;
}

function restoreMsgCounter(msgs: Message[]) {
  for (const m of msgs) {
    const match = m.id.match(/^msg-(\d+)-/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > msgCounter) msgCounter = num;
    }
  }
}

function loadFromSession(): Message[] | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return null;
}

export default function Agent() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = loadFromSession();
    if (stored) {
      restoreMsgCounter(stored);
      return stored;
    }
    msgCounter = 0;
    return [{ ...defaultWelcomeMessage, id: nextId() }];
  });
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationHistory = useRef<{ role: string; content: string }[]>([]);

  useEffect(() => {
    const stored = loadFromSession();
    if (stored) {
      conversationHistory.current = stored
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleClearChat = useCallback(() => {
    msgCounter = 0;
    const welcome: Message = { ...defaultWelcomeMessage, id: nextId() };
    setMessages([welcome]);
    conversationHistory.current = [];
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: Message = {
        id: nextId(),
        role: "user",
        content: text,
        type: "text",
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      conversationHistory.current.push({ role: "user", content: text });

      try {
        const res = await apiRequest("POST", "/api/ai/chat", {
          message: text,
          conversationHistory: conversationHistory.current,
          currentUserId: 1,
        });
        const json = await res.json();
        const data = json.data;

        let assistantContent = "";
        if (data.type === "text") {
          assistantContent = data.message || "";
        } else if (data.type === "confirm" && data.action) {
          assistantContent = data.action.followUpQuestion || data.action.summary || "";
        } else if (data.type === "multi_confirm" && data.actions) {
          assistantContent = data.message || data.actions.map((a: ActionPayload) => a.summary).join("\n");
        } else if (data.type === "follow_up" && data.followUp) {
          assistantContent = data.followUp.message || "";
        }

        conversationHistory.current.push({
          role: "assistant",
          content: assistantContent,
        });

        const assistantMsg: Message = {
          id: nextId(),
          role: "assistant",
          content: assistantContent,
          type: data.type,
          action: data.action,
          actions: data.actions,
          followUp: data.followUp,
          confirmed: data.type === "confirm" ? null : undefined,
          actionConfirmed: data.type === "multi_confirm" && data.actions
            ? data.actions.map(() => null)
            : undefined,
          actionSkipped: data.type === "multi_confirm" && data.actions
            ? data.actions.map(() => false)
            : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        const errorMsg: Message = {
          id: nextId(),
          role: "system",
          content: err.message || "请求失败，请稍后重试",
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleConfirm = useCallback(
    async (messageId: string, actionIndex?: number) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;

      let action: ActionPayload | undefined;
      if (msg.type === "multi_confirm" && msg.actions && actionIndex !== undefined) {
        action = msg.actions[actionIndex];
      } else {
        action = msg.action;
      }
      if (!action) return;

      try {
        const res = await apiRequest("POST", "/api/ai/confirm", {
          actionType: action.actionType,
          data: action.data,
          currentUserId: 1,
        });
        const json = await res.json();
        const result = json.data;

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            if (m.type === "multi_confirm" && actionIndex !== undefined && m.actionConfirmed) {
              const updated = [...m.actionConfirmed];
              updated[actionIndex] = true;
              return { ...m, actionConfirmed: updated };
            }
            return { ...m, confirmed: true };
          })
        );

        const sysMsg: Message = {
          id: nextId(),
          role: "system",
          content: result.message,
        };
        setMessages((prev) => [...prev, sysMsg]);

        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stats/overview"] });
      } catch (err: any) {
        const sysMsg: Message = {
          id: nextId(),
          role: "system",
          content: err.message || "执行失败，请重试",
        };
        setMessages((prev) => [...prev, sysMsg]);
      }
    },
    [messages]
  );

  const handleReject = useCallback((messageId: string, actionIndex?: number) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        if (m.type === "multi_confirm" && actionIndex !== undefined && m.actionConfirmed) {
          const updated = [...m.actionConfirmed];
          updated[actionIndex] = false;
          return { ...m, actionConfirmed: updated };
        }
        return { ...m, confirmed: false };
      })
    );
    const sysMsg: Message = {
      id: nextId(),
      role: "system",
      content: "已取消操作",
    };
    setMessages((prev) => [...prev, sysMsg]);
  }, []);

  const handleSkip = useCallback((messageId: string, actionIndex?: number) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        if (m.type === "multi_confirm" && actionIndex !== undefined && m.actionConfirmed && m.actionSkipped) {
          const updatedConfirm = [...m.actionConfirmed];
          const updatedSkip = [...m.actionSkipped];
          updatedConfirm[actionIndex] = false;
          updatedSkip[actionIndex] = true;
          return { ...m, actionConfirmed: updatedConfirm, actionSkipped: updatedSkip };
        }
        return { ...m, confirmed: false, skipped: true };
      })
    );
    const sysMsg: Message = {
      id: nextId(),
      role: "system",
      content: "已跳过，该任务不会创建",
    };
    setMessages((prev) => [...prev, sysMsg]);
  }, []);

  const handleFollowUpSubmit = useCallback(
    async (messageId: string, mergedData: Record<string, any>) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, followUpSubmitted: true } : m
        )
      );

      conversationHistory.current.push({
        role: "user",
        content: `用户已选择完成信息：${JSON.stringify(mergedData)}`,
      });

      setLoading(true);
      try {
        const res = await apiRequest("POST", "/api/ai/chat", {
          message: `用户已选择完成信息，请直接用这些数据创建确认卡片（不要再追问）：${JSON.stringify(mergedData)}`,
          conversationHistory: conversationHistory.current,
          currentUserId: 1,
        });
        const json = await res.json();
        const data = json.data;

        let assistantContent = "";
        if (data.type === "text") {
          assistantContent = data.message || "";
        } else if (data.type === "confirm" && data.action) {
          assistantContent = data.action.summary || "";
        } else if (data.type === "multi_confirm" && data.actions) {
          assistantContent = data.message || data.actions.map((a: any) => a.summary).join("\n");
        } else if (data.type === "follow_up" && data.followUp) {
          assistantContent = data.followUp.message || "";
        }

        conversationHistory.current.push({
          role: "assistant",
          content: assistantContent,
        });

        const assistantMsg: Message = {
          id: nextId(),
          role: "assistant",
          content: assistantContent,
          type: data.type,
          action: data.action,
          actions: data.actions,
          followUp: data.followUp,
          confirmed: data.type === "confirm" ? null : undefined,
          actionConfirmed: data.type === "multi_confirm" && data.actions
            ? data.actions.map(() => null)
            : undefined,
          actionSkipped: data.type === "multi_confirm" && data.actions
            ? data.actions.map(() => false)
            : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        const errorMsg: Message = {
          id: nextId(),
          role: "system",
          content: err.message || "请求失败，请稍后重试",
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const isWelcomeOnly = messages.length === 1 && messages[0].role === "assistant" && messages[0].content === defaultWelcomeMessage.content;

  return (
    <div className="flex flex-col h-full bg-transparent" data-testid="agent-page">
      {isWelcomeOnly ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="font-serif text-2xl text-[var(--text-primary)]">有什么可以帮你的？</h1>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full max-w-md">
            {SUGGESTIONS.map((s) => {
              const SIcon = s.icon;
              return (
                <button
                  key={s.text}
                  onClick={() => handleSend(s.text)}
                  className="rounded-card border border-[var(--border-subtle)] hover:bg-black/5 dark:hover:bg-white/5 p-4 cursor-pointer text-left transition-colors"
                  data-testid={`suggestion-${s.text}`}
                >
                  <SIcon className="w-4 h-4 text-[var(--text-secondary)] mb-2" />
                  <span className="text-sm text-[var(--text-primary)]">{s.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-4 relative" ref={scrollRef} data-testid="agent-messages" style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}>
          <div className="absolute top-2 right-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              data-testid="btn-clear-chat"
              onClick={handleClearChat}
              className="text-[var(--text-secondary)] no-default-hover-elevate"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <AiMessageBubble
                key={msg.id}
                message={msg}
                onConfirm={handleConfirm}
                onReject={handleReject}
                onSkip={handleSkip}
                onFollowUpSubmit={handleFollowUpSubmit}
              />
            ))}
            {loading && (
              <div className="flex justify-start px-4 mb-6" data-testid="ai-loading">
                <div>
                  <div style={{ position: 'relative', width: 32, height: 32, marginBottom: 10 }}>
                    <svg width="32" height="32" viewBox="0 0 32 32"
                      style={{ animation: 'buddySpin 1.2s linear infinite', position: 'absolute' }}>
                      <defs>
                        <linearGradient id="loadingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#AE5630" stopOpacity="1" />
                          <stop offset="100%" stopColor="#AE5630" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <circle cx="16" cy="16" r="14" fill="none"
                        stroke="url(#loadingGrad)" strokeWidth="2"
                        strokeDasharray="66 22" strokeLinecap="round" />
                    </svg>
                    <div style={{
                      width: 20, height: 20,
                      borderRadius: '50%',
                      background: '#C4703F',
                      position: 'absolute',
                      top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Sparkles className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--text-secondary)',
                        animation: `buddyDotPulse 1.4s ease-in-out ${i * 0.15}s infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-transparent" data-testid="agent-input">
        <div className="max-w-3xl mx-auto px-4 pb-[env(safe-area-inset-bottom)]">
          <AiInputBar onSend={handleSend} loading={loading} />
        </div>
      </div>
    </div>
  );
}
