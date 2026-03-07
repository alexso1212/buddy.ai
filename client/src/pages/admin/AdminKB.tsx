import { useQuery } from "@tanstack/react-query";
import AdminLayout from "./AdminLayout";
import { BookOpen, FileText, AlertCircle, HardDrive } from "lucide-react";

export default function AdminKB() {
  const { data: kb, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/kb/stats"],
  });

  const ov = kb?.data?.overview || {};
  const byCategory = kb?.data?.byCategory || [];
  const byType = kb?.data?.byType || [];
  const errors = kb?.data?.errors || [];

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 B";
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
    return bytes + " B";
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl">
        <div>
          <h2 className="text-xl font-semibold text-foreground" data-testid="text-admin-kb-title">
            知识库概览
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">文档处理状态、分类分布与异常文档</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { label: "总文档数", value: ov.total_docs || 0, icon: BookOpen, color: "text-primary" },
            { label: "已就绪", value: ov.ready_docs || 0, icon: FileText, color: "text-green-500" },
            { label: "处理中", value: ov.processing_docs || 0, icon: FileText, color: "text-yellow-500" },
            { label: "处理失败", value: ov.error_docs || 0, icon: AlertCircle, color: "text-destructive" },
          ].map((item) => (
            <div key={item.label} className="bg-card border border-border rounded-xl p-4" data-testid={`stat-kb-${item.label}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <div className="text-2xl font-semibold text-foreground">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <HardDrive className="w-4 h-4" />
          <span>总存储: {formatSize(parseInt(ov.total_size_bytes) || 0)}</span>
          <span className="mx-2">|</span>
          <span>总 Chunks: {parseInt(ov.total_chunks || 0).toLocaleString()}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div className="bg-card border border-border rounded-xl p-4" data-testid="card-kb-category">
            <h3 className="text-sm font-medium text-foreground mb-3">按分类</h3>
            {isLoading ? (
              <div className="animate-pulse space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-6 bg-muted rounded" />)}</div>
            ) : byCategory.length > 0 ? (
              <div className="space-y-1.5">
                {byCategory.map((c: any) => {
                  const maxCount = Math.max(...byCategory.map((x: any) => parseInt(x.count)));
                  const pct = (parseInt(c.count) / maxCount) * 100;
                  return (
                    <div key={c.category} className="flex items-center gap-2 text-xs">
                      <span className="w-24 text-muted-foreground truncate">{c.category}</span>
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-foreground w-8 text-right">{c.count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">暂无数据</p>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-4" data-testid="card-kb-type">
            <h3 className="text-sm font-medium text-foreground mb-3">按文件类型</h3>
            {byType.length > 0 ? (
              <div className="space-y-1.5">
                {byType.map((t: any) => {
                  const maxCount = Math.max(...byType.map((x: any) => parseInt(x.count)));
                  const pct = (parseInt(t.count) / maxCount) * 100;
                  return (
                    <div key={t.file_type} className="flex items-center gap-2 text-xs">
                      <span className="w-24 text-muted-foreground truncate font-mono">{t.file_type}</span>
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div className="bg-orange-500 rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-foreground w-8 text-right">{t.count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">暂无数据</p>
            )}
          </div>
        </div>

        {errors.length > 0 && (
          <div className="bg-card border border-destructive/30 rounded-xl p-4" data-testid="card-kb-errors">
            <h3 className="text-sm font-medium text-destructive mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              处理失败文档
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">ID</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">标题</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">文件名</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">组织</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((e: any) => (
                    <tr key={e.id} className="border-b border-border/50" data-testid={`row-kb-error-${e.id}`}>
                      <td className="py-2 px-3 text-xs text-muted-foreground">#{e.id}</td>
                      <td className="py-2 px-3 text-foreground">{e.title}</td>
                      <td className="py-2 px-3 text-muted-foreground font-mono text-xs">{e.file_name}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">Org #{e.org_id}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleDateString("zh-CN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
