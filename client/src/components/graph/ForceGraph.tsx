import { useRef, useEffect, useCallback } from "react";
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

interface ForceGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  projects: ProjectInfo[];
  departments?: DeptInfo[];
  collabHealth?: CollabHealth[];
  colorBy?: ColorByOption;
  bloodFlow?: boolean;
  onNodeClick?: (node: GraphNode) => void;
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

function deptClusterForce(nodes: SimNode[], alpha: number) {
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
  for (const key of Object.keys(centroids)) {
    const c = centroids[Number(key)];
    c.x /= c.count;
    c.y /= c.count;
  }
  const attractStrength = 0.35;
  const repelStrength = 0.08;
  for (const node of nodes) {
    const key = node.deptId ?? -1;
    const c = centroids[key];
    if (c) {
      node.vx = (node.vx || 0) + (c.x - (node.x || 0)) * alpha * attractStrength;
      node.vy = (node.vy || 0) + (c.y - (node.y || 0)) * alpha * attractStrength;
      for (const otherKey of Object.keys(centroids)) {
        const otherDept = Number(otherKey);
        if (otherDept !== key) {
          const other = centroids[otherDept];
          const dx = (node.x || 0) - other.x;
          const dy = (node.y || 0) - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          node.vx = (node.vx || 0) + (dx / dist) * alpha * repelStrength * 60;
          node.vy = (node.vy || 0) + (dy / dist) * alpha * repelStrength * 60;
        }
      }
    }
  }
}

function truncate(str: string, max: number) {
  if (str.length <= max) return str;
  return str.slice(0, max) + "\u2026";
}

function computeGalaxyBoundaries(nodes: SimNode[], departments: DeptInfo[], padding: number = 40) {
  const deptNodes: Record<number, SimNode[]> = {};
  for (const n of nodes) {
    const key = n.deptId ?? -1;
    if (key === -1) continue;
    if (!deptNodes[key]) deptNodes[key] = [];
    deptNodes[key].push(n);
  }

  return Object.entries(deptNodes).map(([deptIdStr, dNodes]) => {
    const deptId = Number(deptIdStr);
    const dept = departments.find(d => d.id === deptId);
    if (!dept || dNodes.length === 0) return null;

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

    const radius = maxR + padding;

    return {
      deptId,
      name: dept.name,
      color: dept.color || FALLBACK_COLOR,
      cx,
      cy,
      radius,
      nodeCount: dNodes.length,
    };
  }).filter(Boolean) as Array<{
    deptId: number; name: string; color: string;
    cx: number; cy: number; radius: number; nodeCount: number;
  }>;
}

