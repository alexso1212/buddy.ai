import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, Copy, Share2, ThumbsUp, ThumbsDown } from "lucide-react";
import AiConfirmCard from "./AiConfirmCard";
import AiGuidedCreation from "./AiGuidedCreation";
import AIMessageContent from "./AIMessageContent";
import AgentLogo from "@/components/AgentLogo";

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
}

interface AiMessageBubbleProps {
  message: Message;
  onConfirm?: (messageId: string, actionIndex?: number) => void;
  onReject?: (messageId: string, actionIndex?: number) => void;
  onSkip?: (messageId: string, actionIndex?: number) => void;
  onFollowUpSubmit?: (messageId: string, mergedData: Record<string, any>, creationType?: string) => void;
  onStepAnswer?: (stepLabel: string, answerLabel: string) => void;
}

function BrandLogo() {
  return <AgentLogo size={28} animate={false} glow={false} />;
}

function AiReplyActions({ content }: { content: string }) {
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
        <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
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
}: {
  message: Message;
  confirmStates: (boolean | null)[];
  hasUndecided: boolean;
  onConfirm: (messageId: string, actionIndex?: number) => void;
  onReject: (messageId: string, actionIndex?: number) => void;
  onSkip?: (messageId: string, actionIndex?: number) => void;
}) {
  const [confirmingAll, setConfirmingAll] = useState(false);

  const handleConfirmAll = async () => {
    setConfirmingAll(true);
    const undecidedIndexes = confirmStates
      .map((c, i) => (c === null ? i : -1))
      .filter((i) => i !== -1);
    for (const index of undecidedIndexes) {
      onConfirm(message.id, index);
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
            <Check className="w-3.5 h-3.5" />
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

export default function AiMessageBubble({
  message,
  onConfirm,
  onReject,
  onSkip,
  onFollowUpSubmit,
  onStepAnswer,
}: AiMessageBubbleProps) {
  if (message.role === "system") {
    const isSuccess = message.content.includes("成功") || message.content.includes("已");
    return (
      <div
        className="flex justify-center px-3 mb-6"
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
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div
        className="flex justify-end px-3 mb-6"
        style={{ animation: 'messageAppear 200ms ease-out' }}
        data-testid={`ai-message-${message.id}`}
      >
        <div
          style={{
            maxWidth: '82%',
            background: '#2F2F2F',
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
          {message.content}
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
      className="flex justify-start px-3 mb-6"
      style={{ animation: 'messageAppear 200ms ease-out' }}
      data-testid={`ai-message-${message.id}`}
    >
      <div className="max-w-full">
        <div className="mb-2">
          <BrandLogo />
        </div>
        <AIMessageContent content={message.content} />
        <AiReplyActions content={message.content} />
      </div>
    </div>
  );
}
