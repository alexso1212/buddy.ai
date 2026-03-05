import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertTriangle, CheckCircle, Star, Sparkles, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SwipeableTaskCard from "@/components/SwipeableTaskCard";
import { apiRequest } from "@/lib/queryClient";
import type { Task, Project, User } from "@shared/schema";

type TaskWithParticipants = Task & {
  participants?: Array<{
    id: number;
    taskId: number;
    userId: number;
    role: string;
    user: User | null;
  }>;
};

interface StatsOverview {
  totalTasks: number;
  inProgressCount: number;
  completedCount: number;
  overdueCount: number;
  needsReviewCount: number;
  todayNew: number;
  weekNew: number;
  monthNew: number;
}

type AttentionReason = "overdue" | "due-soon" | "needs-review";

interface AttentionTask {
  task: TaskWithParticipants;
  reasons: AttentionReason[];
}

function DailyBriefing() {
  const queryClient = useQueryClient();

  const { data: briefingResponse, isLoading } = useQuery<{ data: { content: string; isNew: boolean; date: string } }>({
    queryKey: ['/api/briefing/today'],
    staleTime: 5 * 60 * 1000,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/briefing/refresh');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/briefing/today'] });
    },
  });

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow-sm p-4 md:p-6 mb-6" data-testid="briefing-loading">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span className="text-sm">正在生成今日简报...</span>
        </div>
      </div>
    );
  }

  const briefing = briefingResponse?.data;
  if (!briefing?.content) return null;

  return (
    <div className="bg-card rounded-lg shadow-sm p-4 md:p-6 mb-6" data-testid="briefing-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-foreground text-sm md:text-base" data-testid="briefing-title">今日简报</span>
          {briefing.isNew && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">NEW</span>
          )}
        </div>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          data-testid="button-refresh-briefing"
        >
          <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-0 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:text-sm [&_p]:my-1 [&_li]:text-sm [&_li]:my-0.5 [&_hr]:my-2 [&_em]:text-xs [&_em]:text-muted-foreground" data-testid="briefing-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing.content}</ReactMarkdown>
      </div>
    </div>
  );
}

