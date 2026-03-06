import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, Department, JobRole, MemberProfile } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Plus, Pencil, Trash2, X, Check, Copy, RefreshCw, Inbox, ChevronDown, Clock, Users, ListChecks, CheckCircle2, AlertTriangle, Link2, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DeptStatsMap, DeptStats, UserStatsMap } from "@/components/org/types";
import { getCompletionRate } from "@/components/org/types";

function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  return `${months}个月前`;
}

export default function Team() {
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddDept, setShowAddDept] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const orgId = user?.orgId;
  const isAdminOrOwner = user?.role === "owner" || user?.role === "admin";

  const { data: usersData, isLoading: usersLoading } = useQuery<{ data: User[] }>({
    queryKey: ["/api/users"],
  });

  const { data: deptsData, isLoading: deptsLoading } = useQuery<{ data: Department[] }>({
    queryKey: ["/api/departments"],
  });

  const { data: jobRolesData, isLoading: jobRolesLoading } = useQuery<{ data: JobRole[] }>({
    queryKey: ["/api/job-roles"],
  });

  const { data: userStatsData } = useQuery<UserStatsMap>({
    queryKey: ["/api/users/stats"],
  });

  const { data: deptStatsData } = useQuery<DeptStatsMap>({
    queryKey: ["/api/departments/stats"],
  });

  const deptStats: DeptStatsMap = deptStatsData ?? {};

  const { data: pendingRequestsData } = useQuery<{ data: Array<any> }>({
    queryKey: ["/api/organizations", orgId, "join-requests", "pending"],
    queryFn: () => apiRequest("GET", `/api/organizations/${orgId}/join-requests?status=pending`).then(r => r.json()),
    enabled: !!orgId && isAdminOrOwner,
  });

  const pendingCount = pendingRequestsData?.data?.length ?? 0;

  const users = usersData?.data ?? [];
  const departments = deptsData?.data ?? [];
  const jobRoles = jobRolesData?.data ?? [];

  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const jobRoleMap = new Map(jobRoles.map((r) => [r.id, r]));
  const userStats: UserStatsMap = userStatsData ?? {};

  function buildTree(depts: Department[], parentId: number | null = null, level = 0): Array<Department & { level: number }> {
    const result: Array<Department & { level: number }> = [];
    for (const d of depts) {
      if (d.parentDeptId === parentId) {
        result.push({ ...d, level });
        result.push(...buildTree(depts, d.id, level + 1));
      }
    }
    return result;
  }

  const deptTree = buildTree(departments);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl md:text-2xl font-bold" data-testid="team-title">团队管理</h1>

      <Tabs defaultValue="members">
        <TabsList className="flex-wrap h-auto gap-1" data-testid="team-tabs">
          <TabsTrigger value="members" data-testid="tab-members">成员</TabsTrigger>
          <TabsTrigger value="departments" data-testid="tab-departments">部门管理</TabsTrigger>
          <TabsTrigger value="jobroles" data-testid="tab-jobroles">岗位定义</TabsTrigger>
          {isAdminOrOwner && (
            <TabsTrigger value="requests" data-testid="tab-requests" className="gap-1.5">
              加入申请
              {pendingCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-xs">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {isAdminOrOwner && (
            <TabsTrigger value="invite" data-testid="tab-invite">邀请码</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="members" className="space-y-4 mt-4">
          <MembersTab
            users={users}
            departments={departments}
            deptMap={deptMap}
            jobRoleMap={jobRoleMap}
            userStats={userStats}
            isLoading={usersLoading || deptsLoading || jobRolesLoading}
            showAddUser={showAddUser}
            setShowAddUser={setShowAddUser}
            toast={toast}
            isAdminOrOwner={!!isAdminOrOwner}
          />
        </TabsContent>

        <TabsContent value="departments" className="space-y-4 mt-4">
          <DepartmentsTab
            departments={departments}
            deptTree={deptTree}
            isLoading={deptsLoading}
            showAddDept={showAddDept}
            setShowAddDept={setShowAddDept}
            editingDept={editingDept}
            setEditingDept={setEditingDept}
            toast={toast}
            deptStats={deptStats}
            users={users}
          />
        </TabsContent>

        <TabsContent value="jobroles" className="space-y-4 mt-4">
          <JobRolesTab
            jobRoles={jobRoles}
            departments={departments}
            isLoading={jobRolesLoading}
            toast={toast}
          />
        </TabsContent>

        {isAdminOrOwner && (
          <TabsContent value="requests" className="space-y-4 mt-4">
            <RequestsTab orgId={orgId} toast={toast} />
          </TabsContent>
        )}

        {isAdminOrOwner && (
          <TabsContent value="invite" className="space-y-4 mt-4">
            <InviteTab orgId={orgId} userRole={user?.role} toast={toast} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function MembersTab({
  users,
  departments,
  deptMap,
  jobRoleMap,
  userStats,
  isLoading,
  showAddUser,
  setShowAddUser,
  toast,
  isAdminOrOwner,
}: {
  users: User[];
  departments: Department[];
  deptMap: Map<number, Department>;
  jobRoleMap: Map<number, JobRole>;
  userStats: UserStatsMap;
  isLoading: boolean;
  showAddUser: boolean;
  setShowAddUser: (v: boolean) => void;
  toast: ReturnType<typeof useToast>["toast"];
  isAdminOrOwner: boolean;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [deptId, setDeptId] = useState<string>("");
  const [bindTarget, setBindTarget] = useState<MemberProfile | null>(null);
  const [bindUserId, setBindUserId] = useState<string>("");

  const { data: profilesData, isLoading: profilesLoading } = useQuery<{ data: MemberProfile[] }>({
    queryKey: ["/api/member-profiles"],
  });

  const profiles = profilesData?.data ?? [];
  const pendingProfiles = profiles.filter(p => p.status === "pending" || p.status === "manual");
  const claimedProfiles = profiles.filter(p => p.status === "claimed");
  const claimedUserIds = new Set(claimedProfiles.map(p => p.userId).filter(Boolean));

  const unboundUsers = users.filter(u => !claimedUserIds.has(u.id));

  const addUserMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/users", {
        displayName,
        email,
        role,
        deptId: deptId ? Number(deptId) : null,
        orgId: 1,
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowAddUser(false);
      setDisplayName("");
      setEmail("");
      setRole("member");
      setDeptId("");
      toast({ title: "成员已添加" });
    },
    onError: (err: Error) => {
      toast({ title: "添加失败", description: err.message, variant: "destructive" });
    },
  });

  const bindMutation = useMutation({
    mutationFn: async ({ profileId, userId }: { profileId: number; userId: number }) => {
      await apiRequest("POST", `/api/member-profiles/${profileId}/bind/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/member-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setBindTarget(null);
      setBindUserId("");
      toast({ title: "档案已绑定" });
    },
    onError: (err: Error) => {
      toast({ title: "绑定失败", description: err.message, variant: "destructive" });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/member-profiles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/member-profiles"] });
      toast({ title: "档案已删除" });
    },
    onError: (err: Error) => {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    },
  });

  function parseAliases(aliases: string | null | undefined): string[] {
    if (!aliases) return [];
    try { return JSON.parse(aliases); } catch { return aliases ? [aliases] : []; }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-xs" data-testid="badge-pending">待认领</Badge>;
      case "manual":
        return <Badge variant="secondary" className="text-xs" data-testid="badge-manual">手动创建</Badge>;
      case "claimed":
        return <Badge variant="default" className="text-xs" data-testid="badge-claimed">已认领</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" data-testid="section-registered-members">已注册成员</h2>
        <Button onClick={() => setShowAddUser(true)} data-testid="btn-add-user">
          <Plus className="w-4 h-4 mr-1" />
          添加成员
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table data-testid="user-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead>岗位</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>任务数</TableHead>
                    <TableHead>已完成</TableHead>
                    <TableHead>逾期</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const stats = userStats[String(user.id)];
                    return (
                      <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                        <TableCell className="max-w-[150px]">
                          <span className="block truncate">{user.displayName}</span>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {user.deptId ? deptMap.get(user.deptId)?.name ?? "-" : "-"}
                        </TableCell>
                        <TableCell data-testid={`user-jobrole-${user.id}`}>
                          {user.jobRoleId ? jobRoleMap.get(user.jobRoleId)?.title ?? "-" : "-"}
                        </TableCell>
                        <TableCell>{user.role}</TableCell>
                        <TableCell data-testid={`user-tasks-${user.id}`}>
                          {stats?.total ?? 0}
                        </TableCell>
                        <TableCell data-testid={`user-done-${user.id}`}>
                          {stats?.done ?? 0}
                        </TableCell>
                        <TableCell data-testid={`user-overdue-${user.id}`}>
                          {stats?.overdue ? (
                            <span className="text-red-600 dark:text-red-400">{stats.overdue}</span>
                          ) : (
                            0
                          )}
                        </TableCell>
                        <TableCell>{user.isActive ? "活跃" : "停用"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        暂无成员
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="md:hidden">
              {users.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">暂无成员</div>
              ) : (
                <div className="space-y-2 p-4" data-testid="user-card-list">
                  {users.map((user) => {
                    const stats = userStats[String(user.id)];
                    return (
                      <div
                        key={user.id}
                        className="bg-card rounded-lg shadow-sm p-4"
                        data-testid={`user-card-${user.id}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-medium truncate min-w-0">{user.displayName}</span>
                          <Badge variant="secondary" className="text-xs">
                            {user.role}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mb-1">
                          {user.deptId ? deptMap.get(user.deptId)?.name ?? "-" : "-"}
                        </div>
                        <div
                          className="text-xs text-muted-foreground mb-3"
                          data-testid={`user-jobrole-mobile-${user.id}`}
                        >
                          {user.jobRoleId ? jobRoleMap.get(user.jobRoleId)?.title ?? "-" : "-"}
                        </div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="text-xs text-muted-foreground" data-testid={`user-tasks-mobile-${user.id}`}>
                            任务 {stats?.total ?? 0}
                          </span>
                          <span className="text-xs text-muted-foreground" data-testid={`user-done-mobile-${user.id}`}>
                            已完成 {stats?.done ?? 0}
                          </span>
                          {(stats?.overdue ?? 0) > 0 && (
                            <span className="text-xs text-red-600 dark:text-red-400" data-testid={`user-overdue-mobile-${user.id}`}>
                              逾期 {stats.overdue}
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-xs font-medium ${
                            user.isActive
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                          data-testid={`user-status-${user.id}`}
                        >
                          {user.isActive ? "活跃" : "停用"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      {pendingProfiles.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2 mt-6">
            <h2 className="text-lg font-semibold" data-testid="section-pending-profiles">
              待认领档案
              <Badge variant="secondary" className="ml-2 text-xs">{pendingProfiles.length}</Badge>
            </h2>
          </div>

          <div className="hidden md:block">
            <Card>
              <Table data-testid="pending-profiles-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>别名</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead>岗位</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>来源</TableHead>
                    {isAdminOrOwner && <TableHead>操作</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingProfiles.map((profile) => {
                    const aliases = parseAliases(profile.aliases);
                    return (
                      <TableRow key={profile.id} data-testid={`profile-row-${profile.id}`}>
                        <TableCell className="font-medium">{profile.fullName}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {aliases.map((a, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
                            ))}
                            {aliases.length === 0 && <span className="text-muted-foreground">-</span>}
                          </div>
                        </TableCell>
                        <TableCell>{profile.deptId ? deptMap.get(profile.deptId)?.name ?? "-" : "-"}</TableCell>
                        <TableCell>{profile.jobRoleId ? jobRoleMap.get(profile.jobRoleId)?.title ?? "-" : "-"}</TableCell>
                        <TableCell>{getStatusBadge(profile.status)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {profile.sourceDocument ? "AI提取" : "手动"}
                        </TableCell>
                        {isAdminOrOwner && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => { setBindTarget(profile); setBindUserId(""); }}
                                data-testid={`btn-bind-profile-${profile.id}`}
                              >
                                <Link2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (window.confirm(`确定删除档案「${profile.fullName}」吗？`)) {
                                    deleteProfileMutation.mutate(profile.id);
                                  }
                                }}
                                data-testid={`btn-delete-profile-${profile.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>

          <div className="md:hidden space-y-2">
            {pendingProfiles.map((profile) => {
              const aliases = parseAliases(profile.aliases);
              return (
                <Card key={profile.id} className="p-4" data-testid={`profile-card-${profile.id}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-medium truncate min-w-0">{profile.fullName}</span>
                    {getStatusBadge(profile.status)}
                  </div>
                  {aliases.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-2">
                      {aliases.map((a, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground mb-1">
                    {profile.deptId ? deptMap.get(profile.deptId)?.name ?? "-" : "-"}
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">
                    {profile.jobRoleId ? jobRoleMap.get(profile.jobRoleId)?.title ?? "-" : "-"}
                  </div>
                  {isAdminOrOwner && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setBindTarget(profile); setBindUserId(""); }}
                        data-testid={`btn-bind-profile-mobile-${profile.id}`}
                      >
                        <Link2 className="w-4 h-4 mr-1" />
                        绑定
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (window.confirm(`确定删除档案「${profile.fullName}」吗？`)) {
                            deleteProfileMutation.mutate(profile.id);
                          }
                        }}
                        data-testid={`btn-delete-profile-mobile-${profile.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        删除
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent data-testid="modal-add-user">
          <DialogHeader>
            <DialogTitle>添加成员</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              addUserMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>姓名 *</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                data-testid="input-display-name"
              />
            </div>
            <div className="space-y-2">
              <Label>邮箱 *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger data-testid="select-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">owner</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="head">head</SelectItem>
                  <SelectItem value="member">member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>部门</Label>
              <Select value={deptId} onValueChange={setDeptId}>
                <SelectTrigger data-testid="select-dept">
                  <SelectValue placeholder="选择部门" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={String(dept.id)}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={addUserMutation.isPending}
              data-testid="btn-submit-user"
            >
              {addUserMutation.isPending ? "提交中..." : "提交"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bindTarget} onOpenChange={(open) => { if (!open) { setBindTarget(null); setBindUserId(""); } }}>
        <DialogContent data-testid="modal-bind-profile">
          <DialogHeader>
            <DialogTitle>绑定档案</DialogTitle>
            <DialogDescription>
              将档案「{bindTarget?.fullName}」绑定到一个已注册成员，该成员将继承档案中的部门、岗位信息及相关任务。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>选择成员</Label>
              <Select value={bindUserId} onValueChange={setBindUserId}>
                <SelectTrigger data-testid="select-bind-user">
                  <SelectValue placeholder="选择要绑定的成员" />
                </SelectTrigger>
                <SelectContent>
                  {unboundUsers.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.displayName} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBindTarget(null); setBindUserId(""); }} data-testid="btn-cancel-bind">
              取消
            </Button>
            <Button
              onClick={() => {
                if (bindTarget && bindUserId) {
                  bindMutation.mutate({ profileId: bindTarget.id, userId: Number(bindUserId) });
                }
              }}
              disabled={!bindUserId || bindMutation.isPending}
              data-testid="btn-confirm-bind"
            >
              <UserCheck className="w-4 h-4 mr-1" />
              {bindMutation.isPending ? "绑定中..." : "确认绑定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DepartmentsTab({
  departments,
  deptTree,
  isLoading,
  showAddDept,
  setShowAddDept,
  editingDept,
  setEditingDept,
  toast,
  deptStats,
  users,
}: {
  departments: Department[];
  deptTree: Array<Department & { level: number }>;
  isLoading: boolean;
  showAddDept: boolean;
  setShowAddDept: (v: boolean) => void;
  editingDept: Department | null;
  setEditingDept: (v: Department | null) => void;
  toast: ReturnType<typeof useToast>["toast"];
  deptStats: DeptStatsMap;
  users: User[];
}) {
  const memberCountMap = new Map<number, number>();
  for (const u of users) {
    if (u.deptId) {
      memberCountMap.set(u.deptId, (memberCountMap.get(u.deptId) ?? 0) + 1);
    }
  }

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentDeptId, setParentDeptId] = useState<string>("");

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const addDeptMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/departments", {
        name,
        description: description || null,
        parentDeptId: parentDeptId ? Number(parentDeptId) : null,
        orgId: 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setShowAddDept(false);
      setName("");
      setDescription("");
      setParentDeptId("");
      toast({ title: "部门已添加" });
    },
    onError: (err: Error) => {
      toast({ title: "添加失败", description: err.message, variant: "destructive" });
    },
  });

  const editDeptMutation = useMutation({
    mutationFn: async () => {
      if (!editingDept) return;
      await apiRequest("PATCH", `/api/departments/${editingDept.id}`, {
        name: editName,
        description: editDescription || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setEditingDept(null);
      toast({ title: "部门已更新" });
    },
    onError: (err: Error) => {
      toast({ title: "更新失败", description: err.message, variant: "destructive" });
    },
  });

  const deleteDeptMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/departments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "部门已删除" });
    },
    onError: (err: Error) => {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    },
  });

  function openEdit(dept: Department) {
    setEditName(dept.name);
    setEditDescription(dept.description ?? "");
    setEditingDept(dept);
  }

  function handleDelete(dept: Department) {
    if (window.confirm(`确定删除部门「${dept.name}」吗？`)) {
      deleteDeptMutation.mutate(dept.id);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">部门管理</h2>
        <Button onClick={() => setShowAddDept(true)} data-testid="btn-add-dept">
          <Plus className="w-4 h-4 mr-1" />
          添加部门
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="divide-y" data-testid="dept-list">
            {deptTree.length === 0 && (
              <div className="p-4 text-center text-muted-foreground">暂无部门</div>
            )}
            {deptTree.map((dept) => {
              const memberCount = memberCountMap.get(dept.id) ?? 0;
              const stats: DeptStats | undefined = deptStats[String(dept.id)];
              const taskTotal = stats?.total ?? 0;
              const taskDone = stats?.done ?? 0;
              const taskOverdue = stats?.overdue ?? 0;
              const completionRate = getCompletionRate(taskTotal, taskDone);

              return (
                <div
                  key={dept.id}
                  className="flex items-center justify-between p-3 gap-2"
                  style={{ paddingLeft: `${dept.level * 24 + 12}px` }}
                  data-testid={`dept-item-${dept.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{dept.name}</span>
                      <Badge variant="secondary" className="gap-1 text-xs" data-testid={`dept-members-${dept.id}`}>
                        <Users className="w-3 h-3" />
                        {memberCount}
                      </Badge>
                      {taskTotal > 0 && (
                        <>
                          <Badge variant="secondary" className="gap-1 text-xs" data-testid={`dept-tasks-${dept.id}`}>
                            <ListChecks className="w-3 h-3" />
                            {taskDone}/{taskTotal}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={`gap-1 text-xs ${
                              completionRate >= 80
                                ? "text-green-700 dark:text-green-400"
                                : completionRate >= 50
                                ? "text-yellow-700 dark:text-yellow-400"
                                : "text-red-700 dark:text-red-400"
                            }`}
                            data-testid={`dept-rate-${dept.id}`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {completionRate}%
                          </Badge>
                        </>
                      )}
                      {taskOverdue > 0 && (
                        <Badge
                          variant="destructive"
                          className="gap-1 text-xs"
                          data-testid={`dept-overdue-${dept.id}`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {taskOverdue}
                        </Badge>
                      )}
                    </div>
                    {dept.description && (
                      <div className="text-sm text-muted-foreground mt-0.5">{dept.description}</div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(dept)}
                      data-testid={`btn-edit-dept-${dept.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(dept)}
                      data-testid={`btn-delete-dept-${dept.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={showAddDept} onOpenChange={setShowAddDept}>
        <DialogContent data-testid="modal-add-dept">
          <DialogHeader>
            <DialogTitle>添加部门</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              addDeptMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>部门名称 *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                data-testid="input-dept-name"
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="input-dept-description"
              />
            </div>
            <div className="space-y-2">
              <Label>上级部门</Label>
              <Select value={parentDeptId} onValueChange={setParentDeptId}>
                <SelectTrigger data-testid="select-parent-dept">
                  <SelectValue placeholder="无（顶级部门）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无（顶级部门）</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={String(dept.id)}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={addDeptMutation.isPending}
              data-testid="btn-submit-dept"
            >
              {addDeptMutation.isPending ? "提交中..." : "提交"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingDept} onOpenChange={(open) => { if (!open) setEditingDept(null); }}>
        <DialogContent data-testid="modal-edit-dept">
          <DialogHeader>
            <DialogTitle>编辑部门</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              editDeptMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>部门名称 *</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                data-testid="input-edit-dept-name"
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                data-testid="input-edit-dept-description"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={editDeptMutation.isPending}
              data-testid="btn-submit-edit-dept"
            >
              {editDeptMutation.isPending ? "更新中..." : "更新"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

function TagListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const [newItem, setNewItem] = useState("");

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {items.map((item, i) => (
          <Badge key={i} variant="secondary" className="gap-1 pr-1">
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder || `添加${label}`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (newItem.trim()) {
                onChange([...items, newItem.trim()]);
                setNewItem("");
              }
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (newItem.trim()) {
              onChange([...items, newItem.trim()]);
              setNewItem("");
            }
          }}
        >
          添加
        </Button>
      </div>
    </div>
  );
}

function JobRolesTab({
  jobRoles,
  departments,
  isLoading,
  toast,
}: {
  jobRoles: JobRole[];
  departments: Department[];
  isLoading: boolean;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingRole, setEditingRole] = useState<JobRole | null>(null);
  const deptMap = new Map(departments.map((d) => [d.id, d]));

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deptId, setDeptId] = useState<string>("");
  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [boundaries, setBoundaries] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setDeptId("");
    setResponsibilities([]);
    setBoundaries([]);
    setSkills([]);
  }

  function openEdit(role: JobRole) {
    setTitle(role.title);
    setDescription(role.description ?? "");
    setDeptId(role.deptId ? String(role.deptId) : "");
    setResponsibilities(parseJsonArray(role.responsibilities));
    setBoundaries(parseJsonArray(role.boundaries));
    setSkills(parseJsonArray(role.requiredSkills));
    setEditingRole(role);
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/job-roles", {
        orgId: 1,
        deptId: deptId ? Number(deptId) : null,
        title,
        description: description || null,
        responsibilities: JSON.stringify(responsibilities),
        boundaries: JSON.stringify(boundaries),
        requiredSkills: JSON.stringify(skills),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-roles"] });
      setShowAdd(false);
      resetForm();
      toast({ title: "岗位已创建" });
    },
    onError: (err: Error) => {
      toast({ title: "创建失败", description: err.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingRole) return;
      await apiRequest("PATCH", `/api/job-roles/${editingRole.id}`, {
        title,
        description: description || null,
        deptId: deptId ? Number(deptId) : null,
        responsibilities: JSON.stringify(responsibilities),
        boundaries: JSON.stringify(boundaries),
        requiredSkills: JSON.stringify(skills),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-roles"] });
      setEditingRole(null);
      resetForm();
      toast({ title: "岗位已更新" });
    },
    onError: (err: Error) => {
      toast({ title: "更新失败", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/job-roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-roles"] });
      toast({ title: "岗位已删除" });
    },
    onError: (err: Error) => {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    },
  });

  const isEditing = !!editingRole;
  const formOpen = showAdd || isEditing;

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">岗位定义</h2>
        <Button onClick={() => { resetForm(); setShowAdd(true); }} data-testid="btn-add-jobrole">
          <Plus className="w-4 h-4 mr-1" />
          新建岗位
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="divide-y" data-testid="jobrole-list">
            {jobRoles.length === 0 && (
              <div className="p-4 text-center text-muted-foreground">暂无岗位定义</div>
            )}
            {jobRoles.map((role) => {
              const resp = parseJsonArray(role.responsibilities);
              return (
                <div
                  key={role.id}
                  className="p-4 space-y-2"
                  data-testid={`jobrole-item-${role.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{role.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {role.deptId ? deptMap.get(role.deptId)?.name ?? "" : ""}
                        {role.description ? ` — ${role.description}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(role)}
                        data-testid={`btn-edit-jobrole-${role.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(`确定删除岗位「${role.title}」吗？`)) {
                            deleteMutation.mutate(role.id);
                          }
                        }}
                        data-testid={`btn-delete-jobrole-${role.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {resp.slice(0, 3).map((r, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{r}</Badge>
                    ))}
                    {resp.length > 3 && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        +{resp.length - 3}项
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            setShowAdd(false);
            setEditingRole(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="modal-jobrole">
          <DialogHeader>
            <DialogTitle>{isEditing ? "编辑岗位" : "新建岗位"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (isEditing) editMutation.mutate();
              else addMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>岗位名称 *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                data-testid="input-jobrole-title"
              />
            </div>
            <div className="space-y-2">
              <Label>岗位描述</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="input-jobrole-description"
              />
            </div>
            <div className="space-y-2">
              <Label>所属部门</Label>
              <Select value={deptId} onValueChange={setDeptId}>
                <SelectTrigger data-testid="select-jobrole-dept">
                  <SelectValue placeholder="选择部门" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={String(dept.id)}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TagListEditor
              label="核心职责"
              items={responsibilities}
              onChange={setResponsibilities}
              placeholder="添加职责条目"
            />
            <TagListEditor
              label="职责边界（不负责的事）"
              items={boundaries}
              onChange={setBoundaries}
              placeholder="添加边界条目"
            />
            <TagListEditor
              label="所需技能"
              items={skills}
              onChange={setSkills}
              placeholder="添加技能"
            />

            <Button
              type="submit"
              className="w-full"
              disabled={addMutation.isPending || editMutation.isPending}
              data-testid="btn-submit-jobrole"
            >
              {(addMutation.isPending || editMutation.isPending) ? "提交中..." : isEditing ? "更新" : "创建"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface JoinRequest {
  id: number;
  orgId: number;
  userId: number;
  message: string | null;
  inviteCode: string | null;
  status: string;
  reviewedBy: number | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  user: { id: number; displayName: string; email: string; avatarUrl: string | null };
}

function RequestsTab({
  orgId,
  toast,
}: {
  orgId: number | null | undefined;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [rejectTarget, setRejectTarget] = useState<JoinRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: pendingData, isLoading: pendingLoading, error: pendingError } = useQuery<{ data: JoinRequest[] }>({
    queryKey: ["/api/organizations", orgId, "join-requests", "pending"],
    queryFn: () => apiRequest("GET", `/api/organizations/${orgId}/join-requests?status=pending`).then(r => r.json()),
    enabled: !!orgId,
  });

  const { data: allData, isLoading: allLoading } = useQuery<{ data: JoinRequest[] }>({
    queryKey: ["/api/organizations", orgId, "join-requests", "all"],
    queryFn: () => apiRequest("GET", `/api/organizations/${orgId}/join-requests`).then(r => r.json()),
    enabled: !!orgId && historyOpen,
  });

  const pending = pendingData?.data ?? [];
  const history = (allData?.data ?? []).filter(r => r.status !== "pending");

  const approveMutation = useMutation({
    mutationFn: async (requestId: number) => {
      await apiRequest("PUT", `/api/organizations/${orgId}/join-requests/${requestId}`, { status: "approved" });
    },
    onSuccess: (_data, _vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", orgId, "join-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "已批准加入申请" });
    },
    onError: (err: Error) => {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reviewNote }: { requestId: number; reviewNote?: string }) => {
      await apiRequest("PUT", `/api/organizations/${orgId}/join-requests/${requestId}`, {
        status: "rejected",
        reviewNote: reviewNote || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", orgId, "join-requests"] });
      setRejectTarget(null);
      setRejectNote("");
      toast({ title: "已拒绝加入申请" });
    },
    onError: (err: Error) => {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    },
  });

  return (
    <>
      <h2 className="text-lg font-semibold">加入申请</h2>

      {pendingError ? (
        <Card className="p-6">
          <div className="text-center text-destructive" data-testid="error-requests">
            加载失败：{(pendingError as Error).message}
          </div>
        </Card>
      ) : pendingLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <Card className="p-8">
          <div className="flex flex-col items-center text-muted-foreground gap-2" data-testid="empty-requests">
            <Inbox className="w-10 h-10 opacity-40" />
            <span>暂无待审批的加入申请</span>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {pending.map((req) => (
            <Card key={req.id} className="p-4" data-testid={`request-card-${req.id}`}>
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={req.user.avatarUrl ?? undefined} />
                  <AvatarFallback>{req.user.displayName?.charAt(0)?.toUpperCase() ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold truncate" data-testid={`request-name-${req.id}`}>{req.user.displayName}</span>
                    <span className="text-sm text-muted-foreground truncate">{req.user.email}</span>
                  </div>
                  {req.message && (
                    <p className="text-sm italic text-muted-foreground mt-1" data-testid={`request-message-${req.id}`}>{req.message}</p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatRelativeTime(req.createdAt)}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate(req.id)}
                    disabled={approveMutation.isPending}
                    data-testid={`btn-approve-${req.id}`}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    批准
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRejectTarget(req)}
                    disabled={rejectMutation.isPending}
                    data-testid={`btn-reject-${req.id}`}
                  >
                    <X className="w-4 h-4 mr-1" />
                    拒绝
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="gap-1 text-muted-foreground" data-testid="btn-toggle-history">
            <ChevronDown className={`w-4 h-4 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
            已处理的申请
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-2">
          {allLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground pl-2">暂无已处理的申请</p>
          ) : (
            history.map((req) => (
              <Card key={req.id} className="p-3" data-testid={`history-card-${req.id}`}>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={req.user.avatarUrl ?? undefined} />
                    <AvatarFallback>{req.user.displayName?.charAt(0)?.toUpperCase() ?? "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{req.user.displayName}</span>
                      <Badge
                        variant={req.status === "approved" ? "default" : "destructive"}
                        className="text-xs"
                        data-testid={`history-status-${req.id}`}
                      >
                        {req.status === "approved" ? "已批准" : "已拒绝"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatRelativeTime(req.reviewedAt || req.createdAt)}
                      {req.reviewNote && <span className="ml-2 italic">{req.reviewNote}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectNote(""); } }}>
        <DialogContent data-testid="modal-reject">
          <DialogHeader>
            <DialogTitle>拒绝加入申请</DialogTitle>
            <DialogDescription>
              确定拒绝 {rejectTarget?.user.displayName} 的加入申请吗？可以填写拒绝原因（可选）。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="拒绝原因（可选）"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            data-testid="input-reject-note"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectNote(""); }} data-testid="btn-cancel-reject">
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectTarget) {
                  rejectMutation.mutate({ requestId: rejectTarget.id, reviewNote: rejectNote || undefined });
                }
              }}
              disabled={rejectMutation.isPending}
              data-testid="btn-confirm-reject"
            >
              {rejectMutation.isPending ? "处理中..." : "确认拒绝"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface InviteCodeData {
  inviteCode: string;
  createdAt: string;
  maxUses: number | null;
  usedCount: number;
}

function InviteTab({
  orgId,
  userRole,
  toast,
}: {
  orgId: number | null | undefined;
  userRole: string | undefined;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [copied, setCopied] = useState(false);
  const [showRegenDialog, setShowRegenDialog] = useState(false);
  const isOwner = userRole === "owner";

  const { data: inviteData, isLoading, error: inviteError } = useQuery<{ data: InviteCodeData }>({
    queryKey: ["/api/organizations", orgId, "invite-code"],
    queryFn: () => apiRequest("GET", `/api/organizations/${orgId}/invite-code`).then(r => r.json()),
    enabled: !!orgId,
  });

  const inviteCode = inviteData?.data;

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/organizations/${orgId}/invite-code/regenerate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", orgId, "invite-code"] });
      setShowRegenDialog(false);
      toast({ title: "邀请码已重新生成" });
    },
    onError: (err: Error) => {
      toast({ title: "生成失败", description: err.message, variant: "destructive" });
    },
  });

  async function handleCopy() {
    if (!inviteCode?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode.inviteCode);
      setCopied(true);
      toast({ title: "已复制到剪贴板" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "复制失败", variant: "destructive" });
    }
  }

  return (
    <>
      <h2 className="text-lg font-semibold">邀请码</h2>

      {inviteError ? (
        <Card className="p-6">
          <div className="text-center text-destructive" data-testid="error-invite">
            加载失败：{(inviteError as Error).message}
          </div>
        </Card>
      ) : isLoading ? (
        <Card className="p-8">
          <Skeleton className="h-12 w-48 mx-auto" />
        </Card>
      ) : !inviteCode ? (
        <Card className="p-8">
          <div className="text-center text-muted-foreground" data-testid="no-invite-code">
            暂无邀请码
            {isOwner && (
              <Button
                variant="outline"
                className="ml-3"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
                data-testid="btn-generate-code"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                生成邀请码
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-6 space-y-4">
          <div className="text-center space-y-3">
            <div
              className="font-mono text-3xl tracking-wider text-center select-all"
              data-testid="text-invite-code"
            >
              {inviteCode.inviteCode}
            </div>
            <Button variant="outline" size="sm" onClick={handleCopy} data-testid="btn-copy-code">
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? "已复制" : "复制邀请码"}
            </Button>
          </div>

          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span data-testid="text-invite-created">创建于 {new Date(inviteCode.createdAt).toLocaleDateString("zh-CN")}</span>
            <span data-testid="text-invite-usage">
              已使用 {inviteCode.usedCount}{inviteCode.maxUses ? `/${inviteCode.maxUses}` : ""} 次
            </span>
          </div>

          {isOwner && (
            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => setShowRegenDialog(true)}
                data-testid="btn-regenerate-code"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                重新生成
              </Button>
            </div>
          )}

          <p className="text-sm text-muted-foreground text-center">
            将邀请码分享给同事，他们在注册后输入即可申请加入你的组织。
          </p>
        </Card>
      )}

      <Dialog open={showRegenDialog} onOpenChange={setShowRegenDialog}>
        <DialogContent data-testid="modal-regenerate">
          <DialogHeader>
            <DialogTitle>重新生成邀请码</DialogTitle>
            <DialogDescription>
              重新生成后旧邀请码将立即失效，确定吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenDialog(false)} data-testid="btn-cancel-regen">
              取消
            </Button>
            <Button
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              data-testid="btn-confirm-regen"
            >
              {regenerateMutation.isPending ? "生成中..." : "确认生成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}