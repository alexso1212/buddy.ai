import { useState, useCallback, useEffect, useRef } from "react";
import { X, Copy, Check, Download } from "lucide-react";
import AIMessageContent from "./AIMessageContent";

interface ArtifactSidePanelProps {
  content: string;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ArtifactSidePanel({ content, title, isOpen, onClose }: ArtifactSidePanelProps) {
  const [copied, setCopied] = useState(false);
  const [closing, setClosing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setClosing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 250);
  }, [onClose]);

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
    <div
      className={`artifact-side-panel${closing ? " closing" : ""}`}
      style={{
        width: "clamp(400px, 50vw, 700px)",
        flexShrink: 0,
      }}
      data-testid="artifact-side-panel"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 48,
          padding: "0 16px",
          borderBottom: "1px solid #3a3a3a",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}
          data-testid="artifact-side-panel-title"
        >
          {title || "Document"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={handleCopy}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: copied ? "var(--accent-green)" : "var(--text-secondary)",
              cursor: "pointer",
              transition: "color 150ms, background 150ms",
            }}
            title={copied ? "Copied" : "Copy"}
            data-testid="artifact-side-panel-btn-copy"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDownload}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "color 150ms, background 150ms",
            }}
            title="Download"
            data-testid="artifact-side-panel-btn-download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "color 150ms, background 150ms",
            }}
            title="Close"
            data-testid="artifact-side-panel-btn-close"
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
          padding: 16,
        }}
        data-testid="artifact-side-panel-content"
      >
        <AIMessageContent content={content} />
      </div>
    </div>
  );
}
