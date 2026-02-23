import { useQuery } from "@tanstack/react-query";
import { Menu } from "lucide-react";
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
  deptColor: string;
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

function GraphOverlayControls() {
  return (
    <>
      <button
        onClick={() => window.dispatchEvent(new Event('open-sidebar'))}
        className="md:hidden"
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 50,
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '50%',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.85)',
          transition: 'background 150ms',
        }}
        data-testid="graph-menu-toggle"
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
      >
        <Menu size={18} strokeWidth={1.8} />
      </button>

      <span
        className="md:hidden"
        style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          fontSize: 17,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.6)',
          fontFamily: 'var(--font-sans)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        data-testid="graph-brand-title"
      >
        Buddy
      </span>
    </>
  );
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
        <GraphOverlayControls />
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
      <GraphOverlayControls />
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
