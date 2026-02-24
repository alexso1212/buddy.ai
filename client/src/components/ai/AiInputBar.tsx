import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowUp, Plus, Square, X, Globe, Palette, FileText, Image, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Attachment {
  type: 'image' | 'file';
  name: string;
  mimeType: string;
  base64: string;
  previewUrl?: string;
}

interface AiInputBarProps {
  onSend: (message: string, attachments?: Attachment[]) => void;
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
  onAttach,
}: {
  open: boolean;
  onClose: () => void;
  webSearchEnabled: boolean;
  onWebSearchToggle: (enabled: boolean) => void;
  replyStyle: string;
  onReplyStyleChange: (style: string) => void;
  onAttach: (attachments: Attachment[]) => void;
}) {
  const [showStylePicker, setShowStylePicker] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) setShowStylePicker(false);
  }, [open]);

  if (!open) return null;

  const currentStyleLabel = REPLY_STYLES.find(s => s.value === replyStyle)?.label || '正常';

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const totalFiles = fileArray.length;
    const newAttachments: Attachment[] = [];
    let processed = 0;
    fileArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const isImage = file.type.startsWith('image/');
        const attachment: Attachment = {
          type: isImage ? 'image' : 'file',
          name: file.name,
          mimeType: file.type,
          base64,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        };
        newAttachments.push(attachment);
        processed++;
        if (processed === totalFiles) {
          onAttach(newAttachments);
        }
      };
      reader.readAsDataURL(file);
    });
  };

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

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
            data-testid="input-camera"
          />
          <input
            ref={photosRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
            data-testid="input-photos"
          />
          <input
            ref={filesRef}
            type="file"
            accept=".pdf,.txt,.csv,.json,.md,.doc,.docx,.xls,.xlsx"
            style={{ display: 'none' }}
            onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
            data-testid="input-files"
          />

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
                  { icon: Camera, label: '相机', testId: 'btn-camera', ref: cameraRef },
                  { icon: Image, label: '图片', testId: 'btn-photos', ref: photosRef },
                  { icon: FileText, label: '文件', testId: 'btn-files', ref: filesRef },
                ].map(item => (
                  <button
                    key={item.testId}
                    onClick={() => item.ref.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl transition-colors"
                    style={{
                      background: '#3A3A38',
                      cursor: 'pointer',
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
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
    if (!trimmed && attachments.length === 0) return;
    if (loading) return;
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setValue("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, loading, onSend, attachments]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const isEmpty = !value.trim() && attachments.length === 0;

  return (
    <>
      <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div
          style={{
            borderRadius: 20,
            position: 'relative' as const,
            padding: 1,
            background: isPressed
              ? 'linear-gradient(to bottom, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 40%, rgba(255,255,255,0.15) 100%)'
              : 'linear-gradient(to bottom, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.12) 40%, rgba(255,255,255,0.06) 100%)',
            boxShadow: isPressed
              ? '0 0 24px rgba(255,255,255,0.2), 0 0 48px rgba(255,255,255,0.1), inset 0 0 12px rgba(255,255,255,0.06)'
              : 'none',
            transition: 'background 0.15s ease, box-shadow 0.15s ease',
          }}
          onPointerDown={() => {
            setIsPressed(true);
            if (navigator.vibrate) navigator.vibrate(10);
          }}
          onPointerUp={() => setIsPressed(false)}
          onPointerLeave={() => setIsPressed(false)}
          onPointerCancel={() => setIsPressed(false)}
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
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
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

          {attachments.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: '4px 16px 8px 16px',
                overflowX: 'auto',
              }}
              data-testid="attachment-previews"
            >
              {attachments.map((att, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    flexShrink: 0,
                  }}
                  data-testid={`attachment-preview-${i}`}
                >
                  {att.type === 'image' ? (
                    <img
                      src={att.previewUrl || `data:${att.mimeType};base64,${att.base64}`}
                      alt={att.name}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                      }}
                    >
                      <FileText className="w-4 h-4 text-[var(--text-secondary)]" />
                      <span style={{ fontSize: 8, color: 'var(--text-secondary)', maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        {att.name.split('.').pop()}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      background: '#444',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    data-testid={`remove-attachment-${i}`}
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

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
        onAttach={(newAttachments) => {
          setAttachments(prev => [...prev, ...newAttachments]);
          setShowSheet(false);
        }}
      />
    </>
  );
}
