import { type ReactNode, useCallback } from "react";
import {
  useExternalStoreRuntime,
  AssistantRuntimeProvider,
  type ThreadMessageLike,
  type AppendMessage,
} from "@assistant-ui/react";

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
  creationType?: "task" | "project";
  partialData: Record<string, any>;
  steps?: any[];
  currentStep?: number;
  questions?: any[];
}

export interface BuddyMessage {
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
  searchResults?: {
    title: string;
    url: string;
    content: string;
  }[];
  codeFiles?: string[];
  codeFilesFailed?: string[];
  attachments?: {
    type: string;
    name: string;
    mimeType: string;
    base64: string;
    previewUrl?: string;
  }[];
  thinking?: string;
  isThinking?: boolean;
  thinkingDuration?: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  retryPayload?: { text: string; attachments?: any[] };
  errorType?:
    | "network"
    | "timeout"
    | "rate_limit"
    | "context_too_long"
    | "service_unavailable"
    | "stream_interrupted"
    | "unknown";
  timestamp?: number;
  toolCalls?: {
    toolName: string;
    label: string;
    status: "running" | "complete" | "error";
    detail?: string;
    type?: string;
    completedLabel?: string;
  }[];
  retryCount?: number;
  cooldownUntil?: number;
  partialContent?: string;
}

function convertMessage(msg: BuddyMessage): ThreadMessageLike {
  const contentParts: Array<{ type: "text"; text: string }> = [];

  if (msg.content) {
    contentParts.push({ type: "text", text: msg.content });
  }

  if (msg.role === "assistant" && contentParts.length === 0) {
    contentParts.push({ type: "text", text: "" });
  }

  return {
    id: msg.id,
    role: msg.role === "system" ? "assistant" : msg.role,
    content: contentParts,
    createdAt: msg.timestamp ? new Date(msg.timestamp) : undefined,
    status: msg.isStreaming
      ? { type: "running" as const }
      : msg.errorType
        ? {
            type: "incomplete" as const,
            reason: "error" as const,
            error: msg.errorType,
          }
        : { type: "complete" as const, reason: "stop" as const },
    metadata: {
      custom: {
        buddyMessage: msg,
      },
    },
  };
}

interface BuddyRuntimeProviderProps {
  messages: BuddyMessage[];
  isRunning: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
  children: ReactNode;
}

export function BuddyRuntimeProvider({
  messages,
  isRunning,
  onSend,
  onCancel,
  children,
}: BuddyRuntimeProviderProps) {
  const onNew = useCallback(
    async (message: AppendMessage) => {
      const textPart = message.content.find((p) => p.type === "text");
      if (textPart && "text" in textPart) {
        onSend(textPart.text);
      }
    },
    [onSend],
  );

  const handleCancel = useCallback(async () => {
    onCancel();
  }, [onCancel]);

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    convertMessage,
    onNew,
    onCancel: handleCancel,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}

