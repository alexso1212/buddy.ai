import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { cn, getStatusColor, getStatusLabel } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Task, Phase, User, Department } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChevronDown, ChevronRight, CalendarDays, ZoomIn, ZoomOut, Maximize2,
  RefreshCw, AlertTriangle, Clock, Users, Link2, ChevronLeft, BarChart3, ArrowLeft,
  X, CheckCircle2, ArrowRightCircle, Bot
} from "lucide-react";

type AssigneeMap = Record<string, User[]>;
interface TasksResponse { tasks: Task[]; assigneeMap: AssigneeMap; }
interface AnalysisData {
  blockers: any[];
  criticalPath: { path: { id: string; title: string; status: string }[]; risk: string };
  dueThisWeek: any[];
  workload: any[];
  nextWeekLookahead: any;
  computedAt: string;
  ai?: { summary: string; suggestions: string[] } | null;
}

const ROW_HEIGHT = 36;
const DAY_WIDTH = 40;
const WEEK_WIDTH = 60;
const LEFT_PANEL_WIDTH = 280;
const HEADER_HEIGHT = 40;
const ANALYSIS_WIDTH = 340;

function parsePhaseDate(dateRange: string | null, which: "start" | "end"): Date | null {
  if (!dateRange) return null;
  const parts = dateRange.split("-");
  if (parts.length !== 2) return null;
  const raw = which === "start" ? parts[0] : parts[1];
  const segments = raw.trim().split("/");
  if (segments.length !== 2) return null;
  const month = parseInt(segments[0], 10);
  const day = parseInt(segments[1], 10);
  if (isNaN(month) || isNaN(day)) return null;
  const year = new Date().getFullYear();
  return new Date(year, month - 1, day);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getBarHexColor(status: string | null): string {
  switch (status) {
    case "active": return "#3b82f6";
    case "review": return "#f97316";
    case "done": return "#22c55e";
    default: return "#9ca3af";
  }
}

function getWorkloadColor(level: string): string {
  switch (level) {
    case "overloaded": return "text-red-600 bg-red-50 dark:bg-red-950/30";
    case "busy": return "text-orange-600 bg-orange-50 dark:bg-orange-950/30";
    default: return "text-green-600 bg-green-50 dark:bg-green-950/30";
  }
}

function getWorkloadLabel(level: string): string {
  switch (level) {
    case "overloaded": return "超载";
    case "busy": return "繁忙";
    default: return "可用";
  }
}

export default function GanttChart() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [granularity, setGranularity] = useState<"day" | "week">("day");
  const [filterPhase, setFilterPhase] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});
  const [scale, setScale] = useState(1);
  const [autoFitDone, setAutoFitDone] = useState(false);
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [mobileView, setMobileView] = useState<"analysis" | "gantt">("analysis");
  const [isMobile, setIsMobile] = useState(false);

  const isCeoOrAdmin = user?.role === "ceo" || user?.role === "admin";

  useEffect(() => {
    if (!user) navigate("/");
    else if (!isCeoOrAdmin) navigate("/dashboard");
  }, [user, isCeoOrAdmin, navigate]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const { data: tasksData, isLoading: tasksLoading } = useQuery<TasksResponse>({
    queryKey: ["/api/tasks?view=all"],
  });
  const { data: phasesData, isLoading: phasesLoading } = useQuery<Phase[]>({
    queryKey: ["/api/phases"],
  });
  const { data: usersData, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });
  const { data: deptsData, isLoading: deptsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });
  const { data: analysisData, isLoading: analysisLoading } = useQuery<AnalysisData>({
    queryKey: ["/api/analysis"],
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/analysis/refresh"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/analysis"] }),
  });

  const isLoading = tasksLoading || phasesLoading || usersLoading || deptsLoading;
  const allTasks = tasksData?.tasks ?? [];
  const assigneeMap = tasksData?.assigneeMap ?? {};
  const allPhases = useMemo(() => [...(phasesData ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)), [phasesData]);
  const allUsers = usersData ?? [];
  const allDepts = deptsData ?? [];

  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (t.parent_id) return false;
      if (filterPhase !== "all" && t.phase !== filterPhase) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterDept !== "all") {
        const ta = assigneeMap[t.id] ?? [];
        if (!ta.some((u) => u.dept_id === filterDept)) return false;
      }
      if (filterAssignee !== "all") {
        const ta = assigneeMap[t.id] ?? [];
        if (!ta.some((u) => u.id === filterAssignee)) return false;
      }
      return true;
    });
  }, [allTasks, filterPhase, filterStatus, filterDept, filterAssignee, assigneeMap]);

  const groupedByPhase = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const phase of allPhases) map.set(phase.id, []);
    map.set("__none__", []);
    for (const t of filteredTasks) {
      const key = t.phase ?? "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [filteredTasks, allPhases]);

  const visibleRows = useMemo(() => {
    const result: Array<{ type: "phase"; phase: Phase; taskCount: number } | { type: "task"; task: Task; phaseId: string }> = [];
    for (const phase of allPhases) {
      const tasks = groupedByPhase.get(phase.id) ?? [];
      if (tasks.length === 0) continue;
      result.push({ type: "phase", phase, taskCount: tasks.length });
      if (!collapsedPhases[phase.id]) {
        for (const task of tasks) result.push({ type: "task", task, phaseId: phase.id });
      }
    }
    const nonPhaseTasks = groupedByPhase.get("__none__") ?? [];
    if (nonPhaseTasks.length > 0) {
      const fakePhase: Phase = { id: "__none__", label: "未分组", date_range: null, color: "#888", sort_order: 9999 };
      result.push({ type: "phase", phase: fakePhase, taskCount: nonPhaseTasks.length });
      if (!collapsedPhases["__none__"]) {
        for (const task of nonPhaseTasks) result.push({ type: "task", task, phaseId: "__none__" });
      }
    }
    return result;
  }, [allPhases, groupedByPhase, collapsedPhases]);

  const phaseMap = useMemo(() => {
    const m = new Map<string, Phase>();
    for (const p of allPhases) m.set(p.id, p);
    return m;
  }, [allPhases]);

  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    const today = new Date();
    let earliest = new Date(today);
    let latest = new Date(today);
    for (const t of filteredTasks) {
      if (t.created_at) { const d = new Date(t.created_at); if (d < earliest) earliest = new Date(d); }
      if (t.deadline) { const d = new Date(t.deadline); if (d > latest) latest = new Date(d); }
      if (t.grace_deadline) { const d = new Date(t.grace_deadline); if (d > latest) latest = new Date(d); }
    }
    for (const p of allPhases) {
      const start = parsePhaseDate(p.date_range, "start");
      const end = parsePhaseDate(p.date_range, "end");
      if (start && start < earliest) earliest = new Date(start);
      if (end && end > latest) latest = new Date(end);
    }
    earliest.setDate(earliest.getDate() - 3);
    latest.setDate(latest.getDate() + 7);
    earliest.setHours(0, 0, 0, 0);
    latest.setHours(0, 0, 0, 0);
    const total = daysBetween(earliest, latest) + 1;
    return { timelineStart: earliest, timelineEnd: latest, totalDays: Math.max(total, 14) };
  }, [filteredTasks, allPhases]);

  const colWidth = granularity === "day" ? DAY_WIDTH : WEEK_WIDTH;

  const dateColumns = useMemo(() => {
    const cols: { date: Date; label: string }[] = [];
    if (granularity === "day") {
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(timelineStart);
        d.setDate(d.getDate() + i);
        cols.push({ date: new Date(d), label: formatDate(d) });
      }
    } else {
      const d = new Date(timelineStart);
      const dayOfWeek = d.getDay();
      d.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      while (d <= timelineEnd) {
        cols.push({ date: new Date(d), label: formatDate(d) });
        d.setDate(d.getDate() + 7);
      }
    }
    return cols;
  }, [granularity, totalDays, timelineStart, timelineEnd]);

  const totalWidth = dateColumns.length * colWidth;

  const getTaskBarPosition = useCallback((task: Task) => {
    let startDate: Date;
    if (task.created_at) {
      startDate = new Date(task.created_at);
    } else {
      const phase = task.phase ? phaseMap.get(task.phase) : null;
      const parsed = phase ? parsePhaseDate(phase.date_range, "start") : null;
      startDate = parsed ?? new Date(timelineStart);
    }
    startDate.setHours(0, 0, 0, 0);
    const endDate = task.deadline ? new Date(task.deadline) : new Date(startDate);
    endDate.setHours(0, 0, 0, 0);
    const startOffset = daysBetween(timelineStart, startDate);
    const duration = Math.max(daysBetween(startDate, endDate), 1);
    if (granularity === "day") return { left: startOffset * DAY_WIDTH, width: duration * DAY_WIDTH };
    return { left: (startOffset / 7) * WEEK_WIDTH, width: Math.max((duration / 7) * WEEK_WIDTH, WEEK_WIDTH * 0.3) };
  }, [timelineStart, phaseMap, granularity]);

  const getGraceBarPosition = useCallback((task: Task) => {
    if (!task.grace_deadline || !task.deadline) return null;
    const deadlineDate = new Date(task.deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    const graceDate = new Date(task.grace_deadline);
    graceDate.setHours(0, 0, 0, 0);
    if (graceDate <= deadlineDate) return null;
    const startOffset = daysBetween(timelineStart, deadlineDate);
    const duration = daysBetween(deadlineDate, graceDate);
    if (granularity === "day") return { left: startOffset * DAY_WIDTH, width: duration * DAY_WIDTH };
    return { left: (startOffset / 7) * WEEK_WIDTH, width: Math.max((duration / 7) * WEEK_WIDTH, 4) };
  }, [timelineStart, granularity]);

  const getOverdueBarPosition = useCallback((task: Task) => {
    if (task.status === "done" || !task.deadline) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(task.deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    if (today <= deadlineDate) return null;
    const startOffset = daysBetween(timelineStart, deadlineDate);
    const duration = daysBetween(deadlineDate, today);
    if (granularity === "day") return { left: startOffset * DAY_WIDTH, width: duration * DAY_WIDTH };
    return { left: (startOffset / 7) * WEEK_WIDTH, width: Math.max((duration / 7) * WEEK_WIDTH, 4) };
  }, [timelineStart, granularity]);

  const todayOffset = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const offset = daysBetween(timelineStart, today);
    return granularity === "day" ? offset * DAY_WIDTH : (offset / 7) * WEEK_WIDTH;
  }, [timelineStart, granularity]);

  const scrollToToday = useCallback(() => {
    if (timelineRef.current) {
      const containerWidth = timelineRef.current.clientWidth;
      timelineRef.current.scrollLeft = todayOffset - containerWidth / 2;
    }
  }, [todayOffset]);

  const ganttContentWidth = LEFT_PANEL_WIDTH + totalWidth;

  const fitToScreen = useCallback(() => {
    if (zoomContainerRef.current) {
      const containerWidth = zoomContainerRef.current.clientWidth;
      if (ganttContentWidth > containerWidth) {
        setScale(Math.max(containerWidth / ganttContentWidth, 0.2));
      } else {
        setScale(1);
      }
    }
  }, [ganttContentWidth]);

  useEffect(() => {
    if (!isLoading && !autoFitDone && zoomContainerRef.current) {
      const containerWidth = zoomContainerRef.current.clientWidth;
      if (containerWidth < 768 && ganttContentWidth > containerWidth) {
        setScale(Math.max(containerWidth / ganttContentWidth, 0.2));
      }
      setAutoFitDone(true);
    }
  }, [isLoading, autoFitDone, ganttContentWidth]);

  useEffect(() => {
    const el = zoomContainerRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = { startDist: Math.hypot(dx, dy), startScale: scale };
        el.style.touchAction = "none";
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const newScale = pinchRef.current.startScale * (dist / pinchRef.current.startDist);
        setScale(Math.min(Math.max(newScale, 0.2), 2));
      }
    };
    const onTouchEnd = () => { pinchRef.current = null; el.style.touchAction = "auto"; };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => { el.removeEventListener("touchstart", onTouchStart); el.removeEventListener("touchmove", onTouchMove); el.removeEventListener("touchend", onTouchEnd); };
  }, [scale]);

  const togglePhase = (phaseId: string) => {
    setCollapsedPhases((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };

  const taskRowIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const row of visibleRows) {
      if (row.type === "task") map.set(row.task.id, idx);
      idx++;
    }
    return map;
  }, [visibleRows]);

  const taskDependencyMap = useMemo(() => {
    const deps = new Map<string, string[]>();
    const reverseDeps = new Map<string, string[]>();
    for (const t of allTasks) {
      if (!t.depends_on) continue;
      const depIds = t.depends_on.split(",").map((s) => s.trim()).filter(Boolean);
      deps.set(t.id, depIds);
      for (const depId of depIds) {
        if (!reverseDeps.has(depId)) reverseDeps.set(depId, []);
        reverseDeps.get(depId)!.push(t.id);
      }
    }
    return { deps, reverseDeps };
  }, [allTasks]);

  const activeTaskId = isMobile ? (detailTaskId || selectedTaskId) : (detailTaskId || hoveredTaskId);

  const hoveredRelatedIds = useMemo(() => {
    if (!activeTaskId) return new Set<string>();
    const related = new Set<string>();
    related.add(activeTaskId);
    const upstream = taskDependencyMap.deps.get(activeTaskId) ?? [];
    for (const id of upstream) related.add(id);
    const downstream = taskDependencyMap.reverseDeps.get(activeTaskId) ?? [];
    for (const id of downstream) related.add(id);
    return related;
  }, [activeTaskId, taskDependencyMap]);

  const criticalPathIds = useMemo(() => {
    if (!analysisData?.criticalPath?.path) return new Set<string>();
    return new Set(analysisData.criticalPath.path.map((p) => p.id));
  }, [analysisData]);

  const dependencyArrows = useMemo(() => {
    const arrows: Array<{
      fromX: number; fromY: number; toX: number; toY: number;
      color: string; key: string; visible: boolean;
    }> = [];
    for (const row of visibleRows) {
      if (row.type !== "task") continue;
      const task = row.task;
      if (!task.depends_on) continue;
      const depIds = task.depends_on.split(",").map((s) => s.trim()).filter(Boolean);
      const toIdx = taskRowIndexMap.get(task.id);
      if (toIdx === undefined) continue;
      const toBar = getTaskBarPosition(task);
      for (const depId of depIds) {
        const fromIdx = taskRowIndexMap.get(depId);
        if (fromIdx === undefined) continue;
        const depTask = allTasks.find((t) => t.id === depId);
        if (!depTask) continue;
        const fromBar = getTaskBarPosition(depTask);
        const isDone = depTask.status === "done";
        const isActiveVisible = activeTaskId && (hoveredRelatedIds.has(task.id) || hoveredRelatedIds.has(depId));
        const isCriticalVisible = showCriticalPath && criticalPathIds.has(task.id) && criticalPathIds.has(depId);
        arrows.push({
          fromX: fromBar.left + fromBar.width,
          fromY: fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
          toX: toBar.left,
          toY: toIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
          color: isCriticalVisible ? "#8B5CF6" : isDone ? "#9CA3AF" : "#EF4444",
          key: `${depId}-${task.id}`,
          visible: !!(isActiveVisible || isCriticalVisible),
        });
      }
    }
    return arrows;
  }, [visibleRows, taskRowIndexMap, getTaskBarPosition, allTasks, activeTaskId, hoveredRelatedIds, showCriticalPath, criticalPathIds]);

  const getOverdueDays = (task: Task): number => {
    if (task.status === "done" || !task.deadline) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dl = new Date(task.deadline);
    dl.setHours(0, 0, 0, 0);
    const diff = daysBetween(dl, today);
    return diff > 0 ? diff : 0;
  };

  if (user && user.role !== "ceo" && user.role !== "admin") return null;

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex items-center gap-3 p-3 border-b flex-wrap">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="flex-1 flex">
          <div className="w-[280px] border-r p-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
          <div className="flex-1 p-3"><Skeleton className="h-full w-full" /></div>
        </div>
      </div>
    );
  }

  const totalContentHeight = visibleRows.length * ROW_HEIGHT;

  const detailTask = detailTaskId ? allTasks.find((t) => t.id === detailTaskId) : null;

  const TaskDetailPanel = () => {
    if (!detailTask) return null;
    const taskAssignees = assigneeMap[detailTask.id] ?? [];
    const phase = detailTask.phase ? phaseMap.get(detailTask.phase) : null;
    const overdueDays = getOverdueDays(detailTask);
    const upstreamIds = (detailTask.depends_on ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const upstreamTasks = upstreamIds.map((id) => allTasks.find((t) => t.id === id)).filter(Boolean) as Task[];
    const downstreamIds = taskDependencyMap.reverseDeps.get(detailTask.id) ?? [];
    const downstreamTasks = downstreamIds.map((id) => allTasks.find((t) => t.id === id)).filter(Boolean) as Task[];
    const hasNoDeps = upstreamTasks.length === 0 && downstreamTasks.length === 0;

    const renderDepTask = (t: Task, direction: "upstream" | "downstream") => {
      const depAssignees = assigneeMap[t.id] ?? [];
      const isDone = t.status === "done";
      return (
        <div key={t.id} className="border rounded-md p-2 space-y-1" data-testid={`detail-dep-${direction}-${t.id}`}>
          <div className="flex items-center gap-1.5">
            {direction === "upstream" ? (
              isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            ) : (
              <ArrowRightCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            )}
            <span className="text-[11px] font-medium truncate flex-1 min-w-0">{t.title}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge className={cn("text-[10px]", getStatusColor(t.status ?? "pending"))} variant="secondary">
              {getStatusLabel(t.status ?? "pending")}
            </Badge>
            {direction === "upstream" && !isDone && (
              <span className="text-[10px] text-red-500 font-medium">阻塞中</span>
            )}
          </div>
          {depAssignees.length > 0 && (
            <p className="text-[10px] text-muted-foreground">负责人: {depAssignees.map((u) => u.name).join(", ")}</p>
          )}
          {t.deadline && (
            <p className="text-[10px] text-muted-foreground">截止: {t.deadline}</p>
          )}
        </div>
      );
    };

    return (
      <div className="h-full overflow-y-auto bg-background border-l" style={{ width: isMobile ? "100%" : ANALYSIS_WIDTH }} data-testid="task-detail-panel">
        <div className="p-3 border-b flex items-start justify-between gap-2 sticky top-0 bg-background z-10">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold break-words" data-testid="detail-task-title">{detailTask.title}</p>
            <Badge className={cn("text-[10px] mt-1", getStatusColor(detailTask.status ?? "pending"))} variant="secondary" data-testid="detail-task-status">
              {getStatusLabel(detailTask.status ?? "pending")}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setDetailTaskId(null)} data-testid="detail-close">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-3 space-y-4">
          <section data-testid="detail-task-info">
            <p className="text-xs font-semibold mb-2">任务信息</p>
            <div className="space-y-1.5 text-[11px]">
              {detailTask.deadline && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">截止日期:</span>
                  <span data-testid="detail-deadline">{detailTask.deadline}</span>
                </div>
              )}
              {detailTask.grace_deadline && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">宽限期:</span>
                  <span data-testid="detail-grace-deadline">{detailTask.grace_deadline}</span>
                </div>
              )}
              {overdueDays > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">逾期天数:</span>
                  <span className="text-red-500 font-medium" data-testid="detail-overdue">{overdueDays} 天</span>
                </div>
              )}
              {taskAssignees.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground shrink-0">负责人:</span>
                  <span data-testid="detail-assignees">{taskAssignees.map((u) => u.name).join(", ")}</span>
                </div>
              )}
              {phase && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">阶段:</span>
                  <span className="flex items-center gap-1" data-testid="detail-phase">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: phase.color ?? "#888" }} />
                    {phase.label}
                  </span>
                </div>
              )}
              {detailTask.priority != null && detailTask.priority > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">优先级:</span>
                  <Badge variant="secondary" className={cn("text-[10px]", detailTask.priority === 2 ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300")} data-testid="detail-priority">
                    {detailTask.priority === 2 ? "紧急" : "重要"}
                  </Badge>
                </div>
              )}
            </div>
          </section>

          <section data-testid="detail-dependencies">
            <p className="text-xs font-semibold mb-2">依赖关系</p>

            {hasNoDeps ? (
              <p className="text-[11px] text-muted-foreground" data-testid="detail-no-deps">无依赖关系</p>
            ) : (
              <div className="space-y-3">
                {upstreamTasks.length > 0 && (
                  <div data-testid="detail-upstream-section">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <ArrowRightCircle className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-medium">上游依赖 (前置任务)</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">{upstreamTasks.length}</Badge>
                    </div>
                    <div className="space-y-1.5 pl-5">
                      {upstreamTasks.map((t) => renderDepTask(t, "upstream"))}
                    </div>
                  </div>
                )}

                {downstreamTasks.length > 0 && (
                  <div data-testid="detail-downstream-section">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <ArrowRightCircle className="w-3.5 h-3.5 text-muted-foreground rotate-180" />
                      <span className="text-[11px] font-medium">下游任务 (被阻塞)</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">{downstreamTasks.length}</Badge>
                    </div>
                    <div className="space-y-1.5 pl-5">
                      {downstreamTasks.map((t) => renderDepTask(t, "downstream"))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  };

  const AnalysisPanel = () => (
    <div className="h-full overflow-y-auto bg-background border-l" style={{ width: isMobile ? "100%" : ANALYSIS_WIDTH }} data-testid="analysis-panel">
      <div className="p-3 border-b flex items-center justify-between sticky top-0 bg-background z-10">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">每日分析</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            data-testid="analysis-refresh"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshMutation.isPending && "animate-spin")} />
          </Button>
          {!isMobile && (
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setShowAnalysis(false)} data-testid="analysis-close">
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {analysisLoading ? (
        <div className="p-3 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : analysisData ? (
        <div className="p-3 space-y-4">
          {analysisData.computedAt && (
            <p className="text-[10px] text-muted-foreground">
              更新: {new Date(analysisData.computedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}

          <section data-testid="analysis-ai" className="rounded-lg border border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Bot className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">AI 分析建议</span>
            </div>
            {analysisData.ai ? (
              <div className="space-y-1.5">
                <p className="text-[11px] text-foreground">{analysisData.ai.summary}</p>
                {analysisData.ai.suggestions.length > 0 && (
                  <ul className="space-y-0.5 pl-3">
                    {analysisData.ai.suggestions.map((s: string, i: number) => (
                      <li key={i} className="text-[10px] text-muted-foreground list-disc">{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-blue-500/70 dark:text-blue-400/60">AI 分析功能即将上线，敬请期待</p>
            )}
          </section>

          <section data-testid="analysis-blockers">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs font-semibold">阻塞项</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1">{analysisData.blockers.length}</Badge>
            </div>
            {analysisData.blockers.length === 0 ? (
              <p className="text-[10px] text-muted-foreground pl-5">无阻塞任务</p>
            ) : (
              <div className="space-y-2 pl-5">
                {analysisData.blockers.slice(0, 5).map((b: any, i: number) => (
                  <div key={i} className="text-[11px] border rounded-md p-2 space-y-1">
                    <p className="font-medium truncate">{b.taskTitle}</p>
                    <p className="text-muted-foreground">
                      被阻塞于: <span className="text-foreground">{b.blockerTitle}</span>
                      <span className={cn("ml-1", b.blockerStatus !== "done" ? "text-orange-500" : "text-green-500")}>
                        ({getStatusLabel(b.blockerStatus)})
                      </span>
                    </p>
                    {b.blockerAssignees?.length > 0 && (
                      <p className="text-muted-foreground">负责人: {b.blockerAssignees.join(", ")}</p>
                    )}
                    {b.overdueDays > 0 && <p className="text-red-500">逾期 {b.overdueDays} 天</p>}
                    {b.suggestion && <p className="text-primary/80 italic">{b.suggestion}</p>}
                  </div>
                ))}
                {analysisData.blockers.length > 5 && (
                  <p className="text-[10px] text-muted-foreground">还有 {analysisData.blockers.length - 5} 项...</p>
                )}
              </div>
            )}
          </section>

          <section data-testid="analysis-critical-path">
            <div className="flex items-center gap-1.5 mb-2">
              <Link2 className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs font-semibold">关键链</span>
              <Button
                variant={showCriticalPath ? "default" : "outline"}
                size="sm"
                className="h-5 text-[10px] px-2 ml-auto"
                onClick={() => setShowCriticalPath(!showCriticalPath)}
                data-testid="toggle-critical-path"
              >
                {showCriticalPath ? "隐藏" : "高亮"}
              </Button>
            </div>
            {analysisData.criticalPath.path.length === 0 ? (
              <p className="text-[10px] text-muted-foreground pl-5">无依赖链</p>
            ) : (
              <div className="pl-5 space-y-1">
                <div className="flex flex-wrap gap-1">
                  {analysisData.criticalPath.path.map((p: any, i: number) => (
                    <span key={i} className="inline-flex items-center gap-0.5">
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded",
                        p.status === "done" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        showCriticalPath ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {p.title.length > 8 ? p.title.slice(0, 8) + "..." : p.title}
                      </span>
                      {i < analysisData.criticalPath.path.length - 1 && (
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      )}
                    </span>
                  ))}
                </div>
                {analysisData.criticalPath.risk && (
                  <p className="text-[10px] text-orange-500">{analysisData.criticalPath.risk}</p>
                )}
              </div>
            )}
          </section>

          <section data-testid="analysis-due-this-week">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs font-semibold">本周截止</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1">{analysisData.dueThisWeek.length}</Badge>
            </div>
            {analysisData.dueThisWeek.length === 0 ? (
              <p className="text-[10px] text-muted-foreground pl-5">本周无截止任务</p>
            ) : (
              <div className="space-y-1 pl-5">
                {analysisData.dueThisWeek.map((d: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className={cn(
                      "shrink-0 text-[10px] px-1.5 py-0.5 rounded",
                      d.isOverdue ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                      d.diffDays <= 1 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {d.dayLabel}
                    </span>
                    <span className="truncate flex-1 min-w-0">{d.title}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section data-testid="analysis-workload">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-semibold">工作量</span>
            </div>
            <div className="space-y-1 pl-5">
              {analysisData.workload.filter((w: any) => w.activeCount > 0).slice(0, 8).map((w: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="w-12 truncate shrink-0 font-medium">{w.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        w.level === "overloaded" ? "bg-red-500" : w.level === "busy" ? "bg-orange-400" : "bg-green-400"
                      )}
                      style={{ width: `${Math.min((w.activeCount / 8) * 100, 100)}%` }}
                    />
                  </div>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded shrink-0", getWorkloadColor(w.level))}>
                    {w.activeCount}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {analysisData.nextWeekLookahead && (
            <section data-testid="analysis-next-week">
              <div className="flex items-center gap-1.5 mb-2">
                <CalendarDays className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-semibold">下周预览</span>
                <span className="text-[10px] text-muted-foreground">{analysisData.nextWeekLookahead.dateRange}</span>
              </div>
              <div className="pl-5 space-y-1">
                <div className="flex items-center gap-3 text-[11px]">
                  <span>本周 <strong>{analysisData.nextWeekLookahead.thisWeekCount}</strong></span>
                  <span className="text-muted-foreground">→</span>
                  <span>下周 <strong>{analysisData.nextWeekLookahead.nextWeekCount}</strong></span>
                  <span className="text-[10px] text-muted-foreground">({analysisData.nextWeekLookahead.ratio}x)</span>
                </div>
                {analysisData.nextWeekLookahead.busiestDay && (
                  <p className="text-[10px] text-muted-foreground">
                    最忙: {analysisData.nextWeekLookahead.busiestDay} ({analysisData.nextWeekLookahead.busiestDayCount}个任务)
                  </p>
                )}
                {analysisData.nextWeekLookahead.gateTasks?.length > 0 && (
                  <div className="mt-1">
                    <p className="text-[10px] text-orange-500 font-medium mb-0.5">门控任务:</p>
                    {analysisData.nextWeekLookahead.gateTasks.slice(0, 3).map((g: any, i: number) => (
                      <p key={i} className="text-[10px] text-muted-foreground">
                        {g.title} → {g.downstreamCount}个下游
                        {g.isOverdue && <span className="text-red-500 ml-1">逾期</span>}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="p-3 text-xs text-muted-foreground">分析数据加载失败</div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex items-center gap-2 p-2 border-b">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            data-testid="button-back"
          >
            <ArrowLeft />
          </Button>
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold flex-1">甘特图</span>
          <Button
            variant={mobileView === "analysis" ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setMobileView("analysis")}
            data-testid="mobile-tab-analysis"
          >
            分析
          </Button>
          <Button
            variant={mobileView === "gantt" ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setMobileView("gantt")}
            data-testid="mobile-tab-gantt"
          >
            甘特图
          </Button>
        </div>

        {mobileView === "analysis" ? (
          <div className="flex-1 overflow-auto">
            <AnalysisPanel />
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-1 p-1.5 border-b flex-wrap">
              <Select value={filterPhase} onValueChange={setFilterPhase}>
                <SelectTrigger className="w-[90px] h-8 text-xs" data-testid="gantt-filter-phase">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部阶段</SelectItem>
                  {allPhases.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[80px] h-8 text-xs" data-testid="gantt-filter-status">
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
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={fitToScreen} data-testid="gantt-zoom-fit">
                <Maximize2 className="w-3 h-3" />
              </Button>
            </div>
            <div className={cn("overflow-auto", detailTaskId ? "h-[45vh]" : "flex-1")} ref={zoomContainerRef}>
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  width: ganttContentWidth,
                  minHeight: HEADER_HEIGHT + totalContentHeight,
                }}
              >
                {renderGanttContent()}
              </div>
            </div>
            {detailTaskId && (
              <div className="border-t overflow-auto" style={{ height: "55vh" }} data-testid="mobile-detail-container">
                <TaskDetailPanel />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderGanttContent() {
    return (
      <div className="flex" style={{ width: ganttContentWidth }}>
        <div className="flex flex-col shrink-0" style={{ width: LEFT_PANEL_WIDTH }}>
          <div className="border-b border-r bg-muted/30 flex items-center px-3 text-xs font-medium text-muted-foreground" style={{ height: HEADER_HEIGHT }}>
            任务
          </div>
          <div className="border-r">
            {visibleRows.map((row) => {
              if (row.type === "phase") {
                const isCollapsed = collapsedPhases[row.phase.id];
                return (
                  <div
                    key={`phase-${row.phase.id}`}
                    className="flex items-center gap-2 px-3 cursor-pointer hover:bg-muted/40 bg-muted/20"
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => togglePhase(row.phase.id)}
                    data-testid={`gantt-phase-${row.phase.id}`}
                  >
                    {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.phase.color ?? "#888" }} />
                    <span className="text-xs font-medium truncate">{row.phase.label}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{row.taskCount}</span>
                  </div>
                );
              }
              const isActive = activeTaskId === row.task.id;
              const isRelated = hoveredRelatedIds.has(row.task.id);
              const isCritical = showCriticalPath && criticalPathIds.has(row.task.id);
              return (
                <div
                  key={`task-${row.task.id}`}
                  className={cn(
                    "flex items-center gap-2 px-3 pl-8 transition-colors cursor-pointer",
                    isActive && "bg-blue-50 dark:bg-blue-950/20",
                    !isActive && isRelated && "bg-blue-50/50 dark:bg-blue-950/10",
                    isCritical && "bg-purple-50/50 dark:bg-purple-950/10",
                    !isActive && !isRelated && !isCritical && "hover:bg-muted/30"
                  )}
                  style={{ height: ROW_HEIGHT }}
                  onMouseEnter={isMobile ? undefined : () => setHoveredTaskId(row.task.id)}
                  onMouseLeave={isMobile ? undefined : () => setHoveredTaskId(null)}
                  onClick={isMobile ? () => {
                    setSelectedTaskId(selectedTaskId === row.task.id ? null : row.task.id);
                    setDetailTaskId(detailTaskId === row.task.id ? null : row.task.id);
                  } : () => {
                    setDetailTaskId(detailTaskId === row.task.id ? null : row.task.id);
                  }}
                  data-testid={`gantt-task-${row.task.id}`}
                >
                  <span className="text-xs truncate flex-1 min-w-0">{row.task.title}</span>
                  <Badge
                    className={cn("text-[10px] shrink-0", getStatusColor(row.task.status ?? "pending"))}
                    variant="secondary"
                  >
                    {getStatusLabel(row.task.status ?? "pending")}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ width: totalWidth }} ref={timelineRef}>
          <div style={{ width: totalWidth, position: "relative" }}>
            <div className="flex border-b bg-muted/30" style={{ height: HEADER_HEIGHT }}>
              {dateColumns.map((col, i) => {
                const isToday = (() => { const t = new Date(); t.setHours(0, 0, 0, 0); const c = new Date(col.date); c.setHours(0, 0, 0, 0); return c.getTime() === t.getTime(); })();
                const isWeekend = col.date.getDay() === 0 || col.date.getDay() === 6;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-center text-[10px] text-muted-foreground border-r shrink-0",
                      isToday && "bg-red-50 dark:bg-red-950/30 font-medium text-red-600 dark:text-red-400",
                      isWeekend && !isToday && "bg-muted/50"
                    )}
                    style={{ width: colWidth, minWidth: colWidth }}
                  >
                    {col.label}
                  </div>
                );
              })}
            </div>

            <div style={{ position: "relative", height: totalContentHeight }}>
              {visibleRows.map((row, idx) => {
                if (row.type === "phase") {
                  return <div key={`timeline-phase-${row.phase.id}`} className="bg-muted/10" style={{ height: ROW_HEIGHT, position: "absolute", top: idx * ROW_HEIGHT, width: totalWidth }} />;
                }
                return null;
              })}

              {dateColumns.map((col, i) => {
                const isWeekend = col.date.getDay() === 0 || col.date.getDay() === 6;
                return (
                  <div
                    key={`grid-${i}`}
                    className={cn("border-r absolute top-0", isWeekend ? "bg-muted/20" : "")}
                    style={{ left: i * colWidth, width: colWidth, height: totalContentHeight }}
                  />
                );
              })}

              {visibleRows.map((row, idx) => {
                if (row.type !== "task") return null;
                const task = row.task;
                const bar = getTaskBarPosition(task);
                const graceBar = getGraceBarPosition(task);
                const overdueBar = getOverdueBarPosition(task);
                const taskAssignees = assigneeMap[task.id] ?? [];
                const overdueDays = getOverdueDays(task);
                const isActive = activeTaskId === task.id;
                const isRelated = hoveredRelatedIds.has(task.id);
                const isCritical = showCriticalPath && criticalPathIds.has(task.id);

                return (
                  <Tooltip key={`bar-${task.id}`}>
                    <TooltipTrigger asChild>
                      <div
                        style={{
                          position: "absolute",
                          top: idx * ROW_HEIGHT + 6,
                          left: bar.left,
                          height: ROW_HEIGHT - 12,
                        }}
                        className="flex items-center"
                        onMouseEnter={isMobile ? undefined : () => setHoveredTaskId(task.id)}
                        onMouseLeave={isMobile ? undefined : () => setHoveredTaskId(null)}
                        onClick={() => {
                          if (isMobile) {
                            setSelectedTaskId(selectedTaskId === task.id ? null : task.id);
                          }
                          setDetailTaskId(detailTaskId === task.id ? null : task.id);
                        }}
                        data-testid={`gantt-bar-${task.id}`}
                      >
                        <div
                          className={cn(
                            "rounded-sm cursor-pointer transition-all",
                            isActive && "ring-2 ring-blue-400 ring-offset-1",
                            isCritical && !isActive && "ring-2 ring-purple-400 ring-offset-1",
                          )}
                          style={{
                            width: Math.max(bar.width, 4),
                            height: "100%",
                            backgroundColor: getBarHexColor(task.status),
                            opacity: (activeTaskId && !isActive && !isRelated && !isCritical) ? 0.3 : 1,
                          }}
                        />
                        {graceBar && (
                          <div
                            className="rounded-sm"
                            style={{
                              position: "absolute",
                              left: graceBar.left - bar.left,
                              width: Math.max(graceBar.width, 4),
                              height: "100%",
                              backgroundColor: getBarHexColor(task.status),
                              opacity: 0.3,
                            }}
                          />
                        )}
                        {overdueBar && (
                          <div
                            className="rounded-sm"
                            style={{
                              position: "absolute",
                              left: overdueBar.left - bar.left,
                              width: Math.max(overdueBar.width, 4),
                              height: "100%",
                              border: "2px dashed #EF4444",
                              backgroundColor: "transparent",
                            }}
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="space-y-1">
                        <p className="text-xs font-medium">{task.title}</p>
                        {taskAssignees.length > 0 && (
                          <p className="text-[10px] text-muted-foreground">负责人: {taskAssignees.map((u) => u.name).join(", ")}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground">截止: {task.deadline}</p>
                        <p className="text-[10px]">状态: {getStatusLabel(task.status ?? "pending")}</p>
                        {overdueDays > 0 && <p className="text-[10px] text-red-500 font-medium">逾期 {overdueDays} 天</p>}
                        {task.depends_on && <p className="text-[10px] text-blue-500">有依赖关系 (悬浮查看)</p>}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}

              <div
                data-testid="gantt-today-line"
                style={{
                  position: "absolute",
                  left: todayOffset,
                  top: 0,
                  height: totalContentHeight,
                  width: 0,
                  borderLeft: "2px dashed #EF4444",
                  zIndex: 10,
                  pointerEvents: "none",
                }}
              />

              <svg
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: totalWidth,
                  height: totalContentHeight,
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                <defs>
                  <marker id="arrowhead-gray" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#9CA3AF" />
                  </marker>
                  <marker id="arrowhead-red" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#EF4444" />
                  </marker>
                  <marker id="arrowhead-purple" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#8B5CF6" />
                  </marker>
                </defs>
                {dependencyArrows.filter((a) => a.visible).map((arrow) => {
                  const midX = (arrow.fromX + arrow.toX) / 2;
                  const markerId = arrow.color === "#9CA3AF" ? "arrowhead-gray" : arrow.color === "#8B5CF6" ? "arrowhead-purple" : "arrowhead-red";
                  return (
                    <path
                      key={arrow.key}
                      d={`M ${arrow.fromX} ${arrow.fromY} C ${midX} ${arrow.fromY}, ${midX} ${arrow.toY}, ${arrow.toX} ${arrow.toY}`}
                      fill="none"
                      stroke={arrow.color}
                      strokeWidth={2}
                      markerEnd={`url(#${markerId})`}
                      opacity={0.8}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 border-b flex-wrap">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          data-testid="button-back"
        >
          <ArrowLeft />
        </Button>
        <div className="flex items-center gap-1.5 mr-2">
          <CalendarDays className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-semibold">甘特图</span>
        </div>

        <Select value={filterPhase} onValueChange={setFilterPhase}>
          <SelectTrigger className="w-[100px] md:w-[130px]" data-testid="gantt-filter-phase">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部阶段</SelectItem>
            {allPhases.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-[100px] md:w-[130px]" data-testid="gantt-filter-dept">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部部门</SelectItem>
            {allDepts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-[100px] md:w-[130px]" data-testid="gantt-filter-assignee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部人员</SelectItem>
            {allUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[100px] md:w-[130px]" data-testid="gantt-filter-status">
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

        <Button variant="outline" size="sm" onClick={scrollToToday} data-testid="gantt-btn-today">
          今天
        </Button>

        <div className="flex items-center border rounded-md">
          <Button variant={granularity === "day" ? "default" : "ghost"} size="sm" onClick={() => setGranularity("day")} data-testid="gantt-toggle-day" className="rounded-r-none">日</Button>
          <Button variant={granularity === "week" ? "default" : "ghost"} size="sm" onClick={() => setGranularity("week")} data-testid="gantt-toggle-week" className="rounded-l-none">周</Button>
        </div>

        <div className="flex items-center gap-1 border rounded-md">
          <Button variant="ghost" size="sm" onClick={() => setScale((s) => Math.min(s + 0.1, 2))} data-testid="gantt-zoom-in" className="px-2">
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground w-9 text-center" data-testid="gantt-zoom-level">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={() => setScale((s) => Math.max(s - 0.1, 0.2))} data-testid="gantt-zoom-out" className="px-2">
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={fitToScreen} data-testid="gantt-zoom-fit" className="px-2">
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {!showAnalysis && (
          <Button variant="outline" size="sm" onClick={() => setShowAnalysis(true)} data-testid="gantt-show-analysis" className="ml-auto">
            <BarChart3 className="w-3.5 h-3.5 mr-1" />
            分析
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 px-3 py-1 border-b bg-muted/10 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-gray-400" /> 待开始</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-blue-500" /> 进行中</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-orange-500" /> 审核中</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-green-500" /> 已完成</span>
        <span className="flex items-center gap-1"><span className="w-3 h-1 border border-dashed border-red-400 rounded-sm" /> 逾期</span>
        <span className="text-muted-foreground/50">|</span>
        <span>悬浮/点击任务查看依赖详情</span>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">暂无任务数据</p>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-auto" ref={zoomContainerRef}>
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                width: ganttContentWidth,
                minHeight: HEADER_HEIGHT + totalContentHeight,
              }}
            >
              {renderGanttContent()}
            </div>
          </div>

          {detailTaskId ? <TaskDetailPanel /> : showAnalysis && <AnalysisPanel />}
        </div>
      )}
    </div>
  );
}