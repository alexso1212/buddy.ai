import { useState } from "react";
import type { User } from "@shared/schema";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface Participant {
  id: number;
  taskId: number;
  userId: number;
  role: string;
  user: User | null;
}

interface ParticipantAvatarsProps {
  participants: Participant[];
  maxDisplay?: number;
  size?: "sm" | "md";
}

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-pink-500",
  "bg-amber-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500",
];

function getAvatarColor(userId: number): string {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}

const ROLE_LABELS: Record<string, string> = {
  participant: "参与人",
  reviewer: "审核人",
  observer: "观察者",
};

export default function ParticipantAvatars({ participants, maxDisplay = 3, size = "sm" }: ParticipantAvatarsProps) {
  const [expanded, setExpanded] = useState(false);

  if (!participants || participants.length === 0) return null;

  const displayed = participants.slice(0, maxDisplay);
  const remaining = participants.length - maxDisplay;
  const sizeClasses = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";
  const overlapMargin = size === "sm" ? "-ml-1.5" : "-ml-2";

  return (
    <div className="relative" data-testid="participant-avatars">
      <div
        className="flex items-center cursor-pointer"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        data-testid="participant-avatars-toggle"
      >
        {displayed.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              "rounded-full flex items-center justify-center text-white font-medium border-2 border-card",
              sizeClasses,
              getAvatarColor(p.userId),
              i > 0 && overlapMargin
            )}
            title={p.user?.displayName || `User ${p.userId}`}
            data-testid={`participant-avatar-${p.userId}`}
          >
            {p.user?.avatarUrl ? (
              <img src={p.user.avatarUrl} alt={p.user.displayName} className="w-full h-full rounded-full object-cover" />
            ) : (
              getInitials(p.user?.displayName || "?")
            )}
          </div>
        ))}
        {remaining > 0 && (
          <div
            className={cn(
              "rounded-full flex items-center justify-center text-muted-foreground font-medium border-2 border-card bg-muted",
              sizeClasses,
              overlapMargin
            )}
            data-testid="participant-avatar-more"
          >
            +{remaining}
          </div>
        )}
      </div>

      {expanded && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setExpanded(false); }} />
          <div
            className="absolute z-50 top-full left-0 mt-1 bg-card rounded-lg shadow-lg border border-border p-3 min-w-[200px]"
            onClick={(e) => e.stopPropagation()}
            data-testid="participant-list-popup"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">相关人员 ({participants.length})</span>
              <button onClick={(e) => { e.stopPropagation(); setExpanded(false); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2" data-testid={`participant-detail-${p.userId}`}>
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium", getAvatarColor(p.userId))}>
                    {getInitials(p.user?.displayName || "?")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{p.user?.displayName || `User ${p.userId}`}</div>
                    <div className="text-xs text-muted-foreground">{ROLE_LABELS[p.role] || p.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
