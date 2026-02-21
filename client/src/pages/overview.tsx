import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { User } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, AlertTriangle, Clock, CheckCircle, TrendingUp, ArrowLeft } from "lucide-react";

interface OverviewStats {
  totalTasks: number;
  doneTasks: number;
  dueTodayTasks: number;
  overdueTasks: number;
  doneYesterday: number;
}

interface PhaseProgress {
  id: string;
  label: string;
  color: string;
  total: number;
  done: number;
  pct: number;
}

interface RiskTask {
  id: string;
  title: string;
  deadline: string;
  overdueDays: number;
  assignees: Array<{ id: string; name: string; color: string }>;
}

interface RecentLog {
  id: number;
  task_id: string;
  user_id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

interface OverviewData {
  stats: OverviewStats;
  phaseProgress: PhaseProgress[];
  riskTasks: RiskTask[];
  recentLogs: RecentLog[];
}

const ACTION_LABELS: Record<string, string> = {
  status_change: "状态变更",
  urge: "催办",
  sync: "JSON同步",
  comment: "评论",
  auto_unblock: "自动解锁",
};

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export default function Overview() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) {
    setLocation("/");
    return null;
  }

  if (user.role !== "ceo" && user.role !== "admin") {
    setLocation("/dashboard");
    return null;
  }

  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: ["/api/overview"],
  });

  const { data: usersData } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const usersMap: Record<string, User> = {};
  if (usersData) {
    for (const u of usersData) {
      usersMap[u.id] = u;
    }
  }

  const stats = data?.stats;
  const phaseProgress = data?.phaseProgress ?? [];
  const riskTasks = [...(data?.riskTasks ?? [])].sort((a, b) => b.overdueDays - a.overdueDays);
  const recentLogs = data?.recentLogs ?? [];

  const completionPct = stats && stats.totalTasks > 0
    ? Math.round((stats.doneTasks / stats.totalTasks) * 100)
    : 0;

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="page-overview">
      <header
        className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-3 border-b bg-background"
        data-testid="header-overview"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setLocation("/dashboard")}
            data-testid="button-back"
          >
            <ArrowLeft />
          </Button>
          <h1 className="text-lg font-bold tracking-tight" data-testid="text-page-title">全局概览</h1>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          {isLoading ? (
            <LoadingSkeleton />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="stats-row">
                <Card className="p-4" data-testid="card-stat-total">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">任务总数 / 已完成</span>
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold" data-testid="text-total-tasks">
                      {stats?.totalTasks ?? 0}
                    </span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-done-tasks">
                      {stats?.doneTasks ?? 0}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground" data-testid="text-completion-pct">
                    完成率 {completionPct}%
                  </span>
                </Card>

                <Card className="p-4" data-testid="card-stat-due-today">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">今日到期</span>
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold" data-testid="text-due-today">
                      {stats?.dueTodayTasks ?? 0}
                    </span>
                  </div>
                </Card>

                <Card
                  className={cn("p-4", stats && stats.overdueTasks > 0 && "border-red-500 dark:border-red-400")}
                  data-testid="card-stat-overdue"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">逾期任务</span>
                    <AlertTriangle className={cn("w-4 h-4", stats && stats.overdueTasks > 0 ? "text-red-500" : "text-muted-foreground")} />
                  </div>
                  <div className="mt-2">
                    <span
                      className={cn("text-2xl font-bold", stats && stats.overdueTasks > 0 && "text-red-600 dark:text-red-400")}
                      data-testid="text-overdue"
                    >
                      {stats?.overdueTasks ?? 0}
                    </span>
                  </div>
                </Card>

                <Card className="p-4" data-testid="card-stat-done-yesterday">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">昨日完成</span>
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold" data-testid="text-done-yesterday">
                      {stats?.doneYesterday ?? 0}
                    </span>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="p-4" data-testid="card-phase-progress">
                  <h2 className="text-sm font-semibold mb-4" data-testid="text-phase-title">阶段进度</h2>
                  <div className="space-y-3">
                    {phaseProgress.map((phase) => (
                      <div key={phase.id} data-testid={`phase-row-${phase.id}`}>
                        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                          <span className="text-sm">{phase.label}</span>
                          <span className="text-xs text-muted-foreground" data-testid={`text-phase-count-${phase.id}`}>
                            {phase.done}/{phase.total}
                          </span>
                        </div>
                        <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${phase.pct}%`,
                              backgroundColor: phase.color,
                            }}
                            data-testid={`progress-bar-${phase.id}`}
                          />
                        </div>
                      </div>
                    ))}
                    {phaseProgress.length === 0 && (
                      <p className="text-sm text-muted-foreground">暂无阶段数据</p>
                    )}
                  </div>
                </Card>

                <Card className="p-4" data-testid="card-risk-board">
                  <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 flex-wrap" data-testid="text-risk-title">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    逾期预警
                  </h2>
                  <ScrollArea className="max-h-64">
                    <div className="space-y-2">
                      {riskTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start justify-between gap-3 p-2 rounded-md bg-muted/50"
                          data-testid={`risk-task-${task.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" data-testid={`text-risk-title-${task.id}`}>
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {task.assignees.map((a) => (
                                <div key={a.id} className="flex items-center gap-1">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: a.color ?? "#888" }}
                                  />
                                  <span className="text-xs text-muted-foreground">{a.name}</span>
                                </div>
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground mt-1 block" data-testid={`text-deadline-${task.id}`}>
                              截止: {task.deadline}
                            </span>
                          </div>
                          <Badge
                            variant="secondary"
                            className="no-default-active-elevate bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 shrink-0"
                            data-testid={`badge-overdue-${task.id}`}
                          >
                            逾期{task.overdueDays}天
                          </Badge>
                        </div>
                      ))}
                      {riskTasks.length === 0 && (
                        <div className="flex items-center justify-center py-6">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm text-muted-foreground">无逾期任务</span>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </Card>
              </div>

              <Card className="p-4" data-testid="card-recent-activity">
                <h2 className="text-sm font-semibold mb-4" data-testid="text-activity-title">最近动态</h2>
                <div className="space-y-3">
                  {recentLogs.map((log) => {
                    const logUser = usersMap[log.user_id];
                    const actionLabel = ACTION_LABELS[log.action] ?? log.action;
                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-2 text-sm"
                        data-testid={`log-entry-${log.id}`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium" data-testid={`text-log-user-${log.id}`}>
                              {logUser?.name ?? log.user_id}
                            </span>
                            <span className="text-muted-foreground">{actionLabel}</span>
                            {log.action === "status_change" && log.old_value && log.new_value && (
                              <span className="text-muted-foreground" data-testid={`text-log-change-${log.id}`}>
                                {log.old_value} → {log.new_value}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground" data-testid={`text-log-task-${log.id}`}>
                            任务: {log.task_id}
                          </span>
                          {log.created_at && (
                            <span className="text-xs text-muted-foreground ml-2" data-testid={`text-log-time-${log.id}`}>
                              {new Date(log.created_at).toLocaleString("zh-CN")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {recentLogs.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无动态</p>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
