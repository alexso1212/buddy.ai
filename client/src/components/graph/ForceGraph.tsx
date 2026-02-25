import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import * as d3 from "d3";
import type { ColorByOption } from "./GraphSettings";
import BloodVesselCanvas from "./BloodVesselCanvas";

export interface GraphNode {
  id: number;
  title: string;
  status: string;
  priority: string;
  weight: number;
  progress: number;
  projectId: number;
  projectName: string;
  projectColor: string;
  deptId: number | null;
  deptColor: string;
  assigneeId: number | null;
  assigneeName: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  type: string;
  parentTaskId: number | null;
  hasSubtasks: boolean;
  isBridge?: boolean;
}

export interface GraphLink {
  source: number | any;
  target: number | any;
  type: string;
  isBlocking: boolean;
}

export interface ProjectInfo {
  id: number;
  name: string;
  color: string;
}

export interface DeptInfo {
  id: number;
  name: string;
  color: string;
}

export interface CollabHealth {
  deptA: number;
  deptB: number;
  healthScore: number;
  taskCount: number;
  metrics: { volume: number; completion: number; timeliness: number; flow: number };
}

export interface HighlightedNode {
  id: number;
  type: 'followUp' | 'important' | 'bottleneck';
  reason: string;
}

export interface ForceGraphHandle {
  resetView: () => void;
}

interface ForceGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  projects: ProjectInfo[];
  departments?: DeptInfo[];
  collabHealth?: CollabHealth[];
  colorBy?: ColorByOption;
  bloodFlow?: boolean;
  onNodeClick?: (node: GraphNode) => void;
  highlightedNodes?: HighlightedNode[];
}

interface SimNode extends GraphNode, d3.SimulationNodeDatum {}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  type: string;
  isBlocking: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  todo: '#9ca3af',
  in_progress: '#f59e0b',
  in_review: '#3b82f6',
  blocked: '#ef4444',
  done: '#10b981',
  cancelled: '#6b7280',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#9ca3af',
};

const ASSIGNEE_PALETTE = [
  '#FF6B35', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#F08080', '#87CEEB',
];

function hashAssigneeColor(assigneeId: number): string {
  return ASSIGNEE_PALETTE[assigneeId % ASSIGNEE_PALETTE.length];
}

const FALLBACK_COLOR = '#9ca3af';

function getNodeColor(node: GraphNode, colorBy: ColorByOption): string {
  switch (colorBy) {
    case 'department':
      return node.deptColor || FALLBACK_COLOR;
    case 'project':
      return node.projectColor || FALLBACK_COLOR;
    case 'status':
      return STATUS_COLORS[node.status] || FALLBACK_COLOR;
    case 'priority':
      return PRIORITY_COLORS[node.priority] || FALLBACK_COLOR;
    case 'assignee':
      return node.assigneeId ? hashAssigneeColor(node.assigneeId) : FALLBACK_COLOR;
    default:
      return FALLBACK_COLOR;
  }
}

const DEPT_BASE_MIN_DIST = 200;
const DEPT_MAX_DIST = 400;
const DEPT_FORCE_DIST_CLAMP = 40;
const DEPT_FORCE_VEL_CAP = 3;

function deptClusterForce(
  nodes: SimNode[],
  alpha: number,
  deptCentroidsOut?: Map<number, { x: number; y: number }>,
  galaxyBoundaries?: GalaxyBoundary[]
) {
  const centroids: Record<number, { x: number; y: number; count: number }> = {};
  for (const node of nodes) {
    const key = node.deptId ?? -1;
    if (!centroids[key]) {
      centroids[key] = { x: 0, y: 0, count: 0 };
    }
    centroids[key].x += node.x || 0;
    centroids[key].y += node.y || 0;
    centroids[key].count += 1;
  }
  const centroidKeys = Object.keys(centroids);
  for (const key of centroidKeys) {
    const c = centroids[Number(key)];
    c.x /= c.count;
    c.y /= c.count;
  }

  if (deptCentroidsOut) {
    deptCentroidsOut.clear();
    for (const key of centroidKeys) {
      const k = Number(key);
      if (k !== -1) deptCentroidsOut.set(k, { x: centroids[k].x, y: centroids[k].y });
    }
  }

  const galaxyRadii = new Map<number, number>();
  if (galaxyBoundaries) {
    for (const g of galaxyBoundaries) galaxyRadii.set(g.deptId, g.radius);
  }

  const attractStrength = 0.35;
  for (const node of nodes) {
    const key = node.deptId ?? -1;
    const c = centroids[key];
    if (c) {
      node.vx = (node.vx || 0) + (c.x - (node.x || 0)) * alpha * attractStrength;
      node.vy = (node.vy || 0) + (c.y - (node.y || 0)) * alpha * attractStrength;

      for (const otherKey of centroidKeys) {
        const otherDept = Number(otherKey);
        if (otherDept === key) continue;
        const other = centroids[otherDept];
        const dx = (node.x || 0) - other.x;
        const dy = (node.y || 0) - other.y;
        const rawDist = Math.sqrt(dx * dx + dy * dy);
        const dist = Math.max(rawDist, DEPT_FORCE_DIST_CLAMP);
        const nx = dx / dist;
        const ny = dy / dist;

        const rA = galaxyRadii.get(key) || 50;
        const rB = galaxyRadii.get(otherDept) || 50;
        const effectiveMinDist = Math.max(DEPT_BASE_MIN_DIST, rA + rB + 30);
        const effectiveIdealDist = effectiveMinDist + 40;

        let fMag = 0;
        if (rawDist < effectiveMinDist) {
          fMag = (effectiveMinDist - dist) / effectiveMinDist * alpha * 1.5;
        } else if (rawDist > DEPT_MAX_DIST) {
          fMag = -((dist - DEPT_MAX_DIST) / DEPT_MAX_DIST) * alpha * 0.3;
        } else {
          fMag = (dist - effectiveIdealDist) / effectiveIdealDist * alpha * -0.1;
        }

        fMag = Math.max(-DEPT_FORCE_VEL_CAP, Math.min(DEPT_FORCE_VEL_CAP, fMag));

        node.vx = (node.vx || 0) + nx * fMag;
        node.vy = (node.vy || 0) + ny * fMag;
      }
    }
  }
}

