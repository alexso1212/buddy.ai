import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { DeptTreeNode, SafeUser, DeptStatsMap, UserStatsMap } from "./types";
import {
  getCompletionLevel,
  getCompletionColor,
  getCompletionRate,
  getUrgency,
  getLineColor,
} from "./types";


interface OrgMindmapSvgProps {
  tree: DeptTreeNode[];
  users: SafeUser[];
  deptStats: DeptStatsMap;
  userStats: UserStatsMap;
  currentUser: SafeUser;
  isMobile: boolean;
  onOpenDetail: (node: DeptTreeNode) => void;
}

const NODE_W = 160;
const NODE_H = 70;
const H_GAP = 40;
const V_GAP = 20;
const CORNER_R = 8;

interface LayoutNode {
  node: DeptTreeNode;
  x: number;
  y: number;
  children: LayoutNode[];
  subtreeWidth: number;
  subtreeHeight: number;
}

function measureSubtreeHorizontal(
  node: DeptTreeNode,
  foldedNodes: Set<number>
): { w: number; h: number } {
  const isFolded = foldedNodes.has(node.dept.id);
  if (isFolded || node.children.length === 0) {
    return { w: NODE_W, h: NODE_H };
  }
  let totalChildH = 0;
  let maxChildW = 0;
  for (const child of node.children) {
    const m = measureSubtreeHorizontal(child, foldedNodes);
    totalChildH += m.h;
    if (m.w > maxChildW) maxChildW = m.w;
  }
  totalChildH += (node.children.length - 1) * V_GAP;
  const h = Math.max(NODE_H, totalChildH);
  const w = NODE_W + H_GAP + maxChildW;
  return { w, h };
}

function layoutHorizontal(
  node: DeptTreeNode,
  x: number,
  y: number,
  foldedNodes: Set<number>
): LayoutNode {
  const isFolded = foldedNodes.has(node.dept.id);
  const measure = measureSubtreeHorizontal(node, foldedNodes);

  if (isFolded || node.children.length === 0) {
    const nodeY = y + (measure.h - NODE_H) / 2;
    return {
      node,
      x,
      y: nodeY,
      children: [],
      subtreeWidth: measure.w,
      subtreeHeight: measure.h,
    };
  }

  const childX = x + NODE_W + H_GAP;
  let accY = y;
  const childLayouts: LayoutNode[] = [];
  for (const child of node.children) {
    const childMeasure = measureSubtreeHorizontal(child, foldedNodes);
    const laid = layoutHorizontal(child, childX, accY, foldedNodes);
    childLayouts.push(laid);
    accY += childMeasure.h + V_GAP;
  }

  const firstChild = childLayouts[0];
  const lastChild = childLayouts[childLayouts.length - 1];
  const childrenMidY =
    (firstChild.y + lastChild.y + NODE_H) / 2 - NODE_H / 2;

  return {
    node,
    x,
    y: childrenMidY,
    children: childLayouts,
    subtreeWidth: measure.w,
    subtreeHeight: measure.h,
  };
}

function measureSubtreeVertical(
  node: DeptTreeNode,
  foldedNodes: Set<number>
): { w: number; h: number } {
  const isFolded = foldedNodes.has(node.dept.id);
  if (isFolded || node.children.length === 0) {
    return { w: NODE_W, h: NODE_H };
  }
  let totalChildW = 0;
  let maxChildH = 0;
  for (const child of node.children) {
    const m = measureSubtreeVertical(child, foldedNodes);
    totalChildW += m.w;
    if (m.h > maxChildH) maxChildH = m.h;
  }
  totalChildW += (node.children.length - 1) * H_GAP;
  const w = Math.max(NODE_W, totalChildW);
  const h = NODE_H + V_GAP + maxChildH;
  return { w, h };
}

