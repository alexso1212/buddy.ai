import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import ForceGraph from "@/components/graph/ForceGraph";
import type { GraphNode, GraphLink, ProjectInfo, DeptInfo, CollabHealth } from "@/components/graph/ForceGraph";
import GraphSettings from "@/components/graph/GraphSettings";
import type { ColorByOption } from "@/components/graph/GraphSettings";
import GraphNodeSheet from "@/components/graph/GraphNodeSheet";

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  projects: ProjectInfo[];
  departments: DeptInfo[];
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
  const [colorBy, setColorBy] = useState<ColorByOption>('department');
  const [bloodFlow, setBloodFlow] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const { data: response, isLoading } = useQuery<{ data: GraphData }>({
    queryKey: ['/api/graph/data'],
  });

  const { data: healthResponse } = useQuery<{ data: CollabHealth[] }>({
    queryKey: ['/api/graph/collaboration-health'],
  });

  const graphData = response?.data;
  const collabHealth = healthResponse?.data ?? [];

  const handleNodeClick = useCallback((node: GraphNode | null) => {
    setSelectedNode(node && node.id ? node : null);
  }, []);

  const handleSheetClose = useCallback(() => {
    setSelectedNode(null);
  }, []);

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
        <GraphSettings
          colorBy={colorBy}
          onColorByChange={setColorBy}
          bloodFlow={bloodFlow}
          onBloodFlowChange={setBloodFlow}
        />
        <div style={{ color: '#6b7280', fontSize: 14 }}>Loading graph data...</div>
      </div>
    );
  }

  const nodes = graphData?.nodes ?? [];
  const links = graphData?.links ?? [];
  const projects = graphData?.projects ?? [];
  const departments = graphData?.departments ?? [];

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
      <GraphSettings
        colorBy={colorBy}
        onColorByChange={setColorBy}
        bloodFlow={bloodFlow}
        onBloodFlowChange={setBloodFlow}
      />
      {nodes.length > 0 ? (
        <ForceGraph
          nodes={nodes}
          links={links}
          projects={projects}
          departments={departments}
          collabHealth={collabHealth}
          colorBy={colorBy}
          bloodFlow={bloodFlow}
          onNodeClick={handleNodeClick}
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
      <GraphNodeSheet node={selectedNode} onClose={handleSheetClose} />
    </div>
  );
}
