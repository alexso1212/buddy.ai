import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import * as d3 from "d3";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Network, Users, AlertTriangle, Clock, Building2, ZoomIn, ZoomOut, Maximize2
} from "lucide-react";

interface GraphNode {
  id: string;
  type: "person" | "dept";
  name: string;
  dept_id?: string;
  color?: string;
  task_count?: number;
  overdue_count?: number;
  status?: string;
  title?: string;
  member_count?: number;
  head_id?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
  task_ids: string[];
  status: string;
}

interface CollaborationData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const STATUS_COLORS: Record<string, string> = {
  healthy: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
};

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-[500px] w-full rounded-xl" />
    </div>
  );
}

function SidePanel({ node, links, allNodes }: { node: GraphNode | null; links: GraphLink[]; allNodes: GraphNode[] }) {
  if (!node) return (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-4">
      点击节点查看详情
    </div>
  );

  const connectedLinks = links.filter((l) => {
    const src = typeof l.source === "string" ? l.source : l.source.id;
    const tgt = typeof l.target === "string" ? l.target : l.target.id;
    return src === node.id || tgt === node.id;
  });

  const connections = connectedLinks.map((l) => {
    const src = typeof l.source === "string" ? l.source : l.source.id;
    const tgt = typeof l.target === "string" ? l.target : l.target.id;
    const otherId = src === node.id ? tgt : src;
    const other = allNodes.find((n) => n.id === otherId);
    return { ...l, other, otherId };
  }).sort((a, b) => b.weight - a.weight);

  const isPerson = node.type === "person";

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: node.color || "#888" }} />
          <div>
            <h3 className="font-medium text-sm">{node.name}</h3>
            {isPerson && <p className="text-xs text-muted-foreground">{node.title}</p>}
            {!isPerson && <p className="text-xs text-muted-foreground">{node.member_count}人</p>}
          </div>
        </div>

        {isPerson && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border bg-white dark:bg-card p-2 text-center shadow-sm">
              <p className="text-lg font-semibold">{node.task_count ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">任务数</p>
            </div>
            <div className="rounded-lg border bg-white dark:bg-card p-2 text-center shadow-sm">
              <p className="text-lg font-semibold" style={{ color: (node.overdue_count ?? 0) > 0 ? "#ef4444" : undefined }}>{node.overdue_count ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">逾期</p>
            </div>
          </div>
        )}

        {isPerson && node.status && (
          <Badge className="rounded-full text-xs font-medium border-0" style={{ backgroundColor: STATUS_COLORS[node.status] + "1a", color: STATUS_COLORS[node.status] }}>
            {node.status === "healthy" ? "正常" : node.status === "warning" ? "临期" : "逾期"}
          </Badge>
        )}

        <div>
          <h4 className="text-xs font-medium mb-2 text-muted-foreground">协作关系 ({connections.length})</h4>
          <div className="space-y-2">
            {connections.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-muted/50">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[c.status] || "#888" }} />
                <span className="flex-1 truncate">{c.other?.name || c.otherId}</span>
                <Badge variant="outline" className="rounded-full text-[10px] font-medium border-0">{c.weight}个任务</Badge>
              </div>
            ))}
            {connections.length === 0 && <p className="text-xs text-muted-foreground">暂无协作关系</p>}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function ForceGraph({ data, filter, onSelectNode, selectedNode }: {
  data: CollaborationData; filter: string; onSelectNode: (n: GraphNode | null) => void; selectedNode: GraphNode | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  const filteredData = useMemo(() => {
    let nodes = data.nodes;
    let links = data.links;

    if (filter === "people") {
      nodes = nodes.filter((n) => n.type === "person");
      const nodeIds = new Set(nodes.map((n) => n.id));
      links = links.filter((l) => {
        const src = typeof l.source === "string" ? l.source : l.source.id;
        const tgt = typeof l.target === "string" ? l.target : l.target.id;
        return nodeIds.has(src) && nodeIds.has(tgt);
      });
    } else if (filter !== "all") {
      const deptUsers = data.nodes.filter((n) => n.type === "person" && n.dept_id === filter);
      const deptUserIds = new Set(deptUsers.map((n) => n.id));
      const connectedIds = new Set<string>();
      links.forEach((l) => {
        const src = typeof l.source === "string" ? l.source : l.source.id;
        const tgt = typeof l.target === "string" ? l.target : l.target.id;
        if (deptUserIds.has(src)) connectedIds.add(tgt);
        if (deptUserIds.has(tgt)) connectedIds.add(src);
      });
      const allIds = new Set([...deptUserIds, ...connectedIds]);
      nodes = nodes.filter((n) => n.type === "person" && allIds.has(n.id));
      const nodeIds = new Set(nodes.map((n) => n.id));
      links = links.filter((l) => {
        const src = typeof l.source === "string" ? l.source : l.source.id;
        const tgt = typeof l.target === "string" ? l.target : l.target.id;
        return nodeIds.has(src) && nodeIds.has(tgt);
      });
    }

    return {
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({ ...l })),
    };
  }, [data, filter]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    const simulation = d3.forceSimulation<GraphNode>(filteredData.nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(filteredData.links)
        .id((d) => d.id)
        .distance((d) => Math.max(80, 200 - d.weight * 15))
        .strength((d) => Math.min(0.8, 0.1 + d.weight * 0.05)))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(35));

    simulationRef.current = simulation;

    const link = g.append("g").selectAll("line")
      .data(filteredData.links)
      .join("line")
      .attr("stroke", (d) => STATUS_COLORS[d.status] || "#888")
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", (d) => Math.min(6, 1 + d.weight * 0.8));

    const nodeGroup = g.append("g").selectAll("g")
      .data(filteredData.nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(d3.drag<SVGGElement, GraphNode>()
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
        }));

    nodeGroup.on("click", (_, d) => onSelectNode(d));

    nodeGroup.append("circle")
      .attr("r", (d) => d.type === "dept" ? 22 : 16)
      .attr("fill", (d) => d.color || "#888")
      .attr("fill-opacity", 0.15)
      .attr("stroke", (d) => d.color || "#888")
      .attr("stroke-width", (d) => {
        if (selectedNode && selectedNode.id === d.id) return 3;
        return d.type === "dept" ? 2 : 1.5;
      });

    nodeGroup.filter((d) => d.type === "person" && d.status !== "healthy")
      .append("circle")
      .attr("r", 20)
      .attr("fill", "none")
      .attr("stroke", (d) => STATUS_COLORS[d.status || "healthy"])
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "3,3")
      .attr("opacity", 0.6);

    nodeGroup.append("text")
      .text((d) => d.name.slice(0, 4))
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.type === "dept" ? -28 : -22)
      .attr("font-size", (d) => d.type === "dept" ? 11 : 10)
      .attr("font-weight", 500)
      .attr("fill", "currentColor")
      .attr("opacity", 0.8);

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      nodeGroup.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => { simulation.stop(); };
  }, [filteredData, selectedNode]);

  const handleZoom = useCallback((factor: number) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>();
    svg.transition().duration(300).call(zoom.scaleBy as any, factor);
  }, []);

  const handleReset = useCallback(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const zoom = d3.zoom<SVGSVGElement, unknown>();
    svg.transition().duration(500).call(zoom.transform as any, d3.zoomIdentity);
  }, []);

  return (
    <div className="relative w-full h-full" ref={containerRef} data-testid="graph-container">
      <svg ref={svgRef} className="w-full h-full rounded-lg border bg-white dark:bg-card" />
      <div className="absolute bottom-3 right-3 flex gap-1">
        <Button size="icon" variant="secondary" onClick={() => handleZoom(1.3)} data-testid="button-zoom-in">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="secondary" onClick={() => handleZoom(0.7)} data-testid="button-zoom-out">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="secondary" onClick={handleReset} data-testid="button-zoom-reset">
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>
      <div className="absolute top-3 left-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> 正常</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> 临期</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> 逾期</span>
      </div>
    </div>
  );
}

