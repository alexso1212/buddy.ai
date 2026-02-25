import { useState, useCallback, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Menu, LocateFixed, Sparkles } from "lucide-react";
import ForceGraph from "@/components/graph/ForceGraph";
import type { GraphNode, GraphLink, ProjectInfo, DeptInfo, CollabHealth, ForceGraphHandle } from "@/components/graph/ForceGraph";
import GraphSettings from "@/components/graph/GraphSettings";
import type { ColorByOption } from "@/components/graph/GraphSettings";
import GraphNodeSheet from "@/components/graph/GraphNodeSheet";
import GraphLegend from "@/components/graph/GraphLegend";
import GraphChatFloat from "@/components/graph/GraphChatFloat";

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
  const [showChat, setShowChat] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const graphRef = useRef<ForceGraphHandle>(null);

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

  const handleReset = useCallback(() => {
    graphRef.current?.resetView();
  }, []);

  const handleToggleChat = useCallback(() => {
    setShowChat(prev => !prev);
  }, []);

  const handleToggleLegend = useCallback(() => {
    setShowLegend(prev => !prev);
  }, []);

  const { nodes, links, projects, departments } = useMemo(() => {
    const allNodes = graphData?.nodes ?? [];
    const allLinks = graphData?.links ?? [];
    const proj = graphData?.projects ?? [];
    const dept = graphData?.departments ?? [];

    const activeNodes = allNodes.filter(n => n.status !== 'done' && n.status !== 'cancelled');
    const activeIds = new Set(activeNodes.map(n => n.id));

    const upstreamOf = new Map<number, number[]>();
    const downstreamOf = new Map<number, number[]>();
    for (const l of allLinks) {
      if (!downstreamOf.has(l.source)) downstreamOf.set(l.source, []);
      downstreamOf.get(l.source)!.push(l.target);
      if (!upstreamOf.has(l.target)) upstreamOf.set(l.target, []);
      upstreamOf.get(l.target)!.push(l.source);
    }

    function canReachActive(nodeId: number, getNeighbors: (id: number) => number[], visited: Set<number>): boolean {
      if (activeIds.has(nodeId)) return true;
      visited.add(nodeId);
      for (const nb of (getNeighbors(nodeId) || [])) {
        if (!visited.has(nb) && canReachActive(nb, getNeighbors, visited)) return true;
      }
      return false;
    }

    const bridgeIds = new Set<number>();
    const inactiveNodes = allNodes.filter(n => n.status === 'done' || n.status === 'cancelled');
    for (const n of inactiveNodes) {
      const reachesDown = canReachActive(n.id, (id) => downstreamOf.get(id) || [], new Set([n.id]));
      if (!reachesDown) continue;
      const reachesUp = canReachActive(n.id, (id) => upstreamOf.get(id) || [], new Set([n.id]));
      if (reachesUp) bridgeIds.add(n.id);
    }

    const bridgeNodes = inactiveNodes
      .filter(n => bridgeIds.has(n.id))
      .map(n => ({ ...n, isBridge: true }));

    const finalNodes = [...activeNodes, ...bridgeNodes];
    const finalNodeIds = new Set(finalNodes.map(n => n.id));
    const finalLinks = allLinks.filter(l => finalNodeIds.has(l.source) && finalNodeIds.has(l.target));

    return { nodes: finalNodes, links: finalLinks, projects: proj, departments: dept };
  }, [graphData]);

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

      <div style={{
        position: 'fixed',
        bottom: 20,
        right: 16,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <button
          data-testid="graph-ai-chat-toggle"
          onClick={handleToggleChat}
          style={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: showChat
              ? 'rgba(139,92,246,0.25)'
              : 'rgba(255,255,255,0.07)',
            border: showChat
              ? '1px solid rgba(139,92,246,0.3)'
              : '1px solid rgba(255,255,255,0.10)',
            borderRadius: '50%',
            cursor: 'pointer',
            color: showChat ? '#8b5cf6' : 'rgba(255,255,255,0.85)',
            transition: 'all 150ms',
          }}
          onMouseEnter={e => { if (!showChat) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={e => { if (!showChat) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
        >
          <Sparkles size={18} strokeWidth={1.8} />
        </button>

        <GraphLegend isOpen={showLegend} onToggle={handleToggleLegend} />

        <button
          data-testid="graph-reset-view"
          onClick={handleReset}
          style={{
            width: 40,
            height: 40,
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
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
        >
          <LocateFixed size={18} strokeWidth={1.8} />
        </button>
      </div>

      {nodes.length > 0 ? (
        <ForceGraph
          ref={graphRef}
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

      <GraphChatFloat open={showChat} onClose={() => setShowChat(false)} />
    </div>
  );
}