export default function ForceGraph({ nodes, links, projects, departments = [], collabHealth = [], colorBy = 'department', bloodFlow = true, onNodeClick }: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const colorByRef = useRef(colorBy);
  const simLinksRef = useRef<any[]>([]);
  const hoveredNodeIdRef = useRef<number | null>(null);
  const selectedNodeIdRef = useRef<number | null>(null);
  const galaxyDataRef = useRef<ReturnType<typeof computeGalaxyBoundaries>>([]);
  const collabHealthRef = useRef(collabHealth);

  useEffect(() => { collabHealthRef.current = collabHealth; }, [collabHealth]);

  const getRadius = useCallback((node: GraphNode) => {
    const priorityBase: Record<string, number> = {
      critical: 14,
      high: 10,
      medium: 7,
      low: 5,
    };
    let r = (priorityBase[node.priority] || 7) + node.weight * 1.5;
    if (node.type === 'milestone') r *= 1.3;
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

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const defs = svg.append("defs");

    const galaxyFilter = defs.append("filter")
      .attr("id", "galaxyNebula")
      .attr("x", "-50%").attr("y", "-50%")
      .attr("width", "200%").attr("height", "200%");
    galaxyFilter.append("feTurbulence")
      .attr("type", "fractalNoise")
      .attr("baseFrequency", "0.015")
      .attr("numOctaves", "4")
      .attr("seed", "3")
      .attr("result", "noise");
    galaxyFilter.append("feDisplacementMap")
      .attr("in", "SourceGraphic")
      .attr("in2", "noise")
      .attr("scale", "25")
      .attr("xChannelSelector", "R")
      .attr("yChannelSelector", "G");

    const g = svg.append("g");

    const galaxyGroup = g.append("g").attr("class", "galaxies");
    const collabGroup = g.append("g").attr("class", "collab-links");
    const nodeGroup = g.append("g").attr("class", "nodes");
    const labelGroup = g.append("g").attr("class", "labels");

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = links.map((l) => ({ ...l }));
    simLinksRef.current = simLinks;

    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3.forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide<SimNode>().radius((d) => getRadius(d) + 5)
      )
      .force("cluster", (alpha: number) => deptClusterForce(simNodes, alpha));

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
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    nodeElements.each(function (d) {
      const el = d3.select(this);
      const r = getRadius(d);
      const fillColor = getNodeColor(d, colorByRef.current);

      el.append("circle")
        .attr("r", r)
        .attr("fill", fillColor)
        .attr("stroke", d.isOverdue ? "#ef4444" : "none")
        .attr("stroke-width", d.isOverdue ? 3 : 0);

      if (d.status === 'blocked') {
        el.classed("blocked-breathing", true);
      }
    });

    const labelElements = labelGroup
      .selectAll<SVGTextElement, SimNode>("text")
      .data(simNodes)
      .enter()
      .append("text")
      .text((d) => truncate(d.title, 12))
      .attr("font-size", 10)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => getRadius(d) + 14)
      .attr("fill", "rgba(255,255,255,0.7)")
      .attr("pointer-events", "none")
      .attr("visibility", "hidden");

    function updateLabelVisibility() {
      const k = zoomTransformRef.current.k;
      const hovId = hoveredNodeIdRef.current;
      const selId = selectedNodeIdRef.current;
      labelElements.each(function (d) {
        const show = k > 1.5 || d.id === hovId || d.id === selId;
        d3.select(this).attr("visibility", show ? "visible" : "hidden");
      });
    }

    function updateGalaxies() {
      const boundaries = computeGalaxyBoundaries(simNodes, departments);
      galaxyDataRef.current = boundaries;

      galaxyGroup.selectAll("*").remove();

      for (const gal of boundaries) {
        const galG = galaxyGroup.append("g");

        galG.append("circle")
          .attr("cx", gal.cx)
          .attr("cy", gal.cy)
          .attr("r", gal.radius)
          .attr("fill", "none")
          .attr("stroke", gal.color)
          .attr("stroke-width", 1.5)
          .attr("stroke-opacity", 0.15)
          .attr("filter", "url(#galaxyNebula)");

        galG.append("circle")
          .attr("cx", gal.cx)
          .attr("cy", gal.cy)
          .attr("r", gal.radius)
          .attr("fill", `url(#grad-${gal.deptId})`)
          .attr("opacity", 0.12);

        if (!defs.select(`#grad-${gal.deptId}`).node()) {
          const grad = defs.append("radialGradient")
            .attr("id", `grad-${gal.deptId}`);
          grad.append("stop").attr("offset", "0%").attr("stop-color", gal.color).attr("stop-opacity", 0.08);
          grad.append("stop").attr("offset", "60%").attr("stop-color", gal.color).attr("stop-opacity", 0.04);
          grad.append("stop").attr("offset", "100%").attr("stop-color", gal.color).attr("stop-opacity", 0.15);
        }

        galG.append("circle")
          .attr("cx", gal.cx)
          .attr("cy", gal.cy)
          .attr("r", gal.radius * 0.92)
          .attr("fill", "none")
          .attr("stroke", gal.color)
          .attr("stroke-width", 0.5)
          .attr("stroke-opacity", 0.08)
          .attr("stroke-dasharray", "3,6");

        galG.append("text")
          .attr("x", gal.cx)
          .attr("y", gal.cy - gal.radius - 8)
          .attr("text-anchor", "middle")
          .attr("font-size", 13)
          .attr("font-weight", 600)
          .attr("fill", gal.color)
          .attr("opacity", 0.5)
          .text(gal.name);
      }

      updateCollabLinks(boundaries);
    }

    function updateCollabLinks(boundaries: ReturnType<typeof computeGalaxyBoundaries>) {
      collabGroup.selectAll("*").remove();
      const health = collabHealthRef.current;
      if (!health || health.length === 0) return;

      const galaxyMap = new Map(boundaries.map(g => [g.deptId, g]));

      for (const h of health) {
        const gA = galaxyMap.get(h.deptA);
        const gB = galaxyMap.get(h.deptB);
        if (!gA || !gB) continue;

        const dx = gB.cx - gA.cx;
        const dy = gB.cy - gA.cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;

        const x1 = gA.cx + nx * gA.radius;
        const y1 = gA.cy + ny * gA.radius;
        const x2 = gB.cx - nx * gB.radius;
        const y2 = gB.cy - ny * gB.radius;

        let linkColor: string;
        if (h.healthScore > 0.7) linkColor = '#10b981';
        else if (h.healthScore > 0.3) linkColor = '#f59e0b';
        else linkColor = '#ef4444';

        const lineWidth = Math.max(1, Math.min(4, h.taskCount * 0.5));

        collabGroup.append("line")
          .attr("x1", x1).attr("y1", y1)
          .attr("x2", x2).attr("y2", y2)
          .attr("stroke", linkColor)
          .attr("stroke-width", lineWidth)
          .attr("stroke-opacity", 0.2)
          .attr("stroke-dasharray", "6,4");
      }
    }

    nodeElements.on("mouseover", function (_event, hoveredNode) {
      hoveredNodeIdRef.current = hoveredNode.id;

      const connectedIds = new Set<number>();
      connectedIds.add(hoveredNode.id);
      simLinks.forEach((l) => {
        const srcId = typeof l.source === "object" ? l.source.id : l.source;
        const tgtId = typeof l.target === "object" ? l.target.id : l.target;
        if (srcId === hoveredNode.id) connectedIds.add(Number(tgtId));
        if (tgtId === hoveredNode.id) connectedIds.add(Number(srcId));
      });

      nodeElements.each(function (d) {
        const el = d3.select(this);
        el.style("opacity", connectedIds.has(d.id) ? "1" : "0.2");
        if (d.id === hoveredNode.id) {
          el.classed("blocked-breathing", false);
          el.style("filter", "brightness(1.4)");
        } else {
          el.style("filter", "none");
        }
      });
      d3.select(this).attr("transform", function () {
        const d = d3.select<SVGGElement, SimNode>(this as SVGGElement).datum();
        return `translate(${d.x},${d.y}) scale(1.3)`;
      });

      updateLabelVisibility();
    });

    nodeElements.on("mouseout", function () {
      hoveredNodeIdRef.current = null;
      nodeElements.each(function (d) {
        const el = d3.select(this);
        el.style("opacity", null);
        el.style("filter", null);
        if (d.status === 'blocked') {
          el.classed("blocked-breathing", true);
        }
      });
      nodeElements.attr("transform", (d) => `translate(${d.x},${d.y})`);
      updateLabelVisibility();
    });

    nodeElements.on("click", (_event, d) => {
      _event.stopPropagation();
      selectedNodeIdRef.current = d.id;
      updateLabelVisibility();
      if (onNodeClick) onNodeClick(d);
    });

    svg.on("click", () => {
      selectedNodeIdRef.current = null;
      updateLabelVisibility();
    });

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        zoomTransformRef.current = event.transform;
        updateLabelVisibility();
      });

    svg.call(zoom);

    let tickCount = 0;
    simulation.on("tick", () => {
      nodeElements.attr("transform", (d) => `translate(${d.x},${d.y})`);
      labelElements
        .attr("x", (d) => d.x || 0)
        .attr("y", (d) => (d.y || 0));

      tickCount++;
      if (tickCount % 3 === 0) {
        updateGalaxies();
      }
    });

    updateLabelVisibility();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        svg.attr("width", w).attr("height", h);
        simulation.force("center", d3.forceCenter(w / 2, h / 2));
        simulation.alpha(0.3).restart();
      }
    });
    resizeObserver.observe(container);

    return () => {
      simulation.stop();
      resizeObserver.disconnect();
    };
  }, [nodes, links, projects, departments, onNodeClick, getRadius]);

  return (
    <div
      ref={containerRef}
      data-testid="graph-canvas"
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <BloodVesselCanvas
        simLinksRef={simLinksRef}
        zoomTransformRef={zoomTransformRef}
        hoveredNodeIdRef={hoveredNodeIdRef}
        bloodFlow={bloodFlow}
        galaxyDataRef={galaxyDataRef}
        collabHealthRef={collabHealthRef}
      />
      <svg
        ref={svgRef}
        style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
