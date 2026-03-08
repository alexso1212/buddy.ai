import { type ReactNode, useCallback, createContext, useContext } from "react";
import {
  useExternalStoreRuntime,
  AssistantRuntimeProvider,
  type ThreadMessageLike,
  type AppendMessage,
  useMessage,
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
  type?: "text" | "confirm" | "multi_confirm" | "follow_up" | "decision_request";
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
  inlineWidget?: {
    type: "single_select" | "multi_select" | "rank_priorities";
    question: string;
    options: { label: string; value: string; description?: string }[];
  };
  document?: {
    title: string;
    fileName: string;
    downloadUrl: string;
  };
}

export interface BuddyCallbacks {
  onConfirm?: (messageId: string, actionIndex?: number) => void;
  onReject?: (messageId: string, actionIndex?: number) => void;
  onSkip?: (messageId: string, actionIndex?: number) => void;
  onConfirmAll?: (messageId: string) => void;
  onFollowUpSubmit?: (messageId: string, mergedData: Record<string, any>, creationType?: string) => void;
  onStepAnswer?: (stepLabel: string, answerLabel: string) => void;
  onRegenerate?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRetry?: (messageId: string) => void;
  onContinueGeneration?: (messageId: string) => void;
  onNewConversation?: () => void;
  onTrimAndRetry?: (messageId: string) => void;
  onOpenArtifact?: (content: string, title: string) => void;
  onWidgetSubmit?: (summary: string) => void;
}

const CallbacksContext = createContext<BuddyCallbacks>({});
const IsLastAssistantContext = createContext<(msgId: string) => boolean>(() => false);

export function useBuddyCallbacks(): BuddyCallbacks {
  return useContext(CallbacksContext);
}

export function useIsLastAssistant(msgId: string): boolean {
  const check = useContext(IsLastAssistantContext);
  return check(msgId);
}

export function useBuddyMessageData(): BuddyMessage | undefined {
  try {
    const buddyMsg = useMessage((s) => (s.metadata as any)?.custom?.buddyMessage);
    return buddyMsg as BuddyMessage | undefined;
  } catch {
    return undefined;
  }
}

function convertMessage(msg: BuddyMessage): ThreadMessageLike {
  const contentParts: Array<{ type: "text"; text: string }> = [];

  if (msg.content) {
    contentParts.push({ type: "text", text: msg.content });
  }

  if (msg.role === "assistant" && contentParts.length === 0) {
    contentParts.push({ type: "text", text: "" });
  }

  const mappedRole = msg.role === "system" ? "assistant" : msg.role;

  const assistantStatus = msg.isStreaming
    ? { type: "running" as const }
    : msg.errorType
      ? {
          type: "incomplete" as const,
          reason: "error" as const,
          error: msg.errorType,
        }
      : { type: "complete" as const, reason: "stop" as const };

  return {
    id: msg.id,
    role: mappedRole,
    content: contentParts,
    createdAt: msg.timestamp ? new Date(msg.timestamp) : undefined,
    ...(mappedRole === "assistant" ? { status: assistantStatus } : {}),
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
  callbacks: BuddyCallbacks;
  children: ReactNode;
}

export function BuddyRuntimeProvider({
  messages,
  isRunning,
  onSend,
  onCancel,
  callbacks,
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

  const checkIsLastAssistant = useCallback(
    (msgId: string) => {
      const lastIdx = messages.reduce(
        (acc, m, i) => (m.role === "assistant" && !m.isStreaming ? i : acc),
        -1,
      );
      if (lastIdx === -1) return false;
      return messages[lastIdx].id === msgId;
    },
    [messages],
  );

  return (
    <CallbacksContext.Provider value={callbacks}>
      <IsLastAssistantContext.Provider value={checkIsLastAssistant}>
        <AssistantRuntimeProvider runtime={runtime}>
          {children}
        </AssistantRuntimeProvider>
      </IsLastAssistantContext.Provider>
    </CallbacksContext.Provider>
  );
}
