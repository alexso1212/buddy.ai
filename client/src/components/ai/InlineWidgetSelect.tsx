import { useState, useCallback, useRef } from "react";

export interface WidgetOption {
  label: string;
  value: string;
  description?: string;
}

export interface InlineWidgetData {
  type: "single_select" | "multi_select" | "rank_priorities";
  question: string;
  options: WidgetOption[];
}

interface InlineWidgetSelectProps {
  data: InlineWidgetData;
  onSubmit: (summary: string) => void;
  messageId?: string;
}

function RadioCircle({ selected }: { selected: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="8" fill="none" stroke={selected ? "#7ab5e0" : "#6b6b6b"} strokeWidth="2" />
      {selected && <circle cx="9" cy="9" r="5" fill="#7ab5e0" />}
    </svg>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      {checked ? (
        <>
          <rect x="1" y="1" width="16" height="16" rx="4" fill="#7ab5e0" stroke="#7ab5e0" strokeWidth="2" />
          <polyline points="4,9 7.5,12.5 14,6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <rect x="1" y="1" width="16" height="16" rx="4" fill="none" stroke="#6b6b6b" strokeWidth="2" />
      )}
    </svg>
  );
}

function DragHandle() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#6b6b6b" style={{ flexShrink: 0, cursor: "grab" }} data-testid="drag-handle">
      <circle cx="5" cy="4" r="1.5" />
      <circle cx="11" cy="4" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="11" cy="12" r="1.5" />
    </svg>
  );
}

