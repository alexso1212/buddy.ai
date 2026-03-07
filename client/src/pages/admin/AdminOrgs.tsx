import { useQuery } from "@tanstack/react-query";
import AdminLayout from "./AdminLayout";
import { Building2 } from "lucide-react";

export default function AdminOrgs() {
  const { data: orgs, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/orgs/list"],
  });

  const orgList = orgs?.data || [];

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl">
        <div>
          <h2 className="text-xl font-semibold text-foreground" data-testid="text-admin-orgs-title">
            组织管理
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">所有组织的成员、任务、知识库和消耗概况</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4" data-testid="card-org-list">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            组织列表
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
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">成员</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">任务</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">KB 文档</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Token 预算</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">本月 Tokens</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">本月消耗</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {orgList.map((o: any) => (
                    <tr key={o.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors" data-testid={`row-org-${o.id}`}>
                      <td className="py-2 px-3 text-xs text-muted-foreground">#{o.id}</td>
                      <td className="py-2 px-3 text-foreground font-medium">{o.name}</td>
                      <td className="py-2 px-3 text-foreground">{o.member_count}</td>
                      <td className="py-2 px-3 text-foreground">{o.task_count}</td>
                      <td className="py-2 px-3 text-foreground">{o.kb_doc_count}</td>
                      <td className="py-2 px-3 text-foreground">
                        {o.token_budget_usd ? `$${parseFloat(o.token_budget_usd).toFixed(2)}` : "-"}
                      </td>
                      <td className="py-2 px-3 text-foreground text-xs font-mono">
                        {parseInt(o.tokens_this_month).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-foreground text-xs">
                        ${parseFloat(o.cost_this_month || 0).toFixed(3)}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString("zh-CN")}
                      </td>
                    </tr>
                  ))}
                  {orgList.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-8 text-muted-foreground text-sm">暂无组织数据</td></tr>
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
