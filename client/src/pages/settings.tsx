import { useQuery } from "@tanstack/react-query";
import type { Organization } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2 } from "lucide-react";

export default function Settings() {
  const { data: orgsData, isLoading } = useQuery<{ data: Organization[] }>({
    queryKey: ["/api/organizations"],
  });

  const org = orgsData?.data?.[0] ?? null;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" data-testid="settings-title">系统设置</h1>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Building2 className="w-5 h-5 text-muted-foreground" />
          <CardTitle>组织信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-72" />
              <Skeleton className="h-5 w-36" />
            </div>
          ) : org ? (
            <>
              <div>
                <div className="text-sm text-muted-foreground">组织名称</div>
                <h2 className="text-xl font-semibold" data-testid="org-name">{org.name}</h2>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">描述</div>
                <p data-testid="org-description">{org.description || "暂无描述"}</p>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">创建时间</div>
                <p>{new Date(org.createdAt).toLocaleDateString("zh-CN")}</p>
              </div>
              <Button disabled data-testid="btn-edit-org" title="功能开发中">
                编辑组织信息 (开发中)
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">未找到组织信息</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
