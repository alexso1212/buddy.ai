import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Menu, LocateFixed, Sparkles, Loader2, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import ForceGraph from "@/components/graph/ForceGraph";
import type { GraphNode, GraphLink, ProjectInfo, DeptInfo, CollabHealth, ForceGraphHandle, HighlightedNode } from "@/components/graph/ForceGraph";
import GraphSettings from "@/components/graph/GraphSettings";
import type { ColorByOption } from "@/components/graph/GraphSettings";
import GraphNodeSheet from "@/components/graph/GraphNodeSheet";

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  projects: ProjectInfo[];
  departments: DeptInfo[];
}

interface AiAnalysisResult {
  followUp: Array<{ id: number; reason: string }>;
  important: Array<{ id: number; reason: string }>;
  bottleneck: Array<{ id: number; reason: string }>;
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

const ANALYSIS_LABELS: Record<string, { label: string; color: string }> = {
  followUp: { label: '需跟进', color: '#3b82f6' },
  important: { label: '最重要', color: '#f59e0b' },
  bottleneck: { label: '卡点', color: '#ef4444' },
};

export default function GraphView() {
  const [colorBy, setColorBy] = useState<ColorByOption>('department');
  const [bloodFlow, setBloodFlow] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<HighlightedNode[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AiAnalysisResult | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const graphRef = useRef<ForceGraphHandle>(null);

  const { data: response, isLoading } = useQuery<{ data: GraphData }>({
    queryKey: ['/api/graph/data'],
  });

  const { data: healthResponse } = useQuery<{ data: CollabHealth[] }>({
    queryKey: ['/api/graph/collaboration-health'],
  });

  const analysisMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/graph/ai-analysis');
      return res.json();
    },
    onSuccess: (response: { data: AiAnalysisResult }) => {
      const result = response.data;
      setAnalysisResult(result);
      setShowAnalysis(true);

      const highlights: HighlightedNode[] = [];
      const seen = new Set<string>();

      for (const item of result.followUp || []) {
        const key = `${item.id}-followUp`;
        if (!seen.has(key)) {
          seen.add(key);
          highlights.push({ id: item.id, type: 'followUp', reason: item.reason });
        }
      }
      for (const item of result.important || []) {
        const key = `${item.id}-important`;
        if (!seen.has(key)) {
          seen.add(key);
          highlights.push({ id: item.id, type: 'important', reason: item.reason });
        }
      }
      for (const item of result.bottleneck || []) {
        const key = `${item.id}-bottleneck`;
        if (!seen.has(key)) {
          seen.add(key);
          highlights.push({ id: item.id, type: 'bottleneck', reason: item.reason });
        }
      }
      setHighlightedNodes(highlights);
    },
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

  const handleAiAnalysis = useCallback(() => {
    if (analysisResult) {
      setHighlightedNodes([]);
      setAnalysisResult(null);
      setShowAnalysis(false);
    } else {
      analysisMutation.mutate();
    }
  }, [analysisResult, analysisMutation]);

  const handleCloseAnalysis = useCallback(() => {
    setShowAnalysis(false);
    setHighlightedNodes([]);
    setAnalysisResult(null);
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

  const allNodes = graphData?.nodes ?? [];
  const allLinks = graphData?.links ?? [];
  const projects = graphData?.projects ?? [];
  const departments = graphData?.departments ?? [];

  const nodes = allNodes.filter(n => n.status !== 'done' && n.status !== 'cancelled');
  const activeNodeIds = new Set(nodes.map(n => n.id));
  const links = allLinks.filter(l => activeNodeIds.has(l.source) && activeNodeIds.has(l.target));

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

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
          data-testid="graph-ai-analysis"
          onClick={handleAiAnalysis}
          disabled={analysisMutation.isPending}
          style={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: analysisResult
              ? 'rgba(139,92,246,0.25)'
              : 'rgba(255,255,255,0.07)',
            border: analysisResult
              ? '1px solid rgba(139,92,246,0.3)'
              : '1px solid rgba(255,255,255,0.10)',
            borderRadius: '50%',
            cursor: analysisMutation.isPending ? 'wait' : 'pointer',
            color: analysisResult ? '#8b5cf6' : 'rgba(255,255,255,0.85)',
            transition: 'all 150ms',
          }}
          onMouseEnter={e => { if (!analysisResult) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={e => { if (!analysisResult) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
        >
          {analysisMutation.isPending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Sparkles size={18} strokeWidth={1.8} />
          )}
        </button>

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
          highlightedNodes={highlightedNodes}
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

      {showAnalysis && analysisResult && (
        <div
          data-testid="graph-analysis-panel"
          style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 80,
            width: 'min(400px, calc(100vw - 100px))',
            maxHeight: '30vh',
            background: 'rgba(20, 19, 18, 0.88)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px 8px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} color="#8b5cf6" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                AI 分析
              </span>
            </div>
            <button
              data-testid="graph-analysis-close"
              onClick={handleCloseAnalysis}
              style={{
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{
            overflowY: 'auto',
            padding: '8px 14px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            {(['followUp', 'important', 'bottleneck'] as const).map(category => {
              const items = analysisResult[category];
              if (!items || items.length === 0) return null;
              const meta = ANALYSIS_LABELS[category];
              return (
                <div key={category}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 4,
                  }}>
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: meta.color,
                    }} />
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: meta.color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}>
                      {meta.label}
                    </span>
                  </div>
                  {items.map((item, idx) => {
                    const task = nodeMap.get(item.id);
                    return (
                      <div
                        key={`${category}-${idx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 0',
                          fontSize: 12,
                        }}
                      >
                        <span style={{
                          color: 'rgba(255,255,255,0.7)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 160,
                        }}>
                          {task?.title || `Task #${item.id}`}
                        </span>
                        <span style={{
                          color: 'rgba(255,255,255,0.35)',
                          fontSize: 11,
                          flexShrink: 0,
                        }}>
                          {item.reason}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