export default function Collaboration() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState("people");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const { data, isLoading } = useQuery<CollaborationData>({ queryKey: ["/api/collaboration"] });
  const { data: departments } = useQuery<{ id: string; name: string; color: string }[]>({ queryKey: ["/api/departments"] });

  if (authLoading) return <LoadingSkeleton />;
  if (!user) { navigate("/"); return null; }
  if (user.role !== "ceo" && user.role !== "admin") { navigate("/dashboard"); return null; }

  const graphData = data || { nodes: [], links: [] };
  const depts = departments || [];

  const stats = useMemo(() => {
    const personNodes = graphData.nodes.filter((n) => n.type === "person");
    const totalPeople = personNodes.length;
    const dangerId = personNodes.filter((n) => n.status === "danger").length;
    const warningId = personNodes.filter((n) => n.status === "warning").length;
    const totalLinks = graphData.links.length;
    const dangerLinks = graphData.links.filter((l) => l.status === "danger").length;
    return { totalPeople, dangerId, warningId, totalLinks, dangerLinks };
  }, [graphData]);

  return (
    <div className="flex flex-col h-screen bg-background pb-16 md:pb-0">
      <header className="sticky top-0 z-50 flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border-b bg-background" data-testid="collab-header">
        <Link href="/organization">
          <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <Network className="w-4 h-4 text-muted-foreground shrink-0" />
        <h1 className="text-[13px] md:text-base font-medium shrink-0">协作图谱</h1>

        <div className="flex-1" />

        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[110px] md:w-[140px] h-8 text-[13px]" data-testid="select-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部（含部门）</SelectItem>
            <SelectItem value="people">仅人员</SelectItem>
            {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </header>

      <div className="grid grid-cols-1 gap-2 px-4 py-2 lg:grid-cols-4">
        <div className="flex items-center gap-2 rounded-lg border bg-white dark:bg-card p-2 shadow-sm">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{stats.totalPeople}人</span>
          <span className="text-xs text-muted-foreground">· {stats.totalLinks}条协作</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-white dark:bg-card p-2 shadow-sm">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-sm font-medium">{stats.dangerId}人逾期</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-white dark:bg-card p-2 shadow-sm">
          <Clock className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium">{stats.warningId}人临期</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-white dark:bg-card p-2 shadow-sm">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium">{stats.dangerLinks}条风险链</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        {isLoading ? (
          <div className="flex-1 p-4"><LoadingSkeleton /></div>
        ) : (
          <>
            <div className="flex-1 min-w-0 p-2">
              <ForceGraph data={graphData} filter={filter} onSelectNode={setSelectedNode} selectedNode={selectedNode} />
            </div>
            <div className="w-72 border-l bg-white dark:bg-card shadow-sm shrink-0 hidden lg:block" data-testid="side-panel">
              <SidePanel node={selectedNode} links={graphData.links} allNodes={graphData.nodes} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
