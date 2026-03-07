import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Check, Copy, Share2, ThumbsUp, ThumbsDown, RotateCcw, Pencil, X,
  Globe, ChevronDown, ChevronUp, ExternalLink, FileText, RefreshCw,
  PanelRightOpen, Loader2, Search, Terminal, AlertTriangle, WifiOff,
  Clock, MessageSquarePlus, Scissors, ServerCrash, PlayCircle, AlertCircle,
  Square, FolderOpen,
} from "lucide-react";
import {
  useBuddyMessageData,
  useBuddyCallbacks,
  useIsLastAssistant,
  type BuddyMessage,
} from "./BuddyRuntime";
import AiConfirmCard from "./AiConfirmCard";
import AiGuidedCreation from "./AiGuidedCreation";
import AIMessageContent from "./AIMessageContent";
import AgentLogo from "@/components/AgentLogo";
import ThinkingBlock from "./ThinkingBlock";
import ArtifactPanel, { isLongContent, extractArtifactTitle } from "./ArtifactPanel";

function BrandLogo({ breathing }: { breathing?: boolean }) {
  return (
    <div
      className={breathing ? 'logo-breathing' : ''}
      style={{ width: 20, height: 20, flexShrink: 0 }}
    >
      <AgentLogo size={20} animate={false} glow={false} />
    </div>
  );
}

const DISLIKE_REASONS = [
  { value: 'inaccurate', label: '回答不准确' },
  { value: 'misunderstood', label: '没有理解我的问题' },
  { value: 'length', label: '回复太长/太短' },
  { value: 'format', label: '格式有问题' },
  { value: 'other', label: '其他' },
];

const ACTION_BTN = "flex h-8 w-8 items-center justify-center rounded-md transition duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)] hover:bg-transparent active:scale-95";

