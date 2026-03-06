import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Maximize2, Minimize2, Copy, Check, Download, ChevronDown, Paperclip, Loader2, Search } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AIMessageContent from "./AIMessageContent";

interface ArtifactPanelProps {
  content: string;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
  messageId?: string;
}

export default function ArtifactPanel({ content, title, isOpen, onClose, messageId }: ArtifactPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showDeliverableDialog, setShowDeliverableDialog] = useState(false);
  const [deliverableTitle, setDeliverableTitle] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [taskSearch, setTaskSearch] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setIsFullscreen(false);
      setCopied(false);
      setShowScrollBtn(false);
      setShowDeliverableDialog(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || !isOpen) return;
    const checkScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      setShowScrollBtn(!nearBottom && el.scrollHeight > el.clientHeight + 100);
    };
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const observer = new MutationObserver(checkScroll);
    observer.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", checkScroll);
      observer.disconnect();
    };
  }, [isOpen, content]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showDeliverableDialog) {
          setShowDeliverableDialog(false);
        } else if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isFullscreen, showDeliverableDialog, onClose]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (title || "artifact").replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, "_") + ".md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [content, title]);

  const scrollToBottom = useCallback(() => {
    contentRef.current?.scrollTo({ top: contentRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  const { data: tasksRes, isLoading: tasksLoading } = useQuery<{ data: any[] }>({
    queryKey: ['/api/tasks'],
    enabled: showDeliverableDialog,
  });

  const activeTasks = (tasksRes?.data || []).filter(
    (t: any) => t.status !== 'done' && t.status !== 'cancelled'
  );

  const filteredTasks = taskSearch.trim()
    ? activeTasks.filter((t: any) =>
        t.title.toLowerCase().includes(taskSearch.toLowerCase())
      )
    : activeTasks;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTaskId || !messageId) throw new Error("Missing task or message");
      const dbMsgId = messageId.startsWith("db-") ? parseInt(messageId.slice(3)) : parseInt(messageId);
      if (isNaN(dbMsgId)) throw new Error("Invalid message ID");
      const res = await apiRequest("POST", `/api/tasks/${selectedTaskId}/deliverables/from-chat`, {
        messageId: dbMsgId,
        title: deliverableTitle || title || content.slice(0, 30).replace(/\n/g, ' '),
        format: "markdown",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "提交成功", description: "AI 内容已添加为任务交付物" });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', selectedTaskId, 'deliverables'] });
      setShowDeliverableDialog(false);
      setSelectedTaskId(null);
      setDeliverableTitle("");
      setTaskSearch("");
    },
    onError: (err: any) => {
      toast({ title: "提交失败", description: err.message, variant: "destructive" });
    },
  });

  const handleOpenDeliverable = () => {
    setDeliverableTitle(title || extractArtifactTitle(content));
    setShowDeliverableDialog(true);
  };

  if (!isOpen) return null;

  const glassBtn: React.CSSProperties = {
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: "1px solid rgba(255,255,255,0.15)",
    cursor: "pointer",
    transition: "all 180ms ease",
  };

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 10000,
          transition: "opacity 200ms ease",
        }}
        data-testid="artifact-panel-backdrop"
      />
      <div
        style={{
          position: "fixed",
          top: isFullscreen ? 0 : 56,
          right: isFullscreen ? 0 : 12,
          bottom: isFullscreen ? 0 : 12,
          width: isFullscreen ? "100%" : "min(680px, calc(100vw - 24px))",
          background: "var(--bg-primary, #0a0a0a)",
          border: isFullscreen ? "none" : "1px solid rgba(255,255,255,0.1)",
          borderRadius: isFullscreen ? 0 : 12,
          zIndex: 10001,
          display: "flex",
          flexDirection: "column",
          transition: "all 200ms ease",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
        data-testid="artifact-panel"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
            data-testid="artifact-panel-title"
          >
            {title || "Document"}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-[rgba(255,255,255,0.7)] hover:text-white"
              style={glassBtn}
              title={copied ? "Copied" : "Copy"}
              data-testid="artifact-btn-copy"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-[rgba(255,255,255,0.7)] hover:text-white"
              style={glassBtn}
              title="Download as .md"
              data-testid="artifact-btn-download"
            >
              <Download className="w-4 h-4" />
            </button>
            {messageId && String(messageId).startsWith("db-") && (
              <button
                onClick={handleOpenDeliverable}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-[rgba(255,255,255,0.7)] hover:text-white"
                style={glassBtn}
                title="提交为交付物"
                data-testid="artifact-btn-deliverable"
              >
                <Paperclip className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-[rgba(255,255,255,0.7)] hover:text-white"
              style={glassBtn}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              data-testid="artifact-btn-fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-[rgba(255,255,255,0.7)] hover:text-white"
              style={glassBtn}
              title="Close"
              data-testid="artifact-btn-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={contentRef}
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "20px 24px",
            position: "relative",
          }}
          data-testid="artifact-panel-content"
        >
          <AIMessageContent content={content} />
        </div>

        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            style={{
              position: "absolute",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...glassBtn,
              background: "rgba(255,255,255,0.12)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
              zIndex: 2,
              color: "rgba(255,255,255,0.85)",
            }}
            data-testid="artifact-btn-scroll-bottom"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}

        {showDeliverableDialog && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              borderRadius: 12,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowDeliverableDialog(false); }}
            data-testid="deliverable-dialog-backdrop"
          >
            <div
              style={{
                background: "var(--bg-primary, #1a1a1a)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 12,
                padding: 20,
                width: "min(400px, 90%)",
                maxHeight: "80%",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
              data-testid="deliverable-dialog"
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                提交为任务交付物
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>标题</label>
                <input
                  type="text"
                  value={deliverableTitle}
                  onChange={(e) => setDeliverableTitle(e.target.value)}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    color: "var(--text-primary)",
                    fontSize: 14,
                    outline: "none",
                  }}
                  data-testid="deliverable-title-input"
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>选择目标任务</label>
                <div style={{ position: "relative" }}>
                  <Search className="w-3.5 h-3.5" style={{ position: "absolute", left: 10, top: 10, color: "rgba(255,255,255,0.4)" }} />
                  <input
                    type="text"
                    placeholder="搜索任务..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 8,
                      padding: "8px 12px 8px 32px",
                      color: "var(--text-primary)",
                      fontSize: 13,
                      outline: "none",
                    }}
                    data-testid="deliverable-task-search"
                  />
                </div>
                <div
                  style={{
                    maxHeight: 200,
                    overflowY: "auto",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    marginTop: 4,
                  }}
                >
                  {tasksLoading && (
                    <div style={{ padding: "12px", fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      加载任务中...
                    </div>
                  )}
                  {!tasksLoading && filteredTasks.length === 0 && (
                    <div style={{ padding: "12px", fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
                      {taskSearch ? "没有匹配的任务" : "暂无可用任务"}
                    </div>
                  )}
                  {filteredTasks.map((t: any) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        background: selectedTaskId === t.id ? "rgba(180,136,107,0.2)" : "transparent",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        transition: "background 120ms",
                        fontSize: 13,
                        color: "var(--text-primary)",
                      }}
                      data-testid={`deliverable-task-option-${t.id}`}
                    >
                      <div style={{ fontWeight: selectedTaskId === t.id ? 600 : 400 }}>{t.title}</div>
                      {t.projectName && (
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{t.projectName}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => setShowDeliverableDialog(false)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "transparent",
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                  data-testid="deliverable-cancel-btn"
                >
                  取消
                </button>
                <button
                  onClick={() => submitMutation.mutate()}
                  disabled={!selectedTaskId || submitMutation.isPending}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: selectedTaskId ? "#B4886B" : "rgba(255,255,255,0.1)",
                    color: selectedTaskId ? "#fff" : "rgba(255,255,255,0.3)",
                    fontSize: 13,
                    cursor: selectedTaskId ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  data-testid="deliverable-submit-btn"
                >
                  {submitMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  提交
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

export function isLongContent(content: string): boolean {
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks = content.match(codeBlockRegex) || [];
  for (const block of codeBlocks) {
    const lines = block.split("\n");
    if (lines.length > 32) return true;
  }
  if (content.length > 2000) return true;
  return false;
}

export function extractArtifactTitle(content: string): string {
  const headingMatch = content.match(/^#+\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  const codeBlockMatch = content.match(/```(\w+)/);
  if (codeBlockMatch) return `Code (${codeBlockMatch[1]})`;
  return "Document";
}
