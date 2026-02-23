import { useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import type { ColorByOption } from "./GraphSettings";

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

interface ForceGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  projects: ProjectInfo[];
  colorBy?: ColorByOption;
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

function clusterForce(nodes: SimNode[], alpha: number) {
  const centroids: Record<number, { x: number; y: number; count: number }> = {};
  for (const node of nodes) {
    if (!centroids[node.projectId]) {
      centroids[node.projectId] = { x: 0, y: 0, count: 0 };
    }
    centroids[node.projectId].x += node.x || 0;
    centroids[node.projectId].y += node.y || 0;
    centroids[node.projectId].count += 1;
  }
  for (const key of Object.keys(centroids)) {
    const c = centroids[Number(key)];
    c.x /= c.count;
    c.y /= c.count;
  }
  const attractStrength = 0.3;
  const repelStrength = 0.05;
  for (const node of nodes) {
    const c = centroids[node.projectId];
    if (c) {
      node.vx = (node.vx || 0) + (c.x - (node.x || 0)) * alpha * attractStrength;
      node.vy = (node.vy || 0) + (c.y - (node.y || 0)) * alpha * attractStrength;
      for (const key of Object.keys(centroids)) {
        const pid = Number(key);
        if (pid !== node.projectId) {
          const other = centroids[pid];
          const dx = (node.x || 0) - other.x;
          const dy = (node.y || 0) - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          node.vx = (node.vx || 0) + (dx / dist) * alpha * repelStrength * 50;
          node.vy = (node.vy || 0) + (dy / dist) * alpha * repelStrength * 50;
        }
      }
    }
  }
}

function truncate(str: string, max: number) {
  if (str.length <= max) return str;
  return str.slice(0, max) + "\u2026";
}

export default function ForceGraph({ nodes, links, projects, colorBy = 'department', onNodeClick }: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const colorByRef = useRef(colorBy);

  const getRadius = useCallback((node: GraphNode) => 12 + node.weight * 4, []);

  useEffect(() => {
    colorByRef.current = colorBy;
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGGElement, SimNode>("g.nodes g").each(function (d) {
      const fillColor = getNodeColor(d, colorBy);
      const el = d3.select(this);
      el.select("circle").attr("fill", fillColor);
      el.select("rect").attr("fill", fillColor);
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

    defs.append("marker")
      .attr("id", "arrow-blocking")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#ef4444");

    defs.append("marker")
      .attr("id", "arrow-normal")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#10b981");

    defs.append("filter")
      .attr("id", "brighten")
      .append("feComponentTransfer")
      .selectAll("func")
      .data(["feFuncR", "feFuncG", "feFuncB"])
      .enter()
      .each(function (tag) {
        defs.select("#brighten feComponentTransfer")
          .append(tag)
          .attr("type", "linear")
          .attr("slope", "1.4")
          .attr("intercept", "0.1");
      });

    const g = svg.append("g");

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = links.map((l) => ({ ...l }));

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
      .force("cluster", (alpha: number) => clusterForce(simNodes, alpha));

    simulationRef.current = simulation;

    const linkGroup = g.append("g").attr("class", "links");
    const nodeGroup = g.append("g").attr("class", "nodes");
    const labelGroup = g.append("g").attr("class", "labels");

    const linkElements = linkGroup
      .selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks)
      .enter()
      .append("line")
      .attr("stroke", (d) => (d.isBlocking ? "#ef4444" : "#10b981"))
      .attr("stroke-width", (d) => (d.isBlocking ? 3 : 1.5))
      .attr("stroke-dasharray", (d) => (d.isBlocking ? "none" : "5,5"))
      .attr("marker-end", (d) =>
        d.isBlocking ? "url(#arrow-blocking)" : "url(#arrow-normal)"
      );

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

      if (d.type === "milestone") {
        el.append("rect")
          .attr("width", r * 1.4)
          .attr("height", r * 1.4)
          .attr("x", (-r * 1.4) / 2)
          .attr("y", (-r * 1.4) / 2)
          .attr("transform", "rotate(45)")
          .attr("fill", fillColor)
          .attr("stroke", d.isOverdue ? "#ef4444" : "none")
          .attr("stroke-width", d.isOverdue ? 3 : 0);
      } else {
        el.append("circle")
          .attr("r", r)
          .attr("fill", fillColor)
          .attr("stroke", d.isOverdue ? "#ef4444" : "none")
          .attr("stroke-width", d.isOverdue ? 3 : 0);
      }
    });

    const labelElements = labelGroup
      .selectAll<SVGTextElement, SimNode>("text")
      .data(simNodes)
      .enter()
      .append("text")
      .text((d) => truncate(d.title, 12))
      .attr("font-size", 11)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => getRadius(d) + 14)
      .attr("fill", "#d1d5db")
      .attr("pointer-events", "none");

    function updateLabelVisibility() {
      const k = zoomTransformRef.current.k;
      labelElements.attr("visibility", k < 0.5 ? "hidden" : "visible");
    }

    nodeElements.on("mouseover", function (_event, hoveredNode) {
      const connectedIds = new Set<number>();
      connectedIds.add(hoveredNode.id);
      simLinks.forEach((l) => {
        const srcId = typeof l.source === "object" ? l.source.id : l.source;
        const tgtId = typeof l.target === "object" ? l.target.id : l.target;
        if (srcId === hoveredNode.id) connectedIds.add(Number(tgtId));
        if (tgtId === hoveredNode.id) connectedIds.add(Number(srcId));
      });

      nodeElements
        .attr("opacity", (d) => (connectedIds.has(d.id) ? 1 : 0.2))
        .attr("filter", (d) => (d.id === hoveredNode.id ? "url(#brighten)" : "none"));
      d3.select(this).attr("transform", function () {
        const d = d3.select<SVGGElement, SimNode>(this as SVGGElement).datum();
        return `translate(${d.x},${d.y}) scale(1.3)`;
      });

      linkElements.attr("opacity", (l) => {
        const srcId = typeof l.source === "object" ? l.source.id : l.source;
        const tgtId = typeof l.target === "object" ? l.target.id : l.target;
        return srcId === hoveredNode.id || tgtId === hoveredNode.id ? 1 : 0.2;
      });

      labelElements.attr("opacity", (d) => (connectedIds.has(d.id) ? 1 : 0.2));
    });

    nodeElements.on("mouseout", function () {
      nodeElements.attr("opacity", 1).attr("filter", "none");
      linkElements.attr("opacity", 1);
      labelElements.attr("opacity", 1);
      nodeElements.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    nodeElements.on("click", (_event, d) => {
      _event.stopPropagation();
      if (onNodeClick) onNodeClick(d);
    });

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        zoomTransformRef.current = event.transform;
        updateLabelVisibility();
      });

    svg.call(zoom);

    simulation.on("tick", () => {
      linkElements
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeElements.attr("transform", (d) => `translate(${d.x},${d.y})`);

      labelElements
        .attr("x", (d) => d.x || 0)
        .attr("y", (d) => (d.y || 0));
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
  }, [nodes, links, projects, onNodeClick, getRadius]);

  return (
    <div
      ref={containerRef}
      data-testid="graph-canvas"
      style={{ width: '100%', height: '100%' }}
    >
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
