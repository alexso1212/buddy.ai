import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Sparkles } from "lucide-react";
import AiMessageBubble from "@/components/ai/AiMessageBubble";
import AgentLogo from "@/components/AgentLogo";
import ThinkingAnimation from "@/components/ThinkingAnimation";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

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
  isStreaming?: boolean;
}

interface GraphChatFloatProps {
  open: boolean;
  onClose: () => void;
}

let msgCounter = 0;
function nextId() {
  return `gchat-${++msgCounter}-${Date.now()}`;
}

const INITIAL_MESSAGE: Message = {
  id: "gchat-init",
  role: "assistant",
  content:
    "我可以帮你分析图谱上的任务，比如找出瓶颈、评估进度、建议优先级。试试问我：\n\n- 哪些任务是当前的瓶颈？\n- 项目整体进度如何？\n- 团队负载是否均衡？",
  type: "text",
};

export default function GraphChatFloat({ open, onClose }: GraphChatFloatProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [visible, setVisible] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationHistory = useRef<{ role: string; content: string }[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { currentUserId } = useAuth();

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open && visible) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open, visible]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || loading) return;

    setInputValue("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const userMsg: Message = {
      id: nextId(),
      role: "user",
      content: text,
      type: "text",
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    conversationHistory.current.push({ role: "user", content: text });

    const assistantMsgId = nextId();
    const streamingMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      type: "text",
      isStreaming: true,
    };
    setMessages((prev) => [...prev, streamingMsg]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const streamHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = localStorage.getItem("buddy_token");
      if (token) streamHeaders["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: streamHeaders,
        body: JSON.stringify({
          message: text,
          conversationHistory: conversationHistory.current,
          currentUserId: currentUserId || 1,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: "Stream failed" }));
        throw new Error(errJson.error || "Stream failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let pendingAction: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "token" && event.content) {
              fullText += event.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: fullText } : m
                )
              );
            } else if (event.type === "action") {
              pendingAction = event;
            } else if (event.type === "done") {
              const finalText = event.fullText || fullText;
              conversationHistory.current.push({
                role: "assistant",
                content: finalText,
              });

              if (pendingAction) {
                const msgType = pendingAction.actions
                  ? "multi_confirm"
                  : "confirm";
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          content: finalText,
                          isStreaming: false,
                          type: msgType,
                          action: pendingAction.action || undefined,
                          actions: pendingAction.actions || undefined,
                          confirmed: pendingAction.action ? null : undefined,
                          actionConfirmed: pendingAction.actions
                            ? pendingAction.actions.map(() => null)
                            : undefined,
                        }
                      : m
                  )
                );
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: finalText, isStreaming: false }
                      : m
                  )
                );
              }
            } else if (event.type === "error") {
              throw new Error(event.content || "Stream error");
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes("JSON"))
              throw parseErr;
          }
        }
      }

      if (
        fullText &&
        !conversationHistory.current.some(
          (m) => m.content === fullText && m.role === "assistant"
        )
      ) {
        conversationHistory.current.push({
          role: "assistant",
          content: fullText,
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: fullText, isStreaming: false }
              : m
          )
        );
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setMessages((prev) => {
          const sm = prev.find((m) => m.id === assistantMsgId);
          if (sm?.content) {
            conversationHistory.current.push({
              role: "assistant",
              content: sm.content,
            });
          }
          return prev.map((m) =>
            m.id === assistantMsgId ? { ...m, isStreaming: false } : m
          );
        });
      } else {
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== assistantMsgId);
          return [
            ...filtered,
            {
              id: nextId(),
              role: "system" as const,
              content: err.message || "请求失败，请稍后重试",
            },
          ];
        });
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [inputValue, loading, currentUserId]);

  const handleConfirm = useCallback(
    async (messageId: string, actionIndex?: number) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;

      let action: ActionPayload | undefined;
      if (
        msg.type === "multi_confirm" &&
        msg.actions &&
        actionIndex !== undefined
      ) {
        action = msg.actions[actionIndex];
      } else {
        action = msg.action;
      }
      if (!action) return;

      try {
        const res = await apiRequest("POST", "/api/ai/confirm", {
          actionType: action.actionType,
          data: action.data,
          currentUserId: currentUserId || 1,
        });
        const json = await res.json();
        const result = json.data;

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            if (
              m.type === "multi_confirm" &&
              actionIndex !== undefined &&
              m.actionConfirmed
            ) {
              const updated = [...m.actionConfirmed];
              updated[actionIndex] = true;
              return { ...m, actionConfirmed: updated };
            }
            return { ...m, confirmed: true };
          })
        );

        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "system",
            content: result.message,
          },
        ]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "system",
            content: err.message || "执行失败，请重试",
          },
        ]);
      }
    },
    [messages, currentUserId]
  );

  const handleReject = useCallback(
    (messageId: string, actionIndex?: number) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          if (
            m.type === "multi_confirm" &&
            actionIndex !== undefined &&
            m.actionConfirmed
          ) {
            const updated = [...m.actionConfirmed];
            updated[actionIndex] = false;
            return { ...m, actionConfirmed: updated };
          }
          return { ...m, confirmed: false };
        })
      );
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "system",
          content: "已取消操作",
        },
      ]);
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const adjustHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 80) + "px";
  }, []);

  if (!open) return null;

  return (
    <div
      data-testid="graph-chat-float"
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: `translateX(-50%) ${visible ? "translateY(0)" : "translateY(20px)"}`,
        zIndex: 90,
        width: "min(420px, calc(100vw - 32px))",
        height: "40vh",
        minHeight: 280,
        background: "rgba(20, 19, 18, 0.88)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease, transform 200ms ease",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={14} color="#8b5cf6" />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(255,255,255,0.8)",
            }}
            data-testid="graph-chat-title"
          >
            AI 图谱分析
          </span>
        </div>
        <button
          data-testid="graph-chat-close"
          onClick={handleClose}
          style={{
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 6,
            border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.4)",
            cursor: "pointer",
            transition: "color 150ms",
          }}
        >
          <X size={14} />
        </button>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "12px 0",
        }}
        data-testid="graph-chat-messages"
      >
        {messages.map((msg) => (
          <AiMessageBubble
            key={msg.id}
            message={msg}
            onConfirm={handleConfirm}
            onReject={handleReject}
          />
        ))}
        {loading && (
          <div className="flex justify-start px-4 mb-4">
            <ThinkingAnimation size={28} />
          </div>
        )}
      </div>

      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "10px 12px",
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
        }}
        data-testid="graph-chat-input-area"
      >
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder="分析图谱上的任务..."
          disabled={loading}
          rows={1}
          style={{
            flex: 1,
            minHeight: 36,
            maxHeight: 80,
            padding: "8px 12px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            color: "rgba(255,255,255,0.9)",
            fontSize: 14,
            lineHeight: 1.4,
            resize: "none",
            outline: "none",
            fontFamily: "var(--font-sans)",
            transition: "border-color 150ms",
          }}
          data-testid="graph-chat-input"
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || loading}
          style={{
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            border: "none",
            background:
              inputValue.trim() && !loading
                ? "rgba(139,92,246,0.6)"
                : "rgba(255,255,255,0.05)",
            color:
              inputValue.trim() && !loading
                ? "#fff"
                : "rgba(255,255,255,0.25)",
            cursor:
              inputValue.trim() && !loading ? "pointer" : "not-allowed",
            transition: "all 150ms",
            flexShrink: 0,
          }}
          data-testid="graph-chat-send"
        >
          <Send size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
