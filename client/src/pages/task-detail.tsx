import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Task, TaskDependency, TaskComment, User, Project, ActivityLog } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Pencil, Trash2, MessageSquare, GitBranch, ListTree, Activity, Scale, Check, X as XIcon, Loader2 } from "lucide-react";

interface TaskDetailResponse {
  data: Task & { subtasks: Task[]; dependencies: TaskDependency[]; comments: TaskComment[] };
}

interface UsersResponse {
  data: User[];
}

interface ProjectsResponse {
  data: Project[];
}

interface AllTasksResponse {
  data: Task[];
}

interface ActivityLogsResponse {
  data: ActivityLog[];
}

function getStatusColor(status: string): string {
  switch (status) {
    case "todo": return "bg-gray-200 text-gray-700";
    case "in_progress": return "bg-yellow-200 text-yellow-700";
    case "in_review": return "bg-blue-200 text-blue-700";
    case "done": return "bg-green-200 text-green-700";
    case "cancelled": return "bg-gray-400 text-gray-800";
    default: return "bg-gray-200 text-gray-700";
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "urgent": return "bg-red-100 text-red-700";
    case "high": return "bg-orange-100 text-orange-700";
    case "medium": return "bg-blue-100 text-blue-700";
    case "low": return "bg-gray-100 text-gray-600";
    default: return "bg-gray-100 text-gray-600";
  }
}

function getPriorityLabel(priority: string): string {
  switch (priority) {
    case "urgent": return "紧急";
    case "high": return "高";
    case "medium": return "中";
    case "low": return "低";
    default: return priority;
  }
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const VERDICT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  in_scope:     { bg: 'bg-green-100', text: 'text-green-800', label: '份内职责' },
  stretch:      { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '延伸职责' },
  out_of_scope: { bg: 'bg-red-100', text: 'text-red-800', label: '分外工作' },
  shared:       { bg: 'bg-blue-100', text: 'text-blue-800', label: '跨部门协作' },
};

interface VerdictData {
  id: number;
  verdict: string;
  confidence: number;
  reasoning: string;
  matchedResponsibilities: string[];
  suggestedAssignee?: { id: number; name: string; reason: string };
}

