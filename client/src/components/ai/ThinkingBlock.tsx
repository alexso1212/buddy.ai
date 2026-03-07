import { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
  duration?: number;
}

function generateSummary(text: string): string {
  if (!text || text.trim().length === 0) return "Thinking...";
  const cleaned = text
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n+/g, " ")
    .trim();
  const firstSentence = cleaned.split(/[.!?。！？]\s/)[0];
  const summary = firstSentence.length > 80
    ? firstSentence.slice(0, 77) + "..."
    : firstSentence;
  return summary || "Analyzed the request";
}

function TimerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="9" r="5.5" stroke="var(--text-secondary)" strokeWidth="1.2" />
      <line x1="8" y1="9" x2="8" y2="6" stroke="var(--text-secondary)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="8" y1="9" x2="10" y2="9" stroke="var(--text-secondary)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="6.5" y1="2" x2="9.5" y2="2" stroke="var(--text-secondary)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        flexShrink: 0,
        transition: "transform 200ms ease",
        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
      }}
    >
      <path d="M4.5 2.5L8 6L4.5 9.5" stroke="var(--text-secondary)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ThinkingBlock({ content, isStreaming, duration }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);
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
    if (!isStreaming) {
      setExpanded(false);
    }
  }, [isStreaming]);

  useEffect(() => {
    if (expanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, expanded]);

  const isComplete = !isStreaming;
  const hasContent = content && content.trim().length > 0;

  const getFinishedDurationSeconds = (): number => {
    if (duration) return Math.round(duration / 1000);
    return finalElapsedRef.current || elapsedSeconds;
  };

  const summary = useMemo(() => {
    if (isStreaming) {
      return elapsedSeconds > 0 ? `Thinking for ${elapsedSeconds}s...` : "Thinking...";
    }
    const dur = getFinishedDurationSeconds();
    const contentSummary = generateSummary(content);
    return dur > 0 ? `Thought for ${dur}s — ${contentSummary}` : contentSummary;
  }, [isStreaming, elapsedSeconds, content, duration]);

  const handleBarClick = () => {
    if (isComplete && hasContent) {
      setExpanded(!expanded);
    }
  };

  return (
    <div
      style={{ margin: "4px 0" }}
      data-testid="thinking-block"
    >
      <div
        className={cn(
          "thinking-collapse-bar",
          isStreaming && "active",
          isComplete && hasContent && "clickable"
        )}
        onClick={handleBarClick}
        data-testid="thinking-block-toggle"
      >
        <TimerIcon />

        <span
          style={{
            flex: 1,
            color: "var(--text-secondary)",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "var(--font-sans)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          data-testid="thinking-block-label"
        >
          {summary}
        </span>

        {isComplete && hasContent && (
          <ChevronIcon expanded={expanded} />
        )}
      </div>

      <div
        style={{
          overflow: "hidden",
          transition: "max-height 300ms ease, opacity 200ms ease",
          maxHeight: expanded ? 300 : 0,
          opacity: expanded ? 1 : 0,
        }}
      >
        {hasContent && (
          <div
            ref={contentRef}
            className="thinking-expand-content"
            data-testid="thinking-block-content"
          >
            {content}
          </div>
        )}
      </div>
    </div>
  );
}
