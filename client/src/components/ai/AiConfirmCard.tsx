import {
  Plus,
  Edit,
  FolderPlus,
  MessageCircle,
  Search,
  Check,
  X,
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
  confirmed: boolean | null;
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
  confirmed,
  index,
}: AiConfirmCardProps) {
  const config = ACTION_CONFIG[action.actionType] || {
    icon: Search,
    label: action.actionType,
    borderColor: "border-l-gray-500",
  };
  const Icon = config.icon;
  const cardId = index !== undefined ? `confirm-card-${index}` : "confirm-card";

  return (
    <div
      className={cn(
        "rounded-xl bg-white border border-gray-200 overflow-hidden",
        "border-l-4",
        config.borderColor
      )}
      data-testid={cardId}
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <Icon className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">
          {config.label}
        </span>
      </div>

      <div className="px-4 py-3 space-y-2">
        <p className="text-sm text-gray-800">{action.summary}</p>
        <div className="space-y-1">
          {Object.entries(action.data).map(([key, val]) => {
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
                <span className="text-gray-400 min-w-[4rem] text-right">
                  {DATA_LABELS[key] || key}
                </span>
                <span className="text-gray-700 break-all">{displayVal}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-100">
        {confirmed === null && (
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
            <button
              onClick={onReject}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5",
                "px-3 py-1.5 rounded-lg text-sm font-medium",
                "bg-gray-100 text-gray-600",
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
          <div className="flex items-center gap-1.5 text-emerald-600 text-sm">
            <Check className="w-4 h-4" />
            已执行
          </div>
        )}
        {confirmed === false && (
          <div className="flex items-center gap-1.5 text-red-500 text-sm">
            <X className="w-4 h-4" />
            已取消
          </div>
        )}
      </div>
    </div>
  );
}
