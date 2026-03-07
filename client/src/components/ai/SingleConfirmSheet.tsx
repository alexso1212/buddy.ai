import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Edit,
  FolderPlus,
  MessageCircle,
  AlertTriangle,
  Loader2,
  Check,
  X,
  Search,
} from "lucide-react";
import ActionSheet from "./ActionSheet";

interface SingleConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  message: {
    id: string;
    content: string;
    action?: {
      actionType: string;
      data: Record<string, any>;
      displayData?: Record<string, string>;
      summary: string;
    };
    confirmed?: boolean | null;
    skipped?: boolean;
  };
  onConfirm: (messageId: string) => void;
  onReject: (messageId: string) => void;
}

const ACTION_CONFIG: Record<string, { icon: typeof Plus; label: string }> = {
  create_task: { icon: Plus, label: "创建任务" },
  update_task: { icon: Edit, label: "更新任务" },
  create_project: { icon: FolderPlus, label: "创建项目" },
  add_comment: { icon: MessageCircle, label: "添加评论" },
};

const DATA_LABELS: Record<string, string> = {
  title: "标题",
  projectId: "项目",
  assigneeId: "负责人",
  priority: "优先级",
  status: "状态",
  dueDate: "截止日期",
  description: "描述",
};

const DISPLAY_DATA_MAP: Record<string, string> = {
  projectId: "projectName",
  assigneeId: "assigneeName",
  priority: "priorityLabel",
  status: "statusLabel",
};

export default function SingleConfirmSheet({
  open,
  onClose,
  message,
  onConfirm,
  onReject,
}: SingleConfirmSheetProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const action = message.action;
  const confirmed = message.confirmed;
  const skipped = message.skipped;
  const decided = (confirmed !== null && confirmed !== undefined) || !!skipped;

  useEffect(() => {
    if (decided && open) {
      setIsSubmitting(false);
      autoCloseTimer.current = setTimeout(onClose, 1500);
    }
    return () => {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    };
  }, [decided, open, onClose]);

  useEffect(() => {
    if (!open) setIsSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (isSubmitting) {
      const t = setTimeout(() => setIsSubmitting(false), 8000);
      return () => clearTimeout(t);
    }
  }, [isSubmitting]);

  if (!action) return null;

  const config = ACTION_CONFIG[action.actionType] || {
    icon: Search,
    label: action.actionType,
  };
  const Icon = config.icon;

  const warnings: string[] = Array.isArray(action.data.warnings)
    ? action.data.warnings
    : [];

  const handleConfirm = () => {
    setIsSubmitting(true);
    onConfirm(message.id);
  };

  const handleReject = () => {
    onReject(message.id);
  };

  const buttonsDisabled = isSubmitting || decided;

  return (
    <ActionSheet open={open} onClose={onClose} maxHeight="50vh" showCloseButton={false}>
      <div style={{ padding: "0 20px 20px" }} data-testid="single-confirm-sheet">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
          }}
          data-testid="single-confirm-header"
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(174,86,48,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={18} color="#AE5630" />
          </div>
          <span
            style={{ fontSize: 16, fontWeight: 600, color: "#ECECEC" }}
            data-testid="single-confirm-action-label"
          >
            {config.label}
          </span>
        </div>

        <div
          style={{
            fontSize: 14,
            color: "#ECECEC",
            lineHeight: 1.5,
            marginBottom: 14,
          }}
          data-testid="single-confirm-summary"
        >
          {action.summary}
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: warnings.length > 0 ? 12 : 16,
          }}
          data-testid="single-confirm-data"
        >
          {Object.entries(action.data)
            .filter(([key]) => key !== "warnings")
            .map(([key, val]) => {
              if (val === null || val === undefined) return null;
              const ddKey = DISPLAY_DATA_MAP[key];
              let displayVal: string;
              if (ddKey && action.displayData?.[ddKey]) {
                displayVal = action.displayData[ddKey];
              } else if (typeof val === "object") {
                displayVal = Array.isArray(val)
                  ? val
                      .map((v) =>
                        typeof v === "object" ? JSON.stringify(v) : String(v)
                      )
                      .join(", ")
                  : JSON.stringify(val);
              } else {
                displayVal = String(val);
              }
              return (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    padding: "5px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    gap: 12,
                  }}
                  data-testid={`single-confirm-field-${key}`}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "#9A9893",
                      flexShrink: 0,
                    }}
                  >
                    {DATA_LABELS[key] || key}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: "#ECECEC",
                      textAlign: "right",
                      wordBreak: "break-all",
                    }}
                  >
                    {displayVal}
                  </span>
                </div>
              );
            })}
        </div>

        {warnings.length > 0 && (
          <div
            style={{
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 16,
            }}
            data-testid="single-confirm-warnings"
          >
            {warnings.map((warning, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "3px 0",
                  fontSize: 13,
                  color: "#F59E0B",
                }}
              >
                <AlertTriangle
                  size={14}
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}

        {!decided ? (
          <div
            style={{ display: "flex", gap: 10 }}
            data-testid="single-confirm-buttons"
          >
            <button
              onClick={handleConfirm}
              disabled={buttonsDisabled}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 0",
                borderRadius: 10,
                border: "none",
                background: "#AE5630",
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                cursor: buttonsDisabled ? "not-allowed" : "pointer",
                opacity: buttonsDisabled ? 0.5 : 1,
              }}
              data-testid="single-confirm-btn"
            >
              {isSubmitting ? (
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Check size={16} />
              )}
              {isSubmitting ? "执行中..." : "确认执行"}
            </button>
            <button
              onClick={handleReject}
              disabled={buttonsDisabled}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 0",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: "#9A9893",
                fontSize: 15,
                fontWeight: 600,
                cursor: buttonsDisabled ? "not-allowed" : "pointer",
                opacity: buttonsDisabled ? 0.5 : 1,
              }}
              data-testid="single-reject-btn"
            >
              <X size={16} />
              取消
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 0",
              borderRadius: 10,
              background: confirmed === true
                ? "rgba(16,185,129,0.1)"
                : "rgba(239,68,68,0.1)",
              border: `1px solid ${
                confirmed === true
                  ? "rgba(16,185,129,0.2)"
                  : "rgba(239,68,68,0.2)"
              }`,
              fontSize: 14,
              fontWeight: 500,
              color: confirmed === true ? "#10B981" : "#EF4444",
            }}
            data-testid="single-confirm-result"
          >
            {confirmed === true ? (
              <>
                <Check size={16} />
                已执行
              </>
            ) : (
              <>
                <X size={16} />
                已取消
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </ActionSheet>
  );
}
