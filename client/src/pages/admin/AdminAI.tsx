import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "./AdminLayout";
import {
  Cpu,
  Globe,
  Key,
  Server,
  ArrowRight,
  Zap,
  Clock,
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

export default function AdminAI() {
  const [period, setPeriod] = useState<Period>("month");

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/admin/ai/stats", period],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ai/stats?period=${period}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("buddy_token")}` },
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

  const s = stats?.data || {};
  const hourlyData = (hourly?.data || []).map((h: any) => ({
    hour: new Date(h.hour).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    calls: parseInt(h.calls) || 0,
    tokens: parseInt(h.tokens) || 0,
  }));

  const providers = config?.data?.providers || [];
  const taskRouting = config?.data?.taskRouting || {};

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

        <div className="bg-card border border-border rounded-xl p-4" data-testid="card-api-config">
          <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            API 配置管理
          </h3>

          <div className="space-y-4">
            {providers.map((prov: any) => (
              <div
                key={prov.id}
                className="border border-border rounded-lg p-4"
                data-testid={`card-provider-${prov.id}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {prov.type === "proxy" ? (
                      <Globe className="w-4 h-4 text-blue-500" />
                    ) : (
                      <Zap className="w-4 h-4 text-green-500" />
                    )}
                    <span className="text-sm font-medium text-foreground">{prov.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        prov.type === "proxy"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "bg-green-500/10 text-green-600 dark:text-green-400"
                      }`}
                    >
                      {prov.type === "proxy" ? "中转" : "直连"}
                    </span>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      prov.keyConfigured
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {prov.keyConfigured ? "Key 已配置" : "Key 未配置"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block mb-1">Base URL</span>
                    <div className="bg-muted rounded-md px-2.5 py-1.5 font-mono text-foreground break-all">
                      {prov.baseUrl || "(未设置)"}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">环境变量</span>
                    <div className="bg-muted rounded-md px-2.5 py-1.5 font-mono text-foreground flex items-center gap-1">
                      <Key className="w-3 h-3 shrink-0" />
                      {prov.keyEnvVar}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <span className="text-xs text-muted-foreground block mb-1.5">支持模型</span>
                  <div className="flex flex-wrap gap-1.5">
                    {prov.models.map((model: string) => (
                      <span
                        key={model}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-primary/5 text-primary border border-primary/10 font-mono"
                      >
                        {model}
                      </span>
                    ))}
                  </div>
                </div>

                {prov.timeout && (
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    超时: {prov.timeout / 1000}s
                  </div>
                )}
              </div>
            ))}
          </div>

          {Object.keys(taskRouting).length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs font-medium text-foreground mb-3 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                智能路由映射 (Task Classification)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
      </div>
    </AdminLayout>
  );
}
