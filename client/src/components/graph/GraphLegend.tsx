import { useState, useRef, useEffect } from "react";
import { Info, X } from "lucide-react";

const STATUS_COLORS = [
  { color: '#6b7280', label: '待办' },
  { color: '#f59e0b', label: '进行中' },
  { color: '#ef4444', label: '阻塞' },
  { color: '#22c55e', label: '已完成' },
];

const PULSE_ITEMS = [
  { color: '#ef4444', label: '已过期', animation: 'urgent-pulse' },
  { color: '#f59e0b', label: '即将到期', animation: 'soon-pulse' },
];

const LINE_ITEMS = [
  { label: '依赖关系', type: 'solid' as const },
  { label: '工作进行中', type: 'particle' as const },
];

interface GraphLegendProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function GraphLegend({ isOpen, onToggle }: GraphLegendProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        onToggle();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onToggle]);

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 8,
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    padding: '3px 0',
  };

  return (
    <>
      {isOpen && (
        <div
          ref={panelRef}
          data-testid="graph-legend-panel"
          style={{
            position: 'fixed',
            bottom: 76,
            right: 16,
            zIndex: 80,
            width: 240,
            background: 'rgba(30, 30, 28, 0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
            overflow: 'hidden',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px 8px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={13} color="rgba(255,255,255,0.5)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                图例
              </span>
            </div>
            <button
              data-testid="graph-legend-close"
              onClick={onToggle}
              style={{
                width: 22,
                height: 22,
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
              <X size={13} />
            </button>
          </div>

          <div style={{
            padding: '10px 14px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            maxHeight: '50vh',
            overflowY: 'auto',
          }}>
            <div>
              <div style={sectionTitleStyle}>状态颜色</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {STATUS_COLORS.map(item => (
                  <div key={item.label} style={itemStyle}>
                    <div style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: item.color,
                      flexShrink: 0,
                    }} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={sectionTitleStyle}>脉冲效果</div>
              {PULSE_ITEMS.map(item => (
                <div key={item.label} style={itemStyle}>
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: item.color,
                    flexShrink: 0,
                  }} className={item.animation} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div>
              <div style={sectionTitleStyle}>连线</div>
              {LINE_ITEMS.map(item => (
                <div key={item.label} style={itemStyle}>
                  <svg width="20" height="10" style={{ flexShrink: 0 }}>
                    {item.type === 'solid' ? (
                      <line x1="0" y1="5" x2="20" y2="5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                    ) : (
                      <>
                        <line x1="0" y1="5" x2="20" y2="5" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                        <circle cx="6" cy="5" r="2" fill="#AE5630" opacity="0.9">
                          <animate attributeName="cx" from="2" to="18" dur="1.2s" repeatCount="indefinite" />
                        </circle>
                      </>
                    )}
                  </svg>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div>
              <div style={sectionTitleStyle}>节点大小</div>
              <div style={itemStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
                </div>
                <span>越大 = 越多下游依赖</span>
              </div>
            </div>

            <div>
              <div style={sectionTitleStyle}>交互</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={itemStyle}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, flexShrink: 0, width: 28 }}>点击</span>
                  <span>高亮依赖链</span>
                </div>
                <div style={itemStyle}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, flexShrink: 0, width: 28 }}>长按</span>
                  <span>查看详情</span>
                </div>
                <div style={itemStyle}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, flexShrink: 0, width: 28 }}>拖拽</span>
                  <span>移动部门框</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
