import { useQuery } from "@tanstack/react-query";
import AdminLayout from "./AdminLayout";
import { Users, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function AdminUsers() {
  const { data: trend } = useQuery<any>({
    queryKey: ["/api/admin/users/trend"],
  });

  const { data: recent, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/users/recent"],
  });

  const trendData = (trend?.data || []).map((d: any) => ({
    date: new Date(d.date).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }),
    count: parseInt(d.count) || 0,
  }));

  const recentUsers = recent?.data || [];

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl">
        <div>
          <h2 className="text-xl font-semibold text-foreground" data-testid="text-admin-users-title">
            用户分析
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">用户注册趋势与近期用户</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4" data-testid="card-user-trend">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            30天注册趋势
          </h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="注册人数" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">暂无数据</div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4" data-testid="card-recent-users">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            最近注册用户
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">ID</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">名称</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">邮箱</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">认证方式</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">角色</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">注册时间</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((u: any) => (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors" data-testid={`row-user-${u.id}`}>
                      <td className="py-2 px-3 text-xs text-muted-foreground">#{u.id}</td>
                      <td className="py-2 px-3 text-foreground">{u.display_name}</td>
                      <td className="py-2 px-3 text-muted-foreground font-mono text-xs">{u.email}</td>
                      <td className="py-2 px-3">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {u.auth_provider || "email"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs">{u.role}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("zh-CN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