interface OrbitState {
  angle: number;
}

interface OrbitTopology {
  parentToChildren: Map<number, number[]>;
  parentMap: Map<number, number>;
}

function buildOrbitTopology(simLinks: SimLink[]): OrbitTopology {
  const parentToChildren = new Map<number, number[]>();
  const childSet = new Set<number>();

  for (const link of simLinks) {
    const srcId = typeof link.source === 'object' ? link.source.id : link.source;
    const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
    if (!parentToChildren.has(srcId)) parentToChildren.set(srcId, []);
    parentToChildren.get(srcId)!.push(tgtId);
    childSet.add(tgtId);
  }

  const roots = new Set<number>();
  for (const srcId of parentToChildren.keys()) {
    if (!childSet.has(srcId)) roots.add(srcId);
  }

  const depthMap = new Map<number, number>();
  const parentMap = new Map<number, number>();

  function assignDepth(nodeId: number, depth: number) {
    if (depthMap.has(nodeId)) return;
    depthMap.set(nodeId, depth);
    const children = parentToChildren.get(nodeId);
    if (children) {
      for (const childId of children) {
        parentMap.set(childId, nodeId);
        assignDepth(childId, depth + 1);
      }
    }
  }

  for (const rootId of roots) {
    assignDepth(rootId, 0);
  }
  for (const link of simLinks) {
    const srcId = typeof link.source === 'object' ? link.source.id : link.source;
    const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
    if (!depthMap.has(srcId)) depthMap.set(srcId, 0);
    if (!depthMap.has(tgtId)) {
      parentMap.set(tgtId, srcId);
      depthMap.set(tgtId, (depthMap.get(srcId) || 0) + 1);
    }
  }

  return { parentToChildren, parentMap };
}

const TWO_PI = Math.PI * 2;

function orbitForce(
  simNodes: SimNode[],
  topology: OrbitTopology,
  orbitStates: Map<number, OrbitState>,
  draggedNodeId: number | null,
  alpha: number,
  nodeMap: Map<number, SimNode>
) {
  if (alpha > 0.08) return;

  const { parentMap, parentToChildren } = topology;

  const ORBIT_RADIUS_BASE = 28;
  const ORBIT_RADIUS_STEP = 8;
  const ANGULAR_SPEED = 0.005;

  const dragSubtree = new Set<number>();
  if (draggedNodeId !== null) {
    dragSubtree.add(draggedNodeId);
    const queue = [draggedNodeId];
    while (queue.length > 0) {
      const nid = queue.pop()!;
      const children = parentToChildren.get(nid);
      if (children) {
        for (const cid of children) {
          if (!dragSubtree.has(cid)) {
            dragSubtree.add(cid);
            queue.push(cid);
          }
        }
      }
    }
  }

  for (const [parentId, children] of parentToChildren) {
    if (dragSubtree.has(parentId)) continue;
    const parent = nodeMap.get(parentId);
    if (!parent || parent.x == null || parent.y == null) continue;

    const validChildren = children.filter(cid => {
      if (dragSubtree.has(cid)) return false;
      const child = nodeMap.get(cid);
      return child && child.x != null && child.fx == null;
    });
    if (validChildren.length === 0) continue;

    const depth = (parentMap.has(parentId) ? 1 : 0);
    const orbitR = ORBIT_RADIUS_BASE + depth * ORBIT_RADIUS_STEP;
    const angleStep = TWO_PI / validChildren.length;

    for (let i = 0; i < validChildren.length; i++) {
      const childId = validChildren[i];
      const child = nodeMap.get(childId)!;

      if (!orbitStates.has(childId)) {
        const dx = (child.x || 0) - (parent.x || 0);
        const dy = (child.y || 0) - (parent.y || 0);
        orbitStates.set(childId, { angle: Math.atan2(dy, dx) });
      }
      const state = orbitStates.get(childId)!;
      state.angle = (state.angle + ANGULAR_SPEED) % TWO_PI;

      const baseAngle = state.angle + i * angleStep;
      const targetX = (parent.x || 0) + Math.cos(baseAngle) * orbitR;
      const targetY = (parent.y || 0) + Math.sin(baseAngle) * orbitR;

      const strength = 0.12;
      child.vx = (child.vx || 0) + (targetX - (child.x || 0)) * strength;
      child.vy = (child.vy || 0) + (targetY - (child.y || 0)) * strength;
    }
  }
}


