import { useState, useMemo, useCallback } from "react";
import { ChevronRight, ChevronDown, Lock } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { OrgPersonPopover } from "./OrgPersonPopover";
import type {
  DeptTreeNode,
  SafeUser,
  DeptStatsMap,
  UserStatsMap,
} from "./types";
import {
  getCompletionLevel,
  getCompletionColor,
  getCompletionRate,
  getUrgency,
} from "./types";

interface OrgOutlineProps {
  tree: DeptTreeNode[];
  users: SafeUser[];
  deptStats: DeptStatsMap;
  userStats: UserStatsMap;
  currentUser: SafeUser;
  isMobile: boolean;
  onOpenDetail: (node: DeptTreeNode) => void;
  onEditUser: (u: SafeUser) => void;
}

function findNodeById(nodes: DeptTreeNode[], id: number): DeptTreeNode | null {
  for (const node of nodes) {
    if (node.dept.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

function buildBreadcrumb(tree: DeptTreeNode[], targetId: number): DeptTreeNode[] {
  const path: DeptTreeNode[] = [];
  function walk(nodes: DeptTreeNode[]): boolean {
    for (const node of nodes) {
      path.push(node);
      if (node.dept.id === targetId) return true;
      if (walk(node.children)) return true;
      path.pop();
    }
    return false;
  }
  walk(tree);
  return path;
}

export function OrgOutline({
  tree,
  users,
  deptStats,
  userStats,
  currentUser,
  isMobile,
  onOpenDetail,
  onEditUser,
}: OrgOutlineProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [focusId, setFocusId] = useState<number | null>(null);

  const isCeoOrAdmin = currentUser.role === "owner" || currentUser.role === "admin";

  const toggleExpand = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const breadcrumb = useMemo(() => {
    if (!focusId) return [];
    return buildBreadcrumb(tree, focusId);
  }, [tree, focusId]);

  const visibleTree = useMemo(() => {
    if (!focusId) return tree;
    const node = findNodeById(tree, focusId);
    return node ? [node] : tree;
  }, [tree, focusId]);

  const handleFocus = useCallback((id: number) => {
    setFocusId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div data-testid="org-outline" className="py-1">
      {focusId && breadcrumb.length > 0 && (
        <div
          data-testid="outline-breadcrumb"
          className="flex items-center gap-1 px-3 py-2 mb-1 text-xs text-muted-foreground border-b flex-wrap"
        >
          {breadcrumb.map((node, i) => (
            <span key={node.dept.id} className="flex items-center gap-1">
              {i > 0 && <span className="select-none">&gt;</span>}
              <button
                className="hover-elevate active-elevate-2 rounded px-1 py-0.5"
                data-testid={`outline-breadcrumb-${node.dept.id}`}
                onClick={() => {
                  if (i === 0 && breadcrumb.length === 1) {
                    setFocusId(null);
                  } else {
                    setFocusId(node.dept.id);
                  }
                }}
              >
                {node.dept.name}
              </button>
            </span>
          ))}
          {breadcrumb.length === 1 && (
            <button
              className="ml-2 text-xs hover-elevate active-elevate-2 rounded px-1 py-0.5"
              data-testid="outline-exit-focus"
              onClick={() => setFocusId(null)}
            >
              (退出聚焦)
            </button>
          )}
        </div>
      )}

      {visibleTree.map((node) => (
        <DeptRow
          key={node.dept.id}
          node={node}
          depth={0}
          expanded={expanded}
          toggleExpand={toggleExpand}
          deptStats={deptStats}
          userStats={userStats}
          users={users}
          isMobile={isMobile}
          isCeoOrAdmin={isCeoOrAdmin}
          onOpenDetail={onOpenDetail}
          onEditUser={onEditUser}
          onFocus={handleFocus}
        />
      ))}
    </div>
  );
}

interface DeptRowProps {
  node: DeptTreeNode;
  depth: number;
  expanded: Set<number>;
  toggleExpand: (id: number) => void;
  deptStats: DeptStatsMap;
  userStats: UserStatsMap;
  users: SafeUser[];
  isMobile: boolean;
  isCeoOrAdmin: boolean;
  onOpenDetail: (node: DeptTreeNode) => void;
  onEditUser: (u: SafeUser) => void;
  onFocus: (id: number) => void;
}

function DeptRow({
  node,
  depth,
  expanded,
  toggleExpand,
  deptStats,
  userStats,
  users,
  isMobile,
  isCeoOrAdmin,
  onOpenDetail,
  onEditUser,
  onFocus,
}: DeptRowProps) {
  const { dept, members, children } = node;
  const isExpanded = expanded.has(dept.id);
  const hasChildren = children.length > 0 || members.length > 0;

  const stats = deptStats[dept.id];
  const total = stats?.total ?? 0;
  const done = stats?.done ?? 0;
  const overdue = stats?.overdue ?? 0;
  const dueSoon = stats?.dueSoon ?? 0;
  const blocked = stats?.blocked ?? 0;

  const level = getCompletionLevel(total, done);
  const color = getCompletionColor(level);
  const rate = getCompletionRate(total, done);

  const memberCount = members.length;

  const paddingLeft = depth * 20 + 8;

  return (
    <>
      <div
        data-testid={`outline-row-${dept.id}`}
        className="group"
        style={{ paddingLeft }}
      >
        {isMobile ? (
          <MobileDeptContent
            node={node}
            isExpanded={isExpanded}
            hasChildren={hasChildren}
            isPlanned={false}
            color={color}
            rate={rate}
            overdue={overdue}
            dueSoon={dueSoon}
            blocked={blocked}
            headUser={null}
            memberCount={memberCount}
            toggleExpand={toggleExpand}
            onOpenDetail={onOpenDetail}
            onFocus={onFocus}
          />
        ) : (
          <DesktopDeptContent
            node={node}
            isExpanded={isExpanded}
            hasChildren={hasChildren}
            isPlanned={false}
            color={color}
            rate={rate}
            overdue={overdue}
            dueSoon={dueSoon}
            blocked={blocked}
            headUser={null}
            memberCount={memberCount}
            toggleExpand={toggleExpand}
            onOpenDetail={onOpenDetail}
            onFocus={onFocus}
          />
        )}
      </div>

      {isExpanded && (
        <>
          {members.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              depth={depth + 1}
              userStats={userStats}
              isCeoOrAdmin={isCeoOrAdmin}
              onEditUser={onEditUser}
            />
          ))}
          {children.map((child) => (
            <DeptRow
              key={child.dept.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggleExpand={toggleExpand}
              deptStats={deptStats}
              userStats={userStats}
              users={users}
              isMobile={isMobile}
              isCeoOrAdmin={isCeoOrAdmin}
              onOpenDetail={onOpenDetail}
              onEditUser={onEditUser}
              onFocus={onFocus}
            />
          ))}
        </>
      )}
    </>
  );
}

interface DeptContentProps {
  node: DeptTreeNode;
  isExpanded: boolean;
  hasChildren: boolean;
  isPlanned: boolean;
  color: string;
  rate: number;
  overdue: number;
  dueSoon: number;
  blocked: number;
  headUser: SafeUser | null | undefined;
  memberCount: number;
  toggleExpand: (id: number) => void;
  onOpenDetail: (node: DeptTreeNode) => void;
  onFocus: (id: number) => void;
}

function DesktopDeptContent({
  node,
  isExpanded,
  hasChildren,
  isPlanned,
  color,
  rate,
  overdue,
  dueSoon,
  blocked,
  headUser,
  memberCount,
  toggleExpand,
  onOpenDetail,
  onFocus,
}: DeptContentProps) {
  const { dept } = node;

  return (
    <div className="flex items-center gap-2 py-1.5 pr-3 min-h-[32px]">
      <button
        data-testid={`outline-toggle-${dept.id}`}
        className="w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground"
        onClick={() => hasChildren && toggleExpand(dept.id)}
        style={{ visibility: hasChildren ? "visible" : "hidden" }}
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
      </button>

      <button
        data-testid={`outline-bullet-${dept.id}`}
        className="w-3 h-3 rounded-full shrink-0 hover-elevate active-elevate-2"
        style={{ backgroundColor: color }}
        onClick={() => onFocus(dept.id)}
      />

      <button
        data-testid={`outline-name-${dept.id}`}
        className="text-sm font-medium truncate hover-elevate active-elevate-2 rounded px-1 py-0.5 text-left"
        onClick={() => onOpenDetail(node)}
      >
        {dept.name}
      </button>

      {headUser && (
        <span className="text-xs text-muted-foreground truncate shrink-0">
          {headUser.displayName}
        </span>
      )}

      <span className="text-xs text-muted-foreground shrink-0">
        {memberCount}人
      </span>

      <div className="w-16 h-1.5 rounded-full bg-muted shrink-0 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${rate}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
        {rate}%
      </span>

      <StatusDots overdue={overdue} dueSoon={dueSoon} blocked={blocked} />
    </div>
  );
}

function MobileDeptContent({
  node,
  isExpanded,
  hasChildren,
  isPlanned,
  color,
  rate,
  overdue,
  dueSoon,
  blocked,
  headUser,
  memberCount,
  toggleExpand,
  onOpenDetail,
  onFocus,
}: DeptContentProps) {
  const { dept } = node;

  return (
    <div className="py-1.5 pr-3">
      <div className="flex items-center gap-2">
        <button
          data-testid={`outline-toggle-${dept.id}`}
          className="w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground"
          onClick={() => hasChildren && toggleExpand(dept.id)}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          data-testid={`outline-bullet-${dept.id}`}
          className="w-3 h-3 rounded-full shrink-0 hover-elevate active-elevate-2"
          style={{ backgroundColor: color }}
          onClick={() => onFocus(dept.id)}
        />

        <button
          data-testid={`outline-name-${dept.id}`}
          className="text-sm font-medium truncate hover-elevate active-elevate-2 rounded px-1 py-0.5 text-left flex-1 min-w-0"
          onClick={() => onOpenDetail(node)}
        >
          {dept.name}
        </button>

        <StatusDots overdue={overdue} dueSoon={dueSoon} blocked={blocked} />
      </div>

      <div className="flex items-center gap-1.5 ml-[28px] mt-0.5 text-xs text-muted-foreground flex-wrap">
        {headUser && (
          <span>
            {headUser.displayName}
          </span>
        )}
        <span>{memberCount}人</span>
        <span>{rate}%</span>
      </div>
    </div>
  );
}

function StatusDots({ overdue, dueSoon, blocked }: { overdue: number; dueSoon: number; blocked: number }) {
  if (overdue === 0 && dueSoon === 0 && blocked === 0) return null;

  return (
    <div className="flex items-center gap-1 shrink-0">
      {overdue > 0 && (
        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title={`${overdue} overdue`} />
      )}
      {dueSoon > 0 && (
        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title={`${dueSoon} due soon`} />
      )}
      {blocked > 0 && (
        <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
      )}
    </div>
  );
}

function PersonRow({
  person,
  depth,
  userStats,
  isCeoOrAdmin,
  onEditUser,
}: {
  person: SafeUser;
  depth: number;
  userStats: UserStatsMap;
  isCeoOrAdmin: boolean;
  onEditUser: (u: SafeUser) => void;
}) {
  const stats = userStats[person.id];
  const total = stats?.total ?? 0;
  const overdue = stats?.overdue ?? 0;
  const urgency = getUrgency(stats);
  const paddingLeft = depth * 20 + 8;

  const urgencyColor =
    urgency === "overdue"
      ? "#EF4444"
      : urgency === "dueSoon"
        ? "#F59E0B"
        : urgency === "blocked"
          ? "#9CA3AF"
          : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          data-testid={`outline-person-${person.id}`}
          className="flex items-center gap-2 py-1 pr-3 cursor-pointer hover-elevate rounded min-h-[28px]"
          style={{ paddingLeft: paddingLeft + 20 }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
          <span className="text-sm truncate">{person.displayName}</span>
          <span className="text-xs text-muted-foreground truncate">
            {person.role || ""}
          </span>
          <span className="text-xs text-muted-foreground shrink-0 ml-auto">
            {total}任务
            {overdue > 0 && (
              <span className="text-red-500"> · {overdue}逾期</span>
            )}
          </span>
          {urgencyColor && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: urgencyColor }}
            />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <OrgPersonPopover
          person={person}
          userStats={userStats}
          isCeoOrAdmin={isCeoOrAdmin}
          onEditUser={onEditUser}
        />
      </PopoverContent>
    </Popover>
  );
}
