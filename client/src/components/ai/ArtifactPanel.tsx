import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Maximize2, Minimize2, Copy, Check, Download, ChevronDown } from "lucide-react";
import AIMessageContent from "./AIMessageContent";

interface ArtifactPanelProps {
  content: string;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ArtifactPanel({ content, title, isOpen, onClose }: ArtifactPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsFullscreen(false);
      setCopied(false);
      setShowScrollBtn(false);
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
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isFullscreen, onClose]);

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
