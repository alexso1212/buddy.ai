import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ForceGraph from "@/components/graph/ForceGraph";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface GraphNode {
  id: number;
  title: string;
  status: string;
  priority: string;
  weight: number;
  progress: number;
  projectId: number;
  projectName: string;
  deptId: number | null;
  assigneeId: number | null;
  assigneeName: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  type: string;
  parentTaskId: number | null;
  hasSubtasks: boolean;
}

interface GraphLink {
  source: number | any;
  target: number | any;
  type: string;
  isBlocking: boolean;
}

interface ProjectInfo {
  id: number;
  name: string;
  color: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  projects: ProjectInfo[];
}

const STATUS_COLORS: Record<string, string> = {
  todo: '#9ca3af',
  in_progress: '#f59e0b',
  in_review: '#3b82f6',
  blocked: '#ef4444',
  done: '#10b981',
  cancelled: '#6b7280',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  blocked: 'Blocked',
  done: 'Done',
  cancelled: 'Cancelled',
};

const ALL_STATUSES = ['todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'];
const DEFAULT_STATUSES = new Set(['todo', 'in_progress', 'in_review', 'blocked']);

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export default function GraphView() {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(DEFAULT_STATUSES));
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const { data: response, isLoading } = useQuery<{ data: GraphData }>({
    queryKey: ['/api/graph/data'],
  });

  const graphData = response?.data;

  const filteredData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [], projects: [] };

    let filteredNodes = graphData.nodes.filter((n) => activeStatuses.has(n.status));

    if (selectedProjectId !== null) {
      filteredNodes = filteredNodes.filter((n) => n.projectId === selectedProjectId);
    }

    const nodeIds = new Set(filteredNodes.map((n) => n.id));

    const filteredLinks = graphData.links.filter((l) => {
      const srcId = typeof l.source === 'object' ? l.source.id : l.source;
      const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
      return nodeIds.has(srcId) && nodeIds.has(tgtId);
    });

    return { nodes: filteredNodes, links: filteredLinks, projects: graphData.projects };
  }, [graphData, activeStatuses, selectedProjectId]);

  const toggleStatus = (status: string) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="graph-container">
        <div className="text-gray-500">Loading graph data...</div>
      </div>
    );
  }

  return (
    <div
      data-testid="graph-container"
      className="flex flex-col bg-gray-50"
      style={{ height: "calc(100vh - 48px)" }}
    >
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-white flex-wrap">
        <span className="text-sm font-medium text-gray-700 mr-1">Project:</span>
        <select
          data-testid="select-project-filter"
          className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
          value={selectedProjectId ?? ""}
          onChange={(e) =>
            setSelectedProjectId(e.target.value === "" ? null : Number(e.target.value))
          }
        >
          <option value="">All Projects</option>
          {(graphData?.projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <span className="text-sm font-medium text-gray-700 ml-3 mr-1">Status:</span>
        {ALL_STATUSES.map((s) => (
          <label
            key={s}
            className="flex items-center gap-1 text-sm cursor-pointer select-none"
            data-testid={`checkbox-status-${s}`}
          >
            <input
              type="checkbox"
              checked={activeStatuses.has(s)}
              onChange={() => toggleStatus(s)}
              className="rounded border-gray-300"
            />
            <span
              className="inline-block w-2.5 h-2.5 rounded-full mr-0.5"
              style={{ backgroundColor: STATUS_COLORS[s] }}
            />
            <span className="text-gray-600">{STATUS_LABELS[s]}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <div data-testid="graph-canvas" className="flex-1">
          {filteredData.nodes.length > 0 ? (
            <ForceGraph
              nodes={filteredData.nodes}
              links={filteredData.links}
              projects={filteredData.projects}
              onNodeClick={(node) => setSelectedNode(node)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No tasks match the current filters
            </div>
          )}
        </div>

        {selectedNode && (
          <Card
            data-testid="node-detail-panel"
            className="w-80 border-l bg-white overflow-y-auto flex-shrink-0"
            style={{ borderRadius: 0 }}
          >
            <div className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-900">{selectedNode.title}</h3>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSelectedNode(null)}
                  data-testid="button-close-detail"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Status</span>
                  <Badge
                    style={{ backgroundColor: STATUS_COLORS[selectedNode.status] }}
                    className="text-white"
                  >
                    {STATUS_LABELS[selectedNode.status] || selectedNode.status}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Priority</span>
                  <span className="font-medium text-gray-800">
                    {PRIORITY_LABELS[selectedNode.priority] || selectedNode.priority}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Project</span>
                  <span className="font-medium text-gray-800">{selectedNode.projectName}</span>
                </div>

                {selectedNode.assigneeName && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Assignee</span>
                    <span className="font-medium text-gray-800">{selectedNode.assigneeName}</span>
                  </div>
                )}

                {selectedNode.dueDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Due Date</span>
                    <span
                      className={`font-medium ${selectedNode.isOverdue ? "text-red-600" : "text-gray-800"}`}
                    >
                      {selectedNode.dueDate}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Progress</span>
                  <span className="font-medium text-gray-800">{selectedNode.progress}%</span>
                </div>

                <div className="pt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${selectedNode.progress}%`,
                        backgroundColor: STATUS_COLORS[selectedNode.status] || "#9ca3af",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      <div
        data-testid="graph-legend"
        className="flex items-center gap-4 px-4 py-2 border-t bg-white text-xs flex-wrap"
      >
        <span className="font-medium text-gray-600 mr-1">Status:</span>
        {ALL_STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[s] }}
            />
            <span className="text-gray-600">{STATUS_LABELS[s]}</span>
          </span>
        ))}

        <span className="mx-2 text-gray-300">|</span>

        <span className="font-medium text-gray-600 mr-1">Links:</span>
        <span className="flex items-center gap-1">
          <svg width="24" height="8">
            <line x1="0" y1="4" x2="24" y2="4" stroke="#ef4444" strokeWidth="3" />
          </svg>
          <span className="text-gray-600">Blocking</span>
        </span>
        <span className="flex items-center gap-1">
          <svg width="24" height="8">
            <line x1="0" y1="4" x2="24" y2="4" stroke="#10b981" strokeWidth="1.5" strokeDasharray="5,5" />
          </svg>
          <span className="text-gray-600">Dependency</span>
        </span>
      </div>
    </div>
  );
}
