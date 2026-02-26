import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Menu, LocateFixed, Sparkles, ChevronRight, ArrowLeft } from "lucide-react";
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

interface HierarchyNode {
  id: string;
  numericId: number;
  title: string;
  type: 'department' | 'project' | 'task' | 'subtask';
  status: string;
  childrenCount: number;
  aggregatedStatus: {
    total: number;
    overdue: number;
    blocked: number;
    completionRate: number;
    hasUrgent: boolean;
    done: number;
  };
  color: string;
  deptId: number | null;
  projectId: number | null;
  assigneeName: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  priority: string;
  weight: number;
  progress: number;
}

interface HierarchyData {
  nodes: HierarchyNode[];
  links: { source: string; target: string; type: string; isBlocking: boolean }[];
  level: number;
  parentId: number | null;
  parentTitle: string | null;
}

interface BreadcrumbItem {
  level: number;
  parentId: number | null;
  title: string;
}

function hierarchyNodesToGraphNodes(hNodes: HierarchyNode[]): GraphNode[] {
  return hNodes.map(n => ({
    id: n.numericId,
    title: n.title,
    status: n.status,
    priority: n.priority,
    weight: n.weight,
    progress: n.progress,
    projectId: n.projectId ?? 0,
    projectName: '',
    projectColor: n.color,
    deptId: n.deptId,
    deptColor: n.color,
    assigneeId: null,
    assigneeName: n.assigneeName,
    dueDate: n.dueDate,
    isOverdue: n.isOverdue,
    type: n.type,
    parentTaskId: null,
    hasSubtasks: n.childrenCount > 0,
  }));
}

function hierarchyLinksToGraphLinks(hLinks: HierarchyData['links']): GraphLink[] {
  return hLinks.map(l => {
    const srcId = parseInt(l.source.replace(/^(dept|proj|task)-/, ''));
    const tgtId = parseInt(l.target.replace(/^(dept|proj|task)-/, ''));
    return {
      source: srcId,
      target: tgtId,
      type: l.type,
      isBlocking: l.isBlocking,
    };
  });
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

function GraphBreadcrumb({
  breadcrumb,
  onNavigate,
}: {
  breadcrumb: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem) => void;
}) {
  if (breadcrumb.length <= 1) return null;

  return (
    <div
      data-testid="graph-breadcrumb"
      style={{
        position: 'fixed',
        top: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 55,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '5px 12px',
        background: 'rgba(20, 19, 18, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        userSelect: 'none',
      }}
    >
      {breadcrumb.map((item, idx) => (
        <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {idx > 0 && (
            <ChevronRight
              size={12}
              style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}
            />
          )}
          <button
            data-testid={`breadcrumb-item-${idx}`}
            onClick={() => onNavigate(item)}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px 4px',
              cursor: idx < breadcrumb.length - 1 ? 'pointer' : 'default',
              color: idx < breadcrumb.length - 1
                ? 'rgba(255,255,255,0.5)'
                : 'rgba(255,255,255,0.9)',
              fontWeight: idx < breadcrumb.length - 1 ? 400 : 600,
              fontSize: 13,
              fontFamily: 'inherit',
              borderRadius: 4,
              transition: 'color 150ms',
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              if (idx < breadcrumb.length - 1) e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
            }}
            onMouseLeave={e => {
              if (idx < breadcrumb.length - 1) e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
            }}
          >
            {item.title}
          </button>
        </span>
      ))}
    </div>
  );
}

