import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Sparkles } from "lucide-react";
import AiConfirmCard from "./AiConfirmCard";
import AiFollowUpCard from "./AiFollowUpCard";
import AIMessageContent from "./AIMessageContent";

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
  partialData: Record<string, any>;
  questions: {
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
  onFollowUpSubmit?: (messageId: string, mergedData: Record<string, any>) => void;
}

function BrandLogo() {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{ width: 20, height: 20, borderRadius: '50%', background: '#C4703F' }}
      data-testid="brand-logo"
    >
      <Sparkles className="w-2.5 h-2.5 text-white" />
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
            background: 'var(--bg-bubble)',
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
    return (
      <div className="flex justify-start px-3 mb-6" style={{ animation: 'messageAppear 200ms ease-out' }} data-testid={`ai-message-${message.id}`}>
        <div className="max-w-[90%]">
          <AiFollowUpCard
            followUp={message.followUp}
            onSubmit={(mergedData) => onFollowUpSubmit(message.id, mergedData)}
            submitted={message.followUpSubmitted}
          />
        </div>
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
      </div>
    </div>
  );
}
