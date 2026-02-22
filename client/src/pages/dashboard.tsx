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
        return "bg-gray-200 text-gray-700";
      case "in_progress":
        return "bg-yellow-200 text-yellow-700";
      case "in_review":
        return "bg-blue-200 text-blue-700";
      case "done":
        return "bg-green-200 text-green-700";
      case "cancelled":
        return "bg-gray-400 text-gray-800";
      default:
        return "bg-gray-200 text-gray-700";
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
        return "bg-red-100 text-red-700";
      case "high":
        return "bg-orange-100 text-orange-700";
      case "medium":
        return "bg-blue-100 text-blue-700";
      case "low":
        return "bg-gray-100 text-gray-600";
      default:
        return "bg-gray-100 text-gray-600";
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
        <div className="text-center text-gray-600">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* Total Tasks */}
        <div className="bg-white rounded-lg shadow-sm p-6" data-testid="stat-total">
          <div className="text-gray-600 text-sm font-medium">Total Tasks</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{totalTasks}</div>
        </div>

        {/* In Progress */}
        <div className="bg-white rounded-lg shadow-sm p-6" data-testid="stat-in-progress">
          <div className="text-gray-600 text-sm font-medium">In Progress</div>
          <div className="text-3xl font-bold text-yellow-600 mt-2">{inProgressCount}</div>
        </div>

        {/* Completed */}
        <div className="bg-white rounded-lg shadow-sm p-6" data-testid="stat-completed">
          <div className="text-gray-600 text-sm font-medium">Completed</div>
          <div className="text-3xl font-bold text-green-600 mt-2">{completedCount}</div>
        </div>

        {/* Overdue */}
        <div className="bg-white rounded-lg shadow-sm p-6" data-testid="stat-overdue">
          <div className="text-gray-600 text-sm font-medium">Overdue</div>
          <div className="text-3xl font-bold text-red-600 mt-2">{overdueCount}</div>
        </div>
      </div>

      {/* My Tasks Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">My Tasks</h2>
        </div>

        {myTasks.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">No tasks assigned to you</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="my-tasks-table">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {myTasks.map((task) => (
                  <tr
                    key={task.id}
                    data-testid={`task-row-${task.id}`}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-gray-900">{task.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{getProjectName(task.projectId)}</td>
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
                        <span className="text-sm text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {task.dueDate ? formatDate(task.dueDate) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
