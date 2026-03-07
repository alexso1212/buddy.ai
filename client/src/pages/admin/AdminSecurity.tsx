import { useQuery } from "@tanstack/react-query";
import AdminLayout from "./AdminLayout";
import { Shield } from "lucide-react";

export default function AdminSecurity() {
  const { data: logs, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/security/logs"],
  });

  const logList = logs?.data || [];

  const actionLabels: Record<string, string> = {
    delete: "删除",
    update_role: "角色变更",
    smart_setup: "智能设置",
    claim: "档案认领",
    assign_department_role: "分配部门角色",
    purchase_tokens: "购买 Token",
    scrape_url: "URL 抓取",
    delete_task: "删除任务",
    delete_project: "删除项目",
    update_user: "更新用户",
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl">
        <div>
          <h2 className="text-xl font-semibold text-foreground" data-testid="text-admin-security-title">
            安全审计
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">敏感操作日志追踪</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4" data-testid="card-security-logs">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            审计日志 (最近 50 条)
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
            </div>
          ) : logList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">时间</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">用户</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">组织</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">操作</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">实体</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">详情</th>
                  </tr>
                </thead>
                <tbody>
                  {logList.map((log: any, i: number) => (
                    <tr key={log.id || i} className="border-b border-border/50 hover:bg-muted/50 transition-colors" data-testid={`row-log-${log.id || i}`}>
                      <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("zh-CN", {
                          month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2 px-3 text-foreground text-xs">
                        {log.user_name || log.user_email || `User #${log.user_id}`}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {log.org_name || (log.org_id ? `Org #${log.org_id}` : "-")}
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400">
                          {actionLabels[log.action] || log.action}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {log.entity_type ? `${log.entity_type} #${log.entity_id || ""}` : "-"}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground max-w-[200px] truncate">
                        {log.details || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">暂无审计日志</p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
