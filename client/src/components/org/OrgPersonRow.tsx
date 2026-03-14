import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { OrgPersonPopover } from "./OrgPersonPopover";
import type { SafeUser, UserStatsMap, CompletionLevel } from "./types";
import { getCompletionLevel, getCompletionColor, getCompletionRate } from "./types";

export function OrgPersonRow({ person, isHead, userStats, isCeoOrAdmin, onEditUser }: {
  person: SafeUser;
  isHead: boolean;
  userStats: UserStatsMap;
  isCeoOrAdmin: boolean;
  onEditUser: (u: SafeUser) => void;
}) {
  const stats = userStats[person.id];
  const total = stats?.total ?? 0;
  const done = stats?.done ?? 0;
  const active = stats?.active ?? 0;
  const overdue = stats?.overdue ?? 0;
  const level: CompletionLevel = getCompletionLevel(total, done);
  const color = getCompletionColor(level);
  const rate = getCompletionRate(total, done);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className="flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-all duration-200 group"
          data-testid={`person-row-${person.id}`}
        >
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 border-2"
            style={{ borderColor: color, backgroundColor: total === 0 ? "transparent" : color }}
          />
          <span className="text-[13px] font-medium flex-1 min-w-0 truncate">{person.displayName}</span>
          {total > 0 ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-muted-foreground">{active}任务</span>
              {overdue > 0 && <span className="text-[11px] text-red-500">{overdue}逾期</span>}
              <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${rate}%`, backgroundColor: color }} />
              </div>
              <span className="text-[10px] text-muted-foreground w-7 text-right">{rate}%</span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">空闲</span>
          )}
          {isHead && <Badge variant="secondary" className="rounded-full text-[10px] font-medium border-0 px-1.5">负责人</Badge>}
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <OrgPersonPopover person={person} userStats={userStats} isCeoOrAdmin={isCeoOrAdmin} onEditUser={onEditUser} />
      </PopoverContent>
    </Popover>
  );
}
