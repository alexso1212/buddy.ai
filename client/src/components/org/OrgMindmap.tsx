// TODO: Future DnD - add drag-and-drop for person moves between departments
// TODO: Future AI Analysis - add AI-powered org insights

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { OrgNode } from "./OrgNode";
import { OrgColorLegend } from "./OrgColorLegend";
import type { DeptTreeNode, SafeUser, DeptStatsMap, UserStatsMap } from "./types";
import { getUrgency, getLineColor, getLineStyle } from "./types";
import type { Department } from "@shared/schema";

interface OrgMindmapProps {
  tree: DeptTreeNode[];
  users: SafeUser[];
  deptStats: DeptStatsMap;
  userStats: UserStatsMap;
  currentUser: SafeUser;
  onEditDept: (d: Department) => void;
  onEditUser: (u: SafeUser) => void;
}

interface NodePosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function OrgMindmap({ tree, users, deptStats, userStats, currentUser, onEditDept, onEditUser }: OrgMindmapProps) {
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [foldedNodes, setFoldedNodes] = useState<Set<string>>(new Set());
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTarget = useRef<string | null>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [nodePositions, setNodePositions] = useState<NodePosition[]>([]);

  useEffect(() => {
    const defaultFolded = new Set<string>();
    function markFolded(nodes: DeptTreeNode[], depth: number) {
      for (const n of nodes) {
        if (depth >= 2 && n.children.length > 0) {
          defaultFolded.add(n.dept.id);
        }
        markFolded(n.children, depth + 1);
      }
    }
    markFolded(tree, 0);
    setFoldedNodes(defaultFolded);
  }, [tree]);

  const toggleExpand = useCallback((deptId: string) => {
    setExpandedNodeId((prev) => prev === deptId ? null : deptId);
  }, []);

  const toggleFold = useCallback((deptId: string) => {
    setFoldedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  }, []);

  const focusBranch = useMemo(() => {
    if (!focusNodeId) return null;
    const ids = new Set<string>();
    const addChildren = (node: DeptTreeNode) => {
      ids.add(node.dept.id);
      node.children.forEach(addChildren);
    };
    const collectBranch = (nodes: DeptTreeNode[]): boolean => {
      for (const n of nodes) {
        if (n.dept.id === focusNodeId) {
          ids.add(n.dept.id);
          addChildren(n);
          return true;
        }
        if (collectBranch(n.children)) {
          ids.add(n.dept.id);
          return true;
        }
      }
      return false;
    };
    collectBranch(tree);
    return ids;
  }, [focusNodeId, tree]);

