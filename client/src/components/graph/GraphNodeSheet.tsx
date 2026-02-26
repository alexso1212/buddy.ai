import { useRef, useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { X, ExternalLink, Calendar, User, FolderOpen, Flag, CircleDot, ArrowRight, ChevronDown, ListTree, GitBranch } from "lucide-react";
import type { GraphNode } from "./ForceGraph";
import type { Task, TaskComment } from "@shared/schema";

interface TaskDetailResponse {
  data: Task & {
    subtasks: Task[];
    dependencies: any[];
    comments: TaskComment[];
    participants: Array<{ id: number; taskId: number; userId: number; role: string; user: any }>;
  };
}

const STATUS_LABELS: Record<string, string> = {
  todo: '待办',
  in_progress: '进行中',
  in_review: '审核中',
  blocked: '阻塞',
  done: '已完成',
  cancelled: '已取消',
};

const STATUS_COLORS: Record<string, string> = {
  todo: '#9ca3af',
  in_progress: '#f59e0b',
  in_review: '#3b82f6',
  blocked: '#ef4444',
  done: '#10b981',
  cancelled: '#6b7280',
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#9ca3af',
};

interface GraphNodeSheetProps {
  node: GraphNode | null;
  onClose: () => void;
}

export default function GraphNodeSheet({ node, onClose }: GraphNodeSheetProps) {
  const [, navigate] = useLocation();
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const dragStartOffset = useRef(0);

  const { data: taskDetail } = useQuery<TaskDetailResponse>({
    queryKey: ['/api/tasks', node?.id],
    enabled: !!node,
  });

  const task = taskDetail?.data;

  useEffect(() => {
    if (node) {
      requestAnimationFrame(() => setIsVisible(true));
      setDragOffset(0);
    } else {
      setIsVisible(false);
    }
  }, [node]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (contentRef.current && contentRef.current.contains(target) && contentRef.current.scrollTop > 0) {
      return;
    }
    dragStartY.current = e.touches[0].clientY;
    dragStartOffset.current = dragOffset;
  }, [dragOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    const newOffset = Math.max(0, dragStartOffset.current + dy);
    setDragOffset(newOffset);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    if (dragOffset > 80) {
      onClose();
    } else {
      setDragOffset(0);
    }
  }, [dragOffset, onClose]);

  const handleNavigate = useCallback(() => {
    if (node) {
      if (node.type === 'department' || node.type === 'project') return;
      onClose();
      setTimeout(() => navigate(`/tasks/${node.id}?from=graph`), 200);
    }
  }, [node, navigate, onClose]);

  if (!node) return null;

  const statusColor = STATUS_COLORS[node.status] || '#9ca3af';
  const priorityColor = PRIORITY_COLORS[node.priority] || '#9ca3af';

  return (
    <>
      <div
        data-testid="graph-sheet-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 90,
          background: 'transparent',
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? 'auto' : 'none',
          transition: 'opacity 200ms',
        }}
        onClick={onClose}
      />

      <div
        ref={sheetRef}
        data-testid="graph-node-sheet"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 100,
          height: '28vh',
          minHeight: 200,
          maxHeight: '40vh',
          background: 'rgba(20, 19, 18, 0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px 16px 0 0',
          transform: isVisible
            ? `translateY(${dragOffset}px)`
            : 'translateY(100%)',
          transition: dragStartY.current !== null
            ? 'none'
            : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 0 4px',
            cursor: 'grab',
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.2)',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 16px 8px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: statusColor,
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: node.isBridge ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.9)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                }}
              >
                {node.title}
              </span>
              {node.isBridge && (
                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.35)',
                    marginTop: 2,
                    lineHeight: 1.3,
                  }}
                >
                  此任务{node.status === 'done' ? '已完成' : '已取消'}，因连接未完成的上下游任务而暂时保留在图谱中
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              data-testid="graph-sheet-navigate"
              onClick={handleNavigate}
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                border: 'none',
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
              }}
            >
              <ExternalLink size={14} />
            </button>
            <button
              data-testid="graph-sheet-close"
              onClick={onClose}
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                border: 'none',
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div
          ref={contentRef}
          data-testid="graph-sheet-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '0 16px 16px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 10,
                background: `${statusColor}22`,
                color: statusColor,
                fontWeight: 500,
              }}
            >
              {STATUS_LABELS[node.status] || node.status}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 10,
                background: `${priorityColor}22`,
                color: priorityColor,
                fontWeight: 500,
              }}
            >
              {PRIORITY_LABELS[node.priority] || node.priority}
            </span>
            {node.isOverdue && (
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: 'rgba(239,68,68,0.15)',
                  color: '#ef4444',
                  fontWeight: 500,
                }}
              >
                逾期
              </span>
            )}
            {node.type === 'milestone' && (
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: 'rgba(139,92,246,0.15)',
                  color: '#8b5cf6',
                  fontWeight: 500,
                }}
              >
                里程碑
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DetailRow icon={<FolderOpen size={13} />} label="项目" value={node.projectName} />
            <DetailRow icon={<User size={13} />} label="负责人" value={node.assigneeName || '未分配'} />
            {node.dueDate && (
              <DetailRow
                icon={<Calendar size={13} />}
                label="截止日期"
                value={new Date(node.dueDate).toLocaleDateString('zh-CN')}
              />
            )}
            <DetailRow
              icon={<CircleDot size={13} />}
              label="进度"
              value={`${node.progress}%`}
              extra={
                <div style={{ flex: 1, maxWidth: 80, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ width: `${node.progress}%`, height: '100%', borderRadius: 2, background: statusColor, transition: 'width 300ms' }} />
                </div>
              }
            />
          </div>

          {task?.description && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4, fontWeight: 500 }}>描述</div>
              <div
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.65)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {task.description}
              </div>
            </div>
          )}

          {task && task.subtasks && task.subtasks.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, fontWeight: 500 }}>
                <ListTree size={11} />
                子任务 ({task.subtasks.length})
              </div>
              {task.subtasks.map(sub => (
                <div
                  key={sub.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 0',
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: STATUS_COLORS[sub.status] || '#9ca3af',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sub.title}
                  </span>
                </div>
              ))}
            </div>
          )}

          {task && task.comments && task.comments.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, fontWeight: 500 }}>
                评论 ({task.comments.length})
              </div>
              {task.comments.slice(0, 3).map(comment => (
                <div
                  key={comment.id}
                  style={{
                    padding: '6px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.55)',
                    lineHeight: 1.5,
                  }}
                >
                  {typeof comment.content === 'string'
                    ? comment.content.length > 100
                      ? comment.content.slice(0, 100) + '…'
                      : comment.content
                    : ''}
                </div>
              ))}
            </div>
          )}

          <button
            data-testid="graph-sheet-open-detail"
            onClick={handleNavigate}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              width: '100%',
              marginTop: 16,
              padding: '10px 0',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 150ms',
            }}
          >
            打开详情
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </>
  );
}

function DetailRow({ icon, label, value, extra }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  extra?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', width: 52, flexShrink: 0, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      {extra}
    </div>
  );
}
