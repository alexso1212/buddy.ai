import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Sparkles, Camera, ArrowDown, Square } from "lucide-react";
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

interface Attachment {
  type: string;
  name: string;
  mimeType: string;
  base64: string;
  previewUrl?: string;
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
  attachments?: Attachment[];
  thinking?: string;
  isThinking?: boolean;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  errorType?: 'network' | 'timeout' | 'rate_limit' | 'unknown';
  retryPayload?: { text: string; attachments?: Attachment[] };
  timestamp?: number;
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationHistory = useRef<{ role: string; content: string }[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);
  const conversationIdRef = useRef<number | null>(null);
  const { currentUserId } = useAuth();

  const processFiles = useCallback((files: File[]) => {
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const isImage = file.type.startsWith('image/');
        setAttachments(prev => [...prev, {
          type: isImage ? 'image' : 'file',
          name: file.name,
          mimeType: file.type,
          base64,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      processFiles(pastedFiles);
    }
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer?.files?.length) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  }, [processFiles]);

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

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  useEffect(() => {
    if (isNearBottom()) {
      scrollToBottom(false);
    }
    setShowScrollBtn(!isNearBottom());
  }, [messages, loading, isNearBottom, scrollToBottom]);

  const handleScroll = useCallback(() => {
    setShowScrollBtn(!isNearBottom());
  }, [isNearBottom]);

  useEffect(() => {
    if (open && visible) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open, visible]);

  const [viewportHeight, setViewportHeight] = useState(
    window.visualViewport?.height || window.innerHeight
  );

  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (vv) {
      setViewportHeight(vv.height);
    }
    const onResize = () => {
      if (vv) {
        const kbH = window.innerHeight - vv.height;
        setKeyboardHeight(kbH > 50 ? kbH : 0);
        setViewportHeight(vv.height);
      } else {
        setViewportHeight(window.innerHeight);
      }
    };
    if (vv) {
      vv.addEventListener("resize", onResize);
    }
    window.addEventListener("resize", onResize);
    return () => {
      if (vv) vv.removeEventListener("resize", onResize);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const stopTouchPropagation = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  const stopPointerPropagation = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setKeyboardHeight(0);
    setViewportHeight(window.innerHeight);
    inputRef.current?.blur();
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

  const handleSendWithText = useCallback(async (text: string, sendAttachments?: Attachment[]) => {
    const hasScreenshot = !!pendingScreenshot;
    const allAttachments = [...(sendAttachments || attachments)];
    if ((!text && !hasScreenshot && allAttachments.length === 0) || loading) return;

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
    setAttachments([]);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const msgAttachments: Attachment[] = [];
    if (screenshotBase64) {
      msgAttachments.push({
        type: "image",
        name: "graph-screenshot.png",
        mimeType: "image/png",
        base64: screenshotBase64,
        previewUrl: `data:image/png;base64,${screenshotBase64}`,
      });
    }
    msgAttachments.push(...allAttachments);

    const userMsg: Message = {
      id: nextId(),
      role: "user",
      content: finalText,
      type: "text",
      attachments: msgAttachments.length > 0 ? msgAttachments : undefined,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    isStreamingRef.current = true;

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
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, streamingMsg]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let lastEventTime = Date.now();
    const STREAM_TIMEOUT_MS = 45000;
    let isTimeoutAbort = false;
    const timeoutCheck = setInterval(() => {
      if (Date.now() - lastEventTime > STREAM_TIMEOUT_MS) {
        clearInterval(timeoutCheck);
        isTimeoutAbort = true;
        abortController.abort();
      }
    }, 5000);

    let tokenBuffer = '';
    let tokenFlushTimer: ReturnType<typeof setTimeout> | null = null;

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

      const apiAttachments: any[] = [];
      if (screenshotBase64) {
        apiAttachments.push({
          type: "image",
          name: "graph-screenshot.png",
          mimeType: "image/png",
          base64: screenshotBase64,
        });
      }
      for (const att of allAttachments) {
        apiAttachments.push({
          type: att.type,
          name: att.name,
          mimeType: att.mimeType,
          base64: att.base64,
        });
      }
      if (apiAttachments.length > 0) {
        bodyPayload.attachments = apiAttachments;
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
      let pendingUsage: any = null;

      const flushTokenBuffer = () => {
        if (tokenBuffer) {
          fullText += tokenBuffer;
          const captured = fullText;
          tokenBuffer = '';
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: captured, isThinking: false } : m
            )
          );
        }
      };

      try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lastEventTime = Date.now();

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "thinking" && event.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, thinking: (m.thinking || '') + event.content, isThinking: true }
                    : m
                )
              );
            } else if (event.type === "token" && event.content) {
              tokenBuffer += event.content;
              if (!tokenFlushTimer) {
                tokenFlushTimer = setTimeout(() => {
                  flushTokenBuffer();
                  tokenFlushTimer = null;
                }, 50);
              }
            } else if (event.type === "action") {
              pendingAction = event;
            } else if (event.type === "usage") {
              pendingUsage = {
                promptTokens: event.promptTokens || 0,
                completionTokens: event.completionTokens || 0,
                totalTokens: event.totalTokens || 0,
              };
            } else if (event.type === "done") {
              flushTokenBuffer();
              const doneText = event.fullText || fullText;
              if (doneText && doneText.trim()) {
                conversationHistory.current.push({
                  role: "assistant",
                  content: doneText,
                });
              }

              const finalUsage = pendingUsage || (event.tokenUsage ? {
                promptTokens: event.tokenUsage.promptTokens || 0,
                completionTokens: event.tokenUsage.completionTokens || 0,
                totalTokens: event.tokenUsage.totalTokens || 0,
              } : undefined);

              if (pendingAction) {
                const msgType = pendingAction.actions
                  ? "multi_confirm"
                  : "confirm";
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          content: doneText,
                          isStreaming: false,
                          isThinking: false,
                          type: msgType,
                          action: pendingAction.action || undefined,
                          actions: pendingAction.actions || undefined,
                          confirmed: pendingAction.action ? null : undefined,
                          actionConfirmed: pendingAction.actions
                            ? pendingAction.actions.map(() => null)
                            : undefined,
                          tokenUsage: finalUsage,
                        }
                      : m
                  )
                );
                if (conversationIdRef.current) {
                  saveMessageToDB(conversationIdRef.current, {
                    role: "assistant",
                    content: doneText,
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
                      ? { ...m, content: doneText, isStreaming: false, isThinking: false, tokenUsage: finalUsage }
                      : m
                  )
                );
                if (conversationIdRef.current && doneText && doneText.trim()) {
                  saveMessageToDB(conversationIdRef.current, { role: "assistant", content: doneText, type: "text" });
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
              ? { ...m, content: fullText, isStreaming: false, tokenUsage: pendingUsage || undefined }
              : m
          )
        );
        if (conversationIdRef.current && fullText.trim()) {
          saveMessageToDB(conversationIdRef.current, { role: "assistant", content: fullText, type: "text" });
        }
      }
      } finally {
        clearInterval(timeoutCheck);
        if (tokenFlushTimer) clearTimeout(tokenFlushTimer);
      }
    } catch (err: any) {
      if (err.name === "AbortError" && !isTimeoutAbort) {
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
      } else if (err.name === "AbortError" && isTimeoutAbort) {
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== assistantMsgId);
          return [...filtered, {
            id: nextId(),
            role: "system" as const,
            content: '响应超时（45秒无数据），请重试',
            errorType: 'timeout' as const,
            retryPayload: { text: finalText, attachments: allAttachments.length > 0 ? allAttachments : undefined },
          }];
        });
      } else {
        const errMsg = err.message || '';
        let errorType: Message['errorType'] = 'unknown';
        let displayMsg = errMsg || '请求失败，请稍后重试';
        if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('network')) {
          errorType = 'network';
          displayMsg = '网络连接失败，请检查网络后重试';
        } else if (errMsg.includes('rate') || errMsg.includes('429') || errMsg.includes('quota')) {
          errorType = 'rate_limit';
          displayMsg = 'AI 服务繁忙，请稍等片刻后重试';
        } else if (errMsg.includes('timeout') || errMsg.includes('Timeout')) {
          errorType = 'timeout';
          displayMsg = '响应超时，请重试';
        }
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== assistantMsgId);
          return [...filtered, {
            id: nextId(),
            role: "system" as const,
            content: displayMsg,
            errorType,
            retryPayload: { text: finalText, attachments: allAttachments.length > 0 ? allAttachments : undefined },
          }];
        });
      }
    } finally {
      setLoading(false);
      isStreamingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [inputValue, loading, currentUserId, saveMessageToDB, pendingScreenshot, attachments, graphRef]);

  const handleSend = useCallback(async () => {
    handleSendWithText(inputValue.trim());
  }, [inputValue, handleSendWithText]);

  const handleRetry = useCallback(
    (messageId: string) => {
      const msg = messages.find(m => m.id === messageId);
      if (!msg?.retryPayload) return;
      const truncated = messages.filter(m => m.id !== messageId);
      setMessages(truncated);
      setTimeout(() => handleSendWithText(msg.retryPayload!.text, msg.retryPayload!.attachments), 0);
    },
    [messages, handleSendWithText]
  );

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
      onTouchStart={stopTouchPropagation}
      onTouchMove={stopTouchPropagation}
      onTouchEnd={stopTouchPropagation}
      onPointerDown={stopPointerPropagation}
      onPointerMove={stopPointerPropagation}
      onPointerUp={stopPointerPropagation}
      style={{
        position: "fixed",
        bottom: keyboardHeight > 0 ? keyboardHeight + 8 : 20,
        left: "50%",
        transform: `translateX(-50%) ${visible ? "translateY(0)" : "translateY(20px)"}`,
        zIndex: 90,
        width: "min(420px, calc(100vw - 32px))",
        height: keyboardHeight > 0 ? Math.min(viewportHeight - 16, 400) : Math.min(viewportHeight * 0.4, 400),
        minHeight: keyboardHeight > 0 ? 200 : Math.min(280, viewportHeight - 60),
        maxHeight: Math.max(viewportHeight - 40, 200),
        background: "rgba(20, 19, 18, 0.92)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.1)",
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
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          flexShrink: 0,
          background: "rgba(255,255,255,0.03)",
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
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.7)",
            cursor: "pointer",
            transition: "color 150ms, background 150ms",
          }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "12px 0",
            touchAction: "pan-y",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
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
              onRetry={handleRetry}
            />
          ))}
          {loading && (
            <div className="flex justify-start px-4 mb-4">
              <ThinkingAnimation size={28} />
            </div>
          )}
        </div>
        {showScrollBtn && (
          <button
            onClick={() => scrollToBottom(true)}
            data-testid="btn-scroll-bottom"
            style={{
              position: 'absolute',
              bottom: 8,
              right: 12,
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(20,19,18,0.9)',
              backdropFilter: 'blur(8px)',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 150ms',
              zIndex: 2,
            }}
          >
            <ArrowDown size={14} />
          </button>
        )}
      </div>

      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid rgba(255,255,255,0.12)",
          padding: "10px 12px",
          outline: isDragOver ? '2px dashed rgba(139,92,246,0.5)' : 'none',
          outlineOffset: -2,
          transition: 'outline 150ms',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="graph-chat-input-area"
      >
        {attachments.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {attachments.map((att, i) => (
              <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                {att.previewUrl ? (
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)' }}
                  />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 6, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                    {att.name.split('.').pop()?.toUpperCase()}
                  </div>
                )}
                <button
                  onClick={() => {
                    if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
                    setAttachments(prev => prev.filter((_, j) => j !== i));
                  }}
                  style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, fontSize: 10 }}
                  data-testid={`remove-attachment-${i}`}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
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
            onPaste={handlePaste}
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
          {loading ? (
            <button
              onClick={() => abortControllerRef.current?.abort()}
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 10,
                border: "none",
                background: "rgba(239,68,68,0.2)",
                color: "#f87171",
                cursor: "pointer",
                transition: "all 150ms",
                flexShrink: 0,
              }}
              data-testid="graph-chat-stop"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() && !pendingScreenshot && attachments.length === 0}
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 10,
                border: "none",
                background:
                  inputValue.trim() || pendingScreenshot || attachments.length > 0
                    ? "rgba(139,92,246,0.6)"
                    : "rgba(255,255,255,0.05)",
                color:
                  inputValue.trim() || pendingScreenshot || attachments.length > 0
                    ? "#fff"
                    : "rgba(255,255,255,0.25)",
                cursor:
                  inputValue.trim() || pendingScreenshot || attachments.length > 0 ? "pointer" : "not-allowed",
                transition: "all 150ms",
                flexShrink: 0,
              }}
              data-testid="graph-chat-send"
            >
              <Send size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
