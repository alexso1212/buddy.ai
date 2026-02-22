import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FolderKanban, Plus, ArrowLeft, Calendar, User as UserIcon, Bell, Check, X } from "lucide-react";
import type { Project, User, TaskClaim } from "@shared/schema";

type PendingClaim = TaskClaim & { project: Project; ownerName: string };

function getProjectStatus(project: Project): { label: string; color: string } {
  if (project.status === "completed") {
    return { label: "已完成", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
  }
  if (project.deadline) {
    const now = new Date();
    const dl = new Date(project.deadline);
    if (dl < now && project.status !== "completed") {
      return { label: "已逾期", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
    }
  }
  return { label: "进行中", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-40 rounded-lg" />
      ))}
    </div>
  );
}

function PendingClaimsSection() {
  const { toast } = useToast();
  const [rejectProjectId, setRejectProjectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: pendingClaims } = useQuery<PendingClaim[]>({
    queryKey: ["/api/claims/pending"],
  });

  const claimMutation = useMutation({
    mutationFn: async (projectId: string) => {
      await apiRequest("POST", `/api/claims/${projectId}/claim`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims/pending"] });
      toast({ title: "认领成功", description: "项目已成功认领" });
    },
    onError: (error: Error) => {
      toast({ title: "认领失败", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ projectId, reason }: { projectId: string; reason: string }) => {
      await apiRequest("POST", `/api/claims/${projectId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims/pending"] });
      setRejectProjectId(null);
      setRejectReason("");
      toast({ title: "已拒绝", description: "已成功拒绝该项目认领" });
    },
    onError: (error: Error) => {
      toast({ title: "拒绝失败", description: error.message, variant: "destructive" });
    },
  });

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return null;
    try {
      return new Date(deadline).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
    } catch {
      return deadline;
    }
  };

  if (!pendingClaims || pendingClaims.length === 0) return null;

  return (
    <>
      <div
        className="mb-6 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 p-4"
        data-testid="section-pending-claims"
      >
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <h2 className="text-sm font-medium text-amber-800 dark:text-amber-300">
            待认领
          </h2>
          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0">
            {pendingClaims.length}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {pendingClaims.map((claim) => {
            const deadline = formatDeadline(claim.project.deadline);
            return (
              <Card
                key={claim.id}
                className="overflow-hidden"
                data-testid={`card-pending-claim-${claim.project_id}`}
              >
                <div className="p-3 md:p-4">
                  <h3 className="text-sm font-medium truncate mb-1" data-testid={`text-claim-title-${claim.project_id}`}>
                    {claim.project.title}
                  </h3>

                  {claim.project.objective && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {claim.project.objective}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                    <div className="flex items-center gap-1">
                      <UserIcon className="w-3 h-3" />
                      <span>{claim.ownerName}</span>
                    </div>
                    {deadline && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{deadline}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => claimMutation.mutate(claim.project_id)}
                      disabled={claimMutation.isPending}
                      data-testid={`button-claim-${claim.project_id}`}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      认领
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRejectProjectId(claim.project_id)}
                      disabled={rejectMutation.isPending}
                      data-testid={`button-reject-${claim.project_id}`}
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      拒绝
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={!!rejectProjectId} onOpenChange={(open) => { if (!open) { setRejectProjectId(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝认领</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="请输入拒绝原因..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              data-testid="input-reject-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectProjectId(null); setRejectReason(""); }} data-testid="button-reject-cancel">
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() => {
                if (rejectProjectId) {
                  rejectMutation.mutate({ projectId: rejectProjectId, reason: rejectReason.trim() });
                }
              }}
              data-testid="button-reject-confirm"
            >
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const isCeoOrAdmin = user?.role === "ceo" || user?.role === "admin";

  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    const active = projects
      .filter((p) => p.status !== "completed")
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const completed = projects
      .filter((p) => p.status === "completed")
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return [...active, ...completed];
  }, [projects]);

  const getUserName = (userId: string | null) => {
    if (!userId || !users) return "未指定";
    const u = users.find((u) => u.id === userId);
    return u?.name ?? "未知";
  };

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return null;
    try {
      return new Date(deadline).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
    } catch {
      return deadline;
    }
  };

  if (!user) {
    setLocation("/");
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-background pb-16 md:pb-0">
      <header
        className="sticky top-0 z-50 flex items-center justify-between gap-2 px-3 md:px-4 py-2 md:py-3 border-b bg-background"
        data-testid="projects-header"
      >
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">任务中心</span>
            </Button>
          </Link>
          <FolderKanban className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium tracking-tight">项目中心</span>
        </div>
        <div className="flex items-center gap-2">
          {isCeoOrAdmin && (
            <Link href="/projects/new">
              <Button size="sm" data-testid="button-new-project">
                <Plus className="w-4 h-4 mr-1" /> 新建项目
              </Button>
            </Link>
          )}
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4">
          <PendingClaimsSection />

          {projectsLoading ? (
            <LoadingSkeleton />
          ) : sortedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <p className="text-sm text-muted-foreground" data-testid="text-empty-projects">
                还没有项目，创建第一个项目开始工作吧！
              </p>
              {isCeoOrAdmin && (
                <Link href="/projects/new">
                  <Button size="sm" data-testid="button-new-project">
                    <Plus className="w-4 h-4 mr-1" /> 新建项目
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedProjects.map((p) => {
                const status = getProjectStatus(p);
                const ownerName = getUserName(p.owner_id);
                const deadline = formatDeadline(p.deadline);

                return (
                  <Link key={p.id} href={`/project/${p.id}`}>
                    <Card
                      className="cursor-pointer transition-shadow duration-150 hover:shadow-md overflow-hidden"
                      data-testid={`card-project-${p.id}`}
                    >
                      <div className="flex">
                        <div className="w-1 shrink-0 rounded-l-md" style={{ backgroundColor: p.color ?? "#6366f1" }} />
                        <div className="flex-1 p-3 md:p-4">
                      <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                        <h3 className="text-sm font-medium truncate flex-1">{p.title}</h3>
                        <Badge
                          variant="secondary"
                          className={`text-xs shrink-0 border-0 ${status.color}`}
                        >
                          {status.label}
                        </Badge>
                      </div>

                      {p.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                          {p.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1">
                          <UserIcon className="w-3 h-3" />
                          <span>负责人: {ownerName}</span>
                        </div>
                        {deadline && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>截止: {deadline}</span>
                          </div>
                        )}
                      </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
