import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, CheckCircle, MoreVertical } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertProjectSchema, type Project, type User } from "@shared/schema";
import { z } from "zod";

type ProjectWithOwner = Project & {
  owner: User | null;
};

type ProjectsResponse = {
  data: ProjectWithOwner[];
};

type UsersResponse = {
  data: User[];
};

const projectFormSchema = insertProjectSchema.extend({
  startDate: z.union([z.string(), z.date()]).optional(),
  targetDate: z.union([z.string(), z.date()]).optional(),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300";
    case "paused":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300";
    case "completed":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300";
    case "archived":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  }
}

function NewProjectModal({
  isOpen,
  onClose,
  users,
}: {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
}) {
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      orgId: 1,
      status: "active",
      name: "",
      description: "",
      ownerId: undefined,
      startDate: undefined,
      targetDate: undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ProjectFormValues) => {
      const formattedData = {
        ...data,
        startDate: data.startDate
          ? new Date(data.startDate).toISOString()
          : undefined,
        targetDate: data.targetDate
          ? new Date(data.targetDate).toISOString()
          : undefined,
      };
      const response = await apiRequest("POST", "/api/projects", formattedData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      form.reset();
      onClose();
    },
  });

  const handleSubmit = (values: ProjectFormValues) => {
    mutation.mutate(values);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      data-testid="modal-new-project"
    >
      <div className="bg-card rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">新建项目</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>项目名称 *</FormLabel>
                  <FormControl>
                    <Input placeholder="输入项目名称" {...field} />
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
                  <FormLabel>项目描述</FormLabel>
                  <FormControl>
                    <Textarea placeholder="输入项目描述" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ownerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>项目负责人</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value ? String(field.value) : ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择项目负责人" />
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
                    <Input type="date" {...field} value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>目标日期</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={mutation.isPending}
              >
                取消
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 text-white hover:bg-blue-700"
                disabled={mutation.isPending}
                data-testid="btn-submit-project"
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

export default function ProjectList() {
  const [, setLocation] = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const projectsQuery = useQuery<ProjectsResponse>({
    queryKey: ["/api/projects"],
  });

  const usersQuery = useQuery<UsersResponse>({
    queryKey: ["/api/users"],
  });

  const projects = projectsQuery.data?.data ?? [];
  const users = usersQuery.data?.data ?? [];

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}`, { userId: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  const updateProjectStatusMutation = useMutation({
    mutationFn: async ({ projectId, status }: { projectId: number; status: string }) => {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { status, userId: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  const handleRowClick = (projectId: number) => {
    setLocation(`/projects/${projectId}`);
  };

  return (
    <div className="p-4 md:p-6">
      {/* Responsive Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0 mb-6">
        <h1
          className="text-xl md:text-3xl font-bold"
          data-testid="project-list-title"
        >
          项目列表
        </h1>
        <Button
          className="w-full md:w-auto"
          onClick={() => setIsModalOpen(true)}
          data-testid="btn-new-project"
        >
          新建项目
        </Button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-card rounded-lg shadow-sm overflow-hidden">
        <Table data-testid="project-table">
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>负责人</TableHead>
              <TableHead>开始日期</TableHead>
              <TableHead>目标日期</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  加载中...
                </TableCell>
              </TableRow>
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  暂无项目
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(project.id)}
                  data-testid={`project-row-${project.id}`}
                >
                  <TableCell className="font-medium max-w-[240px]">
                    <span className="block truncate">{project.name}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(project.status)}>
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {project.owner?.displayName || "-"}
                  </TableCell>
                  <TableCell>{formatDate(project.startDate)}</TableCell>
                  <TableCell>{formatDate(project.targetDate)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" data-testid={`btn-project-actions-${project.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {project.status !== 'completed' && (
                          <DropdownMenuItem
                            onClick={() => updateProjectStatusMutation.mutate({ projectId: project.id, status: 'completed' })}
                            data-testid={`btn-complete-project-${project.id}`}
                          >
                            <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                            标记完成
                          </DropdownMenuItem>
                        )}
                        {project.status !== 'archived' && (
                          <DropdownMenuItem
                            onClick={() => updateProjectStatusMutation.mutate({ projectId: project.id, status: 'archived' })}
                          >
                            归档
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            if (window.confirm(`确定要删除项目「${project.name}」吗？此操作不可撤销。`)) {
                              deleteProjectMutation.mutate(project.id);
                            }
                          }}
                          data-testid={`btn-delete-project-${project.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除项目
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card List */}
      <div
        className="md:hidden space-y-2"
        data-testid="project-card-list"
      >
        {projectsQuery.isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            加载中...
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无项目
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className="bg-card rounded-lg shadow-sm p-4 cursor-pointer hover-elevate"
              onClick={() => handleRowClick(project.id)}
              data-testid={`project-card-${project.id}`}
            >
              {/* Project Name */}
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium mb-2 truncate min-w-0">{project.name}</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 text-muted-foreground hover:text-foreground"
                      data-testid={`btn-project-actions-mobile-${project.id}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {project.status !== 'completed' && (
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); updateProjectStatusMutation.mutate({ projectId: project.id, status: 'completed' }); }}
                      >
                        <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                        标记完成
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`确定要删除项目「${project.name}」吗？`)) {
                          deleteProjectMutation.mutate(project.id);
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Status and Owner Row */}
              <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                <Badge className={getStatusColor(project.status)}>
                  {project.status}
                </Badge>
                <span data-testid={`project-owner-${project.id}`}>
                  {project.owner?.displayName || "-"}
                </span>
              </div>

              {/* Dates Row */}
              <div className="text-xs text-muted-foreground" data-testid={`project-dates-${project.id}`}>
                {formatDate(project.startDate)} → {formatDate(project.targetDate)}
              </div>
            </div>
          ))
        )}
      </div>

      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        users={users}
      />
    </div>
  );
}
