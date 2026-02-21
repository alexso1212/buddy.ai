import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Lock, X } from "lucide-react";
import { OrgPersonRow } from "./OrgPersonRow";
import type { DeptTreeNode, SafeUser, DeptStatsMap, UserStatsMap } from "./types";
import {
  getCompletionLevel, getCompletionColor, getCompletionRate,
  getWorkloadLevel, getWorkloadBg, getUrgency,
} from "./types";
import type { Department } from "@shared/schema";

interface OrgNodeProps {
  node: DeptTreeNode;
  users: SafeUser[];
  deptStats: DeptStatsMap;
  userStats: UserStatsMap;
  currentUser: SafeUser;
  depth: number;
  isExpanded: boolean;
  onToggleExpand: (deptId: string) => void;
  onEditDept: (d: Department) => void;
  onEditUser: (u: SafeUser) => void;
}

export function OrgNode({
  node, users, deptStats, userStats, currentUser,
  depth, isExpanded, onToggleExpand, onEditDept, onEditUser,
}: OrgNodeProps) {
  const [activeTab, setActiveTab] = useState<"members" | "kpi" | "benefits">("members");
  const canEdit = currentUser.role === "ceo" || currentUser.role === "admin";
  const isCeo = currentUser.role === "ceo";
  const head = users.find((u) => u.id === node.dept.head_id);
  const stats = deptStats[node.dept.id];
  const total = stats?.total ?? 0;
  const done = stats?.done ?? 0;
  const active = stats?.active ?? 0;
  const level = getCompletionLevel(total, done);
  const borderColor = getCompletionColor(level);
  const rate = getCompletionRate(total, done);
  const workload = getWorkloadLevel(active);
  const bgTint = getWorkloadBg(workload);
  const urgency = getUrgency(stats);
  const isPlanned = !!node.dept.is_planned;

  const shadowClass = depth === 0 ? "shadow-md" : depth === 1 ? "shadow-sm" : "shadow-sm";
  const borderOpacity = depth >= 2 ? 0.8 : 1;

  const tabs: { key: "members" | "kpi" | "benefits"; label: string }[] = [
    { key: "members", label: "人员" },
    { key: "kpi", label: "职能&KPI" },
  ];
  if (isCeo) tabs.push({ key: "benefits", label: "利益" });

  return (
    <div
      className={`bg-card border rounded-lg transition-all duration-300 relative ${shadowClass} ${isPlanned ? "border-dashed" : ""}`}
      style={{
        borderLeftWidth: "4px",
        borderLeftColor: isPlanned ? "#D1D5DB" : borderColor,
        borderLeftStyle: isPlanned ? "dashed" : "solid",
        opacity: borderOpacity,
        backgroundColor: isPlanned ? "transparent" : bgTint === "transparent" ? undefined : bgTint,
        width: isExpanded ? 320 : 200,
        minWidth: isExpanded ? 320 : 200,
      }}
      data-testid={`org-node-${node.dept.id}`}
    >
      {urgency !== "none" && !isPlanned && (
        <div className="absolute -top-1 -right-1 z-10" data-testid={`urgency-dot-${node.dept.id}`}>
          {urgency === "overdue" && <span className="w-3 h-3 rounded-full bg-[#EF4444] block shadow-sm" />}
          {urgency === "dueSoon" && <span className="w-3 h-3 rounded-full bg-[#F59E0B] block shadow-sm" />}
          {urgency === "blocked" && <Lock className="w-3 h-3 text-muted-foreground" />}
        </div>
      )}

      <div
        className="p-2.5 cursor-pointer select-none"
        onClick={() => onToggleExpand(node.dept.id)}
        data-testid={`org-node-toggle-${node.dept.id}`}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-medium truncate">{node.dept.name}</span>
              {isPlanned && (
                <Badge className="rounded-full text-[10px] font-medium border-0 bg-amber-500/10 text-amber-600 px-1.5">待招</Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {head ? head.name : isPlanned ? "待招" : "—"} · {node.members.length}人
            </p>
          </div>
          {canEdit && (
            <button
              className="p-1 rounded hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onEditDept(node.dept); }}
              data-testid={`button-edit-dept-${node.dept.id}`}
            >
              <Edit2 className="w-3 h-3" />
            </button>
          )}
        </div>

        {!isPlanned && total > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${rate}%`, backgroundColor: borderColor }} />
            </div>
            <span className="text-[10px] text-muted-foreground w-7 text-right">{rate}%</span>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="border-t animate-in slide-in-from-top-2 duration-200">
          <div className="px-2.5 pt-1.5 pb-0 flex items-center justify-between">
            <div className="flex items-center gap-0 border-b border-border flex-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`px-2 py-1.5 text-[11px] transition-all duration-200 border-b-2 whitespace-nowrap ${
                    activeTab === tab.key
                      ? "border-foreground text-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={(e) => { e.stopPropagation(); setActiveTab(tab.key); }}
                  data-testid={`org-tab-${tab.key}-${node.dept.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              className="p-0.5 rounded hover:bg-muted text-muted-foreground ml-1"
              onClick={(e) => { e.stopPropagation(); onToggleExpand(node.dept.id); }}
              data-testid={`org-node-close-${node.dept.id}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="px-2.5 pb-2.5 pt-1.5 max-h-[300px] overflow-y-auto">
            {activeTab === "members" && (
              <div className="space-y-0.5">
                {node.members.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-2">{isPlanned ? "待招聘" : "暂无成员"}</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground px-2 pb-1">
                      <span>任务: {total}个 · 完成: {rate}% · 逾期: {stats?.overdue ?? 0}个</span>
                    </div>
                    {node.members.map((m) => (
                      <OrgPersonRow
                        key={m.id}
                        person={m}
                        isHead={m.id === node.dept.head_id}
                        userStats={userStats}
                        isCeoOrAdmin={canEdit}
                        onEditUser={onEditUser}
                      />
                    ))}
                  </>
                )}
              </div>
            )}

            {activeTab === "kpi" && (
              <div className="space-y-2 text-[11px] text-muted-foreground">
                {node.dept.description && (
                  <div>
                    <p className="font-medium text-foreground mb-0.5">职能描述</p>
                    <p>{node.dept.description}</p>
                  </div>
                )}
                {node.dept.kpi_description && (
                  <div>
                    <p className="font-medium text-foreground mb-0.5">KPI指标</p>
                    <p>{node.dept.kpi_description}</p>
                  </div>
                )}
                {!node.dept.description && !node.dept.kpi_description && (
                  <p className="py-2">暂无职能与KPI信息</p>
                )}
              </div>
            )}

            {activeTab === "benefits" && isCeo && (
              <div className="space-y-2 text-[11px] text-muted-foreground">
                {node.dept.compensation_note && (
                  <div>
                    <p className="font-medium text-foreground mb-0.5">薪酬结构</p>
                    <p>{node.dept.compensation_note}</p>
                  </div>
                )}
                {node.dept.budget_note && (
                  <div>
                    <p className="font-medium text-foreground mb-0.5">预算说明</p>
                    <p>{node.dept.budget_note}</p>
                  </div>
                )}
                {!node.dept.compensation_note && !node.dept.budget_note && (
                  <p className="py-2">暂无利益信息</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
