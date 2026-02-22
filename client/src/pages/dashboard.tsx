import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Task, Project } from "@shared/schema";

function Dashboard() {
  const [, navigate] = useLocation();

  const { data: tasksResponse, isLoading: tasksLoading } = useQuery<{ data: Task[] }>({
    queryKey: ["/api/tasks"],
  });

  const { data: projectsResponse, isLoading: projectsLoading } = useQuery<{ data: Project[] }>({
    queryKey: ["/api/projects"],
  });

  const tasks = tasksResponse?.data ?? [];
  const projects = projectsResponse?.data ?? [];

  const isLoading = tasksLoading || projectsLoading;

  // Helper to get project name by ID
  const getProjectName = (projectId: number) => {
    const project = projects.find((p) => p.id === projectId);
    return project?.name ?? "Unknown";
  };

  // Calculate stats
  const totalTasks = tasks.length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const completedCount = tasks.filter((t) => t.status === "done").length;
  
  const now = new Date();
  const overdueCount = tasks.filter((t) => {
    if (t.status === "done" || t.status === "cancelled") return false;
    if (!t.dueDate) return false;
    const dueDate = new Date(t.dueDate);
    return dueDate < now;
  }).length;

  // Get tasks assigned to userId=1
  const myTasks = tasks.filter((t) => t.assigneeId === 1);

  // Helper to format date as YYYY-MM-DD
  const formatDate = (dateVal: Date | string | null) => {
    if (!dateVal) return "";
    const date = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
    return date.toISOString().split("T")[0];
  };

  // Helper to get status color classes
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

  // Helper to get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "todo":
        return "To Do";
      case "in_progress":
        return "In Progress";
      case "in_review":
        return "In Review";
      case "done":
        return "Done";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  // Helper to get priority color classes
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

  // Helper to get priority label
  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "Urgent";
      case "high":
        return "High";
      case "medium":
        return "Medium";
      case "low":
        return "Low";
      default:
        return priority;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <h1 className="text-2xl font-bold text-foreground mb-8">Dashboard</h1>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* Total Tasks */}
        <div className="bg-card rounded-lg shadow-sm p-4 md:p-6" data-testid="stat-total">
          <div className="text-muted-foreground text-sm font-medium">Total Tasks</div>
          <div className="text-2xl md:text-3xl font-bold text-foreground mt-2">{totalTasks}</div>
        </div>

        {/* In Progress */}
        <div className="bg-card rounded-lg shadow-sm p-4 md:p-6" data-testid="stat-in-progress">
          <div className="text-muted-foreground text-sm font-medium">In Progress</div>
          <div className="text-2xl md:text-3xl font-bold text-yellow-600 mt-2">{inProgressCount}</div>
        </div>

        {/* Completed */}
        <div className="bg-card rounded-lg shadow-sm p-4 md:p-6" data-testid="stat-completed">
          <div className="text-muted-foreground text-sm font-medium">Completed</div>
          <div className="text-2xl md:text-3xl font-bold text-green-600 mt-2">{completedCount}</div>
        </div>

        {/* Overdue */}
        <div className="bg-card rounded-lg shadow-sm p-4 md:p-6" data-testid="stat-overdue">
          <div className="text-muted-foreground text-sm font-medium">Overdue</div>
          <div className="text-2xl md:text-3xl font-bold text-red-600 mt-2">{overdueCount}</div>
        </div>
      </div>

      {/* My Tasks Section */}
      <div className="bg-card rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">My Tasks</h2>
        </div>

        {myTasks.length === 0 ? (
          <div className="px-6 py-8 text-center text-muted-foreground">
            No tasks assigned to you
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="my-tasks-table">
                  <thead>
                    <tr className="border-b border-border bg-muted">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Due Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {myTasks.map((task) => (
                      <tr
                        key={task.id}
                        data-testid={`task-row-${task.id}`}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        className="hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 text-sm text-foreground">{task.title}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{getProjectName(task.projectId)}</td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-border">
              {myTasks.map((task) => (
                <div
                  key={task.id}
                  data-testid={`task-card-${task.id}`}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="p-4 cursor-pointer active:bg-muted/50 transition-colors"
                >
                  {/* Title */}
                  <div className="font-bold text-foreground mb-1">{task.title}</div>

                  {/* Project Name */}
                  <div className="text-xs text-muted-foreground mb-3">
                    {getProjectName(task.projectId)}
                  </div>

                  {/* Status and Priority Badges Row */}
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

                  {/* Due Date */}
                  {task.dueDate && (
                    <div className="text-xs text-muted-foreground">
                      Due: {formatDate(task.dueDate)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
