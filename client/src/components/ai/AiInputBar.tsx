import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowUp, Plus, Square, X, Globe, Palette, FileText, Image, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiInputBarProps {
  onSend: (message: string) => void;
  loading: boolean;
  onStop?: () => void;
  webSearchEnabled?: boolean;
  onWebSearchToggle?: (enabled: boolean) => void;
  replyStyle?: string;
  onReplyStyleChange?: (style: string) => void;
}

const REPLY_STYLES = [
  { value: 'normal', label: '正常', description: '平衡详细与简洁' },
  { value: 'concise', label: '简洁', description: '简短直接的回答' },
  { value: 'detailed', label: '详细', description: '深入全面的解释' },
  { value: 'professional', label: '专业', description: '正式的商务语气' },
  { value: 'casual', label: '随意', description: '轻松友好的对话' },
];

function AddToChatSheet({
  open,
  onClose,
  webSearchEnabled,
  onWebSearchToggle,
  replyStyle,
  onReplyStyleChange,
}: {
  open: boolean;
  onClose: () => void;
  webSearchEnabled: boolean;
  onWebSearchToggle: (enabled: boolean) => void;
  replyStyle: string;
  onReplyStyleChange: (style: string) => void;
}) {
  const [showStylePicker, setShowStylePicker] = useState(false);

  useEffect(() => {
    if (!open) setShowStylePicker(false);
  }, [open]);

  if (!open) return null;

  const currentStyleLabel = REPLY_STYLES.find(s => s.value === replyStyle)?.label || '正常';

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
        data-testid="add-to-chat-backdrop"
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          animation: 'slideUpSheet 250ms ease-out',
          maxHeight: '70vh',
        }}
        data-testid="add-to-chat-sheet"
      >
        <div
          style={{
            background: '#2A2A28',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          }}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              data-testid="btn-close-sheet"
            >
              <X className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
            <span className="text-sm font-medium text-[var(--text-primary)]">添加到对话</span>
            <div className="w-8" />
          </div>

          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

          {showStylePicker ? (
            <div className="px-5 pb-2">
              <button
                onClick={() => setShowStylePicker(false)}
                className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-3 hover:text-[var(--text-primary)] transition-colors"
                data-testid="btn-style-back"
              >
                ← 返回
              </button>
              <div className="space-y-1">
                {REPLY_STYLES.map(style => (
                  <button
                    key={style.value}
                    onClick={() => {
                      onReplyStyleChange(style.value);
                      setShowStylePicker(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors",
                      replyStyle === style.value
                        ? "bg-[var(--brand)]/15 text-[var(--brand)]"
                        : "hover:bg-white/5 text-[var(--text-primary)]"
                    )}
                    data-testid={`style-option-${style.value}`}
                  >
                    <div className="text-left">
                      <div className="text-sm font-medium">{style.label}</div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">{style.description}</div>
                    </div>
                    {replyStyle === style.value && (
                      <div className="w-5 h-5 rounded-full bg-[var(--brand)] flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 px-5 mb-5">
                {[
                  { icon: Camera, label: '相机', testId: 'btn-camera', disabled: true },
                  { icon: Image, label: '图片', testId: 'btn-photos', disabled: true },
                  { icon: FileText, label: '文件', testId: 'btn-files', disabled: true },
                ].map(item => (
                  <button
                    key={item.testId}
                    disabled={item.disabled}
                    className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl transition-colors"
                    style={{
                      background: '#3A3A38',
                      opacity: item.disabled ? 0.4 : 1,
                      cursor: item.disabled ? 'not-allowed' : 'pointer',
                    }}
                    data-testid={item.testId}
                  >
                    <item.icon className="w-6 h-6 text-[var(--text-primary)]" strokeWidth={1.5} />
                    <span className="text-xs text-[var(--text-secondary)]">{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="px-5 space-y-1">
                <div
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => onWebSearchToggle(!webSearchEnabled)}
                  data-testid="toggle-web-search"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
                    <span className="text-sm text-[var(--text-primary)]">网页搜索</span>
                  </div>
                  <div
                    className="relative w-11 h-6 rounded-full transition-colors duration-200"
                    style={{
                      background: webSearchEnabled ? 'var(--brand)' : 'rgba(255,255,255,0.15)',
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                      style={{
                        transform: webSearchEnabled ? 'translateX(22px)' : 'translateX(2px)',
                      }}
                    />
                  </div>
                </div>

                <div
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => setShowStylePicker(true)}
                  data-testid="btn-choose-style"
                >
                  <div className="flex items-center gap-3">
                    <Palette className="w-5 h-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
                    <span className="text-sm text-[var(--text-primary)]">回复风格</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-[var(--text-secondary)]">{currentStyleLabel}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)]"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </div>
              </div>

              {(true) && (
                <div className="px-5 mt-3">
                  <p className="text-xs text-[var(--text-secondary)] text-center" style={{ opacity: 0.5 }}>
                    相机、图片和文件上传即将上线
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function AiInputBar({ onSend, loading, onStop, webSearchEnabled = false, onWebSearchToggle, replyStyle = 'normal', onReplyStyleChange }: AiInputBarProps) {
  const [value, setValue] = useState("");
  const [showSheet, setShowSheet] = useState(false);
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
    <>
      <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div
          style={{
            borderRadius: 20,
            position: 'relative' as const,
            padding: 1,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.12) 40%, rgba(255,255,255,0.06) 100%)',
          }}
          data-testid="ai-composer"
        >
          <div style={{
            background: '#262624',
            borderRadius: 19,
            overflow: 'hidden',
          }}>
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSheet(true)}
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
                  transition: 'background 150ms',
                }}
                className="hover:bg-white/5"
                data-testid="ai-attach"
              >
                <Plus className="w-4 h-4" />
              </button>

              {webSearchEnabled && (
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                  style={{ background: 'rgba(174,86,48,0.15)', color: 'var(--brand)' }}
                  data-testid="web-search-badge"
                >
                  <Globe className="w-3 h-3" />
                  搜索
                </div>
              )}
            </div>

            {loading ? (
              <button
                onClick={onStop}
                style={{
                  width: 30,
                  height: 30,
                  background: '#ECECEC',
                  borderRadius: 8,
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'opacity 150ms, transform 100ms',
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                data-testid="ai-stop"
              >
                <Square className="w-3 h-3 text-[#262624]" strokeWidth={3} fill="#262624" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={isEmpty}
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
            )}
          </div>
          </div>
        </div>
      </div>

      <AddToChatSheet
        open={showSheet}
        onClose={() => setShowSheet(false)}
        webSearchEnabled={webSearchEnabled}
        onWebSearchToggle={(enabled) => {
          onWebSearchToggle?.(enabled);
        }}
        replyStyle={replyStyle}
        onReplyStyleChange={(style) => {
          onReplyStyleChange?.(style);
        }}
      />
    </>
  );
}
