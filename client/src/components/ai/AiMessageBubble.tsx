import { cn } from "@/lib/utils";
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
              ? "bg-emerald-50 text-emerald-600"
              : "bg-red-50 text-red-500"
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
    return (
      <div
        className="flex flex-col justify-start px-4 py-1 space-y-2"
        data-testid={`ai-message-${message.id}`}
      >
        {message.actions.map((action, index) => (
          <div key={index} className="max-w-[90%]">
            <AiConfirmCard
              action={action}
              onConfirm={() => onConfirm(message.id, index)}
              onReject={() => onReject(message.id, index)}
              confirmed={message.actionConfirmed?.[index] ?? null}
              index={index}
            />
          </div>
        ))}
      </div>
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
          "bg-gray-100 text-gray-800",
          "rounded-2xl rounded-bl-sm",
          "whitespace-pre-wrap break-words"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
