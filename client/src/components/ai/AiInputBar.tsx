import { useState, useRef, useCallback } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiInputBarProps {
  onSend: (message: string) => void;
  loading: boolean;
}

export default function AiInputBar({ onSend, loading }: AiInputBarProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 24;
    const maxHeight = lineHeight * 4;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, loading, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="bg-transparent py-3">
      <div className="bg-[var(--bg-composer)] rounded-[20px] shadow-composer border border-[var(--border-subtle)] flex items-end gap-2 px-4 py-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          disabled={loading}
          rows={1}
          className={cn(
            "flex-1 resize-none bg-transparent border-0",
            "text-sm leading-6 outline-none text-[var(--text-primary)]",
            "placeholder:text-[var(--text-secondary)] focus:ring-0",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          data-testid="ai-input"
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || loading}
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            "bg-brand hover:bg-brand-hover text-white",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "transition-colors duration-150"
          )}
          data-testid="ai-send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