export interface GalaxyBoundary {
  deptId: number;
  name: string;
  color: string;
  cx: number;
  cy: number;
  radius: number;
  nodeCount: number;
}

function computeGalaxyBoundaries(nodes: SimNode[], departments: DeptInfo[], padding: number = 30): GalaxyBoundary[] {
  const deptNodes: Record<number, SimNode[]> = {};
  for (const n of nodes) {
    const key = n.deptId ?? -1;
    if (key === -1) continue;
    if (!deptNodes[key]) deptNodes[key] = [];
    deptNodes[key].push(n);
  }

  const result: GalaxyBoundary[] = [];
  for (const deptIdStr of Object.keys(deptNodes)) {
    const deptId = Number(deptIdStr);
    const dNodes = deptNodes[deptId];
    const dept = departments.find(d => d.id === deptId);
    if (!dept || dNodes.length === 0) continue;

    let cx = 0, cy = 0;
    for (const n of dNodes) { cx += n.x || 0; cy += n.y || 0; }
    cx /= dNodes.length;
    cy /= dNodes.length;

    let maxR = 0;
    for (const n of dNodes) {
      const dx = (n.x || 0) - cx;
      const dy = (n.y || 0) - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxR) maxR = dist;
    }

    result.push({
      deptId,
      name: dept.name,
      color: dept.color || FALLBACK_COLOR,
      cx,
      cy,
      radius: maxR + padding,
      nodeCount: dNodes.length,
    });
  }
  return result;
}

function computeDownstreamCounts(links: { source: number | any; target: number | any }[]): Map<number, number> {
  const childrenOf = new Map<number, number[]>();
  for (const l of links) {
    const src = typeof l.source === 'object' ? l.source.id : l.source;
    const tgt = typeof l.target === 'object' ? l.target.id : l.target;
    if (!childrenOf.has(src)) childrenOf.set(src, []);
    childrenOf.get(src)!.push(tgt);
  }
  const cache = new Map<number, number>();
  function count(id: number, visited: Set<number>): number {
    if (cache.has(id)) return cache.get(id)!;
    if (visited.has(id)) return 0;
    visited.add(id);
    const children = childrenOf.get(id) || [];
    let total = children.length;
    for (const c of children) {
      total += count(c, visited);
    }
    cache.set(id, total);
    return total;
  }
  const allIds = new Set<number>();
  for (const l of links) {
    allIds.add(typeof l.source === 'object' ? l.source.id : l.source);
    allIds.add(typeof l.target === 'object' ? l.target.id : l.target);
  }
  for (const id of allIds) count(id, new Set());
  return cache;
}

function collectFullChain(nodeId: number, links: any[]): { upstream: Set<number>; downstream: Set<number> } {
  const childrenOf = new Map<number, number[]>();
  const parentsOf = new Map<number, number[]>();
  for (const l of links) {
    const src = typeof l.source === 'object' ? l.source.id : l.source;
    const tgt = typeof l.target === 'object' ? l.target.id : l.target;
    if (!childrenOf.has(src)) childrenOf.set(src, []);
    childrenOf.get(src)!.push(tgt);
    if (!parentsOf.has(tgt)) parentsOf.set(tgt, []);
    parentsOf.get(tgt)!.push(src);
  }
  const upstream = new Set<number>();
  const downstream = new Set<number>();
  const qUp = [nodeId];
  while (qUp.length > 0) {
    const cur = qUp.pop()!;
    for (const p of (parentsOf.get(cur) || [])) {
      if (!upstream.has(p) && p !== nodeId) {
        upstream.add(p);
        qUp.push(p);
      }
    }
  }
  const qDown = [nodeId];
  while (qDown.length > 0) {
    const cur = qDown.pop()!;
    for (const c of (childrenOf.get(cur) || [])) {
      if (!downstream.has(c) && c !== nodeId) {
        downstream.add(c);
        qDown.push(c);
      }
    }
  }
  return { upstream, downstream };
}

function getDaysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const HIGHLIGHT_COLORS: Record<string, string> = {
  followUp: '#3b82f6',
  important: '#f59e0b',
  bottleneck: '#ef4444',
};