function Dashboard() {
  const [, navigate] = useLocation();

  const { data: tasksResponse, isLoading: tasksLoading } = useQuery<{ data: TaskWithParticipants[] }>({
    queryKey: ["/api/tasks"],
  });

  const { data: projectsResponse, isLoading: projectsLoading } = useQuery<{ data: Project[] }>({
    queryKey: ["/api/projects"],
  });

  const { data: statsResponse, isLoading: statsLoading } = useQuery<{ data: StatsOverview }>({
    queryKey: ["/api/stats/overview"],
  });

  const tasks = tasksResponse?.data ?? [];
  const projects = projectsResponse?.data ?? [];
  const stats = statsResponse?.data ?? {
    totalTasks: 0,
    inProgressCount: 0,
    completedCount: 0,
    overdueCount: 0,
    needsReviewCount: 0,
    todayNew: 0,
    weekNew: 0,
    monthNew: 0,
  };

  const isLoading = tasksLoading || projectsLoading || statsLoading;

  const getProjectName = (projectId: number) => {
    const project = projects.find((p) => p.id === projectId);
    return project?.name ?? "未知项目";
  };

  const formatDate = (dateVal: Date | string | null) => {
    if (!dateVal) return "";
    const date = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
    return date.toISOString().split("T")[0];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "todo":
        return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
      case "in_progress":
        return "bg-yellow-200 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300";
      case "in_review":
        return "bg-blue-200 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300";
      case "done":
        return "bg-green-200 text-green-700 dark:bg-green-900/50 dark:text-green-300";
      case "cancelled":
        return "bg-gray-400 text-gray-800 dark:bg-gray-600 dark:text-gray-200";
      default:
        return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "todo":
        return "待办";
      case "in_progress":
        return "进行中";
      case "in_review":
        return "审核中";
      case "done":
        return "已完成";
      case "cancelled":
        return "已取消";
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300";
      case "high":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300";
      case "medium":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300";
      case "low":
        return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "紧急";
      case "high":
        return "高";
      case "medium":
        return "中";
      case "low":
        return "低";
      default:
        return priority;
    }
  };

  const getAttentionTasks = (): AttentionTask[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    const result: AttentionTask[] = [];

    for (const task of tasks) {
      const reasons: AttentionReason[] = [];
      const isActive = task.status !== "done" && task.status !== "cancelled";

      if (isActive && task.dueDate) {
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate < today) {
          reasons.push("overdue");
        } else if (dueDate >= today && dueDate < dayAfterTomorrow) {
          reasons.push("due-soon");
        }
      }

      if (task.needsReview) {
        reasons.push("needs-review");
      }

      if (reasons.length > 0) {
        result.push({ task, reasons });
      }
    }

    result.sort((a, b) => {
      const aDate = a.task.dueDate ? new Date(a.task.dueDate).getTime() : Infinity;
      const bDate = b.task.dueDate ? new Date(b.task.dueDate).getTime() : Infinity;
      return aDate - bDate;
    });

    return result;
  };

  const attentionTasks = isLoading ? [] : getAttentionTasks();

  const getRowIndicatorColor = (reasons: AttentionReason[]) => {
    if (reasons.includes("overdue")) return "bg-red-500";
    if (reasons.includes("due-soon")) return "bg-orange-500";
    return "bg-amber-500";
  };

  const renderReasonTags = (reasons: AttentionReason[]) => (
    <div className="flex flex-wrap gap-1">
      {reasons.includes("overdue") && (
        <span
          data-testid="attention-tag-overdue"
          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
        >
          逾期
        </span>
      )}
      {reasons.includes("due-soon") && (
        <span
          data-testid="attention-tag-due-soon"
          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
        >
          即将到期
        </span>
      )}
      {reasons.includes("needs-review") && (
        <span
          data-testid="attention-tag-needs-review"
          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
        >
          <AlertTriangle className="w-3 h-3 inline-block mr-0.5 -mt-0.5" />
          待补充
        </span>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <h1 className="text-xl md:text-2xl font-bold text-foreground mb-6 md:mb-8">仪表盘</h1>

      <DailyBriefing />

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-8">
        <div className="bg-card rounded-lg shadow-sm p-3 md:p-6" data-testid="stat-total">
          <div className="text-muted-foreground text-xs md:text-sm font-medium truncate">总任务数</div>
          <div className="text-lg md:text-3xl font-bold text-foreground mt-1 md:mt-2">{stats.totalTasks}</div>
        </div>

        <div className="bg-card rounded-lg shadow-sm p-3 md:p-6" data-testid="stat-in-progress">
          <div className="text-muted-foreground text-xs md:text-sm font-medium truncate">进行中</div>
          <div className="text-lg md:text-3xl font-bold text-yellow-600 mt-1 md:mt-2">{stats.inProgressCount}</div>
        </div>

        <div className="bg-card rounded-lg shadow-sm p-3 md:p-6" data-testid="stat-completed">
          <div className="text-muted-foreground text-xs md:text-sm font-medium truncate">已完成</div>
          <div className="text-lg md:text-3xl font-bold text-green-600 mt-1 md:mt-2">{stats.completedCount}</div>
        </div>

        <div className="bg-card rounded-lg shadow-sm p-3 md:p-6" data-testid="stat-overdue">
          <div className="text-muted-foreground text-xs md:text-sm font-medium truncate">逾期</div>
          <div className="text-lg md:text-3xl font-bold text-red-600 mt-1 md:mt-2">{stats.overdueCount}</div>
        </div>

        <div className="bg-card rounded-lg shadow-sm p-3 md:p-6" data-testid="stat-needs-review">
          <div className="text-muted-foreground text-xs md:text-sm font-medium truncate">待补充</div>
          <div className="text-lg md:text-3xl font-bold text-amber-600 mt-1 md:mt-2">{stats.needsReviewCount}</div>
        </div>
      </div>

      {/* Time-based Stats Row */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8">
        <div className="bg-card rounded-lg shadow-sm p-3 md:p-6" data-testid="stat-today-new">
          <div className="text-muted-foreground text-xs md:text-sm font-medium truncate">今日新增</div>
          <div className="text-lg md:text-3xl font-bold text-blue-600 mt-1 md:mt-2">{stats.todayNew}</div>
        </div>
        <div className="bg-card rounded-lg shadow-sm p-3 md:p-6" data-testid="stat-week-new">
          <div className="text-muted-foreground text-xs md:text-sm font-medium truncate">本周新增</div>
          <div className="text-lg md:text-3xl font-bold text-indigo-600 mt-1 md:mt-2">{stats.weekNew}</div>
        </div>
        <div className="bg-card rounded-lg shadow-sm p-3 md:p-6" data-testid="stat-month-new">
          <div className="text-muted-foreground text-xs md:text-sm font-medium truncate">本月新增</div>
          <div className="text-lg md:text-3xl font-bold text-purple-600 mt-1 md:mt-2">{stats.monthNew}</div>
        </div>
      </div>

      {/* Needs Attention Section */}
      <div className="bg-card rounded-lg shadow-sm overflow-hidden" data-testid="attention-section">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">需要关注</h2>
        </div>

        {attentionTasks.length === 0 ? (
          <div className="px-6 py-8 text-center text-muted-foreground flex items-center justify-center gap-2" data-testid="attention-empty">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span>一切正常，没有需要紧急处理的事项</span>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="attention-table">
                  <thead>
                    <tr className="border-b border-border bg-muted">
                      <th className="w-1 px-0" />
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        标题
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        项目
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        优先级
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        截止日期
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        原因
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {attentionTasks.map(({ task, reasons }) => (
                      <tr
                        key={task.id}
                        data-testid={`attention-task-${task.id}`}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        className="hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <td className="w-1 px-0">
                          <div className={`w-1 h-full min-h-[48px] ${getRowIndicatorColor(reasons)}`} />
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground max-w-[200px]">
                          <span className="block truncate">{task.title}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground max-w-[120px]">
                          <span className="block truncate">{getProjectName(task.projectId)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                            {getStatusLabel(task.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {task.priority ? (
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                              {getPriorityLabel(task.priority)}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {task.dueDate ? formatDate(task.dueDate) : "—"}
                        </td>
                        <td className="px-6 py-4">
                          {renderReasonTags(reasons)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden">
              {attentionTasks.map(({ task, reasons }) => (
                <SwipeableTaskCard
                  key={task.id}
                  taskId={task.id}
                  taskTitle={task.title}
                  taskStatus={task.status}
                  taskPriority={task.priority}
                  taskStarred={task.starred ?? false}
                  onNavigate={() => navigate(`/tasks/${task.id}`)}
                >
                  <div
                    className="flex"
                    data-testid={`attention-task-${task.id}`}
                  >
                    <div className={`w-1 flex-shrink-0 ${getRowIndicatorColor(reasons)}`} />
                    <div className="flex-1 p-4">
                      <div className="text-sm font-medium text-foreground mb-1 flex items-center gap-1 min-w-0">
                        {task.starred && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />}
                        <span className="truncate line-clamp-1">{task.title}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3 truncate min-w-0">
                        {getProjectName(task.projectId)}
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                          {getStatusLabel(task.status)}
                        </span>
                        {task.priority && (
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                            {getPriorityLabel(task.priority)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {task.dueDate && (
                          <div className="text-xs text-muted-foreground">
                            截止: {formatDate(task.dueDate)}
                          </div>
                        )}
                        {renderReasonTags(reasons)}
                      </div>
                    </div>
                  </div>
                </SwipeableTaskCard>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
