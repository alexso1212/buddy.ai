import {
  Plus,
  Edit,
  FolderPlus,
  Search,
  Check,
  X,
  SkipForward,
  Loader2,
} from "lucide-react";
import ActionSheet from "./ActionSheet";

interface MultiConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  message: {
    id: string;
    content: string;
    actions?: Array<{
      actionType: string;
      data: Record<string, any>;
      displayData?: Record<string, string>;
      summary: string;
      confidence?: number;
      missingFields?: string[];
    }>;
    actionConfirmed?: (boolean | null)[];
    actionSkipped?: boolean[];
  };
  onConfirm: (messageId: string, actionIndex?: number) => void;
  onReject: (messageId: string, actionIndex?: number) => void;
  onSkip?: (messageId: string, actionIndex?: number) => void;
  onConfirmAll?: (messageId: string) => void;
}

const ACTION_CONFIG: Record<
  string,
  { icon: typeof Plus; label: string }
> = {
  create_task: { icon: Plus, label: "创建任务" },
  update_task: { icon: Edit, label: "更新任务" },
  create_project: { icon: FolderPlus, label: "创建项目" },
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

const DISPLAY_KEYS = ["title", "projectId", "assigneeId", "priority", "dueDate", "status"];

function getDisplayValue(
  key: string,
  val: any,
  displayData?: Record<string, string>,
): string {
  if (key === "projectId" && displayData?.projectName) return displayData.projectName;
  if (key === "assigneeId" && displayData?.assigneeName) return displayData.assigneeName;
  if (key === "priority" && displayData?.priorityLabel) return displayData.priorityLabel;
  if (typeof val === "object") {
    return Array.isArray(val) ? val.join(", ") : JSON.stringify(val);
  }
  return String(val);
}

export default function MultiConfirmSheet({
  open,
  onClose,
  message,
  onConfirm,
  onReject,
  onSkip,
  onConfirmAll,
}: MultiConfirmSheetProps) {
  const actions = message.actions || [];
  const confirmedArr = message.actionConfirmed || [];
  const skippedArr = message.actionSkipped || [];

  const isPending = (i: number) =>
    (confirmedArr[i] === undefined || confirmedArr[i] === null) && !skippedArr[i];

  const pendingCount = actions.filter((_, i) => isPending(i)).length;
  const hasPending = pendingCount > 0;
  const allDecided = actions.length > 0 && pendingCount === 0;

  return (
    <ActionSheet
      open={open}
      onClose={onClose}
      title="批量确认"
      subtitle={`共 ${actions.length} 项操作${pendingCount > 0 ? `，${pendingCount} 项待确认` : ""}`}
      maxHeight="85vh"
    >
      <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {actions.map((action, index) => {
          const conf = ACTION_CONFIG[action.actionType] || { icon: Search, label: action.actionType };
          const Icon = conf.icon;
          const isConfirmed = confirmedArr[index] === true;
          const isRejected = confirmedArr[index] === false;
          const isSkipped = !!skippedArr[index];
          const decided = isConfirmed || isRejected || isSkipped;

          return (
            <div
              key={index}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                overflow: "hidden",
                opacity: decided ? 0.7 : 1,
              }}
              data-testid={`multi-confirm-card-${index}`}
            >
              <div style={{ display: "flex", alignItems: "stretch" }}>
                <div style={{ flex: 1, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: "rgba(174,86,48,0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={14} color="#AE5630" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#ECECEC" }}>
                      {conf.label}
                    </span>
                    {isConfirmed && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: "rgba(16,185,129,0.15)",
                          color: "#10b981",
                          fontWeight: 500,
                          marginLeft: "auto",
                        }}
                        data-testid={`badge-confirmed-${index}`}
                      >
                        已确认
                      </span>
                    )}
                    {isRejected && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: "rgba(239,68,68,0.15)",
                          color: "#ef4444",
                          fontWeight: 500,
                          marginLeft: "auto",
                        }}
                        data-testid={`badge-rejected-${index}`}
                      >
                        已取消
                      </span>
                    )}
                    {isSkipped && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: "rgba(245,158,11,0.15)",
                          color: "#f59e0b",
                          fontWeight: 500,
                          marginLeft: "auto",
                        }}
                        data-testid={`badge-skipped-${index}`}
                      >
                        已跳过
                      </span>
                    )}
                  </div>

                  {action.data.title && (
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#ECECEC", marginBottom: 6 }}>
                      {action.data.title}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {DISPLAY_KEYS.filter((k) => k !== "title" && action.data[k] != null).map((key) => (
                      <div key={key} style={{ display: "flex", gap: 8, fontSize: 12 }}>
                        <span style={{ color: "#9A9893", minWidth: 56, textAlign: "right", flexShrink: 0 }}>
                          {DATA_LABELS[key] || key}
                        </span>
                        <span style={{ color: "#ECECEC", wordBreak: "break-all" }}>
                          {getDisplayValue(key, action.data[key], action.displayData)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {!decided && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      borderLeft: "1px solid rgba(255,255,255,0.08)",
                      flexShrink: 0,
                    }}
                  >
                    <button
                      onClick={() => onConfirm(message.id, index)}
                      style={{
                        flex: 1,
                        width: 48,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "transparent",
                        border: "none",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        cursor: "pointer",
                        padding: 0,
                      }}
                      data-testid={`confirm-action-${index}`}
                    >
                      <Check size={18} color="#10b981" />
                    </button>
                    {onSkip && (
                      <button
                        onClick={() => onSkip(message.id, index)}
                        style={{
                          flex: 1,
                          width: 48,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "transparent",
                          border: "none",
                          borderBottom: "1px solid rgba(255,255,255,0.08)",
                          cursor: "pointer",
                          padding: 0,
                        }}
                        data-testid={`skip-action-${index}`}
                      >
                        <SkipForward size={18} color="#f59e0b" />
                      </button>
                    )}
                    <button
                      onClick={() => onReject(message.id, index)}
                      style={{
                        flex: 1,
                        width: 48,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                      data-testid={`reject-action-${index}`}
                    >
                      <X size={18} color="#9A9893" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasPending && !allDecided && onConfirmAll && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            padding: "12px 16px",
            paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
            background: "linear-gradient(transparent, #1E1D1B 8px)",
          }}
        >
          <button
            onClick={() => onConfirmAll(message.id)}
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: 12,
              background: "#AE5630",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
            data-testid="confirm-all-button"
          >
            <Check size={16} />
            全部确认
          </button>
        </div>
      )}
    </ActionSheet>
  );
}
