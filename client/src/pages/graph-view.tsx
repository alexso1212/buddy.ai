import { useQuery } from "@tanstack/react-query";
import ForceGraph from "@/components/graph/ForceGraph";

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

export default function GraphView() {
  const { data: response, isLoading } = useQuery<{ data: GraphData }>({
    queryKey: ['/api/graph/data'],
  });

  const graphData = response?.data;

  if (isLoading) {
    return (
      <div
        data-testid="graph-container"
        style={{
          position: 'absolute',
          inset: 0,
          background: '#0D0D0D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: '#6b7280', fontSize: 14 }}>Loading graph data...</div>
      </div>
    );
  }

  const nodes = graphData?.nodes ?? [];
  const links = graphData?.links ?? [];
  const projects = graphData?.projects ?? [];

  return (
    <div
      data-testid="graph-container"
      style={{
        position: 'absolute',
        inset: 0,
        background: '#0D0D0D',
        overflow: 'hidden',
      }}
    >
      {nodes.length > 0 ? (
        <ForceGraph
          nodes={nodes}
          links={links}
          projects={projects}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            color: '#6b7280',
            fontSize: 14,
          }}
        >
          No tasks to display
        </div>
      )}
    </div>
  );
}