export default function InlineWidgetSelect({ data, onSubmit, messageId }: InlineWidgetSelectProps) {
  const { type, question, options } = data;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rankOrder, setRankOrder] = useState<WidgetOption[]>(options);
  const [submitted, setSubmitted] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragCurrentIndex = useRef<number | null>(null);

  const handleSingleSelect = useCallback((opt: WidgetOption) => {
    if (submitted) return;
    setSelected(new Set([opt.value]));
    const summary = `Selected: ${opt.label}`;
    setSummaryText(summary);
    setSubmitted(true);
    setTimeout(() => onSubmit(summary), 300);
  }, [submitted, onSubmit]);

  const handleMultiToggle = useCallback((opt: WidgetOption) => {
    if (submitted) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(opt.value)) {
        next.delete(opt.value);
      } else {
        next.add(opt.value);
      }
      return next;
    });
  }, [submitted]);

  const handleMultiSubmit = useCallback(() => {
    if (submitted) return;
    const selectedLabels = options.filter(o => selected.has(o.value)).map(o => o.label);
    const summary = `Selected: ${selectedLabels.join(", ")}`;
    setSummaryText(summary);
    setSubmitted(true);
    setTimeout(() => onSubmit(summary), 300);
  }, [submitted, selected, options, onSubmit]);

  const handleRankSubmit = useCallback(() => {
    if (submitted) return;
    const summary = `Priority: ${rankOrder.map((o, i) => `${i + 1}. ${o.label}`).join(", ")}`;
    setSummaryText(summary);
    setSubmitted(true);
    setTimeout(() => onSubmit(summary), 300);
  }, [submitted, rankOrder, onSubmit]);

  const getItemIndexAtY = useCallback((clientY: number) => {
    if (!containerRef.current) return null;
    const items = containerRef.current.querySelectorAll("[data-rank-item]");
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return i;
    }
    return null;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, index: number) => {
    if (submitted) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingIndex(index);
    dragStartY.current = e.clientY;
    dragCurrentIndex.current = index;
  }, [submitted]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingIndex === null) return;
    const targetIdx = getItemIndexAtY(e.clientY);
    if (targetIdx !== null && targetIdx !== dragCurrentIndex.current) {
      const from = dragCurrentIndex.current!;
      setRankOrder(prev => {
        const copy = [...prev];
        const [removed] = copy.splice(from, 1);
        copy.splice(targetIdx, 0, removed);
        return copy;
      });
      dragCurrentIndex.current = targetIdx;
    }
  }, [draggingIndex, getItemIndexAtY]);

  const handlePointerUp = useCallback(() => {
    setDraggingIndex(null);
    dragCurrentIndex.current = null;
  }, []);

  const testId = messageId ? `widget-${type}-${messageId}` : `widget-${type}`;

  if (submitted) {
    return (
      <div
        className="widget-collapsed"
        style={{
          marginTop: 12,
          padding: "10px 14px",
          borderRadius: 10,
          background: "rgba(122, 181, 224, 0.08)",
          border: "1px solid rgba(122, 181, 224, 0.2)",
          fontSize: 14,
          color: "#7ab5e0",
          fontWeight: 500,
        }}
        data-testid={`${testId}-summary`}
      >
        {summaryText}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }} data-testid={testId}>
      {question && (
        <p style={{ fontSize: 14, color: "#e8e8e8", marginBottom: 10, fontWeight: 500 }} data-testid="widget-question">
          {question}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }} ref={containerRef}>
        {type === "single_select" && options.map((opt) => (
          <div
            key={opt.value}
            className={`widget-option${selected.has(opt.value) ? " selected" : ""}`}
            onClick={() => handleSingleSelect(opt)}
            data-testid={`option-single-${opt.value}`}
          >
            <RadioCircle selected={selected.has(opt.value)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span data-testid={`label-${opt.value}`}>{opt.label}</span>
              {opt.description && (
                <span style={{ color: "#999", marginLeft: 6, fontSize: 13 }}>
                  — {opt.description}
                </span>
              )}
            </div>
          </div>
        ))}

        {type === "multi_select" && options.map((opt) => (
          <div
            key={opt.value}
            className={`widget-option${selected.has(opt.value) ? " selected" : ""}`}
            onClick={() => handleMultiToggle(opt)}
            data-testid={`option-multi-${opt.value}`}
          >
            <Checkbox checked={selected.has(opt.value)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span data-testid={`label-${opt.value}`}>{opt.label}</span>
              {opt.description && (
                <span style={{ color: "#999", marginLeft: 6, fontSize: 13 }}>
                  — {opt.description}
                </span>
              )}
            </div>
          </div>
        ))}

        {type === "rank_priorities" && rankOrder.map((opt, index) => (
          <div
            key={opt.value}
            data-rank-item
            className={`widget-option${draggingIndex === index ? " selected" : ""}`}
            style={{
              touchAction: "none",
              opacity: draggingIndex === index ? 0.7 : 1,
              transition: draggingIndex !== null ? "none" : "opacity 150ms",
            }}
            data-testid={`option-rank-${opt.value}`}
          >
            <div
              onPointerDown={(e) => handlePointerDown(e, index)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{ touchAction: "none", padding: 4, margin: -4, cursor: "grab" }}
            >
              <DragHandle />
            </div>
            <span style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "rgba(122, 181, 224, 0.15)",
              color: "#7ab5e0",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              {index + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span data-testid={`label-${opt.value}`}>{opt.label}</span>
              {opt.description && (
                <span style={{ color: "#999", marginLeft: 6, fontSize: 13 }}>
                  — {opt.description}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {(type === "multi_select" && selected.size > 0) && (
        <button
          onClick={handleMultiSubmit}
          style={{
            marginTop: 10,
            padding: "8px 20px",
            borderRadius: 8,
            background: "#7ab5e0",
            color: "#1a1a1a",
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "opacity 150ms",
          }}
          data-testid="btn-widget-submit"
        >
          Submit
        </button>
      )}

      {type === "rank_priorities" && (
        <button
          onClick={handleRankSubmit}
          style={{
            marginTop: 10,
            padding: "8px 20px",
            borderRadius: 8,
            background: "#7ab5e0",
            color: "#1a1a1a",
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "opacity 150ms",
          }}
          data-testid="btn-widget-submit"
        >
          Submit
        </button>
      )}
    </div>
  );
}
