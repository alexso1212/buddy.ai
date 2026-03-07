import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "./AdminLayout";
import { BrainCircuit, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const riskConfig: Record<string, { label: string; color: string; bgClass: string; textClass: string }> = {
  low: { label: "低", color: "#22c55e", bgClass: "bg-green-500/10", textClass: "text-green-600 dark:text-green-400" },
  medium: { label: "中", color: "#eab308", bgClass: "bg-yellow-500/10", textClass: "text-yellow-600 dark:text-yellow-400" },
  high: { label: "高", color: "#f97316", bgClass: "bg-orange-500/10", textClass: "text-orange-600 dark:text-orange-400" },
  critical: { label: "极高", color: "#ef4444", bgClass: "bg-red-500/10", textClass: "text-red-600 dark:text-red-400" },
};

function MemberDetail({ userId }: { userId: number }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/ai-workforce", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ai-workforce/${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("buddy_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch workforce data");
      return res.json();
    },
  });

  const d = data?.data || {};

  if (isLoading) {
    return <div className="p-4 animate-pulse"><div className="h-32 bg-muted rounded" /></div>;
  }

  const trendData = (d.trend || []).map((t: any) => ({
    month: t.month,
    calls: parseInt(t.ai_calls) || 0,
    tokens: parseInt(t.tokens) || 0,
  }));

  const purposeData = (d.byPurpose || []).map((p: any) => ({
    name: p.purpose,
    value: parseInt(p.calls) || 0,
  }));

  const purposeColors = ["hsl(var(--primary))", "#f97316", "#22c55e", "#eab308", "#8b5cf6", "#ec4899"];

  return (
    <div className="p-3 md:p-4 bg-muted/30 border-t border-border">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">3 个月趋势</h4>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: "11px", backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }} />
                <Bar dataKey="calls" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="AI 调用" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground">暂无数据</p>
          )}
        </div>

        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">用途分布</h4>
          {purposeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie
                  data={purposeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={45}
                  innerRadius={20}
                >
                  {purposeData.map((_: any, i: number) => (
                    <Cell key={i} fill={purposeColors[i % purposeColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: "11px", backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground">暂无数据</p>
          )}
        </div>

        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">最近 AI 活动</h4>
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {(d.recentChats || []).slice(0, 8).map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{c.purpose}</span>
                <span className="text-foreground font-mono">{parseInt(c.total_tokens).toLocaleString()} tok</span>
              </div>
            ))}
            {(!d.recentChats || d.recentChats.length === 0) && (
              <p className="text-xs text-muted-foreground">暂无记录</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminWorkforce() {
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<string>("aiDependencyIndex");
  const [sortAsc, setSortAsc] = useState(false);

  const { data: workforce, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/ai-workforce"],
  });

  const d = workforce?.data || {};
  const members = [...(d.members || [])];
  const distribution = d.distribution || {};

  members.sort((a: any, b: any) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortAsc ? av - bv : bv - av;
  });

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ k }: { k: string }) => {
    if (sortKey !== k) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  const distData = [
    { name: "低 (0-20)", value: distribution.low || 0, color: riskConfig.low.color },
    { name: "中 (20-50)", value: distribution.medium || 0, color: riskConfig.medium.color },
    { name: "高 (50-70)", value: distribution.high || 0, color: riskConfig.high.color },
    { name: "极高 (70+)", value: distribution.critical || 0, color: riskConfig.critical.color },
  ];

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl">
        <div>
          <h2 className="text-xl font-semibold text-foreground" data-testid="text-admin-workforce-title">
            AI 依赖分析
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">分析团队成员对 AI 工具的依赖程度</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center justify-center" data-testid="card-team-index">
            <span className="text-xs text-muted-foreground mb-1">团队 AI 依赖指数</span>
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={
                    (d.teamIndex || 0) >= 70 ? riskConfig.critical.color :
                    (d.teamIndex || 0) >= 50 ? riskConfig.high.color :
                    (d.teamIndex || 0) >= 20 ? riskConfig.medium.color :
                    riskConfig.low.color
                  }
                  strokeWidth="8"
                  strokeDasharray={`${(d.teamIndex || 0) * 2.51} 251`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-2xl font-bold text-foreground">{d.teamIndex || 0}</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 md:col-span-2" data-testid="card-distribution">
            <span className="text-xs text-muted-foreground mb-3 block">风险等级分布</span>
            <div className="grid grid-cols-4 gap-3">
              {distData.map((item) => (
                <div key={item.name} className="text-center">
                  <div className="text-2xl font-semibold text-foreground">{item.value}</div>
                  <div className="text-[11px] mt-1" style={{ color: item.color }}>{item.name}</div>
                </div>
              ))}
            </div>
            {distData.some((d) => d.value > 0) && (
              <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-muted">
                {distData.filter((d) => d.value > 0).map((item) => {
                  const total = distData.reduce((s, d) => s + d.value, 0);
                  const pct = total > 0 ? (item.value / total) * 100 : 0;
                  return (
                    <div
                      key={item.name}
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                      className="transition-all"
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4" data-testid="card-workforce-table">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-primary" />
            成员 AI 依赖详情
          </h3>
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      { key: "name", label: "成员" },
                      { key: "aiDependencyIndex", label: "AI 指数" },
                      { key: "aiConversations", label: "AI 调用" },
                      { key: "tasksCompleted", label: "完成任务" },
                      { key: "aiDeliveryRatio", label: "AI 交付占比" },
                      { key: "riskLevel", label: "风险等级" },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className="text-left py-2 px-3 text-xs text-muted-foreground font-medium cursor-pointer hover:text-foreground select-none"
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                        <SortIcon k={col.key} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m: any) => {
                    const rc = riskConfig[m.riskLevel] || riskConfig.low;
                    const isExpanded = expandedUser === m.userId;
                    return (
                      <Fragment key={m.userId}>
                        <tr
                          className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => setExpandedUser(isExpanded ? null : m.userId)}
                          data-testid={`row-workforce-${m.userId}`}
                        >
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                              <div>
                                <div className="text-foreground text-xs font-medium">{m.name}</div>
                                <div className="text-[10px] text-muted-foreground">{m.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-1.5">
                                <div
                                  className="h-1.5 rounded-full transition-all"
                                  style={{ width: `${m.aiDependencyIndex}%`, backgroundColor: rc.color }}
                                />
                              </div>
                              <span className="text-xs font-medium text-foreground">{m.aiDependencyIndex}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-xs text-foreground">{m.aiConversations}</td>
                          <td className="py-2 px-3 text-xs text-foreground">{m.tasksCompleted}</td>
                          <td className="py-2 px-3 text-xs text-foreground">{m.aiDeliveryRatio}%</td>
                          <td className="py-2 px-3">
                            <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${rc.bgClass} ${rc.textClass}`}>
                              {rc.label}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <MemberDetail userId={m.userId} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {members.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">暂无数据</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
