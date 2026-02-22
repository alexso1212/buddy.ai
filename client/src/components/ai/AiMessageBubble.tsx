import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import AiConfirmCard from "./AiConfirmCard";

interface ActionPayload {
  actionType: string;
  data: Record<string, any>;
  summary: string;
  confidence?: number;
  missingFields?: string[];
  followUpQuestion?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  type?: "text" | "confirm" | "multi_confirm";
  action?: ActionPayload;
  actions?: ActionPayload[];
  confirmed?: boolean | null;
  actionConfirmed?: (boolean | null)[];
}

interface AiMessageBubbleProps {
  message: Message;
  onConfirm?: (messageId: string, actionIndex?: number) => void;
  onReject?: (messageId: string, actionIndex?: number) => void;
}

function MultiConfirmGroup({
  message,
  confirmStates,
  hasUndecided,
  onConfirm,
  onReject,
}: {
  message: Message;
  confirmStates: (boolean | null)[];
  hasUndecided: boolean;
  onConfirm: (messageId: string, actionIndex?: number) => void;
  onReject: (messageId: string, actionIndex?: number) => void;
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
      className="flex flex-col justify-start px-4 py-1 space-y-2"
      data-testid={`ai-message-${message.id}`}
    >
      {message.content && (
        <div className="max-w-[80%] px-4 py-2.5 text-sm bg-muted text-foreground rounded-2xl rounded-bl-sm whitespace-pre-wrap break-words">
          {message.content}
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
                ? "bg-emerald-400 text-white/80 cursor-not-allowed"
                : "bg-emerald-500 text-white"
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
            confirmed={confirmStates[index] ?? null}
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
}: AiMessageBubbleProps) {
  if (message.role === "system") {
    const isSuccess = message.content.includes("成功") || message.content.includes("已");
    return (
      <div
        className="flex justify-center px-4 py-1"
        data-testid={`ai-message-${message.id}`}
      >
        <span
          className={cn(
            "text-xs px-3 py-1 rounded-full",
            isSuccess
              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
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
        className="flex justify-end px-4 py-1"
        data-testid={`ai-message-${message.id}`}
      >
        <div
          className={cn(
            "max-w-[80%] px-4 py-2.5 text-sm",
            "bg-gradient-to-br from-blue-500 to-indigo-600 text-white",
            "rounded-2xl rounded-br-sm",
            "whitespace-pre-wrap break-words"
          )}
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
        className="flex justify-start px-4 py-1"
        data-testid={`ai-message-${message.id}`}
      >
        <div className="max-w-[90%]">
          <AiConfirmCard
            action={message.action}
            onConfirm={() => onConfirm(message.id)}
            onReject={() => onReject(message.id)}
            confirmed={message.confirmed ?? null}
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
      />
    );
  }

  return (
    <div
      className="flex justify-start px-4 py-1"
      data-testid={`ai-message-${message.id}`}
    >
      <div
        className={cn(
          "max-w-[80%] px-4 py-2.5 text-sm",
          "bg-muted text-foreground",
          "rounded-2xl rounded-bl-sm",
          "whitespace-pre-wrap break-words"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
