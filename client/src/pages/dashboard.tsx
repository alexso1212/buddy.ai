import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn, getStatusColor, getStatusLabel, getPriorityLabel, getDeadlineInfo } from "@/lib/utils";
import type { Task, Phase, User } from "@shared/schema";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Lock, Save, ExternalLink, RefreshCw } from "lucide-react";
import { Link } from "wouter";

type AssigneeMap = Record<string, User[]>;
interface TasksResponse {
  tasks: Task[];
  assigneeMap: AssigneeMap;
}

function TaskCard({
  task,
  assignees,
  allTasks,
  onClick,
}: {
  task: Task;
  assignees: User[];
  allTasks: Task[];
  onClick: () => void;
}) {
  const priority = getPriorityLabel(task.priority ?? 0);
  const deadlineInfo = task.deadline ? getDeadlineInfo(task.deadline, task.grace_deadline) : null;

  const isBlocked = useMemo(() => {
    if (!task.depends_on) return false;
    const depIds = task.depends_on.split(",").map((s) => s.trim()).filter(Boolean);
    return depIds.some((id) => {
      const dep = allTasks.find((t) => t.id === id);
      return !dep || dep.status !== "done";
    });
  }, [task.depends_on, allTasks]);

  return (
    <Card
      className={cn(
        "p-3 cursor-pointer hover-elevate",
        task.parent_id && "ml-6"
      )}
      onClick={onClick}
      data-testid={`card-task-${task.id}`}
    >
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          {isBlocked && <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <span className="text-sm font-medium truncate" data-testid={`text-title-${task.id}`}>
            {task.title}
          </span>
          {priority && (
            <Badge className={cn("no-default-active-elevate text-xs", priority.color)} variant="secondary">
              {priority.label}
            </Badge>
          )}
        </div>
        <Badge className={cn("no-default-active-elevate shrink-0", getStatusColor(task.status ?? "pending"))} variant="secondary">
          {getStatusLabel(task.status ?? "pending")}
        </Badge>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {assignees.map((u) => (
            <div key={u.id} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: u.color ?? "#888" }}
              />
              <span className="text-xs text-muted-foreground">{u.name}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {task.deliverable && (
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{task.deliverable}</span>
          )}
          {deadlineInfo && (
            <span className={cn("text-xs", deadlineInfo.color)}>{deadlineInfo.text}</span>
          )}
        </div>
      </div>
    </Card>
  );
}

function TaskDetailDialog({
  task,
  assignees,
  allTasks,
  allUsers,
  open,
  onOpenChange,
}: {
  task: Task;
  assignees: User[];
  allTasks: Task[];
  allUsers: User[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [feishuLink, setFeishuLink] = useState(task.feishu_link ?? "");
  const [feishuDirty, setFeishuDirty] = useState(false);

  const { data: logs } = useQuery<Array<{ id: number; task_id: string; user_id: string | null; action: string; old_value: string | null; new_value: string | null; created_at: string | null }>>({
    queryKey: ["/api/tasks", task.id, "logs"],
    enabled: open,
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      await apiRequest("PATCH", `/api/tasks/${task.id}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "状态已更新" });
    },
    onError: (err: Error) => {
      toast({ title: "更新失败", description: err.message, variant: "destructive" });
    },
  });

  const feishuMutation = useMutation({
    mutationFn: async (link: string) => {
      await apiRequest("PATCH", `/api/tasks/${task.id}`, { feishu_link: link });
    },
    onSuccess: () => {
      setFeishuDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "飞书链接已保存" });
    },
    onError: (err: Error) => {
      toast({ title: "保存失败", description: err.message, variant: "destructive" });
    },
  });

  const isBlocked = useMemo(() => {
    if (!task.depends_on) return false;
    const depIds = task.depends_on.split(",").map((s) => s.trim()).filter(Boolean);
    return depIds.some((id) => {
      const dep = allTasks.find((t) => t.id === id);
      return !dep || dep.status !== "done";
    });
  }, [task.depends_on, allTasks]);

  const depTasks = useMemo(() => {
    if (!task.depends_on) return [];
    const depIds = task.depends_on.split(",").map((s) => s.trim()).filter(Boolean);
    return depIds.map((id) => allTasks.find((t) => t.id === id)).filter(Boolean) as Task[];
  }, [task.depends_on, allTasks]);

  const canChangeStatus = useMemo(() => {
    if (!user) return false;
    if (user.role === "ceo" || user.role === "admin") return true;
    const isAssignee = assignees.some((a) => a.id === user.id);
    if (user.role === "head") return isAssignee || assignees.some((a) => a.dept === user.dept);
    return isAssignee;
  }, [user, assignees]);

  const reviewer = allUsers.find((u) => u.id === task.reviewer_id);
  const deadlineInfo = task.deadline ? getDeadlineInfo(task.deadline, task.grace_deadline) : null;

  const getNextAction = () => {
    switch (task.status) {
      case "pending": return { label: "开始任务", next: "active" };
      case "active": return { label: "提交审核", next: "review" };
      case "review": return { label: "标记完成", next: "done" };
      case "done": return { label: "重新打开", next: "pending" };
      default: return { label: "开始任务", next: "active" };
    }
  };

  const action = getNextAction();
  const isStartBlocked = task.status === "pending" && isBlocked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl" data-testid={`text-detail-title-${task.id}`}>{task.title}</DialogTitle>
        </DialogHeader>

        {task.description && (
          <p className="text-sm text-muted-foreground">{task.description}</p>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">状态:</span>
              <Badge className={cn("no-default-active-elevate", getStatusColor(task.status ?? "pending"))} variant="secondary">
                {getStatusLabel(task.status ?? "pending")}
              </Badge>
            </div>
            {canChangeStatus && (
              <Button
                size="sm"
                disabled={isStartBlocked || statusMutation.isPending}
                onClick={() => statusMutation.mutate(action.next)}
                data-testid={`button-status-${task.id}`}
              >
                {statusMutation.isPending ? "处理中..." : action.label}
              </Button>
            )}
          </div>

          {isStartBlocked && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-2 rounded-md">
              <Lock className="w-4 h-4" />
              <span>前置任务未完成，无法开始</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-muted-foreground">负责人</span>
              <div className="flex flex-col gap-1 mt-1">
                {assignees.map((u) => (
                  <div key={u.id} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: u.color ?? "#888" }} />
                    <span className="text-sm">{u.name}</span>
                  </div>
                ))}
                {assignees.length === 0 && <span className="text-sm text-muted-foreground">未分配</span>}
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">审核人</span>
              {reviewer ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: reviewer.color ?? "#888" }} />
                  <span className="text-sm">{reviewer.name}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">未指定</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-muted-foreground">截止日期</span>
              {deadlineInfo ? (
                <p className={cn("text-sm mt-1", deadlineInfo.color)}>{task.deadline} ({deadlineInfo.text})</p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">未设置</p>
              )}
            </div>
            {task.grace_deadline && (
              <div>
                <span className="text-xs text-muted-foreground">宽限截止</span>
                <p className="text-sm mt-1">{task.grace_deadline}</p>
              </div>
            )}
          </div>

          {task.deliverable && (
            <div>
              <span className="text-xs text-muted-foreground">交付物</span>
              <p className="text-sm mt-1">{task.deliverable}</p>
            </div>
          )}

          <div>
            <span className="text-xs text-muted-foreground">飞书链接</span>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={feishuLink}
                onChange={(e) => { setFeishuLink(e.target.value); setFeishuDirty(true); }}
                placeholder="粘贴飞书文档链接"
                data-testid={`input-feishu-${task.id}`}
              />
              {feishuDirty && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => feishuMutation.mutate(feishuLink)}
                  disabled={feishuMutation.isPending}
                  data-testid={`button-save-feishu-${task.id}`}
                >
                  <Save />
                </Button>
              )}
              {task.feishu_link && !feishuDirty && (
                <Button size="icon" variant="ghost" asChild>
                  <a href={task.feishu_link} target="_blank" rel="noopener noreferrer" data-testid={`link-feishu-${task.id}`}>
                    <ExternalLink />
                  </a>
                </Button>
              )}
            </div>
          </div>

          {depTasks.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">依赖任务</span>
              <div className="flex flex-col gap-1 mt-1">
                {depTasks.map((dep) => (
                  <div key={dep.id} className="flex items-center gap-2">
                    <Badge className={cn("no-default-active-elevate text-xs", getStatusColor(dep.status ?? "pending"))} variant="secondary">
                      {getStatusLabel(dep.status ?? "pending")}
                    </Badge>
                    <span className="text-sm">{dep.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {logs && logs.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">操作日志</span>
              <div className="mt-2 space-y-2">
                {logs.map((log) => {
                  const logUser = allUsers.find((u) => u.id === log.user_id);
                  return (
                    <div key={log.id} className="flex items-start gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                      <div>
                        <span className="font-medium">{logUser?.name ?? "系统"}</span>
                        <span className="text-muted-foreground ml-1">{log.action}</span>
                        {log.old_value && log.new_value && (
                          <span className="text-muted-foreground ml-1">
                            {log.old_value} → {log.new_value}
                          </span>
                        )}
                        {log.created_at && (
                          <span className="text-muted-foreground ml-2">
                            {new Date(log.created_at).toLocaleString("zh-CN")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PhaseSection({
  phase,
  tasks,
  assigneeMap,
  allTasks,
  allUsers,
  selectedTask,
  onSelectTask,
}: {
  phase: Phase;
  tasks: Task[];
  assigneeMap: AssigneeMap;
  allTasks: Task[];
  allUsers: User[];
  selectedTask: Task | null;
  onSelectTask: (task: Task | null) => void;
}) {
  const parentTasks = tasks.filter((t) => !t.parent_id);
  const subtasks = tasks.filter((t) => t.parent_id);

  return (
    <div className="mb-6">
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 rounded-md mb-2 flex-wrap"
        style={{ backgroundColor: phase.color ? `${phase.color}20` : undefined, borderLeft: `3px solid ${phase.color ?? "hsl(var(--primary))"}` }}
      >
        <span className="font-medium text-sm">{phase.label}</span>
        {phase.date_range && <span className="text-xs text-muted-foreground">{phase.date_range}</span>}
      </div>
      <div className="space-y-2">
        {parentTasks.map((task) => (
          <div key={task.id}>
            <TaskCard
              task={task}
              assignees={assigneeMap[task.id] ?? []}
              allTasks={allTasks}
              onClick={() => onSelectTask(task)}
            />
            {subtasks
              .filter((st) => st.parent_id === task.id)
              .map((st) => (
                <TaskCard
                  key={st.id}
                  task={st}
                  assignees={assigneeMap[st.id] ?? []}
                  allTasks={allTasks}
                  onClick={() => onSelectTask(st)}
                />
              ))}
          </div>
        ))}
        {parentTasks.length === 0 && subtasks.length === 0 && (
          <p className="text-sm text-muted-foreground py-2 px-3">暂无任务</p>
        )}
      </div>
      {selectedTask && tasks.some((t) => t.id === selectedTask.id) && (
        <TaskDetailDialog
          task={selectedTask}
          assignees={assigneeMap[selectedTask.id] ?? []}
          allTasks={allTasks}
          allUsers={allUsers}
          open={true}
          onOpenChange={(o) => { if (!o) onSelectTask(null); }}
        />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("all");

  if (!user) {
    setLocation("/");
    return null;
  }

  const isCeoOrAdmin = user.role === "ceo" || user.role === "admin";

  const { data: myData, isLoading: myLoading } = useQuery<TasksResponse>({
    queryKey: ["/api/tasks?view=mine"],
  });

  const { data: allData, isLoading: allLoading } = useQuery<TasksResponse>({
    queryKey: ["/api/tasks?view=all"],
  });

  const { data: peopleData, isLoading: peopleLoading } = useQuery<TasksResponse>({
    queryKey: ["/api/tasks?view=people"],
    enabled: isCeoOrAdmin,
  });

  const { data: phasesData } = useQuery<Phase[]>({
    queryKey: ["/api/phases"],
  });

  const { data: usersData } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const phases = phasesData ?? [];
  const allUsers = usersData ?? [];

  const groupByPhase = (tasks: Task[]) => {
    const grouped: Record<string, Task[]> = {};
    for (const p of phases) {
      grouped[p.id] = [];
    }
    grouped["_none"] = [];
    for (const t of tasks) {
      const key = t.phase && grouped[t.phase] !== undefined ? t.phase : "_none";
      grouped[key].push(t);
    }
    return grouped;
  };

  const filteredAllTasks = useMemo(() => {
    if (!allData) return [];
    let filtered = allData.tasks;
    if (statusFilter !== "all") {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }
    if (personFilter !== "all") {
      filtered = filtered.filter((t) => {
        const assignees = allData.assigneeMap[t.id] ?? [];
        return assignees.some((a) => a.id === personFilter);
      });
    }
    return filtered;
  }, [allData, statusFilter, personFilter]);

  const groupByPerson = (tasks: Task[], aMap: AssigneeMap) => {
    const grouped: Record<string, Task[]> = {};
    for (const u of allUsers) {
      grouped[u.id] = [];
    }
    for (const t of tasks) {
      const assignees = aMap[t.id] ?? [];
      if (assignees.length === 0) {
        if (!grouped["_unassigned"]) grouped["_unassigned"] = [];
        grouped["_unassigned"].push(t);
      } else {
        for (const a of assignees) {
          if (!grouped[a.id]) grouped[a.id] = [];
          grouped[a.id].push(t);
        }
      }
    }
    return grouped;
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-3 border-b bg-background" data-testid="header">
        <h1 className="text-lg font-bold tracking-tight">德湃任务中心</h1>
        <div className="flex items-center gap-3">
          {user.role === "ceo" && (
            <Link href="/sync">
              <Button variant="ghost" size="sm" data-testid="link-sync">
                <RefreshCw className="w-4 h-4 mr-1" />
                同步
              </Button>
            </Link>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: user.color ?? "#888" }} />
            <span className="text-sm font-medium" data-testid="text-username">{user.name}</span>
          </div>
          <Button size="icon" variant="ghost" onClick={() => logout()} data-testid="button-logout">
            <LogOut />
          </Button>
        </div>
      </header>

      <Tabs defaultValue="mine" className="flex flex-col flex-1 min-h-0">
        <div className="px-4 pt-3">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="mine" data-testid="tab-mine">我的任务</TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">全部任务</TabsTrigger>
            {isCeoOrAdmin && (
              <TabsTrigger value="people" data-testid="tab-people">人员视图</TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="mine" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {myLoading ? (
                <LoadingSkeleton />
              ) : !myData || myData.tasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-12" data-testid="text-empty-mine">暂无任务</p>
              ) : (
                (() => {
                  const grouped = groupByPhase(myData.tasks);
                  const allTasksList = myData.tasks;
                  return (
                    <>
                      {phases.map((phase) =>
                        grouped[phase.id]?.length ? (
                          <PhaseSection
                            key={phase.id}
                            phase={phase}
                            tasks={grouped[phase.id]}
                            assigneeMap={myData.assigneeMap}
                            allTasks={allTasksList}
                            allUsers={allUsers}
                            selectedTask={selectedTask}
                            onSelectTask={setSelectedTask}
                          />
                        ) : null
                      )}
                      {grouped["_none"]?.length > 0 && (
                        <PhaseSection
                          phase={{ id: "_none", label: "未分类", date_range: null, color: "#888", sort_order: 999 }}
                          tasks={grouped["_none"]}
                          assigneeMap={myData.assigneeMap}
                          allTasks={allTasksList}
                          allUsers={allUsers}
                          selectedTask={selectedTask}
                          onSelectTask={setSelectedTask}
                        />
                      )}
                    </>
                  );
                })()
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="all" className="flex-1 min-h-0">
          <div className="flex items-center gap-2 px-4 py-2 border-b flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px]" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待开始</SelectItem>
                <SelectItem value="active">进行中</SelectItem>
                <SelectItem value="review">审核中</SelectItem>
                <SelectItem value="done">已完成</SelectItem>
              </SelectContent>
            </Select>
            <Select value={personFilter} onValueChange={setPersonFilter}>
              <SelectTrigger className="w-[120px]" data-testid="select-person-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部人员</SelectItem>
                {allUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="h-full">
            <div className="p-4">
              {allLoading ? (
                <LoadingSkeleton />
              ) : filteredAllTasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-12" data-testid="text-empty-all">暂无任务</p>
              ) : (
                (() => {
                  const grouped = groupByPhase(filteredAllTasks);
                  const allTasksList = allData?.tasks ?? [];
                  const aMap = allData?.assigneeMap ?? {};
                  return (
                    <>
                      {phases.map((phase) =>
                        grouped[phase.id]?.length ? (
                          <PhaseSection
                            key={phase.id}
                            phase={phase}
                            tasks={grouped[phase.id]}
                            assigneeMap={aMap}
                            allTasks={allTasksList}
                            allUsers={allUsers}
                            selectedTask={selectedTask}
                            onSelectTask={setSelectedTask}
                          />
                        ) : null
                      )}
                      {grouped["_none"]?.length > 0 && (
                        <PhaseSection
                          phase={{ id: "_none", label: "未分类", date_range: null, color: "#888", sort_order: 999 }}
                          tasks={grouped["_none"]}
                          assigneeMap={aMap}
                          allTasks={allTasksList}
                          allUsers={allUsers}
                          selectedTask={selectedTask}
                          onSelectTask={setSelectedTask}
                        />
                      )}
                    </>
                  );
                })()
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {isCeoOrAdmin && (
          <TabsContent value="people" className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                {peopleLoading ? (
                  <LoadingSkeleton />
                ) : !peopleData || peopleData.tasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12" data-testid="text-empty-people">暂无任务</p>
                ) : (
                  (() => {
                    const grouped = groupByPerson(peopleData.tasks, peopleData.assigneeMap);
                    return (
                      <>
                        {allUsers.map((u) => {
                          const userTasks = grouped[u.id] ?? [];
                          if (userTasks.length === 0) return null;
                          return (
                            <div key={u.id} className="mb-6">
                              <div className="flex items-center gap-2 px-3 py-2 rounded-md mb-2 bg-muted/50">
                                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: u.color ?? "#888" }} />
                                <span className="font-medium text-sm">{u.name}</span>
                                {u.title && <span className="text-xs text-muted-foreground">{u.title}</span>}
                              </div>
                              <div className="space-y-2">
                                {userTasks.map((task) => (
                                  <TaskCard
                                    key={task.id}
                                    task={task}
                                    assignees={peopleData.assigneeMap[task.id] ?? []}
                                    allTasks={peopleData.tasks}
                                    onClick={() => setSelectedTask(task)}
                                  />
                                ))}
                              </div>
                              {selectedTask && userTasks.some((t) => t.id === selectedTask.id) && (
                                <TaskDetailDialog
                                  task={selectedTask}
                                  assignees={peopleData.assigneeMap[selectedTask.id] ?? []}
                                  allTasks={peopleData.tasks}
                                  allUsers={allUsers}
                                  open={true}
                                  onOpenChange={(o) => { if (!o) setSelectedTask(null); }}
                                />
                              )}
                            </div>
                          );
                        })}
                        {grouped["_unassigned"]?.length > 0 && (
                          <div className="mb-6">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-md mb-2 bg-muted/50">
                              <span className="w-3 h-3 rounded-full bg-muted-foreground shrink-0" />
                              <span className="font-medium text-sm">未分配</span>
                            </div>
                            <div className="space-y-2">
                              {grouped["_unassigned"].map((task) => (
                                <TaskCard
                                  key={task.id}
                                  task={task}
                                  assignees={[]}
                                  allTasks={peopleData.tasks}
                                  onClick={() => setSelectedTask(task)}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
