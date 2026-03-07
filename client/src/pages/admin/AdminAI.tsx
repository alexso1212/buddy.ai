import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "./AdminLayout";
import {
  Cpu,
  Key,
  Server,
  ArrowRight,
  Zap,
  Clock,
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  TestTube,
  Power,
  PowerOff,
  X,
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Period = "today" | "week" | "month";

interface ModelProvider {
  id: number;
  modelId: string;
  providerName: string;
  baseUrl: string | null;
  apiKeyEnvVar: string | null;
  apiKey: string | null;
  timeout: number;
  priority: number;
  isActive: boolean;
  keyConfigured?: boolean;
}

interface ProviderFormData {
  providerName: string;
  baseUrl: string;
  apiKeyEnvVar: string;
  apiKey: string;
  timeout: number;
  isActive: boolean;
}

const SYSTEM_MODELS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", desc: "日常任务首选" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", desc: "深度分析模式" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", desc: "快速响应" },
  { id: "gpt-4o", label: "GPT-4o", desc: "OpenAI 多模态" },
  { id: "deepseek-chat", label: "DeepSeek V3", desc: "高性价比" },
];

const emptyForm: ProviderFormData = {
  providerName: "",
  baseUrl: "",
  apiKeyEnvVar: "",
  apiKey: "",
  timeout: 90000,
  isActive: true,
};

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("buddy_token")}` };
}

function ProviderFormDialog({
  modelId,
  initial,
  editId,
  onSave,
  onCancel,
  saving,
}: {
  modelId: string;
  initial: ProviderFormData;
  editId?: number;
  onSave: (data: ProviderFormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ProviderFormData>(initial);
  const modelLabel = SYSTEM_MODELS.find(m => m.id === modelId)?.label || modelId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="dialog-provider-form">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {editId ? "编辑 API 端点" : "添加 API 端点"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              模型: <span className="font-mono text-primary">{modelLabel}</span>
            </p>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground" data-testid="button-close-form">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">名称</label>
            <input
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={form.providerName}
              onChange={(e) => setForm({ ...form, providerName: e.target.value })}
              placeholder="例如: Claude 官方 API、代理服务"
              data-testid="input-provider-name"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Base URL <span className="text-muted-foreground/60">(留空则使用官方地址)</span>
            </label>
            <input
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://api.anthropic.com/v1"
              data-testid="input-provider-baseurl"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              API Key <span className="text-muted-foreground/60">(直接粘贴密钥)</span>
            </label>
            <input
              type="password"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder={editId ? "留空则保留现有密钥" : "sk-..."}
              data-testid="input-provider-apikey"
            />
            {!form.apiKey && (
              <div className="mt-2">
                <label className="text-xs text-muted-foreground block mb-1">
                  或使用环境变量名 <span className="text-muted-foreground/60">(高级)</span>
                </label>
                <input
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  value={form.apiKeyEnvVar}
                  onChange={(e) => setForm({ ...form, apiKeyEnvVar: e.target.value })}
                  placeholder="例如: CLAUDE_SIMPLE_API_KEY"
                  data-testid="input-provider-envvar"
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">超时 (ms)</label>
            <input
              type="number"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={form.timeout}
              onChange={(e) => setForm({ ...form, timeout: parseInt(e.target.value) || 90000 })}
              data-testid="input-provider-timeout"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg transition-colors"
            data-testid="button-cancel-form"
          >
            取消
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.providerName || (!editId && !form.apiKey && !form.apiKeyEnvVar)}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            data-testid="button-save-provider"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function ModelGroup({
  model,
  providers,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
  onTest,
  onReorder,
  testingId,
  testResult,
}: {
  model: typeof SYSTEM_MODELS[number];
  providers: ModelProvider[];
  onAdd: (modelId: string) => void;
  onEdit: (p: ModelProvider) => void;
  onDelete: (id: number) => void;
  onToggle: (p: ModelProvider) => void;
  onTest: (id: number) => void;
  onReorder: (modelId: string, ids: number[]) => void;
  testingId: number | null;
  testResult: { id: number; success: boolean; message: string } | null;
}) {
  const [expanded, setExpanded] = useState(providers.length > 0);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, id: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
    setDragId(id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: number) => {
      e.preventDefault();
      setDragId(null);
      setDragOverId(null);
      const srcId = parseInt(e.dataTransfer.getData("text/plain"));
      if (srcId === targetId) return;
      const ids = providers.map((p) => p.id);
      const srcIdx = ids.indexOf(srcId);
      const tgtIdx = ids.indexOf(targetId);
      if (srcIdx === -1 || tgtIdx === -1) return;
      const newIds = [...ids];
      newIds.splice(srcIdx, 1);
      newIds.splice(tgtIdx, 0, srcId);
      onReorder(model.id, newIds);
    },
    [providers, onReorder, model.id]
  );

  const activeCount = providers.filter(p => p.isActive).length;

  return (
    <div className="border border-border rounded-lg overflow-hidden" data-testid={`model-group-${model.id}`}>
      <div
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left cursor-pointer select-none"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
        data-testid={`btn-toggle-model-${model.id}`}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{model.label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/5 text-primary border border-primary/10 font-mono">
              {model.id}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{model.desc}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {providers.length > 0 ? (
            <span className="text-[11px] text-muted-foreground">
              {activeCount}/{providers.length} 个端点
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground/50">未配置</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(model.id); }}
            className="p-1 text-muted-foreground hover:text-primary rounded-md hover:bg-primary/10 transition-colors"
            title="添加 API 端点"
            data-testid={`btn-add-provider-${model.id}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && providers.length > 0 && (
        <div className="border-t border-border">
          <div className="p-1">
            {providers.map((prov, idx) => (
              <div
                key={prov.id}
                draggable
                onDragStart={(e) => handleDragStart(e, prov.id)}
                onDragOver={(e) => handleDragOver(e, prov.id)}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => handleDrop(e, prov.id)}
                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-100 ${
                  dragId === prov.id
                    ? "opacity-40 border border-dashed border-primary"
                    : dragOverId === prov.id
                    ? "bg-primary/5 border border-primary/30"
                    : "hover:bg-muted/30"
                }`}
                data-testid={`provider-row-${prov.id}`}
              >
                <div className="cursor-grab active:cursor-grabbing shrink-0" data-testid={`grip-${prov.id}`}>
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50" />
                </div>

                <span className="text-[10px] font-mono text-muted-foreground w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm ${prov.isActive ? "text-foreground" : "text-muted-foreground line-through"}`}>
                      {prov.providerName}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        prov.keyConfigured
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {prov.keyConfigured ? "Key OK" : "No Key"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    {prov.baseUrl ? (
                      <span className="font-mono truncate max-w-[200px]">{prov.baseUrl}</span>
                    ) : (
                      <span className="italic">官方 API</span>
                    )}
                    <span className="shrink-0">
                      <Key className="w-3 h-3 inline mr-0.5" />
                      {prov.apiKey ? prov.apiKey : prov.apiKeyEnvVar || '-'}
                    </span>
                    <span className="shrink-0">{prov.timeout / 1000}s</span>
                  </div>
                </div>

                {testResult?.id === prov.id && (
                  <div
                    className={`text-[10px] px-2 py-1 rounded-md flex items-center gap-1 shrink-0 ${
                      testResult.success
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : "bg-destructive/10 text-destructive"
                    }`}
                    data-testid={`test-result-${prov.id}`}
                  >
                    {testResult.success ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {testResult.message}
                  </div>
                )}

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => onTest(prov.id)}
                    disabled={testingId === prov.id}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                    title="测试连接"
                    data-testid={`btn-test-${prov.id}`}
                  >
                    {testingId === prov.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <TestTube className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => onToggle(prov)}
                    className={`p-1.5 rounded-md transition-colors ${
                      prov.isActive
                        ? "text-green-600 hover:bg-green-500/10"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                    title={prov.isActive ? "禁用" : "启用"}
                    data-testid={`btn-toggle-${prov.id}`}
                  >
                    {prov.isActive ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => onEdit(prov)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                    data-testid={`btn-edit-${prov.id}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(prov.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                    data-testid={`btn-delete-${prov.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && providers.length === 0 && (
        <div className="border-t border-border px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground mb-2">此模型尚未配置任何 API 端点</p>
          <button
            onClick={() => onAdd(model.id)}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
            data-testid={`btn-add-first-${model.id}`}
          >
            + 添加第一个端点
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminAI() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = !!authUser?.isSuperAdmin;
  const [period, setPeriod] = useState<Period>("month");
  const [addingForModel, setAddingForModel] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; message: string } | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/admin/ai/stats", period],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ai/stats?period=${period}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch AI stats");
      return res.json();
    },
  });

  const { data: hourly } = useQuery<any>({
    queryKey: ["/api/admin/ai/hourly"],
  });

  const { data: config } = useQuery<any>({
    queryKey: ["/api/admin/ai/config"],
    enabled: isSuperAdmin,
  });

  const { data: modelProvidersData, isLoading: providersLoading } = useQuery<any>({
    queryKey: ["/api/admin/ai/model-providers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ai/model-providers", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isSuperAdmin,
  });

  const allModelProviders: ModelProvider[] = modelProvidersData?.data || [];

  const getProvidersForModel = (modelId: string) =>
    allModelProviders
      .filter((p) => p.modelId === modelId)
      .sort((a, b) => a.priority - b.priority);

  const createMutation = useMutation({
    mutationFn: async ({ modelId, data }: { modelId: string; data: ProviderFormData }) => {
      const res = await fetch("/api/admin/ai/model-providers", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId,
          providerName: data.providerName,
          baseUrl: data.baseUrl || null,
          apiKeyEnvVar: data.apiKeyEnvVar || null,
          apiKey: data.apiKey || null,
          timeout: data.timeout,
          isActive: data.isActive,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '保存失败' }));
        throw new Error(err.error || '保存失败');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/model-providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/config"] });
      setAddingForModel(null);
      toast({ title: "API 端点已添加" });
    },
    onError: (err: Error) => {
      toast({ title: "保存失败", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ProviderFormData> }) => {
      const payload: Record<string, any> = {
        providerName: data.providerName,
        baseUrl: data.baseUrl || null,
        timeout: data.timeout,
        isActive: data.isActive,
      };
      if (data.apiKey) payload.apiKey = data.apiKey;
      if (data.apiKeyEnvVar) payload.apiKeyEnvVar = data.apiKeyEnvVar;
      const res = await fetch(`/api/admin/ai/model-providers/${id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '更新失败' }));
        throw new Error(err.error || '更新失败');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/model-providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/config"] });
      setEditingProvider(null);
      toast({ title: "API 端点已更新" });
    },
    onError: (err: Error) => {
      toast({ title: "更新失败", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/ai/model-providers/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete provider");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/model-providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/config"] });
      setDeleteConfirm(null);
      toast({ title: "API 端点已删除" });
    },
    onError: (err: Error) => {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ modelId, ids }: { modelId: string; ids: number[] }) => {
      const res = await fetch("/api/admin/ai/model-providers/reorder", {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, ids }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/model-providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/config"] });
    },
  });

  const handleTest = async (id: number) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/ai/model-providers/${id}/test`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      const d = json.data || json;
      const msg = d.success
        ? `OK${d.latency ? ` (${d.latency}ms)` : ""}${d.model ? ` - ${d.model}` : ""}`
        : d.error || "Failed";
      setTestResult({ id, success: !!d.success, message: msg });
    } catch {
      setTestResult({ id, success: false, message: "Network error" });
    }
    setTestingId(null);
  };

  const handleToggleActive = (provider: ModelProvider) => {
    updateMutation.mutate({ id: provider.id, data: { isActive: !provider.isActive } as any });
  };

  const handleReorder = useCallback((modelId: string, ids: number[]) => {
    reorderMutation.mutate({ modelId, ids });
  }, [reorderMutation]);

  const s = stats?.data || {};
  const hourlyData = (hourly?.data || []).map((h: any) => ({
    hour: new Date(h.hour).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    calls: parseInt(h.calls) || 0,
    tokens: parseInt(h.tokens) || 0,
  }));

  const taskRouting = config?.data?.taskRouting || {};

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground" data-testid="text-admin-ai-title">
              AI 监控
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">模型消耗、调用分析与 API 配置管理</p>
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            {([["today", "今天"], ["week", "本周"], ["month", "本月"]] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setPeriod(v)}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  period === v
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`button-period-${v}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4" data-testid="card-hourly-chart">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            24小时调用趋势
          </h3>
          {hourlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Line type="monotone" dataKey="calls" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="调用次数" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">暂无数据</div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <div className="bg-card border border-border rounded-xl p-4" data-testid="card-by-model">
            <h3 className="text-sm font-medium text-foreground mb-3">按模型</h3>
            {statsLoading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-muted rounded" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {(s.byModel || []).map((m: any) => (
                  <div key={m.model} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-foreground font-mono text-xs">{m.model}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{parseInt(m.calls)} calls</span>
                    </div>
                    <div className="text-right">
                      <span className="text-foreground text-xs">{parseInt(m.total_tokens).toLocaleString()} tok</span>
                      <span className="text-muted-foreground ml-1 text-xs">${parseFloat(m.cost_usd).toFixed(3)}</span>
                    </div>
                  </div>
                ))}
                {(s.byModel || []).length === 0 && (
                  <p className="text-xs text-muted-foreground">暂无数据</p>
                )}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-4" data-testid="card-by-purpose">
            <h3 className="text-sm font-medium text-foreground mb-3">按用途</h3>
            <div className="space-y-2">
              {(s.byPurpose || []).map((p: any) => (
                <div key={p.purpose} className="flex items-center justify-between text-sm">
                  <span className="text-foreground text-xs">{p.purpose}</span>
                  <div className="text-right">
                    <span className="text-muted-foreground text-xs">{parseInt(p.calls)} calls</span>
                    <span className="text-foreground ml-2 text-xs">${parseFloat(p.cost_usd).toFixed(3)}</span>
                  </div>
                </div>
              ))}
              {(s.byPurpose || []).length === 0 && (
                <p className="text-xs text-muted-foreground">暂无数据</p>
              )}
            </div>
          </div>

          {isSuperAdmin && (
            <div className="bg-card border border-border rounded-xl p-4" data-testid="card-by-org">
              <h3 className="text-sm font-medium text-foreground mb-3">按组织 (Top 10)</h3>
              <div className="space-y-2">
                {(s.byOrg || []).map((o: any) => (
                  <div key={o.org_id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground text-xs truncate max-w-[120px]">{o.org_name || `Org #${o.org_id}`}</span>
                    <div className="text-right">
                      <span className="text-muted-foreground text-xs">{parseInt(o.calls)} calls</span>
                      <span className="text-foreground ml-2 text-xs">${parseFloat(o.cost_usd).toFixed(3)}</span>
                    </div>
                  </div>
                ))}
                {(s.byOrg || []).length === 0 && (
                  <p className="text-xs text-muted-foreground">暂无数据</p>
                )}
              </div>
            </div>
          )}
        </div>

        {isSuperAdmin && (
          <div className="bg-card border border-border rounded-xl p-4" data-testid="card-model-providers">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Server className="w-4 h-4 text-primary" />
                  API 端点管理
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1">
                  按模型分组管理 API 端点。同一模型下可添加多个端点，拖拽调整优先级顺序，系统按顺序尝试调用。
                </p>
              </div>
            </div>

            {providersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {SYSTEM_MODELS.map((model) => (
                  <ModelGroup
                    key={model.id}
                    model={model}
                    providers={getProvidersForModel(model.id)}
                    onAdd={setAddingForModel}
                    onEdit={setEditingProvider}
                    onDelete={setDeleteConfirm}
                    onToggle={handleToggleActive}
                    onTest={handleTest}
                    onReorder={handleReorder}
                    testingId={testingId}
                    testResult={testResult}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {deleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="dialog-delete-confirm">
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl">
              <h3 className="text-sm font-semibold text-foreground mb-2">删除端点</h3>
              <p className="text-xs text-muted-foreground mb-4">
                确定要删除此 API 端点吗？删除后将从优先级链中移除。
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                  data-testid="button-cancel-delete"
                >
                  取消
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirm)}
                  disabled={deleteMutation.isPending}
                  className="px-3 py-1.5 text-xs bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 flex items-center gap-1"
                  data-testid="button-confirm-delete"
                >
                  {deleteMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  删除
                </button>
              </div>
            </div>
          </div>
        )}

        {isSuperAdmin && Object.keys(taskRouting).length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4" data-testid="card-task-routing">
            <h4 className="text-xs font-medium text-foreground mb-3 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              Smart Routing (Task Classification)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(taskRouting).map(([task, route]: [string, any]) => (
                <div
                  key={task}
                  className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-1.5 text-xs"
                >
                  <span className="text-foreground font-medium">{task}</span>
                  <span className="text-muted-foreground font-mono">
                    {route.model}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {addingForModel && (
        <ProviderFormDialog
          modelId={addingForModel}
          initial={emptyForm}
          onSave={(data) => createMutation.mutate({ modelId: addingForModel, data })}
          onCancel={() => setAddingForModel(null)}
          saving={createMutation.isPending}
        />
      )}

      {editingProvider && (
        <ProviderFormDialog
          modelId={editingProvider.modelId}
          initial={{
            providerName: editingProvider.providerName,
            baseUrl: editingProvider.baseUrl || "",
            apiKeyEnvVar: editingProvider.apiKeyEnvVar || "",
            apiKey: "",
            timeout: editingProvider.timeout,
            isActive: editingProvider.isActive,
          }}
          editId={editingProvider.id}
          onSave={(data) => updateMutation.mutate({ id: editingProvider.id, data })}
          onCancel={() => setEditingProvider(null)}
          saving={updateMutation.isPending}
        />
      )}
    </AdminLayout>
  );
}
