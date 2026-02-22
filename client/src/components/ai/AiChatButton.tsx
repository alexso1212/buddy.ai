import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiChatButtonProps {
  onClick: () => void;
}

export default function AiChatButton({ onClick }: AiChatButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed right-6 bottom-6 z-50 w-14 h-14 rounded-full",
        "bg-gradient-to-br from-blue-500 to-indigo-600",
        "flex items-center justify-center",
        "text-white shadow-lg",
        "hover:scale-110 active:scale-95",
        "transition-transform duration-200"
      )}
      data-testid="ai-chat-button"
    >
      <MessageSquare className="w-6 h-6" />
    </button>
  );
}
