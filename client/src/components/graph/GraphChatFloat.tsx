import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Sparkles, Camera } from "lucide-react";
import AiMessageBubble from "@/components/ai/AiMessageBubble";
import AgentLogo from "@/components/AgentLogo";
import ThinkingAnimation from "@/components/ThinkingAnimation";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { ForceGraphHandle } from "@/components/graph/ForceGraph";

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
  attachments?: { type: string; name: string; mimeType: string; base64: string; previewUrl?: string }[];
}

interface GraphChatFloatProps {
  open: boolean;
  onClose: () => void;
  graphRef?: React.RefObject<ForceGraphHandle | null>;
}

async function captureGraphScreenshot(svg: SVGSVGElement): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const w = svg.clientWidth || svg.getBoundingClientRect().width;
  const h = svg.clientHeight || svg.getBoundingClientRect().height;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const styles = document.querySelectorAll("style");
  let cssText = "";
  styles.forEach((s) => (cssText += s.textContent || ""));
  if (cssText) {
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = cssText;
    clone.insertBefore(styleEl, clone.firstChild);
  }

  const computed = getComputedStyle(svg);
  clone.querySelectorAll("*").forEach((el) => {
    const orig = svg.querySelector(`[data-node-id="${(el as HTMLElement).dataset?.nodeId}"]`);
    if (!orig) return;
    const cs = getComputedStyle(orig);
    (el as SVGElement).style.fill = cs.fill;
    (el as SVGElement).style.stroke = cs.stroke;
    (el as SVGElement).style.opacity = cs.opacity;
  });

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1600 / w, 1200 / h, 1);
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("No canvas context")); return; }
      ctx.fillStyle = "#0D0D0D";
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      URL.revokeObjectURL(url);
      const base64 = canvas.toDataURL("image/png").split(",")[1];
      resolve(base64);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to render SVG to image"));
    };
    img.src = url;
  });
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

