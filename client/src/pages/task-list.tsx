import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertTaskSchema, type Task, type Project, type User } from "@shared/schema";
import { z } from "zod";
import ParticipantAvatars from "@/components/ParticipantAvatars";

type TaskWithParticipants = Task & {
  participants?: Array<{
    id: number;
    taskId: number;
    userId: number;
    role: string;
    user: User | null;
  }>;
};

type TasksResponse = {
  data: TaskWithParticipants[];
};

type ProjectsResponse = {
  data: Project[];
};

type UsersResponse = {
  data: User[];
};

const taskFormSchema = insertTaskSchema.extend({
  startDate: z.union([z.string(), z.date()]).optional(),
  dueDate: z.union([z.string(), z.date()]).optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

function getStatusColor(status: string): string {
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
}

function NewTaskModal({
  isOpen,
  onClose,
  projects,
  users,
}: {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  users: User[];
}) {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      projectId: undefined,
      priority: "medium",
      assigneeId: undefined,
      startDate: undefined,
      dueDate: undefined,
      type: "task",
      status: "todo",
      orgId: 1,
      creatorId: 1,
      weight: 1,
      progress: 0,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: TaskFormValues) => {
      const formattedData = {
        ...data,
        projectId: parseInt(String(data.projectId)),
        startDate: data.startDate
          ? new Date(data.startDate).toISOString()
          : undefined,
        dueDate: data.dueDate
          ? new Date(data.dueDate).toISOString()
          : undefined,
        assigneeId: data.assigneeId ? parseInt(String(data.assigneeId)) : undefined,
      };
      const response = await apiRequest("POST", "/api/tasks", formattedData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      form.reset();
      onClose();
    },
  });

  const handleSubmit = (values: TaskFormValues) => {
    mutation.mutate(values);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      data-testid="modal-new-task"
    >
      <div className="bg-card rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">新建任务</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>任务标题 *</FormLabel>
                  <FormControl>
                    <Input placeholder="输入任务标题" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>任务描述</FormLabel>
                  <FormControl>
                    <Textarea placeholder="输入任务描述" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>项目 *</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value ? String(field.value) : ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择项目" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={String(project.id)}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>优先级</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "medium"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择优先级" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">低</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="urgent">紧急</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assigneeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>指派人</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value ? String(field.value) : ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择指派人" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={String(user.id)}>
                          {user.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>开始日期</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={typeof field.value === "string" ? field.value : ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>截止日期</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={typeof field.value === "string" ? field.value : ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="flex-1"
                data-testid="btn-submit-task"
              >
                {mutation.isPending ? "提交中..." : "提交"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

function StatusDropdown({
  taskId,
  currentStatus,
}: {
  taskId: number;
  currentStatus: string;
}) {
  const statusOptions = ["todo", "in_progress", "in_review", "done", "cancelled"];

  const mutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const response = await apiRequest("PATCH", `/api/tasks/${taskId}`, {
        status: newStatus,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge className={getStatusColor(currentStatus)} data-testid={`status-badge-${taskId}`}>
          {currentStatus.replace(/_/g, " ")}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {statusOptions.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={() => mutation.mutate(status)}
            disabled={mutation.isPending || status === currentStatus}
          >
            {status.replace(/_/g, " ")}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function TaskList() {
  const [, navigate] = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterProject, setFilterProject] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [filterAssignee, setFilterAssignee] = useState<string | undefined>(undefined);

  const { data: tasksResponse, isLoading: tasksLoading } = useQuery<TasksResponse>({
    queryKey: ["/api/tasks"],
  });

  const { data: projectsResponse, isLoading: projectsLoading } = useQuery<ProjectsResponse>({
    queryKey: ["/api/projects"],
  });

  const { data: usersResponse, isLoading: usersLoading } = useQuery<UsersResponse>({
    queryKey: ["/api/users"],
  });

  const tasks = tasksResponse?.data ?? [];
  const projects = projectsResponse?.data ?? [];
  const users = usersResponse?.data ?? [];

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  const filteredTasks = tasks.filter((task) => {
    if (filterProject && filterProject !== "all" && task.projectId !== parseInt(filterProject)) {
      return false;
    }
    if (filterStatus && filterStatus !== "all" && task.status !== filterStatus) {
      return false;
    }
    if (filterAssignee && filterAssignee !== "all" && task.assigneeId !== parseInt(filterAssignee)) {
      return false;
    }
    return true;
  });

  const statusOptions = ["todo", "in_progress", "in_review", "done", "cancelled"];

  const filterControls = (
    <>
      <div className="min-w-[200px]">
        <label className="text-sm font-medium">项目</label>
        <Select value={filterProject ?? "all"} onValueChange={setFilterProject}>
          <SelectTrigger data-testid="filter-project">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={String(project.id)}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-[200px]">
        <label className="text-sm font-medium">状态</label>
        <Select value={filterStatus ?? "all"} onValueChange={setFilterStatus}>
          <SelectTrigger data-testid="filter-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {status.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-[200px]">
        <label className="text-sm font-medium">指派人</label>
        <Select value={filterAssignee ?? "all"} onValueChange={setFilterAssignee}>
          <SelectTrigger data-testid="filter-assignee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={String(user.id)}>
                {user.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Mobile header: title + filter toggle + new task button */}
      <div className="flex items-center gap-3 md:hidden" data-testid="mobile-header">
        <h1 className="text-3xl font-bold flex-1" data-testid="task-list-title-mobile">
          任务列表
        </h1>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setShowFilters((prev) => !prev)}
          data-testid="btn-toggle-filters"
        >
          <Filter />
        </Button>
        <Button
          onClick={() => setIsModalOpen(true)}
          data-testid="btn-new-task-mobile"
        >
          新建任务
        </Button>
      </div>

      {/* Mobile collapsible filters */}
      {showFilters && (
        <div className="flex flex-col gap-3 md:hidden" data-testid="mobile-filters">
          {filterControls}
        </div>
      )}

      {/* Desktop header */}
      <h1 className="text-3xl font-bold hidden md:block" data-testid="task-list-title">
        任务列表
      </h1>

      {/* Desktop filter bar */}
      <div className="hidden md:flex flex-row items-end gap-3 flex-wrap">
        {filterControls}
        <Button
          onClick={() => setIsModalOpen(true)}
          className="ml-auto"
          data-testid="btn-new-task"
        >
          新建任务
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {tasksLoading || projectsLoading || usersLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table data-testid="task-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>标题</TableHead>
                    <TableHead>项目</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>优先级</TableHead>
                    <TableHead>指派人</TableHead>
                    <TableHead>相关人员</TableHead>
                    <TableHead>截止日期</TableHead>
                    <TableHead>权重</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow
                      key={task.id}
                      data-testid={`task-row-${task.id}`}
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>{projectMap.get(task.projectId)?.name ?? "-"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <StatusDropdown taskId={task.id} currentStatus={task.status} />
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(task.priority)}>
                          {getPriorityLabel(task.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell>{userMap.get(task.assigneeId!)?.displayName ?? "-"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <ParticipantAvatars participants={task.participants || []} />
                      </TableCell>
                      <TableCell>{formatDate(task.dueDate)}</TableCell>
                      <TableCell>{task.weight}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-2" data-testid="mobile-task-cards">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-card rounded-lg shadow-sm p-3 cursor-pointer"
                  data-testid={`task-card-${task.id}`}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                >
                  <div className="font-medium truncate" data-testid={`task-card-title-${task.id}`}>
                    {task.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground" data-testid={`task-card-project-${task.id}`}>
                      {projectMap.get(task.projectId)?.name ?? "-"}
                    </span>
                    <span className="text-xs text-muted-foreground" data-testid={`task-card-assignee-${task.id}`}>
                      {userMap.get(task.assigneeId!)?.displayName ?? "-"}
                    </span>
                  </div>
                  {(task.participants?.length ?? 0) > 0 && (
                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                      <ParticipantAvatars participants={task.participants || []} />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <StatusDropdown taskId={task.id} currentStatus={task.status} />
                    <Badge className={getPriorityColor(task.priority)}>
                      {getPriorityLabel(task.priority)}
                    </Badge>
                    {task.dueDate && (
                      <span className="text-xs text-muted-foreground" data-testid={`task-card-due-${task.id}`}>
                        {formatDate(task.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <NewTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projects={projects}
        users={users}
      />
    </div>
  );
}
