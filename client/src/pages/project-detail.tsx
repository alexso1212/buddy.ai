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
import { ArrowLeft, Plus, Pencil, Trash2, CheckCircle } from "lucide-react";

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
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
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
                    {user.displayName}
                  </SelectItem>
                ))}
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

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const id = params?.id;

  const [editOpen, setEditOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

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
      <div className="space-y-6 p-6">
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
    <div className="space-y-6 p-6">
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
          <h1 className="text-3xl font-bold" data-testid="text-project-name">
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
            <p className="text-muted-foreground">{project.description}</p>
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
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Tasks</h2>
          <Button
            onClick={() => setNewTaskOpen(true)}
            data-testid="btn-new-task"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
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
        creatorId={1} // Assuming current user ID is 1
        users={users}
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
      />
    </div>
  );
}
