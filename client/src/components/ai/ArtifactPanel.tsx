import { useState, useCallback, useEffect } from "react";
import { X, Maximize2, Minimize2, Copy, Check, Download } from "lucide-react";
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

  useEffect(() => {
    if (!isOpen) {
      setIsFullscreen(false);
      setCopied(false);
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 9990,
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
          zIndex: 9991,
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
              className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              style={{ background: "none", border: "none", cursor: "pointer" }}
              title={copied ? "Copied" : "Copy"}
              data-testid="artifact-btn-copy"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              style={{ background: "none", border: "none", cursor: "pointer" }}
              title="Download as .md"
              data-testid="artifact-btn-download"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              style={{ background: "none", border: "none", cursor: "pointer" }}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              data-testid="artifact-btn-fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              style={{ background: "none", border: "none", cursor: "pointer" }}
              title="Close"
              data-testid="artifact-btn-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "20px 24px",
          }}
          data-testid="artifact-panel-content"
        >
          <AIMessageContent content={content} />
        </div>
      </div>
    </>
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
