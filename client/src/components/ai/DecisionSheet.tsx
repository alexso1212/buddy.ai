import { useState, useMemo, useEffect } from "react";
import { UserPlus, CalendarClock, FileQuestion, ArrowUpDown, GitBranch, AlertTriangle } from "lucide-react";
import ActionSheet from "./ActionSheet";

interface DecisionItem {
  index: number;
  decisionTaskId: number;
  originalTaskTitle: string;
  decisionType: string;
  label: string;
  warning?: string;
}

interface DecisionSheetProps {
  open: boolean;
  onClose: () => void;
  message: {
    id: string;
    content: string;
  };
  onSubmitDecisions: (formattedResponse: string) => void;
}

const DECISION_ICONS: Record<string, typeof UserPlus> = {
  assignee_unclear: UserPlus,
  deadline_missing: CalendarClock,
  scope_unclear: FileQuestion,
  priority_unclear: ArrowUpDown,
  dependency_unclear: GitBranch,
};

const DECISION_PLACEHOLDERS: Record<string, string> = {
  assignee_unclear: "输入负责人，例如：张三",
  deadline_missing: "输入截止时间，例如：下周五",
  scope_unclear: "描述任务范围...",
  priority_unclear: "输入优先级，例如：高/中/低",
  dependency_unclear: "描述依赖关系...",
};

export default function DecisionSheet({ open, onClose, message, onSubmitDecisions }: DecisionSheetProps) {
  const [inputs, setInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    if (open) setInputs({});
  }, [open, message.id]);

  const items = useMemo<DecisionItem[]>(() => {
    try {
      const parsed = JSON.parse(message.content);
      if (parsed?.type === "decision_request" && Array.isArray(parsed.items)) {
        return parsed.items;
      }
    } catch {}
    return [];
  }, [message.content]);

  const handleInputChange = (index: number, value: string) => {
    setInputs((prev) => ({ ...prev, [index]: value }));
  };

  const hasAnyInput = items.some((item) => (inputs[item.index] || "").trim().length > 0);

  const handleSubmit = () => {
    const parts = items
      .filter((item) => (inputs[item.index] || "").trim())
      .map((item) => `第${item.index}个任务${inputs[item.index]!.trim()}`);
    if (parts.length > 0) {
      onSubmitDecisions(parts.join("，"));
      onClose();
    }
  };

  return (
    <ActionSheet
      open={open}
      onClose={onClose}
      title="决策确认"
      subtitle={`共 ${items.length} 项需要确认`}
    >
      <div style={{ padding: "0 16px" }} data-testid="decision-sheet-list">
        {items.map((item) => {
          const Icon = DECISION_ICONS[item.decisionType] || FileQuestion;
          return (
            <div
              key={item.index}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 14,
                marginBottom: 12,
              }}
              data-testid={`decision-item-${item.index}`}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "rgba(245,158,11,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                  data-testid={`decision-badge-${item.index}`}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fde68a" }}>
                    {item.index}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#ECECEC",
                      lineHeight: 1.4,
                      marginBottom: 6,
                    }}
                    data-testid={`decision-title-${item.index}`}
                  >
                    {item.originalTaskTitle}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon size={14} style={{ color: "#9A9893", flexShrink: 0 }} />
                    <span
                      style={{ fontSize: 12, color: "#9A9893" }}
                      data-testid={`decision-label-${item.index}`}
                    >
                      {item.label}
                    </span>
                  </div>
                  {item.warning && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        marginTop: 6,
                        fontSize: 12,
                        color: "#f59e0b",
                      }}
                      data-testid={`decision-warning-${item.index}`}
                    >
                      <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                      <span>{item.warning}</span>
                    </div>
                  )}
                </div>
              </div>
              <input
                type="text"
                value={inputs[item.index] || ""}
                onChange={(e) => handleInputChange(item.index, e.target.value)}
                placeholder={DECISION_PLACEHOLDERS[item.decisionType] || "输入你的决定..."}
                style={{
                  width: "100%",
                  marginTop: 10,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  color: "#ECECEC",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
                data-testid={`decision-input-${item.index}`}
              />
              <style>{`
                [data-testid="decision-input-${item.index}"]::placeholder {
                  color: #6B6862;
                }
              `}</style>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "sticky",
          bottom: 0,
          padding: "12px 16px",
          paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
          background: "linear-gradient(to top, #1E1D1B 80%, transparent)",
        }}
        data-testid="decision-sheet-footer"
      >
        <button
          onClick={handleSubmit}
          disabled={!hasAnyInput}
          style={{
            width: "100%",
            padding: "12px 0",
            borderRadius: 12,
            border: "none",
            background: hasAnyInput ? "#AE5630" : "rgba(174,86,48,0.4)",
            color: hasAnyInput ? "#fff" : "rgba(255,255,255,0.5)",
            fontSize: 15,
            fontWeight: 600,
            cursor: hasAnyInput ? "pointer" : "not-allowed",
            transition: "background 200ms, color 200ms",
          }}
          data-testid="decision-submit-all"
        >
          确认全部
        </button>
      </div>
    </ActionSheet>
  );
}