function layoutVertical(
  node: DeptTreeNode,
  x: number,
  y: number,
  foldedNodes: Set<number>
): LayoutNode {
  const isFolded = foldedNodes.has(node.dept.id);
  const measure = measureSubtreeVertical(node, foldedNodes);

  if (isFolded || node.children.length === 0) {
    const nodeX = x + (measure.w - NODE_W) / 2;
    return {
      node,
      x: nodeX,
      y,
      children: [],
      subtreeWidth: measure.w,
      subtreeHeight: measure.h,
    };
  }

  const childY = y + NODE_H + V_GAP;
  let accX = x;
  const childLayouts: LayoutNode[] = [];
  for (const child of node.children) {
    const childMeasure = measureSubtreeVertical(child, foldedNodes);
    const laid = layoutVertical(child, accX, childY, foldedNodes);
    childLayouts.push(laid);
    accX += childMeasure.w + H_GAP;
  }

  const firstChild = childLayouts[0];
  const lastChild = childLayouts[childLayouts.length - 1];
  const childrenMidX =
    (firstChild.x + lastChild.x + NODE_W) / 2 - NODE_W / 2;

  return {
    node,
    x: childrenMidX,
    y,
    children: childLayouts,
    subtreeWidth: measure.w,
    subtreeHeight: measure.h,
  };
}

function collectAllNodes(layout: LayoutNode): LayoutNode[] {
  const result: LayoutNode[] = [layout];
  for (const child of layout.children) {
    result.push(...collectAllNodes(child));
  }
  return result;
}