function VerdictCard({ verdict, onAccept, onOverride }: {
  verdict: VerdictData;
  onAccept: () => void;
  onOverride: (reason: string) => void;
}) {
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const colors = VERDICT_COLORS[verdict.verdict] || VERDICT_COLORS.shared;

  return (
    <Card className="p-5 space-y-4" data-testid="verdict-card">
      <div className="flex items-center gap-2">
        <Scale className="h-5 w-5 text-gray-500" />
        <h3 className="font-semibold">权责判定结果</h3>
      </div>

      <div className="flex items-center gap-3">
        <Badge className={`${colors.bg} ${colors.text}`} data-testid="verdict-badge">
          {colors.label}
        </Badge>
        <span className="text-sm text-muted-foreground" data-testid="verdict-confidence">
          置信度: {verdict.confidence}%
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">判定理由:</p>
        <p className="text-sm" data-testid="verdict-reasoning">{verdict.reasoning}</p>
      </div>

      {verdict.matchedResponsibilities.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">匹配的职责条目:</p>
          <div className="space-y-1">
            {verdict.matchedResponsibilities.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 text-sm text-green-700">
                <Check className="h-3.5 w-3.5" />
                {r}
              </div>
            ))}
          </div>
        </div>
      )}

      {verdict.suggestedAssignee && (
        <div className="p-3 rounded-md bg-amber-50 border border-amber-200 space-y-1">
          <p className="text-sm font-medium text-amber-800">更合适的人选:</p>
          <p className="text-sm text-amber-700">
            → {verdict.suggestedAssignee.name}
          </p>
          <p className="text-xs text-amber-600">{verdict.suggestedAssignee.reason}</p>
        </div>
      )}

      {!overrideMode ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onAccept} data-testid="btn-accept-verdict">
            <Check className="h-3.5 w-3.5 mr-1" />
            接受判定
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOverrideMode(true)} data-testid="btn-override-verdict">
            推翻判定
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea
            placeholder="请填写推翻理由..."
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            data-testid="input-override-reason"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!overrideReason.trim()}
              onClick={() => {
                onOverride(overrideReason.trim());
                setOverrideMode(false);
                setOverrideReason("");
              }}
              data-testid="btn-submit-override"
            >
              确认推翻
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOverrideMode(false)}>
              取消
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function TaskDetail() {
  const [, params] = useRoute('/tasks/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const id = params?.id;

  const [editOpen, setEditOpen] = useState(false);
  const [subtaskOpen, setSubtaskOpen] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [depOpen, setDepOpen] = useState(false);
  const [depTaskId, setDepTaskId] = useState("");
  const [commentText, setCommentText] = useState("");
  const [verdictData, setVerdictData] = useState<VerdictData | null>(null);
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [verdictAccepted, setVerdictAccepted] = useState<boolean | null>(null);

  const { data: taskRes, isLoading: taskLoading } = useQuery<TaskDetailResponse>({
    queryKey: ['/api/tasks', id],
    enabled: !!id,
  });

  const { data: usersRes } = useQuery<UsersResponse>({
    queryKey: ['/api/users'],
  });

  const { data: projectsRes } = useQuery<ProjectsResponse>({
    queryKey: ['/api/projects'],
  });

  const { data: allTasksRes } = useQuery<AllTasksResponse>({
    queryKey: ['/api/tasks'],
  });

  const { data: activityRes } = useQuery<ActivityLogsResponse>({
    queryKey: ['/api/activity-logs', id],
    queryFn: async () => {
      const res = await fetch(`/api/activity-logs?entityType=task&entityId=${id}`);
      return res.json();
    },
    enabled: !!id,
  });

  const task = taskRes?.data;
  const subtasks = task?.subtasks ?? [];
  const dependencies = task?.dependencies ?? [];
  const comments = task?.comments ?? [];
  const users = usersRes?.data ?? [];
  const projects = projectsRes?.data ?? [];
  const allTasks = allTasksRes?.data ?? [];
  const activityLogs = activityRes?.data ?? [];

  const getUserName = (userId: number | null | undefined) => {
    if (!userId) return "-";
    return users.find(u => u.id === userId)?.displayName ?? `User #${userId}`;
  };

  const getProjectName = (projectId: number | null | undefined) => {
    if (!projectId) return "-";
    return projects.find(p => p.id === projectId)?.name ?? `Project #${projectId}`;
  };

  const getTaskTitle = (taskId: number) => {
    return allTasks.find(t => t.id === taskId)?.title ?? `Task #${taskId}`;
  };

  const addSubtaskMutation = useMutation({
    mutationFn: async (title: string) => {
      await apiRequest("POST", "/api/tasks", {
        title,
        projectId: task!.projectId,
        orgId: task!.orgId,
        creatorId: task!.creatorId,
        parentTaskId: task!.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setSubtaskTitle("");
      setSubtaskOpen(false);
      toast({ title: "子任务已添加" });
    },
    onError: (err: Error) => {
      toast({ title: "添加失败", description: err.message, variant: "destructive" });
    },
  });

  const addDepMutation = useMutation({
    mutationFn: async (dependsOnTaskId: number) => {
      await apiRequest("POST", "/api/task-dependencies", {
        taskId: Number(id),
        dependsOnTaskId,
        type: "finish_to_start",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', id] });
      setDepTaskId("");
      setDepOpen(false);
      toast({ title: "依赖已添加" });
    },
    onError: (err: Error) => {
      toast({ title: "添加失败", description: err.message, variant: "destructive" });
    },
  });

  const deleteDepMutation = useMutation({
    mutationFn: async (depId: number) => {
      await apiRequest("DELETE", `/api/task-dependencies/${depId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', id] });
      toast({ title: "依赖已删除" });
    },
    onError: (err: Error) => {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest("POST", `/api/tasks/${id}/comments`, {
        userId: 1,
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', id] });
      setCommentText("");
      toast({ title: "评论已添加" });
    },
    onError: (err: Error) => {
      toast({ title: "添加失败", description: err.message, variant: "destructive" });
    },
  });

  const handleJudge = async () => {
    if (!task || !task.assigneeId) return;
    setVerdictLoading(true);
    setVerdictData(null);
    setVerdictAccepted(null);
    try {
      const res = await apiRequest("POST", "/api/verdicts/judge", {
        taskId: Number(id),
        userId: task.assigneeId,
        requestedBy: 1,
      });
      const json = await res.json();
      const v = json.data.verdict;
      setVerdictData({
        id: v.id,
        verdict: v.verdict,
        confidence: v.confidence,
        reasoning: v.reasoning,
        matchedResponsibilities: v.matchedResponsibilities || [],
        suggestedAssignee: v.suggestedAssignee,
      });
    } catch (err: any) {
      toast({ title: "判定失败", description: err.message, variant: "destructive" });
    } finally {
      setVerdictLoading(false);
    }
  };

  const handleAcceptVerdict = async () => {
    if (!verdictData) return;
    try {
      await apiRequest("PATCH", `/api/verdicts/${verdictData.id}/accept`, { userId: 1 });
      setVerdictAccepted(true);
      toast({ title: "已接受判定" });
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    }
  };

  const handleOverrideVerdict = async (reason: string) => {
    if (!verdictData) return;
    try {
      await apiRequest("PATCH", `/api/verdicts/${verdictData.id}/override`, {
        overrideReason: reason,
        userId: 1,
      });
      setVerdictAccepted(false);
      toast({ title: "已推翻判定" });
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    }
  };

  if (taskLoading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => setLocation("/tasks")} data-testid="btn-back-tasks">
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回任务列表
        </Button>
        <p className="mt-4 text-muted-foreground">任务不存在或加载失败。</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <Button variant="ghost" onClick={() => setLocation("/tasks")} data-testid="btn-back-tasks">
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回任务列表
      </Button>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-3 flex-1 min-w-0">
            <h1 className="text-2xl font-bold" data-testid="text-task-title">{task.title}</h1>
            {task.description && (
              <p className="text-muted-foreground">{task.description}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
              <Badge className={getPriorityColor(task.priority)}>{getPriorityLabel(task.priority)}</Badge>
            </div>
          </div>
          <Button variant="outline" onClick={() => setEditOpen(true)} data-testid="btn-edit-task">
            <Pencil className="mr-2 h-4 w-4" />
            编辑
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
          <div>
            <span className="text-muted-foreground">负责人：</span>
            <span>{getUserName(task.assigneeId)}</span>
            {task.assigneeId && (
              <Button
                size="sm"
                variant="outline"
                className="ml-2 h-7 text-xs"
                onClick={handleJudge}
                disabled={verdictLoading}
                data-testid="btn-judge-verdict"
              >
                {verdictLoading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Scale className="h-3.5 w-3.5 mr-1" />
                )}
                权责判定
              </Button>
            )}
          </div>
          <div>
            <span className="text-muted-foreground">创建者：</span>
            <span>{getUserName(task.creatorId)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">项目：</span>
            <span>{getProjectName(task.projectId)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">类型：</span>
            <span>{task.type}</span>
          </div>
          <div>
            <span className="text-muted-foreground">开始日期：</span>
            <span>{formatDate(task.startDate)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">截止日期：</span>
            <span>{formatDate(task.dueDate)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">权重：</span>
            <span>{task.weight}</span>
          </div>
          <div>
            <span className="text-muted-foreground">进度：</span>
            <span>{task.progress}%</span>
          </div>
        </div>
      </Card>

      {verdictData && verdictAccepted === null && (
        <VerdictCard
          verdict={verdictData}
          onAccept={handleAcceptVerdict}
          onOverride={handleOverrideVerdict}
        />
      )}

      {verdictAccepted === true && (
        <Card className="p-4 border-green-200 bg-green-50">
          <div className="flex items-center gap-2 text-green-700 text-sm">
            <Check className="h-4 w-4" />
            判定已接受
          </div>
        </Card>
      )}

      {verdictAccepted === false && (
        <Card className="p-4 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 text-amber-700 text-sm">
            <Scale className="h-4 w-4" />
            判定已推翻
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ListTree className="h-5 w-5" />
            子任务
          </h2>
          <Button size="sm" onClick={() => setSubtaskOpen(true)} data-testid="btn-add-subtask">
            <Plus className="mr-1 h-4 w-4" />
            添加子任务
          </Button>
        </div>
        <div data-testid="subtask-list" className="space-y-2">
          {subtasks.length === 0 && (
            <p className="text-muted-foreground text-sm">暂无子任务</p>
          )}
          {subtasks.map(st => (
            <div
              key={st.id}
              data-testid={`subtask-row-${st.id}`}
              className="flex items-center justify-between gap-2 p-3 rounded-md border cursor-pointer hover-elevate"
              onClick={() => setLocation(`/tasks/${st.id}`)}
            >
              <span className="font-medium truncate">{st.title}</span>
              <Badge className={getStatusColor(st.status)}>{st.status}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={subtaskOpen} onOpenChange={setSubtaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加子任务</DialogTitle>
            <DialogDescription>为当前任务添加一个子任务</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="子任务标题"
              value={subtaskTitle}
              onChange={e => setSubtaskTitle(e.target.value)}
            />
            <Button
              disabled={!subtaskTitle.trim() || addSubtaskMutation.isPending}
              onClick={() => addSubtaskMutation.mutate(subtaskTitle.trim())}
            >
              {addSubtaskMutation.isPending ? "添加中..." : "添加"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            依赖关系
          </h2>
          <Button size="sm" onClick={() => setDepOpen(true)} data-testid="btn-add-dependency">
            <Plus className="mr-1 h-4 w-4" />
            添加依赖
          </Button>
        </div>
        <div data-testid="dependency-list" className="space-y-2">
          {dependencies.length === 0 && (
            <p className="text-muted-foreground text-sm">暂无依赖</p>
          )}
          {dependencies.map(dep => (
            <div
              key={dep.id}
              data-testid={`dependency-row-${dep.id}`}
              className="flex items-center justify-between gap-2 p-3 rounded-md border"
            >
              <span className="truncate">{getTaskTitle(dep.dependsOnTaskId)}</span>
              <Button
                size="icon"
                variant="ghost"
                data-testid={`btn-delete-dep-${dep.id}`}
                onClick={() => deleteDepMutation.mutate(dep.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={depOpen} onOpenChange={setDepOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加依赖</DialogTitle>
            <DialogDescription>选择此任务依赖的前置任务</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={depTaskId} onValueChange={setDepTaskId}>
              <SelectTrigger>
                <SelectValue placeholder="选择任务" />
              </SelectTrigger>
              <SelectContent>
                {allTasks
                  .filter(t => t.id !== Number(id))
                  .map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!depTaskId || addDepMutation.isPending}
              onClick={() => addDepMutation.mutate(Number(depTaskId))}
            >
              {addDepMutation.isPending ? "添加中..." : "添加"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5" />
          评论
        </h2>
        <div data-testid="comment-list" className="space-y-4 mb-4">
          {comments.length === 0 && (
            <p className="text-muted-foreground text-sm">暂无评论</p>
          )}
          {comments.map(c => (
            <div key={c.id} data-testid={`comment-item-${c.id}`} className="p-3 rounded-md border space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-medium text-sm">{getUserName(c.userId)}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
              </div>
              <p className="text-sm">{c.content}</p>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2">
          <Textarea
            data-testid="input-comment"
            placeholder="写一条评论..."
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            className="flex-1"
          />
          <Button
            data-testid="btn-submit-comment"
            disabled={!commentText.trim() || addCommentMutation.isPending}
            onClick={() => addCommentMutation.mutate(commentText.trim())}
          >
            {addCommentMutation.isPending ? "发送中..." : "发送"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5" />
          活动日志
        </h2>
        <div data-testid="activity-log-list" className="space-y-3">
          {activityLogs.length === 0 && (
            <p className="text-muted-foreground text-sm">暂无活动记录</p>
          )}
          {activityLogs.map(log => (
            <div key={log.id} className="p-3 rounded-md border space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-medium text-sm">{log.action}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
              </div>
              {log.changes && (
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(log.changes), null, 2);
                    } catch {
                      return log.changes;
                    }
                  })()}
                </pre>
              )}
            </div>
          ))}
        </div>
      </Card>

      <EditTaskModal task={task} open={editOpen} onOpenChange={setEditOpen} users={users} />
    </div>
  );
}

function EditTaskModal({ task, open, onOpenChange, users }: {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ? String(task.assigneeId) : "");
  const [startDate, setStartDate] = useState(task.startDate ? new Date(task.startDate).toISOString().slice(0, 10) : "");
  const [dueDate, setDueDate] = useState(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "");
  const [weight, setWeight] = useState(String(task.weight));
  const [progress, setProgress] = useState(String(task.progress));

  const resetForm = () => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setPriority(task.priority);
    setAssigneeId(task.assigneeId ? String(task.assigneeId) : "");
    setStartDate(task.startDate ? new Date(task.startDate).toISOString().slice(0, 10) : "");
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "");
    setWeight(String(task.weight));
    setProgress(String(task.progress));
  };

  const editMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title,
        description: description || null,
        status,
        priority,
        assigneeId: assigneeId ? Number(assigneeId) : null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        weight: Number(weight),
        progress: Number(progress),
      };
      await apiRequest("PATCH", `/api/tasks/${task.id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', String(task.id)] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      onOpenChange(false);
      toast({ title: "任务已更新" });
    },
    onError: (err: Error) => {
      toast({ title: "更新失败", description: err.message, variant: "destructive" });
    },
  });

  const handleOpenChange = (val: boolean) => {
    if (val) resetForm();
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑任务</DialogTitle>
          <DialogDescription>修改任务信息</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">标题</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">描述</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">状态</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Todo</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">优先级</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">低</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="urgent">紧急</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">负责人</label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger><SelectValue placeholder="选择负责人" /></SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">开始日期</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">截止日期</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">权重</label>
              <Input type="number" min={1} value={weight} onChange={e => setWeight(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">进度 (%)</label>
              <Input type="number" min={0} max={100} value={progress} onChange={e => setProgress(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button
              disabled={!title.trim() || editMutation.isPending}
              onClick={() => editMutation.mutate()}
            >
              {editMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
