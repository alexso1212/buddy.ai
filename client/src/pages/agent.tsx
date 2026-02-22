import { useState, useRef, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import AiMessageBubble from "@/components/ai/AiMessageBubble";
import AiInputBar from "@/components/ai/AiInputBar";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActionPayload {
  actionType: string;
  data: Record<string, any>;
  summary: string;
  confidence?: number;
  missingFields?: string[];
  followUpQuestion?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  type?: "text" | "confirm" | "multi_confirm";
  action?: ActionPayload;
  actions?: ActionPayload[];
  confirmed?: boolean | null;
  actionConfirmed?: (boolean | null)[];
  skipped?: boolean;
  actionSkipped?: boolean[];
}

const STORAGE_KEY = "ai_chat_history";

const defaultWelcomeMessage: Message = {
  id: "msg-1-0",
  role: "assistant",
  content: "你好！我是 AI 助手，可以帮你管理任务、创建项目、查询进度。请告诉我你需要什么帮助？",
  type: "text",
};

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

  return (
    <div className="flex flex-col h-full -m-6" data-testid="agent-page">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 flex items-start justify-between gap-4" data-testid="agent-header">
        <div>
          <h1 className="text-xl font-bold text-white">AI 助手</h1>
          <p className="text-sm text-white/70">智能任务管理助手，帮你高效管理工作</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          data-testid="btn-clear-chat"
          onClick={handleClearChat}
          className="text-white hover:bg-white/20 no-default-hover-elevate shrink-0 mt-1"
        >
          <Trash2 className="w-5 h-5" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4" data-testid="agent-messages">
        <div className="max-w-3xl mx-auto space-y-1">
          {messages.map((msg) => (
            <AiMessageBubble
              key={msg.id}
              message={msg}
              onConfirm={handleConfirm}
              onReject={handleReject}
              onSkip={handleSkip}
            />
          ))}
          {loading && (
            <div className="flex justify-start px-4 py-1">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-card" data-testid="agent-input">
        <div className="max-w-3xl mx-auto">
          <AiInputBar onSend={handleSend} loading={loading} />
        </div>
      </div>
    </div>
  );
}
