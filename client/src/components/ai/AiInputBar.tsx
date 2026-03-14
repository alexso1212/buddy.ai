import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowUp, Plus, Square, X, Globe, Palette, FileText, Image, Camera, Atom, FolderOpen, LayoutGrid, ChevronRight, Code, BookOpen } from "lucide-react";
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
  codeContextEnabled?: boolean;
  onCodeContextToggle?: (enabled: boolean) => void;
  knowledgeBaseEnabled?: boolean;
  onKnowledgeBaseToggle?: (enabled: boolean) => void;
  researchEnabled?: boolean;
  onResearchToggle?: (enabled: boolean) => void;
  replyStyle?: string;
  onReplyStyleChange?: (style: string) => void;
  lastUserMessage?: string;
  onEscape?: () => void;
}

const REPLY_STYLES = [
  { value: 'normal', label: '正常', description: '平衡详细与简洁' },
  { value: 'concise', label: '简洁', description: '简短直接的回答' },
  { value: 'detailed', label: '详细', description: '深入全面的解释' },
  { value: 'professional', label: '专业', description: '正式的商务语气' },
  { value: 'casual', label: '随意', description: '轻松友好的对话' },
];

function useSheetBounce(scrollRef: React.RefObject<HTMLDivElement | null>) {
  const lastY = useRef(0);
  const pulling = useRef(false);
  const pullDir = useRef<'top' | 'bottom' | null>(null);
  const accumulated = useRef(0);
  const edgeY = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const getContentEl = () => el.firstElementChild as HTMLElement | null;

    const onTouchStart = (e: TouchEvent) => {
      lastY.current = e.touches[0].clientY;
      const content = getContentEl();
      if (content) { content.style.transition = 'none'; content.style.transform = 'translateY(0)'; }
      pulling.current = false; pullDir.current = null; accumulated.current = 0; edgeY.current = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const content = getContentEl();
      if (!content) return;
      const touchY = e.touches[0].clientY;
      const moveDir = touchY - lastY.current;
      lastY.current = touchY;
      const atTop = el.scrollTop <= 0;
      const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;

      if (pulling.current) {
        const rawDelta = touchY - edgeY.current;
        if ((pullDir.current === 'top' && rawDelta <= 0) || (pullDir.current === 'bottom' && rawDelta >= 0)) {
          content.style.transform = 'translateY(0)';
          pulling.current = false; pullDir.current = null; accumulated.current = 0;
          return;
        }
        const dampened = rawDelta * 0.4;
        accumulated.current = dampened;
        content.style.transform = `translateY(${dampened}px)`;
        e.preventDefault();
        return;
      }
      if (atTop && moveDir > 0) {
        pulling.current = true; pullDir.current = 'top'; edgeY.current = touchY; accumulated.current = 0; e.preventDefault();
      } else if (atBottom && moveDir < 0) {
        pulling.current = true; pullDir.current = 'bottom'; edgeY.current = touchY; accumulated.current = 0; e.preventDefault();
      }
    };
    const onTouchEnd = () => {
      const content = getContentEl();
      if (!content) return;
      if (pulling.current && accumulated.current !== 0) {
        content.style.transition = 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)';
        content.style.transform = 'translateY(0)';
      }
      pulling.current = false; pullDir.current = null; accumulated.current = 0;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => { el.removeEventListener('touchstart', onTouchStart); el.removeEventListener('touchmove', onTouchMove); el.removeEventListener('touchend', onTouchEnd); };
  }, [scrollRef]);
}

