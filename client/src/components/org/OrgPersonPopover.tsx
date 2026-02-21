import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Lock, AlertTriangle } from "lucide-react";
import type { SafeUser, UserStatsMap } from "./types";
import { getCompletionLevel, getCompletionColor, getCompletionRate, getWorkloadLevel } from "./types";

const WORKLOAD_LABELS: Record<string, { label: string; color: string }> = {
  overloaded: { label: "过载", color: "text-red-500" },
  heavy: { label: "较重", color: "text-orange-500" },
  normal: { label: "正常", color: "text-foreground" },
  light: { label: "空闲", color: "text-muted-foreground" },
};

export function OrgPersonPopover({ person, userStats, isCeoOrAdmin, onEditUser }: {
  person: SafeUser;
  userStats: UserStatsMap;
  isCeoOrAdmin: boolean;
  onEditUser: (u: SafeUser) => void;
}) {
  const [, navigate] = useLocation();
  const stats = userStats[person.id];
  const total = stats?.total ?? 0;
  const done = stats?.done ?? 0;
  const active = stats?.active ?? 0;
  const overdue = stats?.overdue ?? 0;
  const blocked = stats?.blocked ?? 0;
  const urged = stats?.urged ?? 0;
  const rate = getCompletionRate(total, done);
  const level = getCompletionLevel(total, done);
  const color = getCompletionColor(level);
  const workload = getWorkloadLevel(active);
  const wl = WORKLOAD_LABELS[workload];

  return (
    <div className="p-3 space-y-3" data-testid={`person-popover-${person.id}`}>
      <div>
        <p className="text-sm font-medium">{person.name}</p>
        <p className="text-xs text-muted-foreground">{person.title || "无职位"} · {person.dept || ""}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">活跃任务</span>
          <span className="font-medium">{active}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">已完成</span>
          <span className="font-medium">{done}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">完成率</span>
          <span className="font-medium" style={{ color }}>{rate}%</span>
        </div>
        {overdue > 0 && (
          <div className="flex justify-between">
            <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />逾期</span>
            <span className="font-medium text-red-500">{overdue}</span>
          </div>
        )}
        {blocked > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" />被阻塞</span>
            <span className="font-medium">{blocked}</span>
          </div>
        )}
        {urged > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">被催办</span>
            <span className="font-medium">{urged}次</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">负荷:</span>
        <span className={`font-medium ${wl.color}`}>{wl.label}</span>
      </div>

      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${rate}%`, backgroundColor: color }} />
      </div>

      <div className="flex items-center gap-2 pt-1 border-t">
        <Button
          variant="outline"
          size="sm"
          className="text-xs flex-1"
          onClick={() => navigate("/dashboard")}
          data-testid={`person-tasks-link-${person.id}`}
        >
          查看任务
        </Button>
        {isCeoOrAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs flex-1"
            onClick={() => navigate("/evaluation")}
            data-testid={`person-eval-link-${person.id}`}
          >
            查看考核
          </Button>
        )}
        {isCeoOrAdmin && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => onEditUser(person)}
            data-testid={`person-edit-btn-${person.id}`}
          >
            编辑
          </Button>
        )}
      </div>
    </div>
  );
}
