import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { cn, getStatusColor, getStatusLabel } from "@/lib/utils";
import type { Task, Phase, User, Department } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, ChevronRight, CalendarDays, List, BarChart3 } from "lucide-react";

type AssigneeMap = Record<string, User[]>;
interface TasksResponse { tasks: Task[]; assigneeMap: AssigneeMap; }

const ROW_HEIGHT = 36;
const DAY_WIDTH = 40;
const WEEK_WIDTH = 60;
const LEFT_PANEL_WIDTH = 280;
const HEADER_HEIGHT = 40;

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
  const msPerDay = 86400000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getBarColor(status: string | null): string {
  switch (status) {
    case "active": return "bg-blue-500";
    case "review": return "bg-orange-500";
    case "done": return "bg-green-500";
    default: return "bg-gray-400";
  }
}

function getBarHexColor(status: string | null): string {
  switch (status) {
    case "active": return "#3b82f6";
    case "review": return "#f97316";
    case "done": return "#22c55e";
    default: return "#9ca3af";
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
  const [mobileView, setMobileView] = useState<"list" | "timeline">("list");

  const isCeoOrAdmin = user?.role === "ceo" || user?.role === "admin";

  useEffect(() => {
    if (!user) { navigate("/"); }
    else if (!isCeoOrAdmin) { navigate("/dashboard"); }
  }, [user, isCeoOrAdmin, navigate]);

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
        const taskAssignees = assigneeMap[t.id] ?? [];
        if (!taskAssignees.some((u) => u.dept_id === filterDept)) return false;
      }
      if (filterAssignee !== "all") {
        const taskAssignees = assigneeMap[t.id] ?? [];
        if (!taskAssignees.some((u) => u.id === filterAssignee)) return false;
      }
      return true;
    });
  }, [allTasks, filterPhase, filterStatus, filterDept, filterAssignee, assigneeMap]);

  const groupedByPhase = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const phase of allPhases) {
      map.set(phase.id, []);
    }
    map.set("__none__", []);
    for (const t of filteredTasks) {
      const key = t.phase ?? "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [filteredTasks, allPhases]);

  const visibleRows = useMemo(() => {
    const rows: { type: "phase"; phase: Phase; taskCount: number }[] | { type: "task"; task: Task; phaseId: string }[] = [];
    const result: Array<{ type: "phase"; phase: Phase; taskCount: number } | { type: "task"; task: Task; phaseId: string }> = [];
    for (const phase of allPhases) {
      const tasks = groupedByPhase.get(phase.id) ?? [];
      if (tasks.length === 0) continue;
      result.push({ type: "phase", phase, taskCount: tasks.length });
      if (!collapsedPhases[phase.id]) {
        for (const task of tasks) {
          result.push({ type: "task", task, phaseId: phase.id });
        }
      }
    }
    const nonPhaseTasks = groupedByPhase.get("__none__") ?? [];
    if (nonPhaseTasks.length > 0) {
      const fakePhase: Phase = { id: "__none__", label: "未分组", date_range: null, color: "#888", sort_order: 9999 };
      result.push({ type: "phase", phase: fakePhase, taskCount: nonPhaseTasks.length });
      if (!collapsedPhases["__none__"]) {
        for (const task of nonPhaseTasks) {
          result.push({ type: "task", task, phaseId: "__none__" });
        }
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
      if (t.created_at) {
        const d = new Date(t.created_at);
        if (d < earliest) earliest = new Date(d);
      }
      if (t.deadline) {
        const d = new Date(t.deadline);
        if (d > latest) latest = new Date(d);
      }
      if (t.grace_deadline) {
        const d = new Date(t.grace_deadline);
        if (d > latest) latest = new Date(d);
      }
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

    if (granularity === "day") {
      return { left: startOffset * DAY_WIDTH, width: duration * DAY_WIDTH };
    } else {
      return { left: (startOffset / 7) * WEEK_WIDTH, width: Math.max((duration / 7) * WEEK_WIDTH, WEEK_WIDTH * 0.3) };
    }
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
    if (granularity === "day") {
      return { left: startOffset * DAY_WIDTH, width: duration * DAY_WIDTH };
    } else {
      return { left: (startOffset / 7) * WEEK_WIDTH, width: Math.max((duration / 7) * WEEK_WIDTH, 4) };
    }
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
    if (granularity === "day") {
      return { left: startOffset * DAY_WIDTH, width: duration * DAY_WIDTH };
    } else {
      return { left: (startOffset / 7) * WEEK_WIDTH, width: Math.max((duration / 7) * WEEK_WIDTH, 4) };
    }
  }, [timelineStart, granularity]);

  const todayOffset = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const offset = daysBetween(timelineStart, today);
    if (granularity === "day") return offset * DAY_WIDTH;
    return (offset / 7) * WEEK_WIDTH;
  }, [timelineStart, granularity]);

  const scrollToToday = useCallback(() => {
    if (timelineRef.current) {
      const containerWidth = timelineRef.current.clientWidth;
      timelineRef.current.scrollLeft = todayOffset - containerWidth / 2;
    }
  }, [todayOffset]);

  const togglePhase = (phaseId: string) => {
    setCollapsedPhases((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };

  const taskRowIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const row of visibleRows) {
      if (row.type === "task") {
        map.set(row.task.id, idx);
      }
      idx++;
    }
    return map;
  }, [visibleRows]);

  const dependencyArrows = useMemo(() => {
    const arrows: Array<{
      fromX: number; fromY: number; toX: number; toY: number;
      color: string; key: string;
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

        arrows.push({
          fromX: fromBar.left + fromBar.width,
          fromY: fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
          toX: toBar.left,
          toY: toIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
          color: isDone ? "#9CA3AF" : "#EF4444",
          key: `${depId}-${task.id}`,
        });
      }
    }
    return arrows;
  }, [visibleRows, taskRowIndexMap, getTaskBarPosition, allTasks]);

  const getOverdueDays = (task: Task): number => {
    if (task.status === "done" || !task.deadline) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dl = new Date(task.deadline);
    dl.setHours(0, 0, 0, 0);
    const diff = daysBetween(dl, today);
    return diff > 0 ? diff : 0;
  };

  if (user && user.role !== "ceo" && user.role !== "admin") {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex items-center gap-3 p-3 border-b flex-wrap">
          <Skeleton className="h-9 w-32" />
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
          <div className="flex-1 p-3">
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      </div>
    );
  }

  const totalContentHeight = visibleRows.length * ROW_HEIGHT;

  return (
    <div className="flex flex-col h-screen bg-background">
      <style>{`
        .gantt-left-panel { width: 100%; min-width: 0; }
        @media (min-width: 768px) { .gantt-left-panel { width: ${LEFT_PANEL_WIDTH}px; min-width: ${LEFT_PANEL_WIDTH}px; } }
      `}</style>
      <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 border-b flex-wrap">
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
            {allPhases.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-[100px] md:w-[130px]" data-testid="gantt-filter-dept">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部部门</SelectItem>
            {allDepts.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-[100px] md:w-[130px]" data-testid="gantt-filter-assignee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部人员</SelectItem>
            {allUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
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

        <div className="flex items-center border rounded-md md:hidden">
          <Button
            variant={mobileView === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMobileView("list")}
            data-testid="gantt-mobile-list"
            className="rounded-r-none gap-1"
          >
            <List className="w-3.5 h-3.5" />
            列表
          </Button>
          <Button
            variant={mobileView === "timeline" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMobileView("timeline")}
            data-testid="gantt-mobile-timeline"
            className="rounded-l-none gap-1"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            时间轴
          </Button>
        </div>

        <div className="hidden md:flex items-center border rounded-md">
          <Button
            variant={granularity === "day" ? "default" : "ghost"}
            size="sm"
            onClick={() => setGranularity("day")}
            data-testid="gantt-toggle-day"
            className="rounded-r-none"
          >
            日
          </Button>
          <Button
            variant={granularity === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => setGranularity("week")}
            data-testid="gantt-toggle-week"
            className="rounded-l-none"
          >
            周
          </Button>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">暂无任务数据</p>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div
            className={cn(
              "flex flex-col gantt-left-panel",
              mobileView === "timeline" ? "hidden md:flex" : "flex"
            )}
          >
            <div
              className="border-b border-r bg-muted/30 flex items-center px-3 text-xs font-medium text-muted-foreground shrink-0"
              style={{ height: HEADER_HEIGHT }}
            >
              任务
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden border-r">
              {visibleRows.map((row, idx) => {
                if (row.type === "phase") {
                  const isCollapsed = collapsedPhases[row.phase.id];
                  return (
                    <div
                      key={`phase-${row.phase.id}`}
                      className="flex items-center gap-2 px-3 cursor-pointer hover-elevate bg-muted/20"
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => togglePhase(row.phase.id)}
                      data-testid={`gantt-phase-${row.phase.id}`}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: row.phase.color ?? "#888" }}
                      />
                      <span className="text-xs font-medium truncate">{row.phase.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                        {row.taskCount}
                      </span>
                    </div>
                  );
                }
                return (
                  <div
                    key={`task-${row.task.id}`}
                    className="flex items-center gap-2 px-3 pl-8 hover-elevate"
                    style={{ height: ROW_HEIGHT }}
                    data-testid={`gantt-task-${row.task.id}`}
                  >
                    <span className="text-xs truncate flex-1 min-w-0">{row.task.title}</span>
                    <Badge
                      className={cn("no-default-active-elevate text-[10px] shrink-0", getStatusColor(row.task.status ?? "pending"))}
                      variant="secondary"
                    >
                      {getStatusLabel(row.task.status ?? "pending")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={cn(
              "flex-1 overflow-auto",
              mobileView === "list" ? "hidden md:block" : "block"
            )}
            ref={timelineRef}
          >
            <div style={{ minWidth: totalWidth, position: "relative" }}>
              <div
                className="flex border-b bg-muted/30 sticky top-0"
                style={{ height: HEADER_HEIGHT, zIndex: 20 }}
              >
                {dateColumns.map((col, i) => {
                  const isToday = (() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const colDate = new Date(col.date);
                    colDate.setHours(0, 0, 0, 0);
                    return colDate.getTime() === today.getTime();
                  })();
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
                    return (
                      <div
                        key={`timeline-phase-${row.phase.id}`}
                        className="bg-muted/10"
                        style={{ height: ROW_HEIGHT, position: "absolute", top: idx * ROW_HEIGHT, width: totalWidth }}
                      />
                    );
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
                          data-testid={`gantt-bar-${task.id}`}
                        >
                          <div
                            className={cn(
                              "rounded-sm cursor-pointer transition-opacity hover:opacity-80",
                              getBarColor(task.status)
                            )}
                            style={{
                              width: Math.max(bar.width, 4),
                              height: "100%",
                            }}
                            onClick={() => navigate("/dashboard")}
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
                            <p className="text-[10px] text-muted-foreground">
                              负责人: {taskAssignees.map((u) => u.name).join(", ")}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            截止: {task.deadline}
                          </p>
                          <p className="text-[10px]">
                            状态: {getStatusLabel(task.status ?? "pending")}
                          </p>
                          {overdueDays > 0 && (
                            <p className="text-[10px] text-red-500 font-medium">
                              逾期 {overdueDays} 天
                            </p>
                          )}
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
                    <marker
                      id="arrowhead-gray"
                      markerWidth="8"
                      markerHeight="6"
                      refX="8"
                      refY="3"
                      orient="auto"
                    >
                      <polygon points="0 0, 8 3, 0 6" fill="#9CA3AF" />
                    </marker>
                    <marker
                      id="arrowhead-red"
                      markerWidth="8"
                      markerHeight="6"
                      refX="8"
                      refY="3"
                      orient="auto"
                    >
                      <polygon points="0 0, 8 3, 0 6" fill="#EF4444" />
                    </marker>
                  </defs>
                  {dependencyArrows.map((arrow) => {
                    const midX = (arrow.fromX + arrow.toX) / 2;
                    const markerId = arrow.color === "#9CA3AF" ? "arrowhead-gray" : "arrowhead-red";
                    return (
                      <path
                        key={arrow.key}
                        d={`M ${arrow.fromX} ${arrow.fromY} C ${midX} ${arrow.fromY}, ${midX} ${arrow.toY}, ${arrow.toX} ${arrow.toY}`}
                        fill="none"
                        stroke={arrow.color}
                        strokeWidth={1.5}
                        markerEnd={`url(#${markerId})`}
                      />
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
