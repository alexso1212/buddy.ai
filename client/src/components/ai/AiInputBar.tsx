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
    <div className="flex items-end gap-2 p-3 border-t border-gray-200 bg-white rounded-b-2xl">
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
          "flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2",
          "text-sm leading-6 outline-none",
          "focus:border-blue-400 focus:ring-1 focus:ring-blue-400",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "bg-gray-50"
        )}
        data-testid="ai-input"
      />
      <button
        onClick={handleSend}
        disabled={!value.trim() || loading}
        className={cn(
          "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center",
          "bg-gradient-to-br from-blue-500 to-indigo-600 text-white",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          "hover:scale-105 active:scale-95 transition-transform duration-150"
        )}
        data-testid="ai-send"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
