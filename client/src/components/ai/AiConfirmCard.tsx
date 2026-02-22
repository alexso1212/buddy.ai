import {
  Plus,
  Edit,
  FolderPlus,
  MessageCircle,
  Search,
  Check,
  X,
  SkipForward,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionPayload {
  actionType: string;
  data: Record<string, any>;
  summary: string;
  confidence?: number;
  missingFields?: string[];
  followUpQuestion?: string;
}

interface AiConfirmCardProps {
  action: ActionPayload;
  onConfirm: () => void;
  onReject: () => void;
  onSkip?: () => void;
  confirmed: boolean | null;
  skipped?: boolean;
  index?: number;
}

const ACTION_CONFIG: Record<
  string,
  { icon: typeof Plus; label: string; borderColor: string }
> = {
  create_task: {
    icon: Plus,
    label: "创建任务",
    borderColor: "border-l-emerald-500",
  },
  update_task: {
    icon: Edit,
    label: "更新任务",
    borderColor: "border-l-blue-500",
  },
  create_project: {
    icon: FolderPlus,
    label: "创建项目",
    borderColor: "border-l-violet-500",
  },
  add_comment: {
    icon: MessageCircle,
    label: "添加评论",
    borderColor: "border-l-amber-500",
  },
  query_tasks: {
    icon: Search,
    label: "查询任务",
    borderColor: "border-l-cyan-500",
  },
};

const DATA_LABELS: Record<string, string> = {
  title: "标题",
  projectId: "项目ID",
  assigneeId: "负责人",
  priority: "优先级",
  status: "状态",
  dueDate: "截止日期",
  weight: "权重",
  description: "描述",
  name: "名称",
  content: "内容",
  taskId: "任务ID",
  progress: "进度",
  tags: "标签",
  type: "类型",
};

export default function AiConfirmCard({
  action,
  onConfirm,
  onReject,
  onSkip,
  confirmed,
  skipped,
  index,
}: AiConfirmCardProps) {
  const config = ACTION_CONFIG[action.actionType] || {
    icon: Search,
    label: action.actionType,
    borderColor: "border-l-gray-500",
  };
  const Icon = config.icon;
  const cardId = index !== undefined ? `confirm-card-${index}` : "confirm-card";
  const warnings: string[] = Array.isArray(action.data.warnings) ? action.data.warnings : [];

  return (
    <div
      className={cn(
        "rounded-xl bg-card border border-border overflow-hidden",
        "border-l-4",
        config.borderColor
      )}
      data-testid={cardId}
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-muted border-b border-border">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          {config.label}
        </span>
      </div>

      <div className="px-4 py-3 space-y-2">
        <p className="text-sm text-foreground">{action.summary}</p>
        <div className="space-y-1">
          {Object.entries(action.data).filter(([key]) => key !== 'warnings').map(([key, val]) => {
            if (val === null || val === undefined) return null;
            let displayVal: string;
            if (typeof val === 'object') {
              if (Array.isArray(val)) {
                displayVal = val.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
              } else {
                displayVal = JSON.stringify(val);
              }
            } else {
              displayVal = String(val);
            }
            return (
              <div key={key} className="flex gap-2 text-xs">
                <span className="text-muted-foreground min-w-[4rem] text-right">
                  {DATA_LABELS[key] || key}
                </span>
                <span className="text-foreground break-all">{displayVal}</span>
              </div>
            );
          })}
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-800">
          {warnings.map((warning, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 py-0.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3 border-t border-border">
        {confirmed === null && !skipped && (
          <div className="flex items-center gap-2">
            <button
              onClick={onConfirm}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5",
                "px-3 py-1.5 rounded-lg text-sm font-medium",
                "bg-emerald-500 text-white",
                "transition-colors duration-150"
              )}
              data-testid={index !== undefined ? `confirm-action-${index}` : "confirm-action"}
            >
              <Check className="w-3.5 h-3.5" />
              确认执行
            </button>
            {onSkip && (
              <button
                onClick={onSkip}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5",
                  "px-3 py-1.5 rounded-lg text-sm font-medium",
                  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
                  "transition-colors duration-150"
                )}
                data-testid={index !== undefined ? `skip-action-${index}` : "skip-action"}
              >
                <SkipForward className="w-3.5 h-3.5" />
                跳过
              </button>
            )}
            <button
              onClick={onReject}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5",
                "px-3 py-1.5 rounded-lg text-sm font-medium",
                "bg-muted text-muted-foreground",
                "transition-colors duration-150"
              )}
              data-testid={index !== undefined ? `reject-action-${index}` : "reject-action"}
            >
              <X className="w-3.5 h-3.5" />
              取消
            </button>
          </div>
        )}
        {confirmed === true && (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm">
            <Check className="w-4 h-4" />
            已执行
          </div>
        )}
        {confirmed === false && !skipped && (
          <div className="flex items-center gap-1.5 text-red-500 dark:text-red-400 text-sm">
            <X className="w-4 h-4" />
            已取消
          </div>
        )}
        {skipped && (
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-sm">
            <SkipForward className="w-4 h-4" />
            已跳过
          </div>
        )}
      </div>
    </div>
  );
}
