import { useState, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Lock, ChevronRight, ChevronDown, X } from "lucide-react";
import { OrgPersonRow } from "./OrgPersonRow";
import { OrgColorLegend } from "./OrgColorLegend";
import type { DeptTreeNode, SafeUser, DeptStatsMap, UserStatsMap } from "./types";
import {
  getCompletionLevel, getCompletionColor, getCompletionRate,
  getWorkloadLevel, getWorkloadBg, getUrgency,
} from "./types";
import type { Department } from "@shared/schema";

interface OrgMobileTreeProps {
  tree: DeptTreeNode[];
  users: SafeUser[];
  deptStats: DeptStatsMap;
  userStats: UserStatsMap;
  currentUser: SafeUser;
  onEditDept: (d: Department) => void;
  onEditUser: (u: SafeUser) => void;
}

function MobileNode({ node, users, deptStats, userStats, currentUser, depth, expandedId, onExpand, focusId, onFocus, onEditDept, onEditUser }: {
  node: DeptTreeNode;
  users: SafeUser[];
  deptStats: DeptStatsMap;
  userStats: UserStatsMap;
  currentUser: SafeUser;
  depth: number;
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  focusId: string | null;
  onFocus: (id: string | null) => void;
  onEditDept: (d: Department) => void;
  onEditUser: (u: SafeUser) => void;
}) {
  const [folded, setFolded] = useState(depth >= 2);
  const [activeTab, setActiveTab] = useState<"members" | "kpi" | "benefits">("members");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const isExpanded = expandedId === node.dept.id;
  const hasChildren = node.children.length > 0;
  const dimmed = focusId !== null && !(focusId === node.dept.id || isAncestorOrDescendant(node, focusId));

  const handleLongPress = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      onFocus(focusId === node.dept.id ? null : node.dept.id);
    }, 400);
  }, [focusId, node.dept.id, onFocus]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const tabs: { key: "members" | "kpi" | "benefits"; label: string }[] = [
    { key: "members", label: "人员" },
    { key: "kpi", label: "职能&KPI" },
  ];
  if (isCeo) tabs.push({ key: "benefits", label: "利益" });

  return (
    <div
      className="transition-opacity duration-300"
      style={{ opacity: dimmed ? 0.15 : 1, paddingLeft: depth > 0 ? 16 : 0 }}
      data-testid={`mobile-node-${node.dept.id}`}
    >
      {depth > 0 && (
        <div className="absolute left-0 top-0 bottom-0" style={{ marginLeft: (depth - 1) * 16 }}>
          <div className="w-px h-full border-l border-dashed border-border" />
        </div>
      )}

      <div
        className={`border rounded-lg mb-2 transition-all duration-200 relative ${isPlanned ? "border-dashed border-gray-300" : ""}`}
        style={{
          borderLeftWidth: "4px",
          borderLeftColor: isPlanned ? "#D1D5DB" : borderColor,
          borderLeftStyle: isPlanned ? "dashed" : "solid",
          backgroundColor: isPlanned ? "transparent" : bgTint === "transparent" ? undefined : bgTint,
        }}
        onPointerDown={handleLongPress}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
      >
        {urgency !== "none" && !isPlanned && (
          <div className="absolute -top-1 -right-1 z-10">
            {urgency === "overdue" && <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] block shadow-sm" />}
            {urgency === "dueSoon" && <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] block shadow-sm" />}
            {urgency === "blocked" && <Lock className="w-2.5 h-2.5 text-muted-foreground" />}
          </div>
        )}

        <div
          className="flex items-center gap-2 p-3 cursor-pointer"
          onClick={() => onExpand(isExpanded ? null : node.dept.id)}
          data-testid={`mobile-toggle-${node.dept.id}`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium">{node.dept.name}</span>
              {isPlanned && (
                <Badge className="rounded-full text-[10px] font-medium border-0 bg-amber-500/10 text-amber-600 px-1.5">待招</Badge>
              )}
              <span className="text-[11px] text-muted-foreground">
                ({head ? head.name : "—"}) {node.members.length}人
              </span>
            </div>
            {!isPlanned && total > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[120px]">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${rate}%`, backgroundColor: borderColor }} />
                </div>
                <span className="text-[10px] text-muted-foreground">{rate}%</span>
              </div>
            )}
          </div>
          {hasChildren && (
            <button
              className="p-1 rounded hover:bg-muted text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); setFolded(!folded); }}
              data-testid={`mobile-fold-${node.dept.id}`}
            >
              {folded ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>

        {isExpanded && (
          <div className="border-t animate-in slide-in-from-top-2 duration-200">
            <div className="px-3 pt-1.5 pb-0 flex items-center justify-between">
              <div className="flex items-center gap-0 border-b border-border flex-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={`px-2 py-1.5 text-[11px] transition-all duration-200 border-b-2 whitespace-nowrap ${
                      activeTab === tab.key
                        ? "border-foreground text-foreground font-medium"
                        : "border-transparent text-muted-foreground"
                    }`}
                    onClick={(e) => { e.stopPropagation(); setActiveTab(tab.key); }}
                    data-testid={`mobile-tab-${tab.key}-${node.dept.id}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                className="p-0.5 rounded hover:bg-muted text-muted-foreground ml-1"
                onClick={(e) => { e.stopPropagation(); onExpand(null); }}
                data-testid={`mobile-close-${node.dept.id}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="px-3 pb-3 pt-1.5">
              {activeTab === "members" && (
                <div className="space-y-0.5">
                  {node.members.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">{isPlanned ? "待招聘" : "暂无成员"}</p>
                  ) : (
                    <>
                      <div className="text-[10px] text-muted-foreground px-2 pb-1">
                        任务: {total}个 · 完成: {rate}% · 逾期: {stats?.overdue ?? 0}个
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
                <div className="space-y-2 text-xs text-muted-foreground">
                  {node.dept.description && (
                    <div><p className="font-medium text-foreground mb-0.5">职能描述</p><p>{node.dept.description}</p></div>
                  )}
                  {node.dept.kpi_description && (
                    <div><p className="font-medium text-foreground mb-0.5">KPI指标</p><p>{node.dept.kpi_description}</p></div>
                  )}
                  {!node.dept.description && !node.dept.kpi_description && <p>暂无职能与KPI信息</p>}
                </div>
              )}

              {activeTab === "benefits" && isCeo && (
                <div className="space-y-2 text-xs text-muted-foreground">
                  {node.dept.compensation_note && (
                    <div><p className="font-medium text-foreground mb-0.5">薪酬结构</p><p>{node.dept.compensation_note}</p></div>
                  )}
                  {node.dept.budget_note && (
                    <div><p className="font-medium text-foreground mb-0.5">预算说明</p><p>{node.dept.budget_note}</p></div>
                  )}
                  {!node.dept.compensation_note && !node.dept.budget_note && <p>暂无利益信息</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {hasChildren && !folded && (
        <div className="relative">
          {node.children.map((child) => (
            <MobileNode
              key={child.dept.id}
              node={child}
              users={users}
              deptStats={deptStats}
              userStats={userStats}
              currentUser={currentUser}
              depth={depth + 1}
              expandedId={expandedId}
              onExpand={onExpand}
              focusId={focusId}
              onFocus={onFocus}
              onEditDept={onEditDept}
              onEditUser={onEditUser}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function isAncestorOrDescendant(node: DeptTreeNode, targetId: string): boolean {
  function checkDescendants(n: DeptTreeNode): boolean {
    if (n.dept.id === targetId) return true;
    return n.children.some(checkDescendants);
  }
  return checkDescendants(node);
}

export function OrgMobileTree({ tree, users, deptStats, userStats, currentUser, onEditDept, onEditUser }: OrgMobileTreeProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  return (
    <div className="relative pb-12" data-testid="org-mobile-tree">
      {focusId && (
        <div className="sticky top-0 z-30 flex justify-end p-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border shadow-sm text-xs font-medium hover:bg-muted"
            onClick={() => setFocusId(null)}
            data-testid="mobile-exit-focus"
          >
            ✕ 退出聚焦
          </button>
        </div>
      )}

      <div className="p-3">
        {tree.map((node) => (
          <MobileNode
            key={node.dept.id}
            node={node}
            users={users}
            deptStats={deptStats}
            userStats={userStats}
            currentUser={currentUser}
            depth={0}
            expandedId={expandedId}
            onExpand={setExpandedId}
            focusId={focusId}
            onFocus={setFocusId}
            onEditDept={onEditDept}
            onEditUser={onEditUser}
          />
        ))}
      </div>

      <OrgColorLegend />
    </div>
  );
}