const ForceGraph = forwardRef<ForceGraphHandle, ForceGraphProps>(function ForceGraph({ nodes, links, projects, departments = [], collabHealth = [], colorBy = 'department', bloodFlow = true, onNodeClick, highlightedNodes = [] }, ref) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const colorByRef = useRef(colorBy);
  const simLinksRef = useRef<any[]>([]);
  const hoveredNodeIdRef = useRef<number | null>(null);
  const selectedNodeIdRef = useRef<number | null>(null);
  const onNodeClickRef = useRef(onNodeClick);
  const galaxyDataRef = useRef<GalaxyBoundary[]>([]);
  const collabHealthRef = useRef(collabHealth);
  const orbitStatesRef = useRef<Map<number, OrbitState>>(new Map());
  const orbitTopologyRef = useRef<OrbitTopology | null>(null);
  const nodeMapRef = useRef<Map<number, SimNode>>(new Map());
  const draggedNodeIdRef = useRef<number | null>(null);
  const orbitIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deptCentroidsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const hasDraggedRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const justClickedNodeRef = useRef(false);
  const downstreamCountsRef = useRef<Map<number, number>>(new Map());
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => { collabHealthRef.current = collabHealth; }, [collabHealth]);
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);

  useImperativeHandle(ref, () => ({
    resetView() {
      if (!svgRef.current || !zoomBehaviorRef.current) return;
      const svg = d3.select(svgRef.current);
      svg.transition().duration(500).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
      if (simulationRef.current) {
        simulationRef.current.alpha(0.3).restart();
      }
    },
  }), []);

  const getRadius = useCallback((node: GraphNode, downstreamCount?: number) => {
    const priorityBase: Record<string, number> = {
      critical: 2.5,
      high: 2,
      medium: 1.8,
      low: 1.5,
    };
    let r = (priorityBase[node.priority] || 1.8) + node.weight * 0.15;
    if (node.type === 'milestone') r *= 1.2;
    const dc = downstreamCount ?? (downstreamCountsRef.current.get(node.id) || 0);
    r += Math.min(dc * 0.3, 2.0);
    return r;
  }, []);

  useEffect(() => {
    colorByRef.current = colorBy;
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGGElement, SimNode>("g.nodes g").each(function (d) {
      const fillColor = getNodeColor(d, colorBy);
      d3.select(this).select("circle").attr("fill", fillColor);
    });
  }, [colorBy]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    d3.select(svgRef.current).selectAll("*").remove();
    orbitStatesRef.current.clear();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const defs = svg.append("defs");

    for (const dept of departments) {
      const grad = defs.append("radialGradient")
        .attr("id", `grad-${dept.id}`);
      const c = dept.color || FALLBACK_COLOR;
      grad.append("stop").attr("offset", "0%").attr("stop-color", c).attr("stop-opacity", 0.06);
      grad.append("stop").attr("offset", "60%").attr("stop-color", c).attr("stop-opacity", 0.03);
      grad.append("stop").attr("offset", "100%").attr("stop-color", c).attr("stop-opacity", 0.10);
    }

    const nodeShadow = defs.append("filter")
      .attr("id", "node-shadow")
      .attr("x", "-50%").attr("y", "-50%")
      .attr("width", "200%").attr("height", "200%");
    nodeShadow.append("feDropShadow")
      .attr("dx", 0).attr("dy", 0.5)
      .attr("stdDeviation", 1.2)
      .attr("flood-color", "#000")
      .attr("flood-opacity", 0.35);

    const nodeShine = defs.append("radialGradient")
      .attr("id", "node-shine")
      .attr("cx", "35%").attr("cy", "35%").attr("r", "65%");
    nodeShine.append("stop").attr("offset", "0%").attr("stop-color", "#fff").attr("stop-opacity", 0.35);
    nodeShine.append("stop").attr("offset", "100%").attr("stop-color", "#fff").attr("stop-opacity", 0);

    const g = svg.append("g");

    const galaxyGroup = g.append("g").attr("class", "galaxies");
    const nodeGroup = g.append("g").attr("class", "nodes");

    if (orbitIntervalRef.current) {
      clearInterval(orbitIntervalRef.current);
      orbitIntervalRef.current = null;
    }

    const deptIds = [...new Set(nodes.map(n => n.deptId ?? -1))];
    const deptAngle = (deptId: number) => {
      const idx = deptIds.indexOf(deptId);
      return (idx / Math.max(deptIds.length, 1)) * Math.PI * 2;
    };
    const spreadR = Math.min(width, height) * 0.2;

    const simNodes: SimNode[] = nodes.map((n) => {
      const angle = deptAngle(n.deptId ?? -1) + (Math.random() - 0.5) * 0.8;
      const r = spreadR * (0.5 + Math.random() * 0.5);
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * r,
        y: height / 2 + Math.sin(angle) * r,
      };
    });
    const simLinks: SimLink[] = links.map((l) => ({ ...l }));
    simLinksRef.current = simLinks;

    const dsCounts = computeDownstreamCounts(simLinks);
    downstreamCountsRef.current = dsCounts;

    const nodeMap = new Map<number, SimNode>();
    for (const n of simNodes) nodeMap.set(n.id, n);
    nodeMapRef.current = nodeMap;

    const topology = buildOrbitTopology(simLinks);
    orbitTopologyRef.current = topology;

    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .velocityDecay(0.5)
      .force(
        "link",
        d3.forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(35)
          .strength(0.8)
      )
      .force("charge", d3.forceManyBody().strength(-25).distanceMax(200))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force(
        "collision",
        d3.forceCollide<SimNode>().radius((d) => getRadius(d) + 1)
      )
      .force("cluster", (alpha: number) => deptClusterForce(simNodes, alpha, deptCentroidsRef.current, galaxyDataRef.current));

    simulationRef.current = simulation;

    const nodeElements = nodeGroup
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .enter()
      .append("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (event.sourceEvent) event.sourceEvent.preventDefault();
            hasDraggedRef.current = false;
            longPressFiredRef.current = false;
            d.fx = d.x;
            d.fy = d.y;
            draggedNodeIdRef.current = d.id;

            const tip = tooltipRef.current;
            if (tip) tip.style.opacity = '0';

            longPressTimerRef.current = setTimeout(() => {
              if (!hasDraggedRef.current) {
                longPressFiredRef.current = true;
                selectedNodeIdRef.current = d.id;
                if (onNodeClickRef.current) onNodeClickRef.current(d);
              }
            }, 400);
          })
          .on("drag", (event, d) => {
            if (!hasDraggedRef.current) {
              hasDraggedRef.current = true;
              if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
              if (!event.active) simulation.alphaTarget(0.02).restart();
            }
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
            if (!event.active) simulation.alphaTarget(0);

            if (hasDraggedRef.current) {
              setTimeout(() => {
                d.fx = null;
                d.fy = null;
              }, 1500);
            } else if (!longPressFiredRef.current) {
              justClickedNodeRef.current = true;
              selectedNodeIdRef.current = d.id;

              d.fx = d.x;
              d.fy = d.y;
              setTimeout(() => { d.fx = null; d.fy = null; }, 500);

              const { upstream, downstream } = collectFullChain(d.id, simLinks);
              const allChain = new Set<number>([d.id, ...upstream, ...downstream]);

              nodeElements.each(function (nd) {
                const el = d3.select(this);
                const isBr = !!(nd as any).isBridge;
                if (nd.id === d.id) {
                  el.style("opacity", "1");
                  el.style("filter", "brightness(1.4)");
                } else if (allChain.has(nd.id)) {
                  el.style("opacity", "0.9");
                  el.style("filter", "none");
                } else {
                  el.style("opacity", isBr ? "0.15" : "0.15");
                  el.style("filter", "none");
                }
              });
            }

            draggedNodeIdRef.current = null;
            hasDraggedRef.current = false;
          })
      );

    nodeElements.each(function (d) {
      const el = d3.select(this);
      const isBridge = !!(d as any).isBridge;
      const dc = isBridge ? 0 : (dsCounts.get(d.id) || 0);
      const r = getRadius(d, dc);
      const fillColor = isBridge ? '#6b7280' : getNodeColor(d, colorByRef.current);
      const daysLeft = getDaysUntilDue(d.dueDate);

      if (isBridge) {
        el.style("opacity", "0.4");
      }

      if (!isBridge && d.isOverdue) {
        el.append("circle")
          .attr("class", "overdue-glow")
          .attr("r", r + 3)
          .attr("fill", "none")
          .attr("stroke", "#ef4444")
          .attr("stroke-width", 1)
          .attr("stroke-opacity", 0.7)
          .attr("pointer-events", "none");
      }

      el.append("circle")
        .attr("r", r)
        .attr("fill", fillColor)
        .attr("stroke", (!isBridge && d.isOverdue) ? "#ef4444" : "none")
        .attr("stroke-width", (!isBridge && d.isOverdue) ? 1 : 0)
        .attr("filter", "url(#node-shadow)");

      el.append("circle")
        .attr("r", r * 0.8)
        .attr("fill", "url(#node-shine)")
        .attr("pointer-events", "none");

      if (isBridge) {
        el.append("circle")
          .attr("r", r + 2)
          .attr("fill", "none")
          .attr("stroke", "rgba(255,255,255,0.2)")
          .attr("stroke-width", 0.5)
          .attr("stroke-dasharray", "2,2")
          .attr("pointer-events", "none");
      } else if (d.status === 'blocked') {
        el.classed("blocked-breathing", true);
      } else if (d.isOverdue) {
        el.classed("urgent-pulse", true);
      } else if (daysLeft !== null && daysLeft <= 3 && daysLeft > 0) {
        el.classed("urgent-pulse", true);
      } else if (daysLeft !== null && daysLeft <= 7 && daysLeft > 3) {
        el.classed("soon-pulse", true);
      }
    });


    interface GalaxyDOMGroup {
      deptId: number;
      borderCircle: d3.Selection<SVGCircleElement, unknown, null, undefined>;
      fillCircle: d3.Selection<SVGCircleElement, unknown, null, undefined>;
      dottedCircle: d3.Selection<SVGCircleElement, unknown, null, undefined>;
      label: d3.Selection<SVGTextElement, unknown, null, undefined>;
      dragHandle: d3.Selection<SVGCircleElement, unknown, null, undefined>;
    }

    const galaxyDOMCache: GalaxyDOMGroup[] = [];

    function initGalaxyDOM() {
      const boundaries = computeGalaxyBoundaries(simNodes, departments);
      galaxyDataRef.current = boundaries;

      galaxyGroup.selectAll("*").remove();
      galaxyDOMCache.length = 0;

      for (const gal of boundaries) {
        const galG = galaxyGroup.append("g");

        const borderCircle = galG.append("circle")
          .attr("cx", gal.cx)
          .attr("cy", gal.cy)
          .attr("r", gal.radius)
          .attr("fill", "none")
          .attr("stroke", gal.color)
          .attr("stroke-width", 1.5)
          .attr("stroke-opacity", 0.12);

        const fillCircle = galG.append("circle")
          .attr("cx", gal.cx)
          .attr("cy", gal.cy)
          .attr("r", gal.radius)
          .attr("fill", `url(#grad-${gal.deptId})`)
          .attr("opacity", 0.12);

        const dottedCircle = galG.append("circle")
          .attr("cx", gal.cx)
          .attr("cy", gal.cy)
          .attr("r", gal.radius * 0.92)
          .attr("fill", "none")
          .attr("stroke", gal.color)
          .attr("stroke-width", 0.5)
          .attr("stroke-opacity", 0.06)
          .attr("stroke-dasharray", "3,6");

        const label = galG.append("text")
          .attr("x", gal.cx)
          .attr("y", gal.cy - gal.radius - 8)
          .attr("text-anchor", "middle")
          .attr("font-size", 13)
          .attr("font-weight", 600)
          .attr("fill", gal.color)
          .attr("opacity", 0.4)
          .text(gal.name);

        const deptId = gal.deptId;
        const dragHandle = galG.append("circle")
          .attr("cx", gal.cx)
          .attr("cy", gal.cy)
          .attr("r", gal.radius)
          .attr("fill", "transparent")
          .attr("stroke", "transparent")
          .attr("stroke-width", 24)
          .attr("cursor", "grab")
          .attr("pointer-events", "stroke")
          .call(
            d3.drag<SVGCircleElement, unknown>()
              .on("start", function (event) {
                if (event.sourceEvent) {
                  event.sourceEvent.stopPropagation();
                  event.sourceEvent.preventDefault();
                }
                d3.select(this).attr("cursor", "grabbing");

                const deptNodes = simNodes.filter(n => (n.deptId ?? -1) === deptId);
                const cx = deptNodes.reduce((s, n) => s + (n.x || 0), 0) / (deptNodes.length || 1);
                const cy = deptNodes.reduce((s, n) => s + (n.y || 0), 0) / (deptNodes.length || 1);

                (this as any).__dragData = {
                  deptNodes,
                  lastCx: cx,
                  lastCy: cy,
                  offsets: deptNodes.map(n => ({ node: n, dx: (n.x || 0) - cx, dy: (n.y || 0) - cy })),
                };

                for (const n of deptNodes) {
                  n.fx = n.x;
                  n.fy = n.y;
                }
              })
              .on("drag", function (event) {
                const data = (this as any).__dragData;
                if (!data) return;

                data.lastCx += event.dx;
                data.lastCy += event.dy;

                for (const off of data.offsets) {
                  const n = off.node;
                  n.fx = data.lastCx + off.dx;
                  n.fy = data.lastCy + off.dy;
                  n.x = n.fx;
                  n.y = n.fy;
                }

                deptCentroidsRef.current.set(deptId, { x: data.lastCx, y: data.lastCy });

                const myRadius = galaxyDataRef.current.find(g => g.deptId === deptId)?.radius || 50;
                for (const otherGal of galaxyDataRef.current) {
                  if (otherGal.deptId === deptId) continue;
                  const otherCentroid = deptCentroidsRef.current.get(otherGal.deptId);
                  if (!otherCentroid) continue;
                  const dx = otherCentroid.x - data.lastCx;
                  const dy = otherCentroid.y - data.lastCy;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  const minDist = myRadius + (otherGal.radius || 50) + 30;
                  if (dist < minDist && dist > 0.1) {
                    const pushDist = minDist - dist;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const otherNodes = simNodes.filter(n => (n.deptId ?? -1) === otherGal.deptId);
                    for (const n of otherNodes) {
                      n.x = (n.x || 0) + nx * pushDist;
                      n.y = (n.y || 0) + ny * pushDist;
                      n.fx = n.x;
                      n.fy = n.y;
                    }
                    const newOx = otherCentroid.x + nx * pushDist;
                    const newOy = otherCentroid.y + ny * pushDist;
                    deptCentroidsRef.current.set(otherGal.deptId, { x: newOx, y: newOy });
                    if (!(this as any).__pushedDepts) (this as any).__pushedDepts = new Set<number>();
                    (this as any).__pushedDepts.add(otherGal.deptId);
                  }
                }

                nodeElements.attr("transform", (d) => `translate(${d.x},${d.y})`);
                updateGalaxyPositions();
              })
              .on("end", function () {
                d3.select(this).attr("cursor", "grab");
                const data = (this as any).__dragData;
                if (!data) return;

                const pushedDepts: Set<number> | undefined = (this as any).__pushedDepts;

                setTimeout(() => {
                  for (const n of data.deptNodes) {
                    n.fx = null;
                    n.fy = null;
                  }
                  if (pushedDepts) {
                    for (const pd of pushedDepts) {
                      const pushed = simNodes.filter(n => (n.deptId ?? -1) === pd);
                      for (const n of pushed) {
                        n.fx = null;
                        n.fy = null;
                      }
                    }
                  }
                  simulation.alpha(0.1).restart();
                }, 2000);

                (this as any).__dragData = null;
                (this as any).__pushedDepts = null;
              })
          );

        galaxyDOMCache.push({
          deptId: gal.deptId,
          borderCircle,
          fillCircle,
          dottedCircle,
          label,
          dragHandle,
        });
      }
    }

    function updateGalaxyPositions() {
      const boundaries = computeGalaxyBoundaries(simNodes, departments);
      galaxyDataRef.current = boundaries;

      if (boundaries.length !== galaxyDOMCache.length) {
        initGalaxyDOM();
        return;
      }

      for (let i = 0; i < boundaries.length; i++) {
        const gal = boundaries[i];
        const dom = galaxyDOMCache[i];
        if (!dom || dom.deptId !== gal.deptId) {
          initGalaxyDOM();
          return;
        }

        dom.borderCircle.attr("cx", gal.cx).attr("cy", gal.cy).attr("r", gal.radius);
        dom.fillCircle.attr("cx", gal.cx).attr("cy", gal.cy).attr("r", gal.radius);
        dom.dottedCircle.attr("cx", gal.cx).attr("cy", gal.cy).attr("r", gal.radius * 0.92);
        dom.label.attr("x", gal.cx).attr("y", gal.cy - gal.radius - 8);
        dom.dragHandle.attr("cx", gal.cx).attr("cy", gal.cy).attr("r", gal.radius);
      }
    }

    initGalaxyDOM();

    nodeElements.on("mouseover", function (_event, hoveredNode) {
      if (draggedNodeIdRef.current !== null) return;
      hoveredNodeIdRef.current = hoveredNode.id;

      const { upstream, downstream } = collectFullChain(hoveredNode.id, simLinks);
      const allChain = new Set<number>([hoveredNode.id, ...upstream, ...downstream]);

      nodeElements.each(function (d) {
        const el = d3.select(this);
        if (d.id === hoveredNode.id) {
          el.style("opacity", "1");
          el.classed("blocked-breathing", false);
          el.classed("urgent-pulse", false);
          el.classed("soon-pulse", false);
          el.style("filter", "brightness(1.4)");
        } else if (allChain.has(d.id)) {
          el.style("opacity", "0.9");
          el.style("filter", "none");
        } else {
          el.style("opacity", "0.15");
          el.style("filter", "none");
        }
      });
      d3.select(this).attr("transform", function () {
        const d = d3.select<SVGGElement, SimNode>(this as SVGGElement).datum();
        return `translate(${d.x},${d.y}) scale(2)`;
      });

      const tip = tooltipRef.current;
      if (tip) {
        const isBridge = !!(hoveredNode as any).isBridge;
        const dc = isBridge ? 0 : (dsCounts.get(hoveredNode.id) || 0);
        const daysLeft = getDaysUntilDue(hoveredNode.dueDate);
        let urgencyText = '';
        if (!isBridge) {
          if (hoveredNode.isOverdue) urgencyText = ' (已过期)';
          else if (daysLeft !== null && daysLeft <= 3) urgencyText = ` (${daysLeft}天后到期)`;
          else if (daysLeft !== null && daysLeft <= 7) urgencyText = ` (${daysLeft}天后到期)`;
        }

        const STATUS_LABELS: Record<string, string> = {
          todo: '待办', in_progress: '进行中', in_review: '审核中', blocked: '阻塞',
          done: '已完成', cancelled: '已取消',
        };

        const bridgeTag = isBridge
          ? `<div style="color:rgba(255,255,255,0.4);font-size:10px;margin-bottom:2px;border:1px solid rgba(255,255,255,0.15);border-radius:3px;display:inline-block;padding:0 4px">${hoveredNode.status === 'done' ? '✓ 已完成' : '✕ 已取消'} · 桥梁节点</div>`
          : '';

        tip.innerHTML = `
          ${bridgeTag}
          <div style="font-weight:600;margin-bottom:3px;color:rgba(255,255,255,${isBridge ? '0.5' : '0.9'});font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${hoveredNode.title}</div>
          <div style="color:rgba(255,255,255,0.5);font-size:11px;line-height:1.5">
            ${hoveredNode.assigneeName ? `<span>${hoveredNode.assigneeName}</span> · ` : ''}${STATUS_LABELS[hoveredNode.status] || hoveredNode.status}${hoveredNode.dueDate ? ` · ${hoveredNode.dueDate.slice(0, 10)}${urgencyText}` : ''}${dc > 0 ? ` · ${dc}个下游依赖` : ''}
          </div>
        `;
        const transform = zoomTransformRef.current;
        const sx = transform.x + (hoveredNode.x || 0) * transform.k;
        const sy = transform.y + (hoveredNode.y || 0) * transform.k;
        tip.style.left = `${sx + 12}px`;
        tip.style.top = `${sy - 8}px`;
        tip.style.opacity = '1';
        tip.style.pointerEvents = 'none';
      }
    });

    nodeElements.on("mouseout", function () {
      hoveredNodeIdRef.current = null;
      nodeElements.each(function (d) {
        const el = d3.select(this);
        const isBridge = !!(d as any).isBridge;
        el.style("opacity", isBridge ? "0.4" : null);
        el.style("filter", null);
        if (!isBridge) {
          const daysLeft = getDaysUntilDue(d.dueDate);
          if (d.status === 'blocked') {
            el.classed("blocked-breathing", true);
          }
          if (d.isOverdue || (daysLeft !== null && daysLeft <= 3)) {
            el.classed("urgent-pulse", true);
          } else if (daysLeft !== null && daysLeft <= 7) {
            el.classed("soon-pulse", true);
          }
        }
      });
      nodeElements.attr("transform", (d) => `translate(${d.x},${d.y})`);

      const tip = tooltipRef.current;
      if (tip) tip.style.opacity = '0';
    });

    svg.on("click", () => {
      if (justClickedNodeRef.current) {
        justClickedNodeRef.current = false;
        return;
      }
      selectedNodeIdRef.current = null;
      if (onNodeClickRef.current) onNodeClickRef.current(null as any);

      nodeElements.each(function (d) {
        const el = d3.select(this);
        const isBridge = !!(d as any).isBridge;
        el.style("opacity", isBridge ? "0.4" : null);
        el.style("filter", null);
        if (!isBridge) {
          const daysLeft = getDaysUntilDue(d.dueDate);
          if (d.status === 'blocked') el.classed("blocked-breathing", true);
          if (d.isOverdue || (daysLeft !== null && daysLeft <= 3)) el.classed("urgent-pulse", true);
          else if (daysLeft !== null && daysLeft <= 7) el.classed("soon-pulse", true);
        }
      });
    });

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 6])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        zoomTransformRef.current = event.transform;
      });
    zoomBehaviorRef.current = zoom;

    svg.call(zoom);

    const VEL_CAP = 5;
    let tickCount = 0;
    simulation.on("tick", () => {
      tickCount++;

      for (const n of simNodes) {
        if (n.vx != null && Math.abs(n.vx) > VEL_CAP) n.vx = Math.sign(n.vx) * VEL_CAP;
        if (n.vy != null && Math.abs(n.vy) > VEL_CAP) n.vy = Math.sign(n.vy) * VEL_CAP;
      }

      orbitForce(simNodes, topology, orbitStatesRef.current, draggedNodeIdRef.current, simulation.alpha(), nodeMap);

      nodeElements.attr("transform", (d) => `translate(${d.x},${d.y})`);

      if (tickCount % 5 === 0) {
        updateGalaxyPositions();
      }
    });

    simulation.on("end", () => {
      const interval = setInterval(() => {
        tickCount++;
        orbitForce(simNodes, topology, orbitStatesRef.current, draggedNodeIdRef.current, 0.01, nodeMap);
        nodeElements.attr("transform", (d) => `translate(${d.x},${d.y})`);
        if (tickCount % 5 === 0) {
          updateGalaxyPositions();
        }
      }, 1000 / 30);
      orbitIntervalRef.current = interval;
    });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let lastResizeW = width;
    let lastResizeH = height;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        svg.attr("width", w).attr("height", h);
        const dw = Math.abs(w - lastResizeW);
        const dh = Math.abs(h - lastResizeH);
        if (dw > 50 || dh > 50) {
          lastResizeW = w;
          lastResizeH = h;
          simulation.force("center", d3.forceCenter(w / 2, h / 2).strength(0.05));
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            simulation.alpha(0.08).restart();
          }, 300);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      if (orbitIntervalRef.current) {
        clearInterval(orbitIntervalRef.current);
        orbitIntervalRef.current = null;
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (resizeTimer) clearTimeout(resizeTimer);
      simulation.stop();
      resizeObserver.disconnect();
    };
  }, [nodes, links, projects, departments, getRadius]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll(".glow-highlight").remove();

    if (highlightedNodes.length === 0) return;

    const highlightMap = new Map<number, HighlightedNode>();
    for (const h of highlightedNodes) highlightMap.set(h.id, h);

    const nodeGroup = svg.select("g g.nodes");
    nodeGroup.selectAll<SVGGElement, SimNode>("g").each(function (d) {
      const hl = highlightMap.get(d.id);
      if (!hl) return;
      const el = d3.select(this);
      const r = getRadius(d);
      const color = HIGHLIGHT_COLORS[hl.type] || '#fff';

      el.insert("circle", ":first-child")
        .attr("class", "glow-highlight")
        .attr("r", r + 5)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.7)
        .style("animation", "glow-pulse 2s ease-in-out infinite");

      el.insert("circle", ":first-child")
        .attr("class", "glow-highlight")
        .attr("r", r + 9)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 0.8)
        .attr("stroke-opacity", 0.3)
        .style("animation", "glow-pulse 2s ease-in-out 0.5s infinite");
    });
  }, [highlightedNodes, getRadius]);

  return (
    <div
      ref={containerRef}
      data-testid="graph-canvas"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: 'none',
      } as any}
    >
      <BloodVesselCanvas
        simLinksRef={simLinksRef}
        zoomTransformRef={zoomTransformRef}
        hoveredNodeIdRef={hoveredNodeIdRef}
        selectedNodeIdRef={selectedNodeIdRef}
        bloodFlow={bloodFlow}
        galaxyDataRef={galaxyDataRef}
        collabHealthRef={collabHealthRef}
        deptCentroidsRef={deptCentroidsRef}
      />
      <svg
        ref={svgRef}
        style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'block' }}
      />
      <div
        ref={tooltipRef}
        data-testid="graph-tooltip"
        style={{
          position: 'absolute',
          zIndex: 20,
          maxWidth: 220,
          padding: '6px 10px',
          background: 'rgba(20, 19, 18, 0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          opacity: 0,
          transition: 'opacity 120ms',
          pointerEvents: 'none',
          fontFamily: 'var(--font-sans)',
        }}
      />
    </div>
  );
});

export default ForceGraph;
