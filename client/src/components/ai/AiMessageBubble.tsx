import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, Copy, Share2, ThumbsUp, ThumbsDown, RotateCcw, Pencil, X, Globe, ChevronDown, ChevronUp, ExternalLink, FileText, RefreshCw } from "lucide-react";
import AiConfirmCard from "./AiConfirmCard";
import AiGuidedCreation from "./AiGuidedCreation";
import AIMessageContent from "./AIMessageContent";
import AgentLogo from "@/components/AgentLogo";
import ThinkingBlock from "./ThinkingBlock";

interface ActionPayload {
  actionType: string;
  data: Record<string, any>;
  summary: string;
  confidence?: number;
  missingFields?: string[];
  followUpQuestion?: string;
}

interface FollowUpData {
  message: string;
  creationType?: 'task' | 'project';
  partialData: Record<string, any>;
  steps?: {
    step: number;
    field: string;
    icon: string;
    label: string;
    options: { label: string; value: any; description?: string; icon?: string }[];
    allowCustomInput: boolean;
    customInputPlaceholder?: string;
    allowSkip: boolean;
    skipValue?: any;
    inputType?: 'text' | 'date' | 'textarea';
  }[];
  currentStep?: number;
  questions?: {
    field: string;
    label: string;
    emoji: string;
    options: { label: string; value: any }[];
    allowCustom?: boolean;
  }[];
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  type?: "text" | "confirm" | "multi_confirm" | "follow_up";
  action?: ActionPayload;
  actions?: ActionPayload[];
  confirmed?: boolean | null;
  actionConfirmed?: (boolean | null)[];
  skipped?: boolean;
  actionSkipped?: boolean[];
  followUp?: FollowUpData;
  followUpSubmitted?: boolean;
  isStreaming?: boolean;
  searchResults?: { title: string; url: string; content: string }[];
  attachments?: { type: string; name: string; mimeType: string; base64: string; previewUrl?: string }[];
  thinking?: string;
  isThinking?: boolean;
  thinkingDuration?: number;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  retryPayload?: { text: string; attachments?: any[] };
  errorType?: 'network' | 'timeout' | 'rate_limit' | 'unknown';
  timestamp?: number;
}

interface AiMessageBubbleProps {
  message: Message;
  onConfirm?: (messageId: string, actionIndex?: number) => void;
  onReject?: (messageId: string, actionIndex?: number) => void;
  onSkip?: (messageId: string, actionIndex?: number) => void;
  onConfirmAll?: (messageId: string) => void;
  onFollowUpSubmit?: (messageId: string, mergedData: Record<string, any>, creationType?: string) => void;
  onStepAnswer?: (stepLabel: string, answerLabel: string) => void;
  onRegenerate?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRetry?: (messageId: string) => void;
  isLastAssistant?: boolean;
}

function BrandLogo() {
  return <AgentLogo size={28} animate={false} glow={false} />;
}

function AiReplyActions({ content, onRegenerate, isLastAssistant }: { content: string; onRegenerate?: () => void; isLastAssistant?: boolean }) {
  const [liked, setLiked] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="flex items-center gap-1 mt-2 ml-0.5" data-testid="ai-reply-actions">
      <button
        onClick={handleCopy}
        className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
        title={copied ? "已复制" : "复制"}
        data-testid="btn-copy-reply"
      >
        {copied ? <Check className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />}
      </button>
      {isLastAssistant && onRegenerate && (
        <button
          onClick={onRegenerate}
          className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
          title="重新生成"
          data-testid="btn-regenerate"
        >
          <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      )}
      <button
        onClick={handleShare}
        className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
        title="分享"
        data-testid="btn-share-reply"
      >
        <Share2 className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
      <button
        onClick={() => setLiked(liked === true ? null : true)}
        className={cn(
          "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
          liked === true
            ? "text-[var(--text-primary)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
        )}
        style={liked === true ? { background: 'rgba(174,86,48,0.15)', color: 'var(--brand)' } : undefined}
        title="有帮助"
        data-testid="btn-like-reply"
      >
        <ThumbsUp className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
      <button
        onClick={() => setLiked(liked === false ? null : false)}
        className={cn(
          "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
          liked === false
            ? "text-red-400"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
        )}
        style={liked === false ? { background: 'rgba(248,113,113,0.1)' } : undefined}
        title="不太好"
        data-testid="btn-dislike-reply"
      >
        <ThumbsDown className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}

