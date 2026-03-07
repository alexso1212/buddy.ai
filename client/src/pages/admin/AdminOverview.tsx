import { useQuery } from "@tanstack/react-query";
import AdminLayout from "./AdminLayout";
import {
  Users,
  Building2,
  Activity,
  CheckSquare,
  AlertTriangle,
  BookOpen,
  Cpu,
  Heart,
  Clock,
} from "lucide-react";

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  color = "text-primary",
  testId,
}: {
  label: string;
  value: string | number;
  icon: any;
  sub?: string;
  color?: string;
  testId: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4" data-testid={testId}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminOverview() {
  const { data: overview, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/overview"],
    refetchInterval: 30000,
  });

  const { data: health } = useQuery<any>({
    queryKey: ["/api/admin/health"],
    refetchInterval: 30000,
  });

  const d = overview?.data || {};
  const h = health?.data || {};

  const formatNum = (v: any) => {
    const n = parseInt(v);
    if (isNaN(n)) return "0";
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  };

  const formatUptime = (s: number) => {
    if (!s) return "-";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-4 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse h-24" />
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground" data-testid="text-admin-overview-title">
              系统概览
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">实时监控系统运行状态</p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${h.status === "healthy" ? "bg-green-500" : "bg-yellow-500"}`}
            />
            <span className="text-xs text-muted-foreground" data-testid="text-system-status">
              {h.status === "healthy" ? "系统正常" : "系统异常"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            label="总用户数"
            value={formatNum(d.total_users)}
            icon={Users}
            sub={`今日新增 ${d.new_users_today || 0}`}
            testId="stat-total-users"
          />
          <StatCard
            label="组织数"
            value={formatNum(d.total_orgs)}
            icon={Building2}
            testId="stat-total-orgs"
          />
          <StatCard
            label="DAU / WAU / MAU"
            value={formatNum(d.dau)}
            icon={Activity}
            sub={`${formatNum(d.wau)} / ${formatNum(d.mau)}`}
            testId="stat-dau"
          />
          <StatCard
            label="活跃任务"
            value={formatNum(d.active_tasks)}
            icon={CheckSquare}
            sub={`总任务 ${formatNum(d.total_tasks)}`}
            testId="stat-active-tasks"
          />
          <StatCard
            label="逾期任务"
            value={formatNum(d.overdue_tasks)}
            icon={AlertTriangle}
            color="text-destructive"
            testId="stat-overdue-tasks"
          />
          <StatCard
            label="知识库文档"
            value={formatNum(d.total_kb_docs)}
            icon={BookOpen}
            sub={`${formatNum(d.total_kb_chunks)} chunks`}
            testId="stat-kb-docs"
          />
          <StatCard
            label="今日 AI 调用"
            value={formatNum(d.ai_calls_today)}
            icon={Cpu}
            sub={`${formatNum(d.tokens_today)} tokens`}
            testId="stat-ai-calls"
          />
          <StatCard
            label="本月消耗"
            value={`$${parseFloat(d.cost_month_usd || 0).toFixed(2)}`}
            icon={Activity}
            sub={`${formatNum(d.tokens_month)} tokens`}
            color="text-orange-500"
            testId="stat-month-cost"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div className="bg-card border border-border rounded-xl p-4" data-testid="card-system-health">
            <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Heart className="w-4 h-4 text-primary" />
              系统健康
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">数据库延迟</span>
                <span className="text-foreground">{h.db?.latencyMs || "-"} ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">内存使用</span>
                <span className="text-foreground">{h.memory?.heapUsedMB || "-"} MB / {h.memory?.rssMB || "-"} MB RSS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">运行时间</span>
                <span className="text-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatUptime(h.uptime)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Node.js</span>
                <span className="text-foreground">{h.nodeVersion || "-"}</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4" data-testid="card-ai-keys">
            <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              AI API 状态
            </h3>
            <div className="space-y-2 text-sm">
              {[
                { label: "Claude Simple Key", ok: h.ai?.simpleKey },
                { label: "Claude Complex Key", ok: h.ai?.complexKey },
                { label: "OpenRouter Key", ok: h.ai?.openRouterKey },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      item.ok
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {item.ok ? "已配置" : "未配置"}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">今日会话</span>
                <span className="text-foreground">{d.conversations_today || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {(parseInt(d.overdue_tasks) > 0 || parseInt(d.failed_kb_docs) > 0) && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4" data-testid="card-alerts">
            <h3 className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              需要关注
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              {parseInt(d.overdue_tasks) > 0 && (
                <li>{d.overdue_tasks} 个任务已逾期</li>
              )}
              {parseInt(d.failed_kb_docs) > 0 && (
                <li>{d.failed_kb_docs} 个知识库文档处理失败</li>
              )}
              {parseInt(d.pending_profiles) > 0 && (
                <li>{d.pending_profiles} 个成员档案待认领</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
