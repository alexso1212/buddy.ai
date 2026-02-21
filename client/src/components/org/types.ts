import type { User, Department } from "@shared/schema";

export type SafeUser = Omit<User, "invite_code">;

export interface DeptTreeNode {
  dept: Department;
  members: SafeUser[];
  children: DeptTreeNode[];
}

export interface DeptStats {
  total: number;
  active: number;
  done: number;
  overdue: number;
  dueSoon: number;
  blocked: number;
  urged: number;
}

export interface UserStats {
  total: number;
  active: number;
  done: number;
  overdue: number;
  dueSoon: number;
  blocked: number;
  urged: number;
}

export type DeptStatsMap = Record<string, DeptStats>;
export type UserStatsMap = Record<string, UserStats>;

export type CompletionLevel = "healthy" | "normal" | "attention" | "critical" | "idle";
export type WorkloadLevel = "overloaded" | "heavy" | "normal" | "light";
export type UrgencyType = "overdue" | "dueSoon" | "blocked" | "none";

export function getCompletionLevel(total: number, done: number): CompletionLevel {
  if (total === 0) return "idle";
  const rate = done / total;
  if (rate >= 0.8) return "healthy";
  if (rate >= 0.6) return "normal";
  if (rate >= 0.4) return "attention";
  return "critical";
}

export function getCompletionColor(level: CompletionLevel): string {
  switch (level) {
    case "healthy": return "#10B981";
    case "normal": return "#3B82F6";
    case "attention": return "#F59E0B";
    case "critical": return "#EF4444";
    case "idle": return "#9CA3AF";
  }
}

export function getCompletionRate(total: number, done: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

export function getWorkloadLevel(activeTasks: number): WorkloadLevel {
  if (activeTasks >= 6) return "overloaded";
  if (activeTasks >= 4) return "heavy";
  if (activeTasks >= 2) return "normal";
  return "light";
}

export function getWorkloadBg(level: WorkloadLevel): string {
  switch (level) {
    case "overloaded": return "rgba(239,68,68,0.06)";
    case "heavy": return "rgba(249,115,22,0.06)";
    case "normal": return "transparent";
    case "light": return "rgba(156,163,175,0.06)";
  }
}

export function getUrgency(stats: { overdue: number; dueSoon: number; blocked: number } | undefined): UrgencyType {
  if (!stats) return "none";
  if (stats.overdue > 0) return "overdue";
  if (stats.blocked > 0) return "blocked";
  if (stats.dueSoon > 0) return "dueSoon";
  return "none";
}

export function getLineColor(urgency: UrgencyType, isPlanned: boolean): string {
  if (isPlanned) return "#D1D5DB";
  switch (urgency) {
    case "overdue": return "#EF4444";
    case "dueSoon": return "#F59E0B";
    default: return "#D1D5DB";
  }
}

export function getLineStyle(isPlanned: boolean): string {
  return isPlanned ? "dashed" : "solid";
}