function MultiConfirmGroup({
  message,
  confirmStates,
  hasUndecided,
  onConfirm,
  onReject,
  onSkip,
  onConfirmAll,
}: {
  message: Message;
  confirmStates: (boolean | null)[];
  hasUndecided: boolean;
  onConfirm: (messageId: string, actionIndex?: number) => void;
  onReject: (messageId: string, actionIndex?: number) => void;
  onSkip?: (messageId: string, actionIndex?: number) => void;
  onConfirmAll?: (messageId: string) => void;
}) {
  const [confirmingAll, setConfirmingAll] = useState(false);

  const handleConfirmAll = async () => {
    setConfirmingAll(true);
    if (onConfirmAll) {
      await onConfirmAll(message.id);
    } else {
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
      className="flex flex-col justify-start px-3 mb-6 space-y-2"
      style={{ animation: 'messageAppear 200ms ease-out' }}
      data-testid={`ai-message-${message.id}`}
    >
      {message.content && (
        <div className="max-w-full">
          <div className="mb-2">
            <BrandLogo />
          </div>
          <AIMessageContent content={message.content} />
          <AiReplyActions content={message.content} />
        </div>
      )}
      {hasUndecided && (
        <div className="max-w-[90%]">
          <button
            onClick={handleConfirmAll}
            disabled={confirmingAll}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
              confirmingAll
                ? "bg-brand/80 text-white/80 cursor-not-allowed"
                : "bg-brand text-white"
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
            onConfirm={() => onConfirm(message.id, index)}
            onReject={() => onReject(message.id, index)}
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
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-opacity opacity-90 hover:opacity-100"
        style={{ color: 'var(--text-secondary)' }}
        data-testid="toggle-sources"
      >
        <Globe className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Sources</span>
        <span style={{ color: 'var(--text-secondary)' }}>
          {results.slice(0, 3).map(r => r.title.slice(0, 20) + (r.title.length > 20 ? '...' : '')).join(' \u00B7 ')}
          {results.length > 3 && ` +${results.length - 3}`}
        </span>
        {expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
      </button>

      {expanded && (
        <div
          className="mt-1.5 rounded-lg overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {results.map((r, i) => {
            const favicon = getFavicon(r.url);
            return (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 px-3 py-2.5 transition-opacity opacity-90 hover:opacity-100"
                style={{ textDecoration: 'none', borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                data-testid={`source-link-${i}`}
              >
                {favicon && (
                  <img src={favicon} alt="" className="w-4 h-4 mt-0.5 rounded-sm shrink-0" style={{ opacity: 0.8 }} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.title}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
                  </div>
                  <div className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)', opacity: 0.7, lineHeight: 1.4 }}>
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
      className="text-[10px] text-[var(--text-tertiary)] ml-1"
      title={`Prompt: ${usage.promptTokens} | Completion: ${usage.completionTokens} | Total: ${usage.totalTokens}`}
      data-testid="token-usage-badge"
    >
      {formatTokens(usage.totalTokens)} tokens
    </span>
  );
}

function MessageTimestamp({ timestamp }: { timestamp: number }) {
  const time = new Date(timestamp);
  const h = time.getHours().toString().padStart(2, '0');
  const m = time.getMinutes().toString().padStart(2, '0');
  return (
    <span className="text-[10px] text-[var(--text-tertiary)] ml-auto" data-testid="message-timestamp">
      {h}:{m}
    </span>
  );
}

export default function AiMessageBubble({
  message,
  onConfirm,
  onReject,
  onSkip,
  onConfirmAll,
  onFollowUpSubmit,
  onStepAnswer,
  onRegenerate,
  onEditMessage,
  onRetry,
  isLastAssistant,
}: AiMessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  if (message.role === "system") {
    const isSuccess = message.content.includes("成功") || message.content.includes("已");
    const isError = !!message.retryPayload;
    return (
      <div
        className="flex flex-col items-center px-3 mb-6 gap-2"
        data-testid={`ai-message-${message.id}`}
      >
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
        {isError && onRetry && (
          <button
            onClick={() => onRetry(message.id)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-secondary)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            data-testid="btn-retry"
          >
            <RefreshCw size={12} />
            重试
          </button>
        )}
      </div>
    );
  }

  if (message.role === "user") {
    if (isEditing) {
      return (
        <div
          className="flex justify-end px-3 mb-6"
          style={{ animation: 'messageAppear 200ms ease-out' }}
          data-testid={`ai-message-${message.id}`}
        >
          <div style={{ maxWidth: '82%', width: '100%' }}>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                background: '#000000',
                borderRadius: 18,
                padding: '10px 14px',
                fontFamily: 'var(--font-sans)',
                fontSize: 16,
                lineHeight: 1.5,
                color: 'var(--text-primary)',
                border: '1px solid var(--brand)',
                outline: 'none',
                resize: 'none',
                minHeight: 60,
              }}
              data-testid="edit-message-input"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => { setIsEditing(false); setEditText(message.content); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-white/5 transition-colors"
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
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
                style={{ background: 'var(--brand)' }}
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
        className="group flex justify-end px-3 mb-6"
        style={{ animation: 'messageAppear 200ms ease-out' }}
        data-testid={`ai-message-${message.id}`}
      >
        {onEditMessage && (
          <button
            onClick={() => { setEditText(message.content); setIsEditing(true); }}
            className="self-start mt-2 mr-2 flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
            title="编辑消息"
            data-testid="btn-edit-message"
          >
            <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        )}
        <div
          style={{
            maxWidth: '82%',
            background: '#000000',
            borderRadius: 18,
            padding: '10px 14px',
            fontFamily: 'var(--font-sans)',
            fontSize: 16,
            lineHeight: 1.5,
            color: 'var(--text-primary)',
            wordBreak: 'break-word',
          }}
          className="whitespace-pre-wrap"
          data-testid={`user-bubble-${message.id}`}
        >
          {message.attachments && message.attachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: message.content ? 8 : 0 }}>
              {message.attachments.map((att, i) => (
                att.type === 'image' ? (
                  <img
                    key={i}
                    src={att.previewUrl || `data:${att.mimeType};base64,${att.base64}`}
                    alt={att.name}
                    style={{
                      maxWidth: 200,
                      maxHeight: 200,
                      borderRadius: 12,
                      objectFit: 'cover',
                    }}
                    data-testid={`attachment-image-${i}`}
                  />
                ) : (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 8,
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                    }}
                    data-testid={`attachment-file-${i}`}
                  >
                    <FileText size={14} />
                    {att.name}
                  </div>
                )
              ))}
            </div>
          )}
          {message.content}
          {message.timestamp != null && (
            <div className="flex justify-end mt-1">
              <MessageTimestamp timestamp={message.timestamp} />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (
    message.type === "confirm" &&
    message.action &&
    onConfirm &&
    onReject
  ) {
    return (
      <div
        className="flex justify-start px-3 mb-6"
        style={{ animation: 'messageAppear 200ms ease-out' }}
        data-testid={`ai-message-${message.id}`}
      >
        <div className="max-w-[90%]">
          <AiConfirmCard
            action={message.action}
            onConfirm={() => onConfirm(message.id)}
            onReject={() => onReject(message.id)}
            onSkip={onSkip ? () => onSkip(message.id) : undefined}
            confirmed={message.confirmed ?? null}
            skipped={message.skipped ?? false}
          />
        </div>
      </div>
    );
  }

  if (
    message.type === "multi_confirm" &&
    message.actions &&
    onConfirm &&
    onReject
  ) {
    const confirmStates = message.actionConfirmed ?? message.actions.map(() => null);
    const hasUndecided = confirmStates.some((c) => c === null);
    return (
      <MultiConfirmGroup
        message={message}
        confirmStates={confirmStates}
        hasUndecided={hasUndecided}
        onConfirm={onConfirm}
        onReject={onReject}
        onSkip={onSkip}
        onConfirmAll={onConfirmAll}
      />
    );
  }

  if (message.type === "follow_up" && message.followUp && onFollowUpSubmit) {
    const hasSteps = message.followUp.steps && message.followUp.steps.length > 0;
    if (!hasSteps) {
      return (
        <div className="flex justify-start px-3 mb-6" style={{ animation: 'messageAppear 200ms ease-out' }} data-testid={`ai-message-${message.id}`}>
          <div className="max-w-full">
            <div className="mb-2"><BrandLogo /></div>
            <AIMessageContent content={message.followUp.message || message.content} />
            <AiReplyActions content={message.followUp.message || message.content} />
          </div>
        </div>
      );
    }
    return (
      <div className="px-3 mb-6" style={{ animation: 'messageAppear 200ms ease-out' }} data-testid={`ai-message-${message.id}`}>
        <AiGuidedCreation
          followUp={message.followUp as any}
          onComplete={(mergedData, creationType) => onFollowUpSubmit(message.id, mergedData, creationType)}
          completed={message.followUpSubmitted}
          onStepAnswer={onStepAnswer}
        />
      </div>
    );
  }

  return (
    <div
      className="group flex justify-start px-3 mb-6"
      style={{ animation: 'messageAppear 200ms ease-out' }}
      data-testid={`ai-message-${message.id}`}
    >
      <div className="max-w-full">
        <div className="mb-2 flex items-center gap-2">
          <BrandLogo />
          {message.timestamp != null && (
            <MessageTimestamp timestamp={message.timestamp} />
          )}
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
        <div className={message.isStreaming ? 'streaming-cursor' : ''}>
          <AIMessageContent content={message.content} />
        </div>
        {!message.isStreaming && (
          <div className="flex items-center opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150">
            <AiReplyActions
              content={message.content}
              onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
              isLastAssistant={isLastAssistant}
            />
            {message.tokenUsage && <TokenUsageBadge usage={message.tokenUsage} />}
          </div>
        )}
      </div>
    </div>
  );
}
