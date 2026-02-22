import { useState, useMemo } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn, getStatusColor, getStatusLabel, getDeadlineInfo } from "@/lib/utils";
import type { Task, User, Project, Module, Phase } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, FolderOpen, ChevronDown, ChevronRight, Plus,
  Pencil, CheckCircle2, Calendar, Target, ClipboardCheck, UserCircle
} from "lucide-react";

type AssigneeMap = Record<string, User[]>;

interface ProjectDetailResponse {
  project: Project;
  modules: Module[];
  tasks: Task[];
  assigneeMap: AssigneeMap;
  stats: { total: number; done: number; active: number; pending: number; review: number };
  unassignedTasks: Task[];
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function getProjectHealth(project: Project, tasks: Task[]) {
  if (!project.deadline) return { status: "healthy", color: "#10B981", label: "健康" };
  const totalDays = daysBetween(new Date(project.created_at!), new Date(project.deadline));
  const elapsedDays = daysBetween(new Date(project.created_at!), new Date());
  const timeConsumed = totalDays > 0 ? elapsedDays / totalDays : 1;
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;
  const today = new Date().toISOString().split("T")[0];
  const overdueCount = tasks.filter((t) => t.status !== "done" && t.deadline && t.deadline < today).length;

  if (completionRate < timeConsumed * 0.5 || overdueCount >= 3) {
    return { status: "danger", color: "#EF4444", label: "危险" };
  }
  if (completionRate < timeConsumed * 0.8 || overdueCount >= 1) {
    return { status: "at_risk", color: "#F59E0B", label: "有风险" };
  }
  return { status: "healthy", color: "#10B981", label: "健康" };
}

function ModuleRow({
  mod,
  tasks,
  assigneeMap,
  projectColor,
  allUsers,
}: {
  mod: Module;
  tasks: Task[];
  assigneeMap: AssigneeMap;
  projectColor: string;
  allUsers: User[];
}) {
  const [expanded, setExpanded] = useState(false);
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const progress = tasks.length > 0 ? doneTasks / tasks.length : 0;
  const today = new Date().toISOString().split("T")[0];
  const overdueCount = tasks.filter((t) => t.status !== "done" && t.deadline && t.deadline < today).length;

  const notes: string[] = [];
  if (overdueCount > 0) notes.push(`${overdueCount}逾期`);

  return (
    <div data-testid={`module-row-${mod.id}`}>
      <div
        className="flex items-center gap-3 py-2.5 px-3 cursor-pointer select-none hover-elevate rounded-md"
        onClick={() => setExpanded(!expanded)}
        data-testid={`module-expand-${mod.id}`}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <span className="text-sm font-medium min-w-0 truncate">{mod.title}</span>
        <div className="flex-1 mx-2">
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress * 100}%`, backgroundColor: projectColor }}
            />
          </div>
        </div>
        <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
          {tasks.length}个任务{notes.length > 0 ? ` · ${notes.join(" · ")}` : ""}
        </span>
      </div>
      {expanded && (
        <div className="ml-7 space-y-1.5 pb-2">
          {tasks.map((task) => {
            const assignees = assigneeMap[task.id] ?? [];
            const deadlineInfo = task.deadline ? getDeadlineInfo(task.deadline, task.grace_deadline) : null;
            return (
              <div
                key={task.id}
                className="flex items-center gap-2 py-1.5 px-2 rounded-md hover-elevate flex-wrap"
                data-testid={`task-row-${task.id}`}
              >
                <span className="text-sm min-w-0 truncate flex-1">{task.title}</span>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  {assignees.map((u) => (
                    <div key={u.id} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: u.color ?? "#888" }} />
                      <span className="text-xs text-muted-foreground">{u.name}</span>
                    </div>
                  ))}
                  {deadlineInfo && (
                    <span className={cn("text-xs", deadlineInfo.color)}>{deadlineInfo.text}</span>
                  )}
                  <Badge
                    className={cn("text-xs px-2 py-0.5 rounded-full font-medium border-0", getStatusColor(task.status ?? "pending"))}
                    variant="secondary"
                  >
                    {getStatusLabel(task.status ?? "pending")}
                  </Badge>
                </div>
              </div>
            );
          })}
          {tasks.length === 0 && (
            <p className="text-xs text-muted-foreground py-2 px-2">暂无任务</p>
          )}
        </div>
      )}
    </div>
  );
}

function EditProjectDialog({
  project,
  allUsers,
  open,
  onOpenChange,
}: {
  project: Project;
  allUsers: User[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(project.title);
  const [objective, setObjective] = useState(project.objective ?? "");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(project.acceptance_criteria ?? "");
  const [deadline, setDeadline] = useState(project.deadline ?? "");
  const [ownerId, setOwnerId] = useState(project.owner_id ?? "");
  const [memberIds, setMemberIds] = useState<string[]>(project.member_ids ?? []);

  const toggleMember = (uid: string) => {
    setMemberIds((prev) => prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]);
  };

  const updateMut = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/projects/${project.id}`, {
        title,
        objective: objective || null,
        acceptance_criteria: acceptanceCriteria || null,
        deadline: deadline || null,
        owner_id: ownerId || null,
        member_ids: memberIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "项目已更新" });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "更新失败", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>编辑项目</DialogTitle>
          <DialogDescription className="sr-only">编辑项目信息</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">项目名称</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-project-title" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">目标</label>
            <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={2} className="resize-none text-sm" data-testid="input-project-objective" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">交付标准</label>
            <Textarea value={acceptanceCriteria} onChange={(e) => setAcceptanceCriteria(e.target.value)} rows={2} className="resize-none text-sm" data-testid="input-project-criteria" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">截止日期</label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} data-testid="input-project-deadline" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">负责人</label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger data-testid="select-project-owner"><SelectValue placeholder="选择负责人" /></SelectTrigger>
              <SelectContent>
                {allUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">项目成员（可多选）</label>
            <div className="grid grid-cols-3 gap-1.5 max-h-[160px] overflow-y-auto">
              {allUsers.filter(u => u.is_active !== false && u.id !== ownerId).map((u) => (
                <label key={u.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border cursor-pointer hover:bg-muted/50 text-sm" data-testid={`toggle-member-${u.id}`}>
                  <input type="checkbox" checked={memberIds.includes(u.id)} onChange={() => toggleMember(u.id)} className="rounded" />
                  <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[9px] text-white" style={{ backgroundColor: u.color ?? "#888" }}>{(u.name ?? "?")[0]}</span>
                  <span className="truncate">{u.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={() => updateMut.mutate()} disabled={!title.trim() || updateMut.isPending} data-testid="button-save-project">
              {updateMut.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddTaskDialog({
  projectId,
  projectModules,
  allUsers,
  open,
  onOpenChange,
}: {
  projectId: string;
  projectModules: Module[];
  allUsers: User[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPhase, setTaskPhase] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [taskModuleId, setTaskModuleId] = useState("");
  const [taskPriority, setTaskPriority] = useState("0");
  const [taskAssigneeIds, setTaskAssigneeIds] = useState<string[]>([]);

  const { data: phasesData } = useQuery<Phase[]>({ queryKey: ["/api/phases"] });
  const phasesList = phasesData ?? [];

  const createTaskMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = {
        title: taskTitle.trim(),
        deadline: taskDeadline,
        project_id: projectId,
        priority: Number(taskPriority),
        created_by: user?.id,
      };
      if (taskDescription.trim()) body.description = taskDescription.trim();
      if (taskPhase) body.phase = taskPhase;
      if (taskModuleId) body.module_id = taskModuleId;
      if (taskAssigneeIds.length > 0) body.assignee_ids = taskAssigneeIds;
      const res = await apiRequest("POST", "/api/tasks", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks?view=mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks?view=all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks?view=people"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks?view=overview"] });
      toast({ title: "任务已创建" });
      setTaskTitle("");
      setTaskDescription("");
      setTaskPhase("");
      setTaskDeadline("");
      setTaskModuleId("");
      setTaskPriority("0");
      setTaskAssigneeIds([]);
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "创建失败", description: err.message, variant: "destructive" }),
  });

  const toggleAssignee = (userId: string) => {
    setTaskAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const canSubmit = taskTitle.trim().length > 0 && taskDeadline.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="dialog-add-task">
        <DialogHeader>
          <DialogTitle>添加任务</DialogTitle>
          <DialogDescription className="sr-only">在项目中创建新任务</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">任务标题 *</label>
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="输入任务标题"
              data-testid="input-task-title"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">描述</label>
            <Textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="任务描述（可选）"
              rows={2}
              className="resize-none text-sm"
              data-testid="input-task-description"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">阶段 *</label>
            <Select value={taskPhase} onValueChange={setTaskPhase}>
              <SelectTrigger data-testid="select-task-phase"><SelectValue placeholder="选择阶段" /></SelectTrigger>
              <SelectContent>
                {phasesList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
                {phasesList.length === 0 && (
                  <>
                    <SelectItem value="p0pre">P0 节前冲刺</SelectItem>
                    <SelectItem value="cny">春节假期</SelectItem>
                    <SelectItem value="p1w1">P1 节后第1周</SelectItem>
                    <SelectItem value="p2w23">P2 节后2-3周</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">截止日期 *</label>
            <Input
              type="date"
              value={taskDeadline}
              onChange={(e) => setTaskDeadline(e.target.value)}
              data-testid="input-task-deadline"
            />
          </div>
          {projectModules.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">模块</label>
              <Select value={taskModuleId} onValueChange={setTaskModuleId}>
                <SelectTrigger data-testid="select-task-module"><SelectValue placeholder="选择模块（可选）" /></SelectTrigger>
                <SelectContent>
                  {projectModules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">优先级</label>
            <Select value={taskPriority} onValueChange={setTaskPriority}>
              <SelectTrigger data-testid="select-task-priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">普通</SelectItem>
                <SelectItem value="1">重要</SelectItem>
                <SelectItem value="2">紧急</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">负责人（可多选）</label>
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto border rounded-md p-2">
              {allUsers
                .filter((u) => u.is_active !== false)
                .map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 py-1 px-1 rounded-md cursor-pointer hover-elevate"
                  >
                    <Checkbox
                      checked={taskAssigneeIds.includes(u.id)}
                      onCheckedChange={() => toggleAssignee(u.id)}
                    />
                    <span
                      className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] text-white"
                      style={{ backgroundColor: u.color ?? "#888" }}
                    >
                      {(u.name ?? "?")[0]}
                    </span>
                    <span className="text-sm">{u.name}</span>
                  </label>
                ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button
              onClick={() => createTaskMut.mutate()}
              disabled={!canSubmit || createTaskMut.isPending}
              data-testid="button-submit-task"
            >
              {createTaskMut.isPending ? "创建中..." : "创建任务"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export default function ProjectDetail() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/project/:id");
  const { toast } = useToast();
  const id = params?.id ?? "";

  const [editOpen, setEditOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery<ProjectDetailResponse>({
    queryKey: ["/api/projects", id],
    enabled: !!id,
  });

  const { data: usersData } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const allUsers = usersData ?? [];

  const completeMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/projects/${id}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "项目已标记为完成" });
      setCompleteOpen(false);
    },
    onError: (err: Error) => toast({ title: "操作失败", description: err.message, variant: "destructive" }),
  });

  const tasksByModule = useMemo(() => {
    if (!data) return {};
    const grouped: Record<string, Task[]> = {};
    for (const mod of data.modules) {
      grouped[mod.id] = data.tasks.filter((t) => t.module_id === mod.id);
    }
    return grouped;
  }, [data]);

  if (!user) {
    setLocation("/");
    return null;
  }

  if (!id) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="sticky top-0 z-50 flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border-b bg-background">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <Skeleton className="h-6 w-48" />
        </header>
        <LoadingSkeleton />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col h-screen bg-background items-center justify-center">
        <p className="text-muted-foreground mb-4">项目未找到</p>
        <Link href="/dashboard"><Button variant="outline">返回</Button></Link>
      </div>
    );
  }

  const { project, modules, tasks, assigneeMap, stats, unassignedTasks } = data;
  const owner = allUsers.find((u) => u.id === project.owner_id);
  const health = getProjectHealth(project, tasks);
  const progressPercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const projectColor = project.color ?? "#3B82F6";

  const canEdit = user.role === "ceo" || user.id === project.owner_id || user.id === project.created_by;
  const canComplete = user.role === "ceo" || user.id === project.owner_id;

  return (
    <div className="flex flex-col h-screen bg-background">
      <header
        className="sticky top-0 z-50 flex items-center justify-between gap-2 px-3 md:px-4 py-2 md:py-3 border-b bg-background"
        data-testid="project-header"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
          <h1 className="text-sm md:text-base font-medium truncate" data-testid="project-title">
            {project.title}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && project.status !== "completed" && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} data-testid="button-edit-project">
              <Pencil className="w-3.5 h-3.5 mr-1" /> 编辑
            </Button>
          )}
          {canComplete && project.status !== "completed" && (
            <Button size="sm" onClick={() => setCompleteOpen(true)} data-testid="button-complete-project">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 完成
            </Button>
          )}
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
          <Card className="p-4 md:p-5" style={{ borderLeft: `4px solid ${projectColor}` }}>
            <div className="space-y-3">
              {project.objective && (
                <div className="flex items-start gap-2">
                  <Target className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs text-muted-foreground">目标</span>
                    <p className="text-sm mt-0.5">{project.objective}</p>
                  </div>
                </div>
              )}
              {project.acceptance_criteria && (
                <div className="flex items-start gap-2">
                  <ClipboardCheck className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs text-muted-foreground">交付标准</span>
                    <p className="text-sm mt-0.5">{project.acceptance_criteria}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">负责人</span>
                  <span className="text-sm">{owner?.name ?? "未指定"}</span>
                </div>
                {project.deadline && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">截止</span>
                    <span className="text-sm">{project.deadline}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-3 flex-1 min-w-[200px]" data-testid="project-progress">
                  <span className="text-xs text-muted-foreground shrink-0">进度</span>
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%`, backgroundColor: projectColor }}
                    />
                  </div>
                  <span className="text-xs font-medium shrink-0">{progressPercent}%</span>
                </div>
                <div className="flex items-center gap-2" data-testid="project-health">
                  <span className="text-xs text-muted-foreground">状态</span>
                  <Badge
                    className="text-xs px-2 py-0.5 rounded-full font-medium border-0"
                    style={{ backgroundColor: `${health.color}1A`, color: health.color }}
                    variant="secondary"
                  >
                    {health.label}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {modules.length > 0 && (
            <div>
              <h2 className="text-sm font-medium mb-3">模块进度</h2>
              <Card className="divide-y">
                {modules.map((mod) => (
                  <ModuleRow
                    key={mod.id}
                    mod={mod}
                    tasks={tasksByModule[mod.id] ?? []}
                    assigneeMap={assigneeMap}
                    projectColor={projectColor}
                    allUsers={allUsers}
                  />
                ))}
              </Card>
            </div>
          )}

          <div>
            <h2 className="text-sm font-medium mb-3">任务列表</h2>
            {tasks.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-sm text-muted-foreground mb-4">项目已创建！现在可以开始添加任务了。</p>
                <Button onClick={() => setAddTaskOpen(true)} data-testid="button-add-task">
                  <Plus className="w-4 h-4 mr-1" /> 添加第一个任务
                </Button>
              </Card>
            ) : (
              <div className="space-y-2">
                {modules.map((mod) => {
                  const modTasks = tasksByModule[mod.id] ?? [];
                  if (modTasks.length === 0) return null;
                  const modDone = modTasks.filter((t) => t.status === "done").length;
                  const modProgress = modTasks.length > 0 ? Math.round((modDone / modTasks.length) * 100) : 0;
                  const isExpanded = expandedModules[mod.id] ?? false;

                  return (
                    <Card key={mod.id} className="overflow-visible">
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer select-none hover-elevate rounded-md flex-wrap"
                        onClick={() =>
                          setExpandedModules((prev) => ({ ...prev, [mod.id]: !prev[mod.id] }))
                        }
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm font-medium">{mod.title}</span>
                        <div className="flex-1 mx-2 min-w-[60px]">
                          <div className="h-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${modProgress}%`, backgroundColor: projectColor }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {modDone}/{modTasks.length}
                        </span>
                      </div>
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-1.5">
                          {modTasks.map((task) => {
                            const assignees = assigneeMap[task.id] ?? [];
                            const deadlineInfo = task.deadline ? getDeadlineInfo(task.deadline, task.grace_deadline) : null;
                            return (
                              <div
                                key={task.id}
                                className="flex items-center gap-2 py-1.5 px-2 rounded-md hover-elevate flex-wrap"
                                data-testid={`task-item-${task.id}`}
                              >
                                <span className="text-sm min-w-0 truncate flex-1">{task.title}</span>
                                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                                  {assignees.map((u) => (
                                    <div key={u.id} className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: u.color ?? "#888" }} />
                                      <span className="text-xs text-muted-foreground">{u.name}</span>
                                    </div>
                                  ))}
                                  {deadlineInfo && (
                                    <span className={cn("text-xs", deadlineInfo.color)}>{deadlineInfo.text}</span>
                                  )}
                                  <Badge
                                    className={cn("text-xs px-2 py-0.5 rounded-full font-medium border-0", getStatusColor(task.status ?? "pending"))}
                                    variant="secondary"
                                  >
                                    {getStatusLabel(task.status ?? "pending")}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  );
                })}

                {unassignedTasks.length > 0 && (
                  <Card className="overflow-visible">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer select-none hover-elevate rounded-md flex-wrap"
                      onClick={() =>
                        setExpandedModules((prev) => ({ ...prev, _unassigned: !prev._unassigned }))
                      }
                    >
                      {expandedModules._unassigned ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm font-medium">未分组任务</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {unassignedTasks.length}
                      </span>
                    </div>
                    {expandedModules._unassigned && (
                      <div className="px-3 pb-3 space-y-1.5">
                        {unassignedTasks.map((task) => {
                          const assignees = assigneeMap[task.id] ?? [];
                          const deadlineInfo = task.deadline ? getDeadlineInfo(task.deadline, task.grace_deadline) : null;
                          return (
                            <div
                              key={task.id}
                              className="flex items-center gap-2 py-1.5 px-2 rounded-md hover-elevate flex-wrap"
                              data-testid={`task-item-${task.id}`}
                            >
                              <span className="text-sm min-w-0 truncate flex-1">{task.title}</span>
                              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                                {assignees.map((u) => (
                                  <div key={u.id} className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: u.color ?? "#888" }} />
                                    <span className="text-xs text-muted-foreground">{u.name}</span>
                                  </div>
                                ))}
                                {deadlineInfo && (
                                  <span className={cn("text-xs", deadlineInfo.color)}>{deadlineInfo.text}</span>
                                )}
                                <Badge
                                  className={cn("text-xs px-2 py-0.5 rounded-full font-medium border-0", getStatusColor(task.status ?? "pending"))}
                                  variant="secondary"
                                >
                                  {getStatusLabel(task.status ?? "pending")}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                )}

                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={() => setAddTaskOpen(true)} data-testid="button-add-task">
                    <Plus className="w-3.5 h-3.5 mr-1" /> 添加任务
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {editOpen && (
        <EditProjectDialog
          project={project}
          allUsers={allUsers}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认完成</DialogTitle>
            <DialogDescription className="sr-only">确认标记项目为已完成</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确认标记「{project.title}」为已完成？
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>取消</Button>
            <Button onClick={() => completeMut.mutate()} disabled={completeMut.isPending}>
              {completeMut.isPending ? "处理中..." : "确认完成"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {addTaskOpen && (
        <AddTaskDialog
          projectId={id}
          projectModules={modules}
          allUsers={allUsers}
          open={addTaskOpen}
          onOpenChange={setAddTaskOpen}
        />
      )}

      {project.status !== "completed" && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button onClick={() => setAddTaskOpen(true)} data-testid="button-add-task-floating">
            <Plus className="w-4 h-4 mr-1" /> 添加任务
          </Button>
        </div>
      )}
    </div>
  );
}
