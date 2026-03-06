import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Project, Task, User } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Plus, Pencil, Trash2, CheckCircle, Sparkles, Loader2, ArrowDown } from "lucide-react";

interface ProjectDetailResponse {
  data: Project & { tasks: Task[] };
}

function getTaskStatusColor(status: string): string {
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
}

function getProjectStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-200 text-green-700 dark:bg-green-900/50 dark:text-green-300";
    case "paused":
      return "bg-yellow-200 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300";
    case "completed":
      return "bg-blue-200 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300";
    case "archived":
      return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
    default:
      return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
  }
}

function getPriorityColor(priority: string): string {
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
}

function getPriorityLabel(priority: string): string {
  switch (priority) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "urgent":
      return "Urgent";
    default:
      return priority;
  }
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface EditProjectModalProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EditProjectModal({ project, open, onOpenChange }: EditProjectModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [status, setStatus] = useState(project.status);
  const [startDate, setStartDate] = useState(project.startDate ? project.startDate.toString().split("T")[0] : "");
  const [targetDate, setTargetDate] = useState(project.targetDate ? project.targetDate.toString().split("T")[0] : "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/projects/${project.id}`, {
        name,
        description: description || null,
        status,
        startDate: startDate ? new Date(startDate) : null,
        targetDate: targetDate ? new Date(targetDate) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id.toString()] });
      toast({ title: "Project updated successfully" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update project", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Update project details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project description"
              rows={3}
              className="resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Target Date</label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !name.trim()}
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface NewTaskModalProps {
  projectId: number;
  orgId: number;
  creatorId: number;
  users: User[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function NewTaskModal({
  projectId,
  orgId,
  creatorId,
  users,
  open,
  onOpenChange,
}: NewTaskModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [aiSuggestedAssigneeId, setAiSuggestedAssigneeId] = useState<number | null>(null);
  const [aiAssigneeReason, setAiAssigneeReason] = useState<string>("");

  const aiSuggestMutation = useMutation({
    mutationFn: async ({ title, projectId }: { title: string; projectId?: number }) => {
      const response = await apiRequest("POST", "/api/ai/suggest-task", { title, projectId });
      return response.json();
    },
    onSuccess: (result: any) => {
      const data = result.data;
      if (data.description) setDescription(data.description);
      if (data.priority) setPriority(data.priority);
      if (data.assigneeId) {
        setAssigneeId(String(data.assigneeId));
        setAiSuggestedAssigneeId(data.assigneeId);
        setAiAssigneeReason(data.assigneeReason || "");
      }
      if (data.dueDate) setDueDate(data.dueDate);
    },
  });

  const handleAiSuggest = () => {
    if (!title.trim()) return;
    setAiSuggestedAssigneeId(null);
    setAiAssigneeReason("");
    aiSuggestMutation.mutate({ title, projectId });
  };

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/tasks", {
        title,
        description: description || null,
        priority,
        assigneeId: assigneeId ? parseInt(assigneeId) : null,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        type: "task",
        status: "todo",
        orgId,
        projectId,
        creatorId,
        weight: 1,
        progress: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId.toString()] });
      toast({ title: "Task created successfully" });
      setTitle("");
      setDescription("");
      setPriority("medium");
      setAssigneeId("");
      setStartDate("");
      setDueDate("");
      setAiSuggestedAssigneeId(null);
      setAiAssigneeReason("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create task", description: error.message, variant: "destructive" });
    },
  });

  const canSubmit = title.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>Add a new task to this project</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title *</label>
            <div className="flex gap-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                data-testid="input-task-title"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAiSuggest}
                disabled={aiSuggestMutation.isPending || !title.trim()}
                data-testid="btn-ai-suggest"
              >
                {aiSuggestMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span className="ml-1">AI 建议</span>
              </Button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task description"
              rows={3}
              className="resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Priority</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Assignee</label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    <span className="flex items-center gap-2">
                      {user.displayName}
                      {aiSuggestedAssigneeId === user.id && (
                        <Badge variant="secondary" className="text-xs" data-testid="badge-ai-recommended">AI 推荐</Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {aiAssigneeReason && aiSuggestedAssigneeId && (
              <p className="text-xs text-muted-foreground mt-1" data-testid="text-ai-assignee-reason">{aiAssigneeReason}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Due Date</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createTaskMutation.mutate()}
              disabled={createTaskMutation.isPending || !canSubmit}
            >
              {createTaskMutation.isPending ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface AiSuggestedTask {
  title: string;
  description?: string;
  priority: string;
  estimatedDays: number;
  suggestedAssigneeId: number | null;
  suggestedAssigneeName: string;
}

interface AiDependency {
  fromIndex: number;
  toIndex: number;
  reason: string;
}

interface AiDecomposeDialogProps {
  projectId: number;
  orgId: number;
  users: User[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AiDecomposeDialog({ projectId, orgId, users, open, onOpenChange }: AiDecomposeDialogProps) {
  const { toast } = useToast();
  const [suggestedTasks, setSuggestedTasks] = useState<AiSuggestedTask[]>([]);
  const [dependencies, setDependencies] = useState<AiDependency[]>([]);
  const [checkedTasks, setCheckedTasks] = useState<boolean[]>([]);
  const [hasResults, setHasResults] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const decomposeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/decompose-project", { projectId });
      return await res.json();
    },
    onSuccess: (data: { data: { tasks: AiSuggestedTask[]; dependencies: AiDependency[] } }) => {
      const tasks = data.data?.tasks || [];
      const deps = data.data?.dependencies || [];
      setSuggestedTasks(tasks);
      setDependencies(deps);
      setCheckedTasks(tasks.map(() => true));
      setHasResults(true);
    },
    onError: (error: Error) => {
      toast({ title: "AI 拆解失败", description: error.message, variant: "destructive" });
    },
  });

  const handleToggleTask = (index: number) => {
    setCheckedTasks(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const handleEditField = (index: number, field: keyof AiSuggestedTask, value: string) => {
    setSuggestedTasks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleCreateAll = async () => {
    setIsCreating(true);
    try {
      const selectedIndices: number[] = [];
      const createdTaskIds: number[] = [];

      for (let i = 0; i < suggestedTasks.length; i++) {
        if (!checkedTasks[i]) continue;
        selectedIndices.push(i);

        const task = suggestedTasks[i];
        const now = new Date();
        const dueDate = task.estimatedDays
          ? new Date(now.getTime() + task.estimatedDays * 86400000)
          : null;

        const res = await apiRequest("POST", "/api/tasks", {
          title: task.title,
          description: task.description || null,
          priority: task.priority || "medium",
          assigneeId: task.suggestedAssigneeId || null,
          startDate: null,
          dueDate,
          type: "task",
          status: "todo",
          orgId,
          projectId,
          creatorId: 1,
          weight: 1,
          progress: 0,
        });
        const created = await res.json();
        createdTaskIds.push(created.data.id);
      }

      for (const dep of dependencies) {
        const fromSelectedIdx = selectedIndices.indexOf(dep.fromIndex);
        const toSelectedIdx = selectedIndices.indexOf(dep.toIndex);
        if (fromSelectedIdx === -1 || toSelectedIdx === -1) continue;

        const fromTaskId = createdTaskIds[fromSelectedIdx];
        const toTaskId = createdTaskIds[toSelectedIdx];
        if (!fromTaskId || !toTaskId) continue;

        try {
          await apiRequest("POST", "/api/task-dependencies", {
            taskId: toTaskId,
            dependsOnTaskId: fromTaskId,
            type: "finish_to_start",
          });
        } catch {
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId.toString()] });
      toast({ title: `已创建 ${createdTaskIds.length} 个任务` });
      onOpenChange(false);
      setSuggestedTasks([]);
      setDependencies([]);
      setCheckedTasks([]);
      setHasResults(false);
    } catch (error: any) {
      toast({ title: "创建任务失败", description: error.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setSuggestedTasks([]);
      setDependencies([]);
      setCheckedTasks([]);
      setHasResults(false);
    }
    onOpenChange(val);
  };

  const getDependencyInfo = (index: number) => {
    const deps = dependencies.filter(d => d.toIndex === index && checkedTasks[d.fromIndex]);
    return deps;
  };

  const checkedCount = checkedTasks.filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle data-testid="text-ai-decompose-title">AI 拆解任务</DialogTitle>
          <DialogDescription>AI 将根据项目信息和团队成员自动生成任务拆解方案</DialogDescription>
        </DialogHeader>

        {!hasResults && !decomposeMutation.isPending && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Sparkles className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground text-center">
              点击下方按钮，AI 将分析项目信息并生成任务拆解方案
            </p>
            <Button
              onClick={() => decomposeMutation.mutate()}
              data-testid="btn-start-decompose"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              开始拆解
            </Button>
          </div>
        )}

        {decomposeMutation.isPending && (
          <div className="flex flex-col items-center gap-4 py-12" data-testid="loading-decompose">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">AI 正在分析项目并生成任务...</p>
          </div>
        )}

        {hasResults && suggestedTasks.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-muted-foreground">AI 未能生成任务建议，请重试</p>
            <Button
              variant="outline"
              onClick={() => {
                setHasResults(false);
                decomposeMutation.mutate();
              }}
              data-testid="btn-retry-decompose"
            >
              重试
            </Button>
          </div>
        )}

        {hasResults && suggestedTasks.length > 0 && (
          <>
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-3 pr-4">
                {suggestedTasks.map((task, index) => {
                  const taskDeps = getDependencyInfo(index);
                  return (
                    <div
                      key={index}
                      className={cn(
                        "border rounded-md p-3 space-y-2 transition-opacity",
                        !checkedTasks[index] && "opacity-50"
                      )}
                      data-testid={`ai-task-item-${index}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={checkedTasks[index]}
                          onCheckedChange={() => handleToggleTask(index)}
                          className="mt-1"
                          data-testid={`checkbox-ai-task-${index}`}
                        />
                        <div className="flex-1 min-w-0 space-y-2">
                          <Input
                            value={task.title}
                            onChange={(e) => handleEditField(index, "title", e.target.value)}
                            className="font-medium"
                            data-testid={`input-ai-task-title-${index}`}
                          />
                          <Input
                            value={task.description || ""}
                            onChange={(e) => handleEditField(index, "description", e.target.value)}
                            placeholder="描述"
                            className="text-sm"
                            data-testid={`input-ai-task-desc-${index}`}
                          />
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={getPriorityColor(task.priority)} data-testid={`badge-ai-task-priority-${index}`}>
                              {getPriorityLabel(task.priority)}
                            </Badge>
                            {task.estimatedDays > 0 && (
                              <Badge variant="secondary" data-testid={`badge-ai-task-days-${index}`}>
                                {task.estimatedDays} 天
                              </Badge>
                            )}
                            {task.suggestedAssigneeName && (
                              <Badge variant="outline" data-testid={`badge-ai-task-assignee-${index}`}>
                                {task.suggestedAssigneeName}
                              </Badge>
                            )}
                          </div>
                          {taskDeps.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <ArrowDown className="h-3 w-3" />
                              <span>
                                依赖: {taskDeps.map(d => suggestedTasks[d.fromIndex]?.title).filter(Boolean).join(", ")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between pt-4 border-t gap-2">
              <p className="text-sm text-muted-foreground" data-testid="text-selected-count">
                已选 {checkedCount} / {suggestedTasks.length} 个任务
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleOpenChange(false)} data-testid="btn-cancel-decompose">
                  取消
                </Button>
                <Button
                  onClick={handleCreateAll}
                  disabled={isCreating || checkedCount === 0}
                  data-testid="btn-create-all-tasks"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    `全部创建 (${checkedCount})`
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const id = params?.id;

  const [editOpen, setEditOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [decomposeOpen, setDecomposeOpen] = useState(false);

  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/projects/${id}`, { userId: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "项目已删除" });
      setLocation("/projects");
    },
    onError: (err: Error) => {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    },
  });

  const completeProjectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/projects/${id}`, { status: 'completed', userId: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "项目已标记完成" });
    },
    onError: (err: Error) => {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    },
  });

  const { data: projectData, isLoading: projectLoading } = useQuery<ProjectDetailResponse>({
    queryKey: ["/api/projects", id],
    enabled: !!id,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<{ data: User[] }>({
    queryKey: ["/api/users"],
  });

  const project = projectData?.data;
  const tasks = project?.tasks || [];
  const users = usersData?.data || [];

  if (projectLoading || usersLoading) {
    return (
      <div className="space-y-6 pt-16 md:pt-6 px-6 pb-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Project not found</p>
          <Button onClick={() => setLocation("/projects")}>Back to Projects</Button>
        </div>
      </div>
    );
  }

  const owner = users.find((u) => u.id === project.ownerId);

  return (
    <div className="space-y-6 pt-16 md:pt-6 px-6 pb-6">
      {/* Back button and header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/projects")}
            data-testid="btn-back-projects"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl md:text-3xl font-bold line-clamp-1" data-testid="text-project-name">
            {project.name}
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {project.status !== 'completed' && (
            <Button
              variant="outline"
              onClick={() => completeProjectMutation.mutate()}
              disabled={completeProjectMutation.isPending}
              data-testid="btn-complete-project"
            >
              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
              标记完成
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setEditOpen(true)}
            data-testid="btn-edit-project"
          >
            <Pencil className="h-4 w-4 mr-2" />
            编辑
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (window.confirm(`确定要删除项目「${project.name}」吗？此操作不可撤销。`)) {
                deleteProjectMutation.mutate();
              }
            }}
            disabled={deleteProjectMutation.isPending}
            data-testid="btn-delete-project"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            删除
          </Button>
        </div>
      </div>

      {/* Project info */}
      <div className="bg-card rounded-lg border p-6 space-y-4">
        {project.description && (
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className={cn("text-muted-foreground", !descExpanded && "line-clamp-3")} data-testid="text-project-description">{project.description}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDescExpanded(!descExpanded)}
              className="px-0 h-auto text-sm mt-1"
              data-testid="btn-toggle-description"
            >
              {descExpanded ? "收起" : "展开"}
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge className={cn("mt-2", getProjectStatusColor(project.status))}>
              {project.status}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Owner</p>
            <p className="mt-2 font-medium">{owner?.displayName || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Start Date</p>
            <p className="mt-2">{formatDate(project.startDate)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Target Date</p>
            <p className="mt-2">{formatDate(project.targetDate)}</p>
          </div>
        </div>
      </div>

      {/* Tasks section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg md:text-2xl font-bold">Tasks</h2>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setDecomposeOpen(true)}
              data-testid="btn-ai-decompose"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              AI 拆解任务
            </Button>
            <Button
              onClick={() => setNewTaskOpen(true)}
              data-testid="btn-new-task"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>
        </div>

        {/* Tasks table */}
        <div className="bg-card rounded-lg border overflow-hidden">
          {tasks.length > 0 ? (
            <Table data-testid="project-task-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const assignee = users.find((u) => u.id === task.assigneeId);
                  return (
                    <TableRow
                      key={task.id}
                      data-testid={`task-row-${task.id}`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setLocation(`/tasks/${task.id}`)}
                    >
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        <Badge className={getTaskStatusColor(task.status)}>
                          {task.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(task.priority)}>
                          {getPriorityLabel(task.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell>{assignee?.displayName || "-"}</TableCell>
                      <TableCell>{formatDate(task.dueDate)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No tasks yet</p>
              <Button
                onClick={() => setNewTaskOpen(true)}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Task
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <EditProjectModal
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <NewTaskModal
        projectId={project.id}
        orgId={project.orgId}
        creatorId={1}
        users={users}
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
      />
      <AiDecomposeDialog
        projectId={project.id}
        orgId={project.orgId}
        users={users}
        open={decomposeOpen}
        onOpenChange={setDecomposeOpen}
      />
    </div>
  );
}
