import { useState, useRef, useEffect, useCallback } from "react";
import { Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import AiMessageBubble from "./AiMessageBubble";
import AiInputBar from "./AiInputBar";

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
}

interface AiChatPanelProps {
  onClose: () => void;
}

let msgCounter = 0;
function nextId() {
  return `msg-${++msgCounter}-${Date.now()}`;
}

export default function AiChatPanel({ onClose }: AiChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: nextId(),
      role: "assistant",
      content: "你好！我是 AI 助手，可以帮你管理任务、创建项目、查询进度。请告诉我你需要什么帮助？",
      type: "text",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationHistory = useRef<{ role: string; content: string }[]>([]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

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
          assistantContent = data.actions.map((a: ActionPayload) => a.summary).join("\n");
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

  return (
    <div
      className={cn(
        "fixed right-6 bottom-24 z-50 w-[400px] h-[70vh] max-sm:w-[calc(100vw-1.5rem)] max-sm:right-3 max-sm:bottom-20",
        "bg-white rounded-2xl shadow-2xl",
        "flex flex-col overflow-hidden",
        "transition-all duration-200 origin-bottom-right",
        visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
      )}
      data-testid="ai-chat-panel"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-indigo-600">
        <h3 className="text-sm font-semibold text-white">AI 助手</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            data-testid="ai-minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            data-testid="ai-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3 space-y-1">
        {messages.map((msg) => (
          <AiMessageBubble
            key={msg.id}
            message={msg}
            onConfirm={handleConfirm}
            onReject={handleReject}
          />
        ))}
        {loading && (
          <div className="flex justify-start px-4 py-1">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      <AiInputBar onSend={handleSend} loading={loading} />
    </div>
  );
}