function AddToChatSheet({
  open,
  onClose,
  webSearchEnabled,
  onWebSearchToggle,
  codeContextEnabled,
  onCodeContextToggle,
  knowledgeBaseEnabled,
  onKnowledgeBaseToggle,
  researchEnabled,
  onResearchToggle,
  replyStyle,
  onReplyStyleChange,
  onAttach,
}: {
  open: boolean;
  onClose: () => void;
  webSearchEnabled: boolean;
  onWebSearchToggle: (enabled: boolean) => void;
  codeContextEnabled: boolean;
  onCodeContextToggle: (enabled: boolean) => void;
  knowledgeBaseEnabled: boolean;
  onKnowledgeBaseToggle: (enabled: boolean) => void;
  researchEnabled: boolean;
  onResearchToggle: (enabled: boolean) => void;
  replyStyle: string;
  onReplyStyleChange: (style: string) => void;
  onAttach: (attachments: Attachment[]) => void;
}) {
  const [showStylePicker, setShowStylePicker] = useState(false);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  useSheetBounce(sheetScrollRef);
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
        }}
        data-testid="add-to-chat-sheet"
      >
        <div
          style={{
            background: '#1E1D1B',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '70vh',
          }}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ flexShrink: 0 }}>
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

          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" style={{ flexShrink: 0 }} />

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

          <div
            ref={sheetScrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              overscrollBehavior: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
          <div>

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
                      background: '#2A2928',
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
                  onClick={() => onResearchToggle(!researchEnabled)}
                  data-testid="toggle-research"
                >
                  <div className="flex items-center gap-3">
                    <Atom className="w-5 h-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
                    <span className="text-sm text-[var(--text-primary)]">深度研究</span>
                  </div>
                  <div
                    className="relative w-11 h-6 rounded-full transition-colors duration-200"
                    style={{
                      background: researchEnabled ? '#3B82F6' : 'rgba(255,255,255,0.15)',
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                      style={{
                        transform: researchEnabled ? 'translateX(22px)' : 'translateX(2px)',
                      }}
                    />
                  </div>
                </div>

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
                      background: webSearchEnabled ? '#3B82F6' : 'rgba(255,255,255,0.15)',
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
                  onClick={() => onCodeContextToggle(!codeContextEnabled)}
                  data-testid="toggle-code-context"
                >
                  <div className="flex items-center gap-3">
                    <Code className="w-5 h-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
                    <span className="text-sm text-[var(--text-primary)]">代码上下文</span>
                  </div>
                  <div
                    className="relative w-11 h-6 rounded-full transition-colors duration-200"
                    style={{
                      background: codeContextEnabled ? '#3B82F6' : 'rgba(255,255,255,0.15)',
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                      style={{
                        transform: codeContextEnabled ? 'translateX(22px)' : 'translateX(2px)',
                      }}
                    />
                  </div>
                </div>

                <div
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => onKnowledgeBaseToggle(!knowledgeBaseEnabled)}
                  data-testid="toggle-knowledge-base"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
                    <span className="text-sm text-[var(--text-primary)]">知识库</span>
                  </div>
                  <div
                    className="relative w-11 h-6 rounded-full transition-colors duration-200"
                    style={{
                      background: knowledgeBaseEnabled ? '#3B82F6' : 'rgba(255,255,255,0.15)',
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                      style={{
                        transform: knowledgeBaseEnabled ? 'translateX(22px)' : 'translateX(2px)',
                      }}
                    />
                  </div>
                </div>

                <div
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  data-testid="btn-add-to-project"
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className="w-5 h-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
                    <span className="text-sm text-[var(--text-primary)]">添加到项目</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-[var(--text-secondary)] max-w-[120px] truncate">未选择</span>
                    <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" strokeWidth={2} />
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
                    <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" strokeWidth={2} />
                  </div>
                </div>

                <div
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  data-testid="btn-manage-connectors"
                >
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="w-5 h-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
                    <span className="text-sm text-[var(--text-primary)]">管理连接器</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" strokeWidth={2} />
                </div>
              </div>
            </>
          )}

          </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AiInputBar({ onSend, loading, onStop, webSearchEnabled = false, onWebSearchToggle, codeContextEnabled = false, onCodeContextToggle, knowledgeBaseEnabled = false, onKnowledgeBaseToggle, researchEnabled = false, onResearchToggle, replyStyle = 'normal', onReplyStyleChange, lastUserMessage, onEscape }: AiInputBarProps) {
  const [value, setValue] = useState("");
  const [showSheet, setShowSheet] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [glowPos, setGlowPos] = useState({ x: 0.5, y: 0.5 });
  const [showGlow, setShowGlow] = useState(false);
  const glowFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);
  const deformState = useRef({ pressed: false, moveHandler: null as ((e: PointerEvent) => void) | null });

  const computeDeform = useCallback((clientX: number, clientY: number) => {
    const el = composerWrapRef.current;
    if (!el) return { transform: '' };
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rawDx = clientX - cx;
    const rawDy = clientY - cy;
    const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    const maxDist = Math.max(rect.width, rect.height) * 0.8;
    const norm = Math.min(dist / Math.max(maxDist, 1), 1.2);
    const angle = Math.atan2(rawDy, rawDx);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const stretch = 0.025;
    const stretchAlong = norm * stretch;
    const compressPerp = norm * stretch * 0.55;
    const scaleX = 1.0 + stretchAlong * Math.abs(cosA) - compressPerp * Math.abs(sinA);
    const scaleY = 1.0 + stretchAlong * Math.abs(sinA) - compressPerp * Math.abs(cosA);
    const tx = cosA * norm * 1.5;
    const ty = sinA * norm * 1.5;
    return {
      transform: `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scaleX(${scaleX.toFixed(4)}) scaleY(${scaleY.toFixed(4)})`,
    };
  }, []);

  const [spotPos, setSpotPos] = useState<{ x: number; y: number } | null>(null);
  const [spotVisible, setSpotVisible] = useState(false);
  const spotFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateGlowPos = useCallback((clientX: number, clientY: number) => {
    const el = composerWrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setGlowPos({
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    });
    setSpotPos({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
  }, []);

  const handleComposerPointerDown = useCallback((e: React.PointerEvent) => {
    setIsPressed(true);
    setShowGlow(true);
    setSpotVisible(true);
    if (glowFadeTimer.current) clearTimeout(glowFadeTimer.current);
    if (spotFadeTimer.current) clearTimeout(spotFadeTimer.current);
    updateGlowPos(e.clientX, e.clientY);
    if (navigator.vibrate) navigator.vibrate(10);
    const el = composerWrapRef.current;
    if (!el) return;
    deformState.current.pressed = true;
    el.style.willChange = 'transform';
    const { transform } = computeDeform(e.clientX, e.clientY);
    el.style.transition = 'transform 180ms cubic-bezier(0.25,0.46,0.45,0.94)';
    el.style.transform = transform;
    const onMove = (ev: PointerEvent) => {
      if (!deformState.current.pressed || !composerWrapRef.current) return;
      const result = computeDeform(ev.clientX, ev.clientY);
      composerWrapRef.current.style.transition = 'transform 50ms ease-out';
      composerWrapRef.current.style.transform = result.transform;
      updateGlowPos(ev.clientX, ev.clientY);
    };
    deformState.current.moveHandler = onMove;
    window.addEventListener('pointermove', onMove);
  }, [computeDeform, updateGlowPos]);

  const handleComposerPointerUp = useCallback(() => {
    setIsPressed(false);
    deformState.current.pressed = false;
    const el = composerWrapRef.current;
    if (el) {
      el.style.transition = 'transform 360ms cubic-bezier(0.34,1.56,0.64,1)';
      el.style.transform = 'translate(0px, 0px) scaleX(1) scaleY(1)';
      el.style.willChange = '';
    }
    if (deformState.current.moveHandler) {
      window.removeEventListener('pointermove', deformState.current.moveHandler);
      deformState.current.moveHandler = null;
    }
    glowFadeTimer.current = setTimeout(() => setShowGlow(false), 600);
    spotFadeTimer.current = setTimeout(() => setSpotVisible(false), 300);
  }, []);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 288;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }, []);

  const processFiles = useCallback((files: File[]) => {
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const isImage = file.type.startsWith('image/');
        setAttachments(prev => [...prev, {
          type: isImage ? 'image' : 'file',
          name: file.name,
          mimeType: file.type,
          base64,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      processFiles(pastedFiles);
    }
  }, [processFiles]);

  const [isDragOver, setIsDragOver] = useState(false);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer?.files?.length) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  }, [processFiles]);

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
      } else if (e.key === "ArrowUp" && !value.trim() && lastUserMessage) {
        e.preventDefault();
        setValue(lastUserMessage);
        setTimeout(() => {
          const el = textareaRef.current;
          if (el) {
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 288) + "px";
            el.setSelectionRange(lastUserMessage.length, lastUserMessage.length);
          }
        }, 0);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (loading && onEscape) {
          onEscape();
        }
      }
    },
    [handleSend, value, lastUserMessage, loading, onEscape]
  );

  const isEmpty = !value.trim() && attachments.length === 0;

  return (
    <>
      <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div
          ref={composerWrapRef}
          style={{
            borderRadius: 20,
            position: 'relative' as const,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            outline: isDragOver ? '2px dashed rgba(212,162,127,0.5)' : 'none',
            outlineOffset: 2,
            overflow: 'hidden',
            transition: 'border-color 200ms ease',
          }}
          onPointerDown={handleComposerPointerDown}
          onPointerUp={handleComposerPointerUp}
          onPointerLeave={(e) => { handleComposerPointerUp(); handleDragLeave(e as any); }}
          onPointerCancel={handleComposerPointerUp}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-testid="ai-composer"
        >
          <div style={{
            background: 'transparent',
            borderRadius: 19,
            overflow: 'hidden',
            position: 'relative',
          }}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="输入消息..."
            disabled={loading}
            rows={1}
            style={{
              width: '100%',
              minHeight: 44,
              maxHeight: 288,
              padding: '16px 16px 10px 16px',
              fontSize: 16,
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.5,
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              display: 'block',
              position: 'relative',
              zIndex: 1,
            }}
            className={cn(
              "placeholder:text-[rgba(255,255,255,0.3)]",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            data-testid="ai-input"
          />

          {attachments.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: '8px 16px 8px 16px',
                overflowX: 'auto',
              }}
              data-testid="attachment-previews"
            >
              {attachments.map((att, i) => {
                const ext = (att.name.split('.').pop() || '').toUpperCase();
                const isImage = att.type === 'image';
                return (
                  <div
                    key={i}
                    style={{
                      position: 'relative',
                      flexShrink: 0,
                      width: isImage ? 180 : 150,
                      height: 140,
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: isImage ? 'transparent' : '#2a2a2a',
                    }}
                    data-testid={`attachment-preview-${i}`}
                  >
                    {isImage ? (
                      <img
                        src={att.previewUrl || `data:${att.mimeType};base64,${att.base64}`}
                        alt={att.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{
                          background: '#3a3a3a',
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#e8e8e8',
                          alignSelf: 'flex-start',
                        }}>
                          {ext}
                        </div>
                        <div style={{ flex: 1 }} />
                        <div style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: '#e8e8e8',
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          wordBreak: 'break-word',
                        }}>
                          {att.name.replace(/\.[^/.]+$/, '')}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        background: '#555',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      data-testid={`remove-attachment-${i}`}
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 10px 10px 10px',
              position: 'relative',
              zIndex: 1,
            }}
            data-testid="ai-toolbar"
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSheet(true)}
                style={{
                  width: 32,
                  height: 32,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.4)',
                  transition: 'color 150ms',
                }}
                className="hover:text-[rgba(255,255,255,0.7)]"
                data-testid="ai-attach"
              >
                <Plus className="w-5 h-5" />
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
              {codeContextEnabled && (
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#60A5FA' }}
                  data-testid="code-context-badge"
                >
                  <Code className="w-3 h-3" />
                  代码
                </div>
              )}
              {knowledgeBaseEnabled && (
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#4ADE80' }}
                  data-testid="knowledge-base-badge"
                >
                  <BookOpen className="w-3 h-3" />
                  知识库
                </div>
              )}
              {researchEnabled && (
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                  style={{ background: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}
                  data-testid="research-badge"
                >
                  <Atom className="w-3 h-3" />
                  深度
                </div>
              )}
            </div>

            <button
              onClick={loading ? onStop : handleSend}
              disabled={!loading && isEmpty}
              style={{
                width: 36,
                height: 36,
                background: loading ? 'var(--bg-tertiary)' : '#c4613a',
                borderRadius: '50%',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: (!loading && isEmpty) ? 'default' : 'pointer',
                opacity: (!loading && isEmpty) ? 0.35 : 1,
                transition: 'all 200ms ease',
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              data-testid={loading ? "ai-stop" : "ai-send"}
            >
              {loading ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transition: 'opacity 200ms ease' }}>
                  <rect x="3" y="3" width="10" height="10" rx="2" fill="#e8e8e8" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transition: 'opacity 200ms ease' }}>
                  <path d="M8 2L8 14M8 2L3 7M8 2L13 7" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
          </div>
        </div>
        <p style={{
          textAlign: 'center',
          fontSize: 11,
          color: 'rgba(255,255,255,0.3)',
          marginTop: 8,
          lineHeight: 1.3,
        }}>BuddyAI can make mistakes. Please double check responses.</p>
      </div>

      <AddToChatSheet
        open={showSheet}
        onClose={() => setShowSheet(false)}
        webSearchEnabled={webSearchEnabled}
        onWebSearchToggle={(enabled) => {
          onWebSearchToggle?.(enabled);
        }}
        codeContextEnabled={codeContextEnabled}
        onCodeContextToggle={(enabled) => {
          onCodeContextToggle?.(enabled);
        }}
        knowledgeBaseEnabled={knowledgeBaseEnabled}
        onKnowledgeBaseToggle={(enabled) => {
          onKnowledgeBaseToggle?.(enabled);
        }}
        researchEnabled={researchEnabled}
        onResearchToggle={(enabled) => {
          onResearchToggle?.(enabled);
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