export function OrgMindmapSvg({
  tree,
  users,
  deptStats,
  userStats,
  currentUser,
  isMobile,
  onOpenDetail,
}: OrgMindmapSvgProps) {
  const [foldedNodes, setFoldedNodes] = useState<Set<number>>(new Set());
  const [focusNodeId, setFocusNodeId] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const svgRef = useRef<SVGSVGElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const lastTouchDist = useRef<number | null>(null);
  const lastTouchMid = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const defaultFolded = new Set<number>();
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

  const layouts = useMemo(() => {
    const PADDING = 40;
    if (isMobile) {
      let accY = PADDING;
      return tree.map((root) => {
        const l = layoutVertical(root, PADDING, accY, foldedNodes);
        accY += l.subtreeHeight + V_GAP;
        return l;
      });
    } else {
      let accY = PADDING;
      return tree.map((root) => {
        const l = layoutHorizontal(root, PADDING, accY, foldedNodes);
        accY += l.subtreeHeight + V_GAP;
        return l;
      });
    }
  }, [tree, foldedNodes, isMobile]);

  const allLayoutNodes = useMemo(() => {
    const all: LayoutNode[] = [];
    for (const l of layouts) {
      all.push(...collectAllNodes(l));
    }
    return all;
  }, [layouts]);

  const bounds = useMemo(() => {
    if (allLayoutNodes.length === 0) return { x: 0, y: 0, w: 400, h: 300 };
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const n of allLayoutNodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + NODE_W > maxX) maxX = n.x + NODE_W;
      if (n.y + NODE_H > maxY) maxY = n.y + NODE_H;
    }
    return {
      x: minX - 20,
      y: minY - 20,
      w: maxX - minX + 40,
      h: maxY - minY + 40,
    };
  }, [allLayoutNodes]);

  const focusBranch = useMemo(() => {
    if (!focusNodeId) return null;
    const ids = new Set<number>();
    const addDescendants = (node: DeptTreeNode) => {
      ids.add(node.dept.id);
      node.children.forEach(addDescendants);
    };
    const findAndMarkAncestors = (nodes: DeptTreeNode[]): boolean => {
      for (const n of nodes) {
        if (n.dept.id === focusNodeId) {
          ids.add(n.dept.id);
          addDescendants(n);
          return true;
        }
        if (findAndMarkAncestors(n.children)) {
          ids.add(n.dept.id);
          return true;
        }
      }
      return false;
    };
    findAndMarkAncestors(tree);
    return ids;
  }, [focusNodeId, tree]);

  const toggleFold = useCallback((deptId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFoldedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  }, []);

  const fitToView = useCallback(() => {
    if (!svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const svgW = svgRect.width;
    const svgH = svgRect.height;
    if (svgW === 0 || svgH === 0) {
      setScale(1);
      setTx(0);
      setTy(0);
      return;
    }
    const newScale = Math.min(
      Math.max(svgW / bounds.w, 0.5),
      Math.min(svgH / bounds.h, 2),
      svgW / bounds.w,
      svgH / bounds.h
    );
    const clampedScale = Math.max(0.5, Math.min(2, newScale));
    const newTx = (svgW - bounds.w * clampedScale) / 2 - bounds.x * clampedScale;
    const newTy = (svgH - bounds.h * clampedScale) / 2 - bounds.y * clampedScale;
    setScale(clampedScale);
    setTx(newTx);
    setTy(newTy);
  }, [bounds]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setScale((s) => {
        const newS = Math.max(0.5, Math.min(2, s + delta));
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (svgRect) {
          const mx = e.clientX - svgRect.left;
          const my = e.clientY - svgRect.top;
          const ratio = newS / s;
          setTx((t) => mx - ratio * (mx - t));
          setTy((t) => my - ratio * (my - t));
        }
        return newS;
      });
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const target = e.target as SVGElement;
      if (target.closest("[data-node-group]") || target.closest("[data-fold-btn]")) return;
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, tx, ty };
      (e.target as SVGElement).setPointerCapture?.(e.pointerId);
    },
    [tx, ty]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isPanning.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setTx(panStart.current.tx + dx);
      setTy(panStart.current.ty + dy);
    },
    []
  );

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const target = e.target as SVGElement;
      if (target.closest("[data-node-group]")) return;
      fitToView();
    },
    [fitToView]
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDist.current = Math.sqrt(dx * dx + dy * dy);
        lastTouchMid.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDist.current !== null) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ratio = dist / lastTouchDist.current;
        const mid = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        setScale((s) => {
          const newS = Math.max(0.5, Math.min(2, s * ratio));
          const svgRect = svg.getBoundingClientRect();
          const mx = mid.x - svgRect.left;
          const my = mid.y - svgRect.top;
          const r = newS / s;
          setTx((t) => mx - r * (mx - t) + (mid.x - (lastTouchMid.current?.x ?? mid.x)));
          setTy((t) => my - r * (my - t) + (mid.y - (lastTouchMid.current?.y ?? mid.y)));
          return newS;
        });
        lastTouchDist.current = dist;
        lastTouchMid.current = mid;
      }
    };
    const handleTouchEnd = () => {
      lastTouchDist.current = null;
      lastTouchMid.current = null;
    };
    svg.addEventListener("touchstart", handleTouchStart, { passive: false });
    svg.addEventListener("touchmove", handleTouchMove, { passive: false });
    svg.addEventListener("touchend", handleTouchEnd);
    return () => {
      svg.removeEventListener("touchstart", handleTouchStart);
      svg.removeEventListener("touchmove", handleTouchMove);
      svg.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  const handleLongPressStart = useCallback((deptId: number) => {
    longPressTimer.current = setTimeout(() => {
      setFocusNodeId((prev) => (prev === deptId ? null : deptId));
    }, 400);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  function renderConnectors(layout: LayoutNode): JSX.Element[] {
    const lines: JSX.Element[] = [];
    for (const child of layout.children) {
      const parentNode = layout.node;
      const childNode = child.node;
      const urgency = getUrgency(deptStats[childNode.dept.id]);
      const lineColor = getLineColor(urgency, false);
      const dimmed =
        focusBranch &&
        (!focusBranch.has(parentNode.dept.id) || !focusBranch.has(childNode.dept.id));

      let path: string;
      if (isMobile) {
        const px = layout.x + NODE_W / 2;
        const py = layout.y + NODE_H;
        const cx = child.x + NODE_W / 2;
        const cy = child.y;
        const midY = (py + cy) / 2;
        const dx = cx - px;
        const absDx = Math.abs(dx);
        const sign = dx > 0 ? 1 : dx < 0 ? -1 : 0;
        if (absDx < 2) {
          path = `M ${px} ${py} L ${cx} ${cy}`;
        } else {
          const rr = Math.min(CORNER_R, absDx / 2, (midY - py) / 2);
          path = [
            `M ${px} ${py}`,
            `L ${px} ${midY - rr}`,
            `Q ${px} ${midY} ${px + sign * rr} ${midY}`,
            `L ${cx - sign * rr} ${midY}`,
            `Q ${cx} ${midY} ${cx} ${midY + rr}`,
            `L ${cx} ${cy}`,
          ].join(" ");
        }
      } else {
        const px = layout.x + NODE_W;
        const py = layout.y + NODE_H / 2;
        const cx = child.x;
        const cy = child.y + NODE_H / 2;
        const midX = (px + cx) / 2;
        const dy = cy - py;
        const absDy = Math.abs(dy);
        const sign = dy > 0 ? 1 : dy < 0 ? -1 : 0;
        if (absDy < 2) {
          path = `M ${px} ${py} L ${cx} ${cy}`;
        } else {
          const rr = Math.min(CORNER_R, absDy / 2, (midX - px) / 2);
          path = [
            `M ${px} ${py}`,
            `L ${midX - rr} ${py}`,
            `Q ${midX} ${py} ${midX} ${py + sign * rr}`,
            `L ${midX} ${cy - sign * rr}`,
            `Q ${midX} ${cy} ${midX + rr} ${cy}`,
            `L ${cx} ${cy}`,
          ].join(" ");
        }
      }

      lines.push(
        <path
          key={`conn-${parentNode.dept.id}-${childNode.dept.id}`}
          d={path}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          style={{
            pointerEvents: "none",
            opacity: dimmed ? 0.15 : 1,
            transition: "opacity 0.3s",
          }}
        />
      );

      lines.push(...renderConnectors(child));
    }
    return lines;
  }

  function renderFoldButtons(layout: LayoutNode): JSX.Element[] {
    const buttons: JSX.Element[] = [];
    const hasChildren = layout.node.children.length > 0;
    if (!hasChildren) {
      for (const child of layout.children) {
        buttons.push(...renderFoldButtons(child));
      }
      return buttons;
    }

    const isFolded = foldedNodes.has(layout.node.dept.id);
    const dimmed = focusBranch && !focusBranch.has(layout.node.dept.id);

    let bx: number, by: number;
    if (isMobile) {
      bx = layout.x + NODE_W / 2;
      by = layout.y + NODE_H + 2;
    } else {
      bx = layout.x + NODE_W + 2;
      by = layout.y + NODE_H / 2;
    }

    buttons.push(
      <g
        key={`fold-${layout.node.dept.id}`}
        data-fold-btn="true"
        data-testid={`mindmap-fold-${layout.node.dept.id}`}
        onClick={(e) => toggleFold(layout.node.dept.id, e)}
        style={{
          cursor: "pointer",
          opacity: dimmed ? 0.15 : 1,
          transition: "opacity 0.3s",
        }}
      >
        <circle
          cx={bx}
          cy={by}
          r={9}
          fill="white"
          stroke="#D1D5DB"
          strokeWidth={1}
        />
        <text
          x={bx}
          y={by}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          fontWeight={500}
          fill="#6B7280"
        >
          {isFolded ? layout.node.children.length : "-"}
        </text>
      </g>
    );

    if (!isFolded) {
      for (const child of layout.children) {
        buttons.push(...renderFoldButtons(child));
      }
    }

    return buttons;
  }

  function renderNode(layout: LayoutNode): JSX.Element[] {
    const elements: JSX.Element[] = [];
    const { node, x, y } = layout;
    const dept = node.dept;
    const stats = deptStats[dept.id];
    const urgency = getUrgency(stats);
    const dimmed = focusBranch && !focusBranch.has(dept.id);

    const total = stats?.total ?? 0;
    const done = stats?.done ?? 0;
    const completionLevel = getCompletionLevel(total, done);
    const completionColor = getCompletionColor(completionLevel);
    const completionRate = getCompletionRate(total, done);

    const memberCount = node.members.length;
    const subtitle = `${memberCount}人`;

    elements.push(
      <g
        key={`node-${dept.id}`}
        data-node-group="true"
        data-testid={`mindmap-node-${dept.id}`}
        transform={`translate(${x}, ${y})`}
        style={{
          cursor: "pointer",
          opacity: dimmed ? 0.15 : 1,
          transition: "opacity 0.3s",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetail(node);
        }}
        onPointerDown={() => handleLongPressStart(dept.id)}
        onPointerUp={handleLongPressEnd}
        onPointerLeave={handleLongPressEnd}
      >
        <rect
          x={0}
          y={0}
          width={NODE_W}
          height={NODE_H}
          rx={CORNER_R}
          ry={CORNER_R}
          fill="white"
          stroke="#E5E7EB"
          strokeWidth={1}
          filter="url(#dropShadow)"
        />

        {isMobile ? (
          <rect
            x={0}
            y={0}
            width={NODE_W}
            height={4}
            rx={CORNER_R}
            ry={CORNER_R}
            fill={completionColor}
          />
        ) : (
          <rect
            x={0}
            y={0}
            width={4}
            height={NODE_H}
            rx={CORNER_R}
            ry={CORNER_R}
            fill={completionColor}
          />
        )}

        {isMobile ? (
          <clipPath id={`topClip-${dept.id}`}>
            <rect x={0} y={0} width={NODE_W} height={4} rx={CORNER_R} ry={CORNER_R} />
          </clipPath>
        ) : (
          <clipPath id={`leftClip-${dept.id}`}>
            <rect x={0} y={0} width={4} height={NODE_H} rx={CORNER_R} ry={CORNER_R} />
          </clipPath>
        )}

        <text
          x={isMobile ? 8 : 12}
          y={18}
          fontSize={13}
          fontWeight={500}
          fill="#1F2937"
        >
          {dept.name.length > 10 ? dept.name.slice(0, 10) + "..." : dept.name}
        </text>

        <text
          x={isMobile ? 8 : 12}
          y={34}
          fontSize={11}
          fill="#9CA3AF"
        >
          {subtitle}
        </text>

        {total > 0 && (
          <>
            <rect
              x={isMobile ? 8 : 12}
              y={44}
              width={NODE_W - (isMobile ? 46 : 50)}
              height={4}
              rx={2}
              fill="#E5E7EB"
            />
            <rect
              x={isMobile ? 8 : 12}
              y={44}
              width={Math.max(0, ((NODE_W - (isMobile ? 46 : 50)) * completionRate) / 100)}
              height={4}
              rx={2}
              fill={completionColor}
            />
            <text
              x={NODE_W - (isMobile ? 8 : 10)}
              y={49}
              textAnchor="end"
              fontSize={10}
              fill="#6B7280"
            >
              {completionRate}%
            </text>
          </>
        )}

        {urgency === "overdue" && (
          <circle cx={NODE_W - 8} cy={8} r={4} fill="#EF4444" />
        )}
        {urgency === "dueSoon" && (
          <circle cx={NODE_W - 8} cy={8} r={4} fill="#F59E0B" />
        )}
        {urgency === "blocked" && (
          <circle cx={NODE_W - 8} cy={8} r={4} fill="#F97316" />
        )}
      </g>
    );

    for (const child of layout.children) {
      elements.push(...renderNode(child));
    }

    return elements;
  }

  return (
    <div className="relative flex-1 h-full w-full" style={{ touchAction: "none" }}>
      {focusNodeId && (
        <div className="absolute top-3 right-3 z-30">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border shadow-sm text-xs font-medium hover-elevate"
            onClick={() => setFocusNodeId(null)}
            data-testid="mindmap-exit-focus"
          >
            退出聚焦
          </button>
        </div>
      )}

      <div className="absolute top-3 left-3 z-30 flex items-center gap-1">
        <button
          className="w-7 h-7 rounded border border-border bg-card text-sm flex items-center justify-center hover-elevate"
          onClick={() => setScale((s) => Math.min(2, s + 0.1))}
          data-testid="mindmap-zoom-in"
        >
          +
        </button>
        <button
          className="w-7 h-7 rounded border border-border bg-card text-[11px] flex items-center justify-center hover-elevate"
          onClick={fitToView}
          data-testid="mindmap-zoom-fit"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          className="w-7 h-7 rounded border border-border bg-card text-sm flex items-center justify-center hover-elevate"
          onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
          data-testid="mindmap-zoom-out"
        >
          -
        </button>
      </div>

      <svg
        ref={svgRef}
        data-testid="mindmap-svg"
        width="100%"
        height="100%"
        style={{
          cursor: isPanning.current ? "grabbing" : "grab",
          userSelect: "none",
        }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <defs>
          <filter id="dropShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow
              dx={0}
              dy={1}
              stdDeviation={2}
              floodColor="#000000"
              floodOpacity={0.08}
            />
          </filter>
        </defs>

        <g transform={`translate(${tx},${ty}) scale(${scale})`}>
          {layouts.map((layout) => renderConnectors(layout))}
          {layouts.map((layout) => renderFoldButtons(layout))}
          {layouts.map((layout) => renderNode(layout))}
        </g>
      </svg>
    </div>
  );
}
