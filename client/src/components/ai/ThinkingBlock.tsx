import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
  duration?: number;
}

export default function ThinkingBlock({ content, isStreaming, duration }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [wasStreaming, setWasStreaming] = useState(isStreaming);
  const [copied, setCopied] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const timerStartRef = useRef<number>(Date.now());
  const finalElapsedRef = useRef<number>(0);

  useEffect(() => {
    if (isStreaming) {
      timerStartRef.current = Date.now();
      setElapsedSeconds(0);

      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - timerStartRef.current) / 1000);
        setElapsedSeconds(elapsed);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      finalElapsedRef.current = elapsedSeconds;
    }
  }, [isStreaming]);

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

  const getFinishedDurationSeconds = (): number => {
    if (duration) {
      return Math.round(duration / 1000);
    }
    return finalElapsedRef.current || elapsedSeconds;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div
      className="mb-3"
      style={{ animation: 'messageAppear 200ms ease-out' }}
      data-testid="thinking-block"
    >
      {isStreaming && <div className="thinking-bar mb-2" />}

      <div className="flex items-center gap-1">
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
          {expanded ? (
            <ChevronDown size={12} className="text-[var(--text-tertiary)]" />
          ) : (
            <ChevronRight size={12} className="text-[var(--text-tertiary)]" />
          )}
          <span style={{ fontWeight: 500 }} data-testid="thinking-block-label">
            {isStreaming
              ? (elapsedSeconds > 0 ? `思考中...` : "思考中...")
              : `思考了 ${getFinishedDurationSeconds()} 秒`}
          </span>
          {isStreaming && elapsedSeconds > 0 && (
            <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
              {elapsedSeconds}s
            </span>
          )}
          {content && !isStreaming && (
            <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
              {content.length >= 1000 ? `${(content.length / 1000).toFixed(1)}k chars` : `${content.length} chars`}
            </span>
          )}
        </button>
        {expanded && !isStreaming && content && (
          <button
            onClick={handleCopy}
            className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
            title={copied ? "Copied" : "Copy thinking content"}
            data-testid="thinking-block-copy"
          >
            {copied ? <Check size={12} strokeWidth={1.5} /> : <Copy size={12} strokeWidth={1.5} />}
          </button>
        )}
      </div>
      <div
        style={{
          overflow: 'hidden',
          transition: 'max-height 300ms ease, opacity 200ms ease',
          maxHeight: expanded ? 300 : 0,
          opacity: expanded ? 1 : 0,
        }}
      >
        <div
          ref={contentRef}
          style={{
            maxHeight: 300,
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
          }}
          data-testid="thinking-block-content"
        >
          {content ? (
            <div className="thinking-markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                p: ({ children }) => <p style={{ marginBottom: 8, marginTop: 0 }}>{children}</p>,
                strong: ({ children }) => <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{children}</strong>,
                em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                ul: ({ children }) => <ul style={{ paddingLeft: 16, marginBottom: 8, marginTop: 0 }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ paddingLeft: 16, marginBottom: 8, marginTop: 0 }}>{children}</ol>,
                li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                code: ({ children }) => (
                  <code style={{
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 3,
                    padding: '1px 4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                  }}>{children}</code>
                ),
                h1: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 6px', color: 'var(--text-primary)' }}>{children}</h3>,
                h2: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 6px', color: 'var(--text-primary)' }}>{children}</h3>,
                h3: ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 600, margin: '10px 0 4px', color: 'var(--text-primary)' }}>{children}</h3>,
                blockquote: ({ children }) => (
                  <blockquote style={{ borderLeft: '2px solid var(--border-medium)', paddingLeft: 8, margin: '8px 0', opacity: 0.85 }}>{children}</blockquote>
                ),
                pre: ({ children }) => <pre style={{ fontSize: 12, overflowX: 'auto', margin: '8px 0', padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 4 }}>{children}</pre>,
              }}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (isStreaming ? '...' : '')}
        </div>
      </div>
    </div>
  );
}
