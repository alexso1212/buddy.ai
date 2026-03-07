import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import AdminLayout from "./AdminLayout";
import {
  Cpu,
  Globe,
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

interface AiProvider {
  id: number;
  name: string;
  type: string;
  baseUrl: string;
  apiKeyEnvVar: string;
  models: string[];
  timeout: number;
  priority: number;
  isActive: boolean;
  keyConfigured?: boolean;
}

interface ProviderFormData {
  name: string;
  type: string;
  baseUrl: string;
  apiKeyEnvVar: string;
  models: string[];
  timeout: number;
  isActive: boolean;
}

const emptyForm: ProviderFormData = {
  name: "",
  type: "proxy",
  baseUrl: "",
  apiKeyEnvVar: "",
  models: [],
  timeout: 90000,
  isActive: true,
};

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("buddy_token")}` };
}

function ProviderFormDialog({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: ProviderFormData;
  onSave: (data: ProviderFormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ProviderFormData>(initial);
  const [modelInput, setModelInput] = useState("");

  const addModel = () => {
    const v = modelInput.trim();
    if (v && !form.models.includes(v)) {
      setForm({ ...form, models: [...form.models, v] });
      setModelInput("");
    }
  };

  const removeModel = (m: string) => {
    setForm({ ...form, models: form.models.filter((x) => x !== m) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="dialog-provider-form">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-foreground">
            {initial.name ? "Edit Provider" : "Add Provider"}
          </h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground" data-testid="button-close-form">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Name</label>
            <input
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Claude Proxy"
              data-testid="input-provider-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Type</label>
              <select
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                data-testid="select-provider-type"
              >
                <option value="proxy">Proxy</option>
                <option value="direct">Direct</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Timeout (ms)</label>
              <input
                type="number"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.timeout}
                onChange={(e) => setForm({ ...form, timeout: parseInt(e.target.value) || 90000 })}
                data-testid="input-provider-timeout"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Base URL</label>
            <input
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://api.example.com/v1"
              data-testid="input-provider-baseurl"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">API Key Env Var</label>
            <input
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              value={form.apiKeyEnvVar}
              onChange={(e) => setForm({ ...form, apiKeyEnvVar: e.target.value })}
              placeholder="e.g. CLAUDE_SIMPLE_API_KEY"
              data-testid="input-provider-envvar"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Models</label>
            <div className="flex gap-2 mb-2">
              <input
                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addModel();
                  }
                }}
                placeholder="Type model name, press Enter"
                data-testid="input-model-name"
              />
              <button
                type="button"
                onClick={addModel}
                className="px-3 py-2 bg-primary/10 text-primary rounded-lg text-xs hover:bg-primary/20 transition-colors"
                data-testid="button-add-model"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.models.map((m) => (
                <span
                  key={m}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-primary/5 text-primary border border-primary/10 font-mono flex items-center gap-1"
                >
                  {m}
                  <button onClick={() => removeModel(m)} className="hover:text-destructive" data-testid={`button-remove-model-${m}`}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg transition-colors"
            data-testid="button-cancel-form"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name || !form.baseUrl || !form.apiKeyEnvVar}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            data-testid="button-save-provider"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAI() {
  const [period, setPeriod] = useState<Period>("month");
  const [editingProvider, setEditingProvider] = useState<AiProvider | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; message: string } | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

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
  });

  const { data: providersData, isLoading: providersLoading } = useQuery<any>({
    queryKey: ["/api/admin/ai/providers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ai/providers", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const providers: (AiProvider & { keyConfigured?: boolean })[] = providersData?.data || [];

  const createMutation = useMutation({
    mutationFn: async (data: ProviderFormData) => {
      const res = await fetch("/api/admin/ai/providers", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create provider");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/config"] });
      setShowAddForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ProviderFormData> }) => {
      const res = await fetch(`/api/admin/ai/providers/${id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update provider");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/config"] });
      setEditingProvider(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/ai/providers/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete provider");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/config"] });
      setDeleteConfirm(null);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch("/api/admin/ai/providers/reorder", {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/config"] });
    },
  });

  const handleTest = async (id: number) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/ai/providers/${id}/test`, {
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

  const handleToggleActive = (provider: AiProvider) => {
    updateMutation.mutate({ id: provider.id, data: { isActive: !provider.isActive } });
  };

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

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
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
      reorderMutation.mutate(newIds);
    },
    [providers, reorderMutation]
  );

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDragOverId(null);
  }, []);

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
        </div>

        <div className="bg-card border border-border rounded-xl p-4" data-testid="card-api-providers">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              API Provider 管理
            </h3>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              data-testid="button-add-provider"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Provider
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground mb-3">
            Drag to reorder priority. Higher priority providers are tried first; lower priority ones serve as fallback.
          </p>

          {providersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {providers.map((prov) => (
                <div
                  key={prov.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, prov.id)}
                  onDragOver={(e) => handleDragOver(e, prov.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, prov.id)}
                  onDragEnd={handleDragEnd}
                  className={`border rounded-lg p-4 transition-all duration-150 ${
                    dragId === prov.id
                      ? "opacity-40 border-dashed border-primary"
                      : dragOverId === prov.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : prov.isActive
                      ? "border-border bg-card"
                      : "border-border/50 bg-muted/30"
                  }`}
                  data-testid={`card-provider-${prov.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 pt-0.5 cursor-grab active:cursor-grabbing" data-testid={`grip-provider-${prov.id}`}>
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="text-[10px] font-mono text-muted-foreground w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                        {prov.priority}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {prov.type === "proxy" ? (
                            <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                          ) : (
                            <Zap className="w-4 h-4 text-green-500 shrink-0" />
                          )}
                          <span className={`text-sm font-medium ${prov.isActive ? "text-foreground" : "text-muted-foreground line-through"}`}>
                            {prov.name}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              prov.type === "proxy"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "bg-green-500/10 text-green-600 dark:text-green-400"
                            }`}
                          >
                            {prov.type === "proxy" ? "Proxy" : "Direct"}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              prov.keyConfigured
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {prov.keyConfigured ? "Key OK" : "No Key"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleTest(prov.id)}
                            disabled={testingId === prov.id}
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                            title="Test connection"
                            data-testid={`button-test-${prov.id}`}
                          >
                            {testingId === prov.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <TestTube className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleToggleActive(prov)}
                            className={`p-1.5 rounded-md transition-colors ${
                              prov.isActive
                                ? "text-green-600 hover:bg-green-500/10"
                                : "text-muted-foreground hover:bg-muted"
                            }`}
                            title={prov.isActive ? "Disable" : "Enable"}
                            data-testid={`button-toggle-${prov.id}`}
                          >
                            {prov.isActive ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => setEditingProvider(prov)}
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                            data-testid={`button-edit-${prov.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(prov.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                            data-testid={`button-delete-${prov.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {testResult?.id === prov.id && (
                        <div
                          className={`text-xs px-2.5 py-1.5 rounded-md mb-2 flex items-center gap-1.5 ${
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground block mb-0.5">Base URL</span>
                          <div className="bg-muted rounded-md px-2 py-1 font-mono text-foreground break-all text-[11px]">
                            {prov.baseUrl}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-0.5">Env Var</span>
                          <div className="bg-muted rounded-md px-2 py-1 font-mono text-foreground flex items-center gap-1 text-[11px]">
                            <Key className="w-3 h-3 shrink-0" />
                            {prov.apiKeyEnvVar}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="flex flex-wrap gap-1">
                          {prov.models.map((model) => (
                            <span
                              key={model}
                              className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/5 text-primary border border-primary/10 font-mono"
                            >
                              {model}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-1.5 text-[11px] text-muted-foreground">
                        Timeout: {prov.timeout / 1000}s
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {deleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="dialog-delete-confirm">
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl">
              <h3 className="text-sm font-semibold text-foreground mb-2">Delete Provider</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Are you sure? This provider will be permanently removed from the fallback chain.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                  data-testid="button-cancel-delete"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirm)}
                  disabled={deleteMutation.isPending}
                  className="px-3 py-1.5 text-xs bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 flex items-center gap-1"
                  data-testid="button-confirm-delete"
                >
                  {deleteMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {Object.keys(taskRouting).length > 0 && (
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

      {showAddForm && (
        <ProviderFormDialog
          initial={emptyForm}
          onSave={(data) => createMutation.mutate(data)}
          onCancel={() => setShowAddForm(false)}
          saving={createMutation.isPending}
        />
      )}

      {editingProvider && (
        <ProviderFormDialog
          initial={{
            name: editingProvider.name,
            type: editingProvider.type,
            baseUrl: editingProvider.baseUrl,
            apiKeyEnvVar: editingProvider.apiKeyEnvVar,
            models: editingProvider.models,
            timeout: editingProvider.timeout,
            isActive: editingProvider.isActive,
          }}
          onSave={(data) => updateMutation.mutate({ id: editingProvider.id, data })}
          onCancel={() => setEditingProvider(null)}
          saving={updateMutation.isPending}
        />
      )}
    </AdminLayout>
  );
}
