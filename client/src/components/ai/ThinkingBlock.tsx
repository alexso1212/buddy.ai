import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
  duration?: number;
}

export default function ThinkingBlock({ content, isStreaming, duration }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [wasStreaming, setWasStreaming] = useState(isStreaming);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (wasStreaming && !isStreaming) {
      setExpanded(false);
    }
    setWasStreaming(isStreaming);
  }, [isStreaming]);

  useEffect(() => {
    if (isStreaming) {
      setExpanded(true);
    }
  }, [isStreaming]);

  useEffect(() => {
    if (expanded && isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, expanded, isStreaming]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const label = isStreaming ? "思考中..." : "思考过程";

  return (
    <div
      className="mb-3"
      style={{ animation: 'messageAppear 200ms ease-out' }}
      data-testid="thinking-block"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs transition-colors group"
        style={{
          color: 'var(--text-secondary)',
          background: 'none',
          border: 'none',
          padding: '4px 0',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}
        data-testid="thinking-block-toggle"
      >
        <Brain
          size={14}
          className={cn(
            "transition-colors",
            isStreaming ? "text-brand animate-pulse" : "text-[var(--text-secondary)]"
          )}
        />
        <span style={{ fontWeight: 500 }}>{label}</span>
        {duration && !isStreaming && (
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
            {formatDuration(duration)}
          </span>
        )}
        {expanded ? (
          <ChevronDown size={12} className="text-[var(--text-tertiary)]" />
        ) : (
          <ChevronRight size={12} className="text-[var(--text-tertiary)]" />
        )}
      </button>
      {expanded && (
        <div
          ref={contentRef}
          className="overflow-hidden"
          style={{
            maxHeight: 200,
            overflowY: 'auto',
            marginTop: 4,
            padding: '8px 12px',
            borderLeft: '2px solid var(--border-subtle)',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '0 8px 8px 0',
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-sans)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
          data-testid="thinking-block-content"
        >
          {content || (isStreaming ? '...' : '')}
        </div>
      )}
    </div>
  );
}