  const handleLongPressStart = useCallback((deptId: string) => {
    longPressTarget.current = deptId;
    longPressTimer.current = setTimeout(() => {
      setFocusNodeId((prev) => prev === deptId ? null : deptId);
    }, 400);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressTarget.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((s) => Math.min(1.5, Math.max(0.5, s + delta)));
    } else if (e.shiftKey) {
      e.preventDefault();
      setTranslate((t) => ({ ...t, x: t.x - e.deltaY }));
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).closest("[data-canvas-bg]")) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
    }
  }, [translate]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning) {
      setTranslate({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, panStart]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const fitToView = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).getAttribute("data-canvas-bg")) {
      fitToView();
    }
  }, [fitToView]);

  useEffect(() => {
    const updatePositions = () => {
      const positions: NodePosition[] = [];
      nodeRefs.current.forEach((el, id) => {
        const rect = el.getBoundingClientRect();
        const containerRect = treeRef.current?.getBoundingClientRect();
        if (containerRect) {
          positions.push({
            id,
            x: (rect.left - containerRect.left) / scale,
            y: (rect.top - containerRect.top) / scale,
            width: rect.width / scale,
            height: rect.height / scale,
          });
        }
      });
      setNodePositions(positions);
    };
    const timer = setTimeout(updatePositions, 100);
    return () => clearTimeout(timer);
  }, [expandedNodeId, foldedNodes, scale, tree]);

  function renderConnectors(nodes: DeptTreeNode[], parentId?: string) {
    const lines: JSX.Element[] = [];
    if (!parentId) return lines;

    const parent = nodePositions.find((p) => p.id === parentId);
    if (!parent) return lines;

    const childPositions = nodes
      .map((n) => ({ node: n, pos: nodePositions.find((p) => p.id === n.dept.id) }))
      .filter((c) => c.pos) as { node: DeptTreeNode; pos: NodePosition }[];

    if (childPositions.length === 0) return lines;

    const parentCx = parent.x + parent.width / 2;
    const parentBottom = parent.y + parent.height;
    const midY = parentBottom + 20;
    const r = 8;

    for (const { node, pos } of childPositions) {
      const childCx = pos.x + pos.width / 2;
      const childTop = pos.y;
      const urgency = getUrgency(deptStats[node.dept.id]);
      const lineColor = getLineColor(urgency, !!node.dept.is_planned);
      const lineStyle = getLineStyle(!!node.dept.is_planned);

      const dx = childCx - parentCx;
      const absDx = Math.abs(dx);
      const sign = dx > 0 ? 1 : -1;

      let path: string;
      if (absDx < 2) {
        path = `M ${parentCx} ${parentBottom} L ${parentCx} ${childTop}`;
      } else {
        const rr = Math.min(r, absDx / 2, (midY - parentBottom) / 2, (childTop - midY) / 2);
        path = [
          `M ${parentCx} ${parentBottom}`,
          `L ${parentCx} ${midY - rr}`,
          `Q ${parentCx} ${midY} ${parentCx + sign * rr} ${midY}`,
          `L ${childCx - sign * rr} ${midY}`,
          `Q ${childCx} ${midY} ${childCx} ${midY + rr}`,
          `L ${childCx} ${childTop}`,
        ].join(" ");
      }

      const connectorDimmed = focusBranch && (!focusBranch.has(parentId!) || !focusBranch.has(node.dept.id));

      lines.push(
        <path
          key={`${parentId}-${node.dept.id}`}
          d={path}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeDasharray={lineStyle === "dashed" ? "4 3" : undefined}
          className="transition-all duration-300"
          style={{ opacity: connectorDimmed ? 0.15 : 1 }}
        />
      );
    }

    return lines;
  }

  function renderTreeLevel(nodes: DeptTreeNode[], depth: number, parentId?: string) {
    return (
      <div className="flex flex-col items-center">
        <div className="flex items-start gap-6 justify-center">
          {nodes.map((node) => {
            const isFolded = foldedNodes.has(node.dept.id);
            const hasChildren = node.children.length > 0;
            const dimmed = focusBranch && !focusBranch.has(node.dept.id);

            return (
              <div
                key={node.dept.id}
                className="flex flex-col items-center transition-opacity duration-300"
                style={{ opacity: dimmed ? 0.15 : 1 }}
              >
                <div
                  ref={(el) => { if (el) nodeRefs.current.set(node.dept.id, el); }}
                  className="group"
                  onPointerDown={() => handleLongPressStart(node.dept.id)}
                  onPointerUp={handleLongPressEnd}
                  onPointerLeave={handleLongPressEnd}
                >
                  <OrgNode
                    node={node}
                    users={users}
                    deptStats={deptStats}
                    userStats={userStats}
                    currentUser={currentUser}
                    depth={depth}
                    isExpanded={expandedNodeId === node.dept.id}
                    onToggleExpand={toggleExpand}
                    onEditDept={onEditDept}
                    onEditUser={onEditUser}
                  />
                </div>

                {hasChildren && (
                  <button
                    className={`mt-1 w-5 h-5 rounded-full border border-border flex items-center justify-center text-[10px] font-medium transition-all duration-200 ${
                      isFolded
                        ? "bg-muted text-foreground hover:bg-primary hover:text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => toggleFold(node.dept.id)}
                    data-testid={`fold-btn-${node.dept.id}`}
                  >
                    {isFolded ? node.children.length : "●"}
                  </button>
                )}

                {hasChildren && !isFolded && (
                  <div className="mt-8">
                    {renderTreeLevel(node.children, depth + 1, node.dept.id)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      {focusNodeId && (
        <div className="absolute top-3 right-3 z-30">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border shadow-sm text-xs font-medium hover:bg-muted transition-colors"
            onClick={() => setFocusNodeId(null)}
            data-testid="exit-focus-mode"
          >
            ✕ 退出聚焦
          </button>
        </div>
      )}

      <div className="absolute top-3 left-3 z-30 flex items-center gap-1">
        <button
          className="w-7 h-7 rounded border border-border bg-card text-sm flex items-center justify-center hover:bg-muted"
          onClick={() => setScale((s) => Math.min(1.5, s + 0.1))}
          data-testid="zoom-in"
        >
          +
        </button>
        <button
          className="w-7 h-7 rounded border border-border bg-card text-[11px] flex items-center justify-center hover:bg-muted"
          onClick={fitToView}
          data-testid="zoom-fit"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          className="w-7 h-7 rounded border border-border bg-card text-sm flex items-center justify-center hover:bg-muted"
          onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
          data-testid="zoom-out"
        >
          −
        </button>
      </div>

      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        data-canvas-bg="true"
        data-testid="org-canvas"
      >
        <div
          ref={treeRef}
          className="inline-flex transition-transform duration-100 origin-top-left p-12 pt-8 min-w-full justify-center"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          }}
        >
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ overflow: "visible" }}
          >
            {tree.map((rootNode) => {
              const allConnectors: JSX.Element[] = [];
              function collectConnectors(nodes: DeptTreeNode[], parentId: string) {
                if (foldedNodes.has(parentId)) return;
                allConnectors.push(...renderConnectors(nodes, parentId));
                for (const child of nodes) {
                  if (child.children.length > 0 && !foldedNodes.has(child.dept.id)) {
                    collectConnectors(child.children, child.dept.id);
                  }
                }
              }
              if (rootNode.children.length > 0 && !foldedNodes.has(rootNode.dept.id)) {
                collectConnectors(rootNode.children, rootNode.dept.id);
              }
              return allConnectors;
            })}
          </svg>
          {renderTreeLevel(tree, 0)}
        </div>
      </div>

      <OrgColorLegend />
    </div>
  );
}
