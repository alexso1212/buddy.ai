import { useState, useRef, useCallback } from "react";
import { ArrowUp, Plus } from "lucide-react";
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
    const maxHeight = 120;
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

  const isEmpty = !value.trim();

  return (
    <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(60,59,55,0.65) 0%, rgba(50,49,45,0.55) 40%, rgba(55,54,50,0.60) 60%, rgba(45,44,40,0.50) 100%)',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.20), inset 0 0.5px 0 rgba(255,255,255,0.08)',
          overflow: 'hidden',
          backdropFilter: 'blur(24px) saturate(1.3) brightness(1.02)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.3) brightness(1.02)',
        }}
        data-testid="ai-composer"
      >
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
          style={{
            width: '100%',
            minHeight: 36,
            maxHeight: 120,
            padding: '14px 16px 8px 16px',
            fontSize: 16,
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.5,
            color: 'var(--text-primary)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            display: 'block',
          }}
          className={cn(
            "placeholder:text-[var(--text-placeholder)]",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          data-testid="ai-input"
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 10px 10px 10px',
          }}
          data-testid="ai-toolbar"
        >
          <button
            style={{
              width: 30,
              height: 30,
              background: 'transparent',
              border: '1px solid var(--border-medium)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
            data-testid="ai-attach"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            onClick={handleSend}
            disabled={isEmpty || loading}
            style={{
              width: 30,
              height: 30,
              background: 'var(--brand)',
              borderRadius: 8,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isEmpty ? 'default' : 'pointer',
              opacity: isEmpty ? 0.35 : 1,
              transition: 'opacity 150ms, transform 100ms',
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            data-testid="ai-send"
          >
            <ArrowUp className="w-4 h-4 text-white" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
