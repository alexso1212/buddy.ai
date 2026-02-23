import { useState, useRef, useEffect } from "react";
import { Settings } from "lucide-react";

export type ColorByOption = 'department' | 'project' | 'status' | 'assignee' | 'priority';

const COLOR_BY_OPTIONS: { value: ColorByOption; label: string }[] = [
  { value: 'department', label: 'Department' },
  { value: 'project', label: 'Project' },
  { value: 'status', label: 'Status' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'priority', label: 'Priority' },
];

interface GraphSettingsProps {
  colorBy: ColorByOption;
  onColorByChange: (value: ColorByOption) => void;
  bloodFlow: boolean;
  onBloodFlowChange: (value: boolean) => void;
}

export default function GraphSettings({ colorBy, onColorByChange, bloodFlow, onBloodFlowChange }: GraphSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(v => !v)}
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 50,
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '50%',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.85)',
          transition: 'background 150ms',
        }}
        data-testid="graph-settings-toggle"
        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
      >
        <Settings size={18} strokeWidth={1.8} />
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: 60,
            right: 16,
            zIndex: 50,
            width: 260,
            background: 'rgba(30, 30, 28, 0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
            overflow: 'hidden',
          }}
          data-testid="graph-settings-panel"
        >
          <div style={{
            padding: '14px 16px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Display
            </span>
          </div>

          <div style={{ padding: '12px 16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <span style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.8)',
              }}>
                Color by
              </span>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              {COLOR_BY_OPTIONS.map(opt => {
                const selected = colorBy === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onColorByChange(opt.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: 'none',
                      background: selected ? 'rgba(255,255,255,0.10)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 120ms',
                      width: '100%',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
                    data-testid={`color-by-${opt.value}`}
                  >
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      border: selected ? '5px solid #AE5630' : '2px solid rgba(255,255,255,0.25)',
                      background: selected ? '#AE5630' : 'transparent',
                      transition: 'all 120ms',
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 13,
                      color: selected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)',
                      fontWeight: selected ? 500 : 400,
                    }}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.8)',
              }}>
                Blood flow
              </span>
              <button
                onClick={() => onBloodFlowChange(!bloodFlow)}
                data-testid="blood-flow-toggle"
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  border: 'none',
                  background: bloodFlow ? '#AE5630' : 'rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 200ms',
                  padding: 0,
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: 2,
                  left: bloodFlow ? 18 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 200ms',
                }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