export default function GraphView() {
  const [colorBy, setColorBy] = useState<ColorByOption>('department');
  const [bloodFlow, setBloodFlow] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const graphRef = useRef<ForceGraphHandle>(null);

  const [currentLevel, setCurrentLevel] = useState(0);
  const [currentParentId, setCurrentParentId] = useState<number | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([
    { level: 0, parentId: null, title: '全局' },
  ]);
  const [drillTransition, setDrillTransition] = useState<'idle' | 'drilling-in' | 'drilling-out'>('idle');
  const [useHierarchy, setUseHierarchy] = useState(true);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: hierarchyResponse, isLoading: hierarchyLoading } = useQuery<{ data: HierarchyData }>({
    queryKey: ['/api/graph/hierarchy', currentLevel, currentParentId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('level', String(currentLevel));
      if (currentParentId !== null) params.set('parentId', String(currentParentId));
      const res = await fetch(`/api/graph/hierarchy?${params}`);
      if (!res.ok) throw new Error('Failed to fetch hierarchy data');
      return res.json();
    },
    enabled: useHierarchy,
  });

  const { data: flatResponse, isLoading: flatLoading } = useQuery<{ data: GraphData }>({
    queryKey: ['/api/graph/data'],
    enabled: !useHierarchy,
  });

  const { data: healthResponse } = useQuery<{ data: CollabHealth[] }>({
    queryKey: ['/api/graph/collaboration-health'],
  });

  const collabHealth = healthResponse?.data ?? [];
  const isLoading = useHierarchy ? hierarchyLoading : flatLoading;

  const hierarchyGraphData = useMemo(() => {
    if (!useHierarchy || !hierarchyResponse?.data) return null;
    const hData = hierarchyResponse.data;
    const gNodes = hierarchyNodesToGraphNodes(hData.nodes);
    const gLinks = hierarchyLinksToGraphLinks(hData.links);
    return { nodes: gNodes, links: gLinks };
  }, [hierarchyResponse, useHierarchy]);

  const flatGraphData = useMemo(() => {
    if (useHierarchy) return null;
    const graphData = flatResponse?.data;
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
  }, [flatResponse, useHierarchy]);

  const { nodes, links, projects, departments } = useMemo(() => {
    if (useHierarchy && hierarchyGraphData) {
      return {
        nodes: hierarchyGraphData.nodes,
        links: hierarchyGraphData.links,
        projects: [] as ProjectInfo[],
        departments: [] as DeptInfo[],
      };
    }
    if (!useHierarchy && flatGraphData) {
      return flatGraphData;
    }
    return { nodes: [] as GraphNode[], links: [] as GraphLink[], projects: [] as ProjectInfo[], departments: [] as DeptInfo[] };
  }, [useHierarchy, hierarchyGraphData, flatGraphData]);

  const handleDrillIn = useCallback((node: GraphNode) => {
    if (!node.hasSubtasks || drillTransition !== 'idle') return;

    setDrillTransition('drilling-in');
    setTimeout(() => {
      const newLevel = currentLevel + 1;
      const newParentId = node.id;
      setCurrentLevel(newLevel);
      setCurrentParentId(newParentId);
      setBreadcrumb(prev => [...prev, { level: newLevel, parentId: newParentId, title: node.title }]);
      setSelectedNode(null);

      setTimeout(() => {
        setDrillTransition('idle');
      }, 400);
    }, 300);
  }, [currentLevel, drillTransition]);

  const handleDrillOut = useCallback(() => {
    if (breadcrumb.length <= 1 || drillTransition !== 'idle') return;

    setDrillTransition('drilling-out');
    setTimeout(() => {
      const newBreadcrumb = breadcrumb.slice(0, -1);
      const target = newBreadcrumb[newBreadcrumb.length - 1];
      setCurrentLevel(target.level);
      setCurrentParentId(target.parentId);
      setBreadcrumb(newBreadcrumb);
      setSelectedNode(null);

      setTimeout(() => {
        setDrillTransition('idle');
      }, 400);
    }, 300);
  }, [breadcrumb, drillTransition]);

  const handleBreadcrumbNavigate = useCallback((item: BreadcrumbItem) => {
    if (drillTransition !== 'idle') return;
    const idx = breadcrumb.findIndex(b => b.level === item.level && b.parentId === item.parentId);
    if (idx < 0 || idx === breadcrumb.length - 1) return;

    setDrillTransition('drilling-out');
    setTimeout(() => {
      const newBreadcrumb = breadcrumb.slice(0, idx + 1);
      setCurrentLevel(item.level);
      setCurrentParentId(item.parentId);
      setBreadcrumb(newBreadcrumb);
      setSelectedNode(null);

      setTimeout(() => {
        setDrillTransition('idle');
      }, 400);
    }, 300);
  }, [breadcrumb, drillTransition]);

  const handleNodeClick = useCallback((node: GraphNode | null) => {
    setSelectedNode(node && node.id ? node : null);
  }, []);

  const handleSheetClose = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleReset = useCallback(() => {
    graphRef.current?.resetView();
  }, []);

  const handleResetLongPress = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      if (breadcrumb.length > 1) {
        setDrillTransition('drilling-out');
        setTimeout(() => {
          setCurrentLevel(0);
          setCurrentParentId(null);
          setBreadcrumb([{ level: 0, parentId: null, title: '全局' }]);
          setSelectedNode(null);
          setTimeout(() => setDrillTransition('idle'), 400);
        }, 300);
      }
    }, 600);
  }, [breadcrumb]);

  const handleResetLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const handleToggleChat = useCallback(() => {
    setShowChat(prev => !prev);
  }, []);

  const handleToggleLegend = useCallback(() => {
    setShowLegend(prev => !prev);
  }, []);

  const drillAnimClass = drillTransition === 'drilling-in'
    ? 'graph-drill-in'
    : drillTransition === 'drilling-out'
    ? 'graph-drill-out'
    : 'graph-drill-idle';

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
      <GraphBreadcrumb breadcrumb={breadcrumb} onNavigate={handleBreadcrumbNavigate} />
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
        {breadcrumb.length > 1 && (
          <button
            data-testid="graph-drill-back"
            onClick={handleDrillOut}
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
            <ArrowLeft size={18} strokeWidth={1.8} />
          </button>
        )}

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
          onMouseDown={handleResetLongPress}
          onMouseUp={handleResetLongPressEnd}
          onMouseLeave={handleResetLongPressEnd}
          onTouchStart={handleResetLongPress}
          onTouchEnd={handleResetLongPressEnd}
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
        >
          <LocateFixed size={18} strokeWidth={1.8} />
        </button>
      </div>

      <div
        className={drillAnimClass}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
        }}
      >
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
            onNodeDrillIn={handleDrillIn}
            hierarchyLevel={currentLevel}
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
            {currentLevel > 0 ? '此层级暂无子节点' : 'No tasks to display'}
          </div>
        )}
      </div>

      <GraphNodeSheet node={selectedNode} onClose={handleSheetClose} />

      <GraphChatFloat open={showChat} onClose={() => setShowChat(false)} graphRef={graphRef} />
    </div>
  );
}