function AiReplyActions({ content, onRegenerate, isLastAssistant }: { content: string; onRegenerate?: () => void; isLastAssistant?: boolean }) {
  const [liked, setLiked] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({ text: content }).catch(() => {});
    } else {
      navigator.clipboard.writeText(content);
    }
  }, [content]);

  const handleDislike = useCallback(() => {
    if (liked === false) {
      setLiked(null);
      setShowFeedback(false);
      setFeedbackSubmitted(false);
    } else {
      setLiked(false);
      if (!feedbackSubmitted) setShowFeedback(true);
    }
  }, [liked, feedbackSubmitted]);

  const handleFeedbackSelect = useCallback((_reason: string) => {
    setFeedbackSubmitted(true);
    setShowFeedback(false);
  }, []);

  return (
    <div className="mt-1" data-testid="ai-reply-actions">
      <div className="flex items-center text-[var(--text-tertiary,#6b6a68)]">
        <button
          onClick={handleCopy}
          className={ACTION_BTN}
          title={copied ? "已复制" : "复制"}
          data-testid="btn-copy-reply"
        >
          {copied ? <Check className="w-4 h-4" strokeWidth={1.5} /> : <Copy className="w-4 h-4" strokeWidth={1.5} />}
        </button>
        {isLastAssistant && onRegenerate && (
          <button
            onClick={onRegenerate}
            className={ACTION_BTN}
            title="重新生成"
            data-testid="btn-regenerate"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={1.5} />
          </button>
        )}
        <button
          onClick={handleShare}
          className={ACTION_BTN}
          title="分享"
          data-testid="btn-share-reply"
        >
          <Share2 className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => setLiked(liked === true ? null : true)}
          className={cn(ACTION_BTN, liked === true && "text-[var(--brand)]")}
          style={liked === true ? { background: 'rgba(174,86,48,0.15)' } : undefined}
          title="有帮助"
          data-testid="btn-like-reply"
        >
          <ThumbsUp className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          onClick={handleDislike}
          className={cn(ACTION_BTN, liked === false && "text-red-400")}
          style={liked === false ? { background: 'rgba(248,113,113,0.1)' } : undefined}
          title="不太好"
          data-testid="btn-dislike-reply"
        >
          <ThumbsDown className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
      {showFeedback && (
        <div
          className="flex flex-wrap gap-1.5 mt-2 ml-0.5"
          style={{ animation: 'messageAppear 200ms ease-out' }}
          data-testid="dislike-feedback-form"
        >
          {DISLIKE_REASONS.map((reason) => (
            <button
              key={reason.value}
              onClick={() => handleFeedbackSelect(reason.value)}
              className="text-xs px-2.5 py-1 rounded-full transition-colors border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[#393937]"
              data-testid={`feedback-${reason.value}`}
            >
              {reason.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchSourcesBar({ results }: { results: { title: string; url: string; content: string }[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!results || results.length === 0) return null;

  const getFavicon = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
      return null;
    }
  };

  return (
    <div className="mb-3" data-testid="search-sources-bar">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-opacity opacity-90 hover:opacity-100 text-[var(--text-secondary)]"
        data-testid="toggle-sources"
      >
        <Globe className="w-3.5 h-3.5 text-[var(--brand)]" strokeWidth={1.5} />
        <span className="text-[var(--text-primary)] font-medium">Sources</span>
        <span>
          {results.slice(0, 3).map(r => r.title.slice(0, 20) + (r.title.length > 20 ? '...' : '')).join(' \u00B7 ')}
          {results.length > 3 && ` +${results.length - 3}`}
        </span>
        {expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
      </button>
      {expanded && (
        <div className="mt-1.5 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[#393937]/30">
          {results.map((r, i) => {
            const favicon = getFavicon(r.url);
            return (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 px-3 py-2.5 transition-opacity opacity-90 hover:opacity-100 no-underline"
                style={{ borderBottom: i < results.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                data-testid={`source-link-${i}`}
              >
                {favicon && (
                  <img src={favicon} alt="" className="w-4 h-4 mt-0.5 rounded-sm shrink-0 opacity-80" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium truncate text-[var(--text-primary)]">{r.title}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 text-[var(--text-secondary)] opacity-50" />
                  </div>
                  <div className="text-xs mt-0.5 line-clamp-2 text-[var(--text-secondary)] opacity-70" style={{ lineHeight: 1.4 }}>
                    {r.content.slice(0, 120)}{r.content.length > 120 ? '...' : ''}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TokenUsageBadge({ usage }: { usage: { promptTokens: number; completionTokens: number; totalTokens: number } }) {
  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return `${n}`;
  };
  return (
    <span
      className="text-[10px] text-[var(--text-tertiary,#6b6a68)] ml-1"
      title={`Prompt: ${usage.promptTokens} | Completion: ${usage.completionTokens} | Total: ${usage.totalTokens}`}
      data-testid="token-usage-badge"
    >
      {formatTokens(usage.totalTokens)} tokens
    </span>
  );
}

function getToolIcon(type?: string) {
  switch (type) {
    case 'search': return Search;
    case 'file': return FileText;
    case 'code': return Terminal;
    default: return Terminal;
  }
}

function ToolCallCard({ toolCall, index }: { toolCall: { toolName: string; label: string; status: 'running' | 'complete' | 'error'; detail?: string; type?: string; completedLabel?: string }; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getToolIcon(toolCall.type);
  const isRunning = toolCall.status === 'running';
  const isError = toolCall.status === 'error';
  const displayLabel = toolCall.status === 'complete' && toolCall.completedLabel
    ? toolCall.completedLabel
    : toolCall.label;

  return (
    <div
      className="rounded-lg overflow-hidden border"
      style={{
        background: isError ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
        borderColor: isError ? 'rgba(239,68,68,0.2)' : 'var(--border-subtle)',
      }}
      data-testid={`tool-call-card-${index}`}
    >
      <button
        onClick={() => !isRunning && toolCall.detail && setExpanded(!expanded)}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-left"
        style={{ cursor: !isRunning && toolCall.detail ? 'pointer' : 'default' }}
        data-testid={`tool-call-toggle-${index}`}
      >
        {isRunning ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-[var(--brand)]" />
        ) : isError ? (
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#F87171]" />
        ) : (
          <Icon className="w-3.5 h-3.5 shrink-0 text-[#4ADE80]" />
        )}
        <span
          className="text-xs flex-1 truncate"
          style={{
            color: isError ? '#FCA5A5' : isRunning ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: isRunning ? 500 : 400,
          }}
        >
          {displayLabel}
        </span>
        {!isRunning && toolCall.detail && (
          expanded
            ? <ChevronUp className="w-3 h-3 shrink-0 text-[var(--text-secondary)]" />
            : <ChevronDown className="w-3 h-3 shrink-0 text-[var(--text-secondary)]" />
        )}
      </button>
      {expanded && toolCall.detail && (
        <div
          className="px-3 pb-2 text-xs text-[var(--text-secondary)] opacity-80 whitespace-pre-wrap break-words"
          style={{
            lineHeight: 1.5,
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 8,
            maxHeight: 200,
            overflowY: 'auto',
          }}
          data-testid={`tool-call-detail-${index}`}
        >
          {toolCall.detail}
        </div>
      )}
    </div>
  );
}

function CooldownTimer({ cooldownUntil }: { cooldownUntil: number }) {
  const [remaining, setRemaining] = useState(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => {
      const r = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil, remaining]);

  if (remaining <= 0) return null;
  return (
    <span className="text-xs tabular-nums text-[var(--text-secondary)]" data-testid="cooldown-timer">
      {remaining}s
    </span>
  );
}

function ErrorBlock({ message }: { message: BuddyMessage }) {
  const { onRetry, onContinueGeneration, onNewConversation, onTrimAndRetry } = useBuddyCallbacks();
  const errorType = message.errorType || 'unknown';

  const errorConfig: Record<string, { icon: typeof WifiOff; title: string; description: string; bgColor: string; borderColor: string; iconColor: string }> = {
    network: {
      icon: WifiOff,
      title: 'Connection lost',
      description: message.retryCount && message.retryCount > 0
        ? `Auto-retrying... (attempt ${message.retryCount}/3)`
        : 'Network connection interrupted. Retrying automatically...',
      bgColor: 'rgba(239,68,68,0.08)',
      borderColor: 'rgba(239,68,68,0.2)',
      iconColor: '#ef4444',
    },
    rate_limit: {
      icon: Clock,
      title: 'Rate limited',
      description: 'Too many requests. Please wait before trying again.',
      bgColor: 'rgba(245,158,11,0.08)',
      borderColor: 'rgba(245,158,11,0.2)',
      iconColor: '#f59e0b',
    },
    context_too_long: {
      icon: AlertCircle,
      title: 'Context too long',
      description: 'The conversation has exceeded the maximum context length.',
      bgColor: 'rgba(139,92,246,0.08)',
      borderColor: 'rgba(139,92,246,0.2)',
      iconColor: '#8b5cf6',
    },
    service_unavailable: {
      icon: ServerCrash,
      title: 'Service unavailable',
      description: 'The AI service is temporarily overloaded. Try a different model or wait a moment.',
      bgColor: 'rgba(245,158,11,0.08)',
      borderColor: 'rgba(245,158,11,0.2)',
      iconColor: '#f59e0b',
    },
    stream_interrupted: {
      icon: AlertTriangle,
      title: 'Response interrupted',
      description: 'The response was cut short. You can continue from where it stopped.',
      bgColor: 'rgba(59,130,246,0.08)',
      borderColor: 'rgba(59,130,246,0.2)',
      iconColor: '#3b82f6',
    },
    timeout: {
      icon: Clock,
      title: 'Response timed out',
      description: 'No data received for 45 seconds.',
      bgColor: 'rgba(245,158,11,0.08)',
      borderColor: 'rgba(245,158,11,0.2)',
      iconColor: '#f59e0b',
    },
    unknown: {
      icon: AlertTriangle,
      title: 'Something went wrong',
      description: message.content || 'An unexpected error occurred.',
      bgColor: 'rgba(239,68,68,0.08)',
      borderColor: 'rgba(239,68,68,0.2)',
      iconColor: '#ef4444',
    },
  };

  const config = errorConfig[errorType] || errorConfig.unknown;
  const IconComponent = config.icon;
  const isAutoRetrying = errorType === 'network' && message.retryCount !== undefined && message.retryCount > 0 && message.retryCount < 3;
  const cooldownActive = errorType === 'rate_limit' && message.cooldownUntil && message.cooldownUntil > Date.now();

  return (
    <div
      className="flex flex-col px-3 mb-6 gap-2"
      style={{ animation: 'messageAppear 200ms ease-out' }}
      data-testid={`ai-message-${message.id}`}
    >
      <div
        className="rounded-lg px-4 py-3"
        style={{
          background: config.bgColor,
          border: `1px solid ${config.borderColor}`,
          maxWidth: '90%',
        }}
        data-testid={`error-block-${errorType}`}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            {isAutoRetrying ? (
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: config.iconColor }} />
            ) : (
              <IconComponent className="w-4 h-4" style={{ color: config.iconColor }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[var(--text-primary)]" data-testid="error-title">
              {config.title}
            </div>
            <div className="text-xs mt-0.5 text-[var(--text-secondary)]" style={{ lineHeight: 1.5 }} data-testid="error-description">
              {config.description}
            </div>
          </div>
          {cooldownActive && <CooldownTimer cooldownUntil={message.cooldownUntil!} />}
        </div>

        {message.partialContent && errorType === 'stream_interrupted' && (
          <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${config.borderColor}` }}>
            <div className="text-xs text-[var(--text-secondary)]">
              Partial response received ({message.partialContent.length} chars)
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {errorType === 'stream_interrupted' && onContinueGeneration && (
            <button
              onClick={() => onContinueGeneration(message.id)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors font-medium"
              style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}
              data-testid="btn-continue-generation"
            >
              <PlayCircle size={12} />
              Continue generating
            </button>
          )}

          {errorType === 'context_too_long' && (
            <>
              {onNewConversation && (
                <button
                  onClick={onNewConversation}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors font-medium"
                  style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }}
                  data-testid="btn-new-conversation"
                >
                  <MessageSquarePlus size={12} />
                  Start new conversation
                </button>
              )}
              {onTrimAndRetry && (
                <button
                  onClick={() => onTrimAndRetry(message.id)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors font-medium border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[#393937]"
                  data-testid="btn-trim-retry"
                >
                  <Scissors size={12} />
                  Trim context & retry
                </button>
              )}
            </>
          )}

          {!isAutoRetrying && errorType !== 'context_too_long' && onRetry && message.retryPayload && (
            <button
              onClick={() => onRetry(message.id)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors font-medium border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[#393937]"
              disabled={!!cooldownActive}
              data-testid="btn-retry"
            >
              <RefreshCw size={12} />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function BuddyUserMessage() {
  const message = useBuddyMessageData();
  const { onEditMessage } = useBuddyCallbacks();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message?.content || '');

  if (!message) return null;

  if (isEditing) {
    return (
      <div
        className="group relative mx-auto mt-1 mb-1 block w-full max-w-3xl"
        style={{ animation: 'messageAppear 200ms ease-out' }}
        data-testid={`ai-message-${message.id}`}
      >
        <div className="inline-flex max-w-[75ch] flex-col gap-2 rounded-xl bg-[#393937] py-2.5 pr-6 pl-2.5">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-[#eee] outline-none resize-none font-serif"
            style={{ minHeight: 60, fontSize: 15, lineHeight: '1.65rem' }}
            data-testid="edit-message-input"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setIsEditing(false); setEditText(message.content); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[#393937] transition-colors"
              data-testid="btn-cancel-edit"
            >
              <X className="w-3.5 h-3.5" />
              取消
            </button>
            <button
              onClick={() => {
                const trimmed = editText.trim();
                if (trimmed && trimmed !== message.content && onEditMessage) {
                  onEditMessage(message.id, trimmed);
                }
                setIsEditing(false);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-white bg-[#ae5630] hover:bg-[#c4633a] transition-colors active:scale-95"
              data-testid="btn-submit-edit"
            >
              <Check className="w-3.5 h-3.5" />
              发送
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group/user relative mx-auto mt-1 mb-1 block w-full max-w-3xl"
      style={{ animation: 'messageAppear 200ms ease-out' }}
      data-testid={`ai-message-${message.id}`}
    >
      <div
        className="wrap-break-word relative inline-flex max-w-[75ch] flex-col gap-2 rounded-xl bg-[#393937] py-2.5 pr-6 pl-2.5 text-[#eee] transition-all"
        data-testid={`user-bubble-${message.id}`}
      >
        <div className="relative flex flex-row gap-2">
          <div className="shrink-0 self-start transition-all duration-300">
            <div className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-[#eee] font-bold text-[12px] text-[#2b2a27]">
              U
            </div>
          </div>
          <div className="flex-1">
            <div className="relative grid grid-cols-1 gap-2 py-0.5">
              {message.attachments && message.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {message.attachments.map((att, i) => (
                    att.type === 'image' ? (
                      <img
                        key={i}
                        src={att.previewUrl || `data:${att.mimeType};base64,${att.base64}`}
                        alt={att.name}
                        className="max-w-[200px] max-h-[200px] rounded-xl object-cover"
                        data-testid={`attachment-image-${i}`}
                      />
                    ) : (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/8 text-[13px] text-[var(--text-secondary)]"
                        data-testid={`attachment-file-${i}`}
                      >
                        <FileText size={14} />
                        {att.name}
                      </div>
                    )
                  ))}
                </div>
              )}
              <div className="wrap-break-word whitespace-pre-wrap font-serif" style={{ lineHeight: '1.65rem' }}>
                {message.content}
              </div>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute right-2 bottom-0">
          <div className="pointer-events-auto min-w-max translate-x-1 translate-y-4 rounded-lg border-[0.5px] border-[rgba(108,106,96,0.25)] bg-[#1f1e1b]/80 p-0.5 opacity-0 shadow-sm backdrop-blur-sm transition group-hover/user:translate-x-0.5 group-hover/user:opacity-100">
            <div className="flex items-center text-[var(--text-tertiary,#6b6a68)]">
              {onEditMessage && (
                <button
                  onClick={() => { setEditText(message.content); setIsEditing(true); }}
                  className={ACTION_BTN}
                  title="编辑消息"
                  data-testid="btn-edit-message"
                >
                  <Pencil className="w-4 h-4" strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BuddyAssistantMessage() {
  const message = useBuddyMessageData();
  const callbacks = useBuddyCallbacks();
  const isLast = useIsLastAssistant(message?.id || '');

  if (!message) return null;

  if (message.role === "system") {
    if (message.errorType && message.errorType !== 'unknown') {
      return <ErrorBlock message={message} />;
    }
    const isSuccess = message.content.includes("成功") || message.content.includes("已");
    const isError = !!message.retryPayload;
    return (
      <div
        className="flex flex-col items-center px-3 mb-6 gap-2"
        data-testid={`ai-message-${message.id}`}
      >
        {isError ? (
          <ErrorBlock message={message} />
        ) : (
          <span
            className={cn(
              "text-xs px-3 py-1 rounded-full",
              isSuccess
                ? "bg-brand/10 text-brand dark:text-brand-light"
                : "bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"
            )}
          >
            {message.content}
          </span>
        )}
      </div>
    );
  }

  if (message.type === "confirm" && message.action && callbacks.onConfirm && callbacks.onReject) {
    return (
      <div
        className="relative mx-auto mt-1 mb-1 block w-full max-w-3xl font-serif"
        style={{ animation: 'messageAppear 200ms ease-out' }}
        data-testid={`ai-message-${message.id}`}
      >
        <div className="max-w-[90%]">
          <AiConfirmCard
            action={message.action}
            onConfirm={() => callbacks.onConfirm!(message.id)}
            onReject={() => callbacks.onReject!(message.id)}
            onSkip={callbacks.onSkip ? () => callbacks.onSkip!(message.id) : undefined}
            confirmed={message.confirmed ?? null}
            skipped={message.skipped ?? false}
          />
        </div>
      </div>
    );
  }

  if (message.type === "multi_confirm" && message.actions && callbacks.onConfirm && callbacks.onReject) {
    const confirmStates = message.actionConfirmed ?? message.actions.map(() => null);
    const hasUndecided = confirmStates.some((c) => c === null);
    return (
      <MultiConfirmGroup
        message={message}
        confirmStates={confirmStates}
        hasUndecided={hasUndecided}
      />
    );
  }

  if (message.type === "follow_up" && message.followUp && callbacks.onFollowUpSubmit) {
    const hasSteps = message.followUp.steps && message.followUp.steps.length > 0;
    if (!hasSteps) {
      return (
        <div
          className="relative mx-auto mt-1 mb-12 block w-full max-w-3xl font-serif"
          style={{ animation: 'messageAppear 200ms ease-out' }}
          data-testid={`ai-message-${message.id}`}
        >
          <div className="mb-1"><BrandLogo /></div>
          <div className="wrap-break-word whitespace-normal pr-8 pl-2 text-[#eee]" style={{ lineHeight: '1.65rem' }}>
            <AIMessageContent content={message.followUp.message || message.content} />
          </div>
          <div className="pl-2">
            <AiReplyActions content={message.followUp.message || message.content} />
          </div>
        </div>
      );
    }
    return (
      <div
        className="relative mx-auto mt-1 mb-1 block w-full max-w-3xl font-serif"
        style={{ animation: 'messageAppear 200ms ease-out' }}
        data-testid={`ai-message-${message.id}`}
      >
        <AiGuidedCreation
          followUp={message.followUp as any}
          onComplete={(mergedData, creationType) => callbacks.onFollowUpSubmit!(message.id, mergedData, creationType)}
          completed={message.followUpSubmitted}
          onStepAnswer={callbacks.onStepAnswer}
        />
      </div>
    );
  }

  if (message.errorType) {
    return <ErrorBlock message={message} />;
  }

  return <DefaultAssistantMessage message={message} isLastAssistant={isLast} />;
}

function MultiConfirmGroup({
  message,
  confirmStates,
  hasUndecided,
}: {
  message: BuddyMessage;
  confirmStates: (boolean | null)[];
  hasUndecided: boolean;
}) {
  const { onConfirm, onReject, onSkip, onConfirmAll } = useBuddyCallbacks();
  const [confirmingAll, setConfirmingAll] = useState(false);

  const handleConfirmAll = async () => {
    setConfirmingAll(true);
    if (onConfirmAll) {
      await onConfirmAll(message.id);
    } else if (onConfirm) {
      const undecidedIndexes = confirmStates
        .map((c, i) => (c === null ? i : -1))
        .filter((i) => i !== -1);
      for (const index of undecidedIndexes) {
        onConfirm(message.id, index);
      }
    }
    setConfirmingAll(false);
  };

  return (
    <div
      className="relative mx-auto mt-1 mb-1 block w-full max-w-3xl font-serif space-y-2"
      style={{ animation: 'messageAppear 200ms ease-out' }}
      data-testid={`ai-message-${message.id}`}
    >
      {message.content && (
        <div className="relative mb-12">
          <div className="mb-1"><BrandLogo /></div>
          <div className="wrap-break-word whitespace-normal pr-8 pl-2 text-[#eee]" style={{ lineHeight: '1.65rem' }}>
            <AIMessageContent content={message.content} />
          </div>
          <div className="pl-2">
            <AiReplyActions content={message.content} />
          </div>
        </div>
      )}
      {hasUndecided && (
        <div className="max-w-[90%]">
          <button
            onClick={handleConfirmAll}
            disabled={confirmingAll}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 active:scale-[0.98]",
              confirmingAll
                ? "bg-[#ae5630]/80 text-white/80 cursor-not-allowed"
                : "bg-[#ae5630] text-white hover:bg-[#c4633a]"
            )}
            data-testid={`confirm-all-${message.id}`}
          >
            {confirmingAll ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {confirmingAll ? "执行中..." : "全部确认"}
          </button>
        </div>
      )}
      {message.actions!.map((action, index) => (
        <div key={index} className="max-w-[90%]">
          <AiConfirmCard
            action={action}
            onConfirm={() => onConfirm?.(message.id, index)}
            onReject={() => onReject?.(message.id, index)}
            onSkip={onSkip ? () => onSkip(message.id, index) : undefined}
            confirmed={confirmStates[index] ?? null}
            skipped={message.actionSkipped?.[index] ?? false}
            index={index}
          />
        </div>
      ))}
    </div>
  );
}

function DefaultAssistantMessage({ message, isLastAssistant }: { message: BuddyMessage; isLastAssistant: boolean }) {
  const { onRegenerate } = useBuddyCallbacks();
  const [artifactOpen, setArtifactOpen] = useState(false);

  const showArtifactButton = !message.isStreaming && isLongContent(message.content);
  const MAX_COLLAPSED_LENGTH = 2000;
  const isLongMessage = message.content.length > MAX_COLLAPSED_LENGTH && !message.isStreaming;
  const [contentExpanded, setContentExpanded] = useState(true);

  useEffect(() => {
    if (!message.isStreaming && message.content.length > MAX_COLLAPSED_LENGTH) {
      setContentExpanded(false);
    }
  }, [message.isStreaming]);

  const displayContent = contentExpanded ? message.content : message.content.slice(0, MAX_COLLAPSED_LENGTH);

  return (
    <div
      className="group relative mx-auto mt-1 mb-1 block w-full max-w-3xl"
      style={{ animation: 'messageAppear 200ms ease-out' }}
      data-testid={`ai-message-${message.id}`}
    >
      <div className="relative mb-12 font-serif">
        <div className="mb-1 flex items-center gap-2">
          <BrandLogo breathing={!!message.isStreaming} />
        </div>
        {message.thinking && (
          <ThinkingBlock
            content={message.thinking}
            isStreaming={message.isThinking}
            duration={message.thinkingDuration}
          />
        )}
        {message.searchResults && message.searchResults.length > 0 && (
          <SearchSourcesBar results={message.searchResults} />
        )}
        {message.codeFiles && message.codeFiles.length > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2 text-xs"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#93C5FD' }}
            data-testid="code-files-info"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>已加载 {message.codeFiles.length} 个代码文件</span>
            {message.codeFilesFailed && message.codeFilesFailed.length > 0 && (
              <span style={{ color: '#FCA5A5' }}>· {message.codeFilesFailed.length} 个未找到</span>
            )}
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-3" data-testid="tool-calls-info">
            {message.toolCalls.map((tc, i) => (
              <ToolCallCard key={i} toolCall={tc} index={i} />
            ))}
          </div>
        )}
        <div className="relative" style={{ lineHeight: '1.65rem' }}>
          <div className="grid grid-cols-1 gap-2.5">
            <div className="wrap-break-word whitespace-normal pr-8 pl-2 font-serif text-[#eee]">
              <AIMessageContent content={displayContent} />
            </div>
          </div>
        </div>
        {isLongMessage && !contentExpanded && (
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              height: 60,
              background: 'linear-gradient(to top, var(--bg-primary), transparent)',
              pointerEvents: 'none',
            }} />
            <button
              onClick={() => setContentExpanded(true)}
              className="w-full py-2 text-center text-[13px] text-[var(--brand)] font-medium font-serif hover:underline"
              data-testid="btn-show-more"
            >
              显示更多
            </button>
          </div>
        )}
        {showArtifactButton && (
          <button
            onClick={() => setArtifactOpen(true)}
            className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[#393937] active:scale-[0.98]"
            data-testid={`btn-open-artifact-${message.id}`}
          >
            <PanelRightOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
            Open in panel
          </button>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0">
          <div className="pointer-events-auto flex w-full translate-y-full flex-col items-end px-2 pt-2 transition">
            {!message.isStreaming && (
              <>
                <div className="flex items-center text-[var(--text-tertiary,#6b6a68)]">
                  <AiReplyActions
                    content={message.content}
                    onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
                    isLastAssistant={isLastAssistant}
                  />
                  {message.tokenUsage && <TokenUsageBadge usage={message.tokenUsage} />}
                  {message.timestamp != null && (
                    <span
                      className="text-[10px] text-[var(--text-secondary)] opacity-0 group-hover:opacity-40 transition-opacity ml-2"
                      data-testid="message-timestamp"
                    >
                      {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                {isLastAssistant && (
                  <p className="mt-2 w-full text-right text-[var(--claude-disclaimer,#b8b5a9)] text-[0.65rem] leading-[0.85rem] opacity-90 sm:text-[0.75rem]">
                    AI 生成内容可能存在错误，请核实重要信息。
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {artifactOpen && (
        <ArtifactPanel
          content={message.content}
          title={extractArtifactTitle(message.content)}
          isOpen={artifactOpen}
          onClose={() => setArtifactOpen(false)}
          messageId={message.id}
        />
      )}
    </div>
  );
}