export default function GraphChatFloat({ open, onClose, graphRef }: GraphChatFloatProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [pendingScreenshot, setPendingScreenshot] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationHistory = useRef<{ role: string; content: string }[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<number | null>(null);
  const { currentUserId } = useAuth();

  const saveMessageToDB = useCallback(async (convId: number, msg: { role: string; content: string; type?: string; action?: any; actions?: any; confirmed?: boolean | null; actionConfirmed?: (boolean | null)[] }) => {
    try {
      const metadata: Record<string, any> = {};
      if (msg.action) metadata.action = msg.action;
      if (msg.actions) metadata.actions = msg.actions;
      if (msg.confirmed !== undefined) metadata.confirmed = msg.confirmed;
      if (msg.actionConfirmed) metadata.actionConfirmed = msg.actionConfirmed;
      await apiRequest("POST", `/api/conversations/${convId}/messages`, {
        role: msg.role,
        content: msg.content,
        type: msg.type || 'text',
        metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
      });
    } catch (err) {
      console.error('Failed to save graph chat message:', err);
    }
  }, []);

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

  const handleCapture = useCallback(async () => {
    if (!graphRef?.current || capturing) return;
    const svg = graphRef.current.getSvgElement();
    if (!svg) return;
    setCapturing(true);
    try {
      const base64 = await captureGraphScreenshot(svg);
      setPendingScreenshot(base64);
    } catch (err) {
      console.error("Screenshot failed:", err);
    } finally {
      setCapturing(false);
    }
  }, [graphRef, capturing]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    const hasScreenshot = !!pendingScreenshot;
    if ((!text && !hasScreenshot) || loading) return;

    const finalText = text || (hasScreenshot ? "请分析当前图谱画面" : "");

    let screenshotBase64 = pendingScreenshot;
    if (!screenshotBase64 && graphRef?.current) {
      try {
        const svg = graphRef.current.getSvgElement();
        if (svg) {
          screenshotBase64 = await captureGraphScreenshot(svg);
        }
      } catch (err) {
        console.error("Auto screenshot failed:", err);
      }
    }

    setInputValue("");
    setPendingScreenshot(null);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const userMsg: Message = {
      id: nextId(),
      role: "user",
      content: finalText,
      type: "text",
      attachments: screenshotBase64 ? [{
        type: "image",
        name: "graph-screenshot.png",
        mimeType: "image/png",
        base64: screenshotBase64,
        previewUrl: `data:image/png;base64,${screenshotBase64}`,
      }] : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    conversationHistory.current.push({ role: "user", content: finalText });

    if (!conversationIdRef.current) {
      try {
        const convTitle = "📊 " + (finalText.slice(0, 25) + (finalText.length > 25 ? '...' : ''));
        const convRes = await apiRequest("POST", "/api/conversations", {
          title: convTitle,
          userId: currentUserId || 1,
        });
        const convData = await convRes.json();
        if (convData.data?.id) {
          conversationIdRef.current = convData.data.id;
          queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
        }
      } catch (err) {
        console.error('Failed to create graph conversation:', err);
      }
    }

    if (conversationIdRef.current) {
      saveMessageToDB(conversationIdRef.current, { role: "user", content: finalText, type: "text" });
    }

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

      const bodyPayload: Record<string, any> = {
        message: finalText,
        conversationHistory: conversationHistory.current.filter(m => m.content && m.content.trim() !== ''),
        currentUserId: currentUserId || 1,
        conversationId: conversationIdRef.current || undefined,
      };

      if (screenshotBase64) {
        bodyPayload.attachments = [{
          type: "image",
          name: "graph-screenshot.png",
          mimeType: "image/png",
          base64: screenshotBase64,
        }];
      }

      const res = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: streamHeaders,
        body: JSON.stringify(bodyPayload),
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
              if (finalText && finalText.trim()) {
                conversationHistory.current.push({
                  role: "assistant",
                  content: finalText,
                });
              }

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
                if (conversationIdRef.current) {
                  saveMessageToDB(conversationIdRef.current, {
                    role: "assistant",
                    content: finalText,
                    type: msgType,
                    action: pendingAction.action,
                    actions: pendingAction.actions,
                    confirmed: pendingAction.action ? null : undefined,
                    actionConfirmed: pendingAction.actions ? pendingAction.actions.map(() => null) : undefined,
                  });
                }
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: finalText, isStreaming: false }
                      : m
                  )
                );
                if (conversationIdRef.current && finalText && finalText.trim()) {
                  saveMessageToDB(conversationIdRef.current, { role: "assistant", content: finalText, type: "text" });
                }
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
        if (conversationIdRef.current && fullText.trim()) {
          saveMessageToDB(conversationIdRef.current, { role: "assistant", content: fullText, type: "text" });
        }
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
            if (conversationIdRef.current) {
              saveMessageToDB(conversationIdRef.current, { role: "assistant", content: sm.content, type: "text" });
            }
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
  }, [inputValue, loading, currentUserId, saveMessageToDB]);

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

        if (res.status === 409) {
          const errJson = await res.json();
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "system",
              content: errJson.error || "该任务已被其他人修改，请刷新后重试",
            },
          ]);
          return;
        }

        const json = await res.json();
        const result = json.data;

        let systemContent = result.message;
        if (result.duplicateWarning) {
          systemContent += `\n⚠️ ${result.duplicateWarning}`;
        }

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

        const sysMsg = {
          id: nextId(),
          role: "system" as const,
          content: systemContent,
        };
        setMessages((prev) => [...prev, sysMsg]);
        if (conversationIdRef.current) {
          saveMessageToDB(conversationIdRef.current, { role: "system", content: systemContent, type: "text" });
        }
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
    [messages, currentUserId, saveMessageToDB]
  );

  const handleConfirmAll = useCallback(
    async (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg || msg.type !== "multi_confirm" || !msg.actions || !msg.actionConfirmed) return;

      const undecidedIndexes = msg.actionConfirmed
        .map((c, i) => (c === null ? i : -1))
        .filter((i) => i !== -1);
      if (undecidedIndexes.length === 0) return;

      const batchActions = undecidedIndexes.map((i) => ({
        actionType: msg.actions![i].actionType,
        data: msg.actions![i].data,
      }));

      try {
        const res = await apiRequest("POST", "/api/ai/confirm-batch", {
          actions: batchActions,
          currentUserId: currentUserId || 1,
        });
        const json = await res.json();
        const batchResult = json.data;

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId || !m.actionConfirmed) return m;
            const updated = [...m.actionConfirmed];
            for (let j = 0; j < undecidedIndexes.length; j++) {
              updated[undecidedIndexes[j]] = batchResult.results[j]?.success ?? false;
            }
            return { ...m, actionConfirmed: updated };
          })
        );

        const summaryParts: string[] = [];
        for (const r of batchResult.results) {
          let line = r.message;
          if (r.duplicateWarning) line += ` ⚠️ ${r.duplicateWarning}`;
          summaryParts.push(line);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "system",
            content: summaryParts.join("\n"),
          },
        ]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "system",
            content: err.message || "批量执行失败，请重试",
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
            onConfirmAll={handleConfirmAll}
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
        }}
        data-testid="graph-chat-input-area"
      >
        {pendingScreenshot && (
          <div style={{
            marginBottom: 8,
            position: "relative",
            display: "inline-block",
          }}>
            <img
              src={`data:image/png;base64,${pendingScreenshot}`}
              alt="Graph screenshot"
              style={{
                width: 120,
                height: 72,
                objectFit: "cover",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
              }}
              data-testid="graph-screenshot-preview"
            />
            <button
              onClick={() => setPendingScreenshot(null)}
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.7)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
              }}
              data-testid="graph-screenshot-remove"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          {graphRef && (
            <button
              onClick={handleCapture}
              disabled={loading || capturing}
              title="截取图谱画面"
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 10,
                border: "none",
                background: capturing
                  ? "rgba(139,92,246,0.3)"
                  : pendingScreenshot
                    ? "rgba(139,92,246,0.2)"
                    : "rgba(255,255,255,0.05)",
                color: capturing || pendingScreenshot
                  ? "#8b5cf6"
                  : "rgba(255,255,255,0.4)",
                cursor: loading || capturing ? "not-allowed" : "pointer",
                transition: "all 150ms",
                flexShrink: 0,
              }}
              data-testid="graph-chat-capture"
            >
              <Camera size={16} strokeWidth={2} />
            </button>
          )}
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={pendingScreenshot ? "添加分析要求（可选）..." : "分析图谱上的任务..."}
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
            disabled={(!inputValue.trim() && !pendingScreenshot) || loading}
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              border: "none",
              background:
                (inputValue.trim() || pendingScreenshot) && !loading
                  ? "rgba(139,92,246,0.6)"
                  : "rgba(255,255,255,0.05)",
              color:
                (inputValue.trim() || pendingScreenshot) && !loading
                  ? "#fff"
                  : "rgba(255,255,255,0.25)",
              cursor:
                (inputValue.trim() || pendingScreenshot) && !loading ? "pointer" : "not-allowed",
              transition: "all 150ms",
              flexShrink: 0,
            }}
            data-testid="graph-chat-send"
          >
            <Send size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
