import { useState, useMemo, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User, Department, OrgChange } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Building2, Users, Edit2, Check, X, Plus, Trash2,
  Clock, CheckCircle, XCircle, ChevronRight, ChevronDown, UserPlus, Network
} from "lucide-react";

type SafeUser = Omit<User, "invite_code">;

interface DeptTreeNode {
  dept: Department;
  members: SafeUser[];
  children: DeptTreeNode[];
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  dept_create: "新建部门",
  dept_edit: "编辑部门",
  dept_delete: "删除部门",
  head_change: "更换负责人",
  user_move: "人员调动",
  user_edit: "编辑人员",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "待审批", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "已通过", color: "bg-green-100 text-green-800" },
  rejected: { label: "已驳回", color: "bg-red-100 text-red-800" },
};

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
    </div>
  );
}

function DeptCard({ node, users, currentUser, onEditDept, onEditUser, onMoveUser }: {
  node: DeptTreeNode; users: SafeUser[]; currentUser: SafeUser;
  onEditDept: (d: Department) => void; onEditUser: (u: SafeUser) => void; onMoveUser: (u: SafeUser) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const head = users.find((u) => u.id === node.dept.head_id);
  const canEdit = currentUser.role === "ceo" || currentUser.role === "admin";

  return (
    <div className="mb-3" data-testid={`dept-card-${node.dept.id}`}>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)} data-testid={`dept-toggle-${node.dept.id}`}>
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: node.dept.color || "#888" }} />
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{node.dept.name}</span>
              <Badge variant="outline" className="text-xs">{node.members.length}人</Badge>
            </div>
            {head && <p className="text-xs text-muted-foreground mt-0.5">负责人: {head.name}</p>}
          </div>
          {canEdit && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEditDept(node.dept); }} data-testid={`button-edit-dept-${node.dept.id}`}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {expanded && (
          <div className="border-t px-3 pb-3 pt-2">
            {node.members.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">暂无成员</p>
            ) : (
              <div className="space-y-1.5">
                {node.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 group" data-testid={`user-row-${m.id}`}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color ?? "#888" }} />
                    <span className="text-sm font-medium flex-1 min-w-0 truncate">{m.name}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{m.title}</span>
                    {m.id === node.dept.head_id && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">负责人</Badge>}
                    {canEdit && (
                      <div className="hidden group-hover:flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEditUser(m)} data-testid={`button-edit-user-${m.id}`}>
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onMoveUser(m)} data-testid={`button-move-user-${m.id}`}>
                          <UserPlus className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {node.children.length > 0 && expanded && (
        <div className="ml-6 mt-2">
          {node.children.map((child) => (
            <DeptCard key={child.dept.id} node={child} users={users} currentUser={currentUser}
              onEditDept={onEditDept} onEditUser={onEditUser} onMoveUser={onMoveUser} />
          ))}
        </div>
      )}
    </div>
  );
}

function EditDeptDialog({ dept, users, open, onOpenChange }: {
  dept: Department | null; users: SafeUser[]; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [headId, setHeadId] = useState("");
  const { toast } = useToast();

  const isNew = !dept;

  useEffect(() => {
    if (open) {
      if (dept) { setName(dept.name); setColor(dept.color || "#888"); setHeadId(dept.head_id || ""); }
      else { setName(""); setColor("#888888"); setHeadId(""); }
    }
  }, [dept, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20) + "_" + Date.now().toString(36);
        await apiRequest("POST", "/api/departments", { id, name, color, head_id: headId || undefined });
      } else {
        await apiRequest("PATCH", `/api/departments/${dept!.id}`, { name, color, head_id: headId || undefined });
      }
    },
    onSuccess: (_, __, ctx) => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-changes"] });
      toast({ title: "操作成功" });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "操作失败", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-edit-dept">
        <DialogHeader>
          <DialogTitle>{isNew ? "新建部门" : "编辑部门"}</DialogTitle>
          <DialogDescription>{isNew ? "创建一个新的部门" : `编辑 ${dept?.name}`}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">部门名称</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-dept-name" />
          </div>
          <div>
            <label className="text-sm font-medium">颜色</label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">负责人</label>
            <Select value={headId} onValueChange={setHeadId}>
              <SelectTrigger data-testid="select-dept-head"><SelectValue placeholder="选择负责人" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} - {u.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={() => mutation.mutate()} disabled={!name || mutation.isPending} data-testid="button-save-dept">
              {mutation.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ targetUser, departments, open, onOpenChange }: {
  targetUser: SafeUser | null; departments: Department[]; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [color, setColor] = useState("#888");
  const { toast } = useToast();

  useEffect(() => {
    if (open && targetUser) { setTitle(targetUser.title || ""); setColor(targetUser.color || "#888"); }
  }, [targetUser, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!targetUser) return;
      await apiRequest("PATCH", `/api/users/${targetUser.id}`, { title, color });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-changes"] });
      toast({ title: "操作成功" });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "操作失败", description: err.message, variant: "destructive" }),
  });

  if (!targetUser) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-edit-user">
        <DialogHeader>
          <DialogTitle>编辑人员 - {targetUser.name}</DialogTitle>
          <DialogDescription>修改人员信息</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">职位</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-user-title" />
          </div>
          <div>
            <label className="text-sm font-medium">标识颜色</label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-save-user">
              {mutation.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MoveUserDialog({ targetUser, departments, open, onOpenChange }: {
  targetUser: SafeUser | null; departments: Department[]; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const [deptId, setDeptId] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open && targetUser) { setDeptId(targetUser.dept_id || ""); }
  }, [targetUser, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!targetUser) return;
      await apiRequest("PATCH", `/api/users/${targetUser.id}`, { dept_id: deptId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-changes"] });
      toast({ title: "调动成功" });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "操作失败", description: err.message, variant: "destructive" }),
  });

  if (!targetUser) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-move-user">
        <DialogHeader>
          <DialogTitle>人员调动 - {targetUser.name}</DialogTitle>
          <DialogDescription>将 {targetUser.name} 调往其他部门</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">目标部门</label>
            <Select value={deptId} onValueChange={setDeptId}>
              <SelectTrigger data-testid="select-move-dept"><SelectValue placeholder="选择部门" /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={() => mutation.mutate()} disabled={!deptId || mutation.isPending} data-testid="button-confirm-move">
              {mutation.isPending ? "调动中..." : "确认调动"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalCard({ change, users, isCeo }: { change: OrgChange; users: SafeUser[]; isCeo: boolean }) {
  const [note, setNote] = useState("");
  const { toast } = useToast();
  const requester = users.find((u) => u.id === change.requested_by);
  const reviewer = change.reviewed_by ? users.find((u) => u.id === change.reviewed_by) : null;
  const statusInfo = STATUS_LABELS[change.status || "pending"] || STATUS_LABELS.pending;

  const approveMut = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/org-changes/${change.id}`, { status, review_note: note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-changes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "操作成功" });
    },
    onError: (err: Error) => toast({ title: "操作失败", description: err.message, variant: "destructive" }),
  });

  return (
    <Card className="p-3" data-testid={`change-card-${change.id}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
            <span className="text-sm font-medium">{CHANGE_TYPE_LABELS[change.change_type] || change.change_type}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {requester?.name || change.requested_by} · {change.created_at ? new Date(change.created_at).toLocaleString("zh-CN") : ""}
          </p>
          {change.new_value != null && (
            <div className="mt-2 text-xs bg-muted/50 rounded p-2">
              <pre className="whitespace-pre-wrap">{String(JSON.stringify(change.new_value, null, 2))}</pre>
            </div>
          )}
          {reviewer && change.status !== "pending" && (
            <p className="text-xs text-muted-foreground mt-1">
              审批人: {reviewer.name} · {change.reviewed_at ? new Date(change.reviewed_at).toLocaleString("zh-CN") : ""}
            </p>
          )}
          {change.review_note && <p className="text-xs mt-1 italic">"{change.review_note}"</p>}
        </div>
      </div>

      {change.status === "pending" && isCeo && (
        <div className="mt-3 space-y-2 border-t pt-2">
          <Textarea placeholder="审批备注（可选）" value={note} onChange={(e) => setNote(e.target.value)} className="text-sm" rows={2} data-testid={`input-review-note-${change.id}`} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => approveMut.mutate("rejected")} disabled={approveMut.isPending} data-testid={`button-reject-${change.id}`}>
              <XCircle className="w-3.5 h-3.5 mr-1" /> 驳回
            </Button>
            <Button size="sm" onClick={() => approveMut.mutate("approved")} disabled={approveMut.isPending} data-testid={`button-approve-${change.id}`}>
              <CheckCircle className="w-3.5 h-3.5 mr-1" /> 通过
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function Organization() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [showNewDept, setShowNewDept] = useState(false);
  const [editUser, setEditUser] = useState<SafeUser | null>(null);
  const [moveUser, setMoveUser] = useState<SafeUser | null>(null);

  const { data: departments, isLoading: deptsLoading } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: usersData } = useQuery<SafeUser[]>({ queryKey: ["/api/users"] });
  const { data: orgChanges, isLoading: changesLoading } = useQuery<OrgChange[]>({ queryKey: ["/api/org-changes"] });

  if (authLoading) return <LoadingSkeleton />;
  if (!user) { navigate("/"); return null; }
  const isCeo = user.role === "ceo";
  const isCeoOrAdmin = isCeo || user.role === "admin";
  if (!isCeoOrAdmin) { navigate("/dashboard"); return null; }

  const allUsers = usersData || [];
  const allDepts = departments || [];
  const allChanges = orgChanges || [];

  const deptTree = useMemo(() => {
    const nodes: DeptTreeNode[] = allDepts.map((d) => ({
      dept: d,
      members: allUsers.filter((u) => u.dept_id === d.id),
      children: [],
    }));
    const rootNodes: DeptTreeNode[] = [];
    for (const node of nodes) {
      if (node.dept.parent_id) {
        const parent = nodes.find((n) => n.dept.id === node.dept.parent_id);
        if (parent) { parent.children.push(node); continue; }
      }
      rootNodes.push(node);
    }
    return rootNodes;
  }, [allDepts, allUsers]);

  const pendingChanges = allChanges.filter((c) => c.status === "pending");

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center gap-3 px-4 py-3 border-b bg-background" data-testid="org-header">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <Building2 className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold">组织架构</h1>
        <div className="flex-1" />
        {isCeoOrAdmin && (
          <Link href="/collaboration">
            <Button variant="outline" size="sm" data-testid="link-collaboration">
              <Network className="w-4 h-4 mr-1" /> 协作图谱
            </Button>
          </Link>
        )}
        {isCeoOrAdmin && (
          <Button size="sm" onClick={() => setShowNewDept(true)} data-testid="button-new-dept">
            <Plus className="w-4 h-4 mr-1" /> 新建部门
          </Button>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        <Tabs defaultValue="tree" className="flex flex-col h-full">
          <div className="px-4 pt-3">
            <TabsList data-testid="org-tabs">
              <TabsTrigger value="tree" data-testid="tab-tree">
                <Building2 className="w-4 h-4 mr-1" /> 组织树
              </TabsTrigger>
              <TabsTrigger value="approvals" data-testid="tab-approvals">
                <Clock className="w-4 h-4 mr-1" /> 审批
                {pendingChanges.length > 0 && (
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0 h-4">{pendingChanges.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" data-testid="tab-history">
                <CheckCircle className="w-4 h-4 mr-1" /> 变更历史
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="tree" className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-4 max-w-3xl mx-auto">
                {deptsLoading ? <LoadingSkeleton /> : deptTree.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">暂无部门数据</p>
                ) : (
                  deptTree.map((node) => (
                    <DeptCard key={node.dept.id} node={node} users={allUsers} currentUser={user}
                      onEditDept={(d) => setEditDept(d)} onEditUser={(u) => setEditUser(u)} onMoveUser={(u) => setMoveUser(u)} />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="approvals" className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-4 max-w-3xl mx-auto space-y-3">
                {changesLoading ? <LoadingSkeleton /> : pendingChanges.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">暂无待审批变更</p>
                ) : (
                  pendingChanges.map((c) => <ApprovalCard key={c.id} change={c} users={allUsers} isCeo={isCeo} />)
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-4 max-w-3xl mx-auto space-y-3">
                {changesLoading ? <LoadingSkeleton /> : allChanges.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">暂无变更记录</p>
                ) : (
                  allChanges.filter((c) => c.status !== "pending").map((c) => <ApprovalCard key={c.id} change={c} users={allUsers} isCeo={isCeo} />)
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      <EditDeptDialog dept={editDept} users={allUsers} open={!!editDept} onOpenChange={(v) => { if (!v) setEditDept(null); }} />
      <EditDeptDialog dept={null} users={allUsers} open={showNewDept} onOpenChange={setShowNewDept} />
      <EditUserDialog targetUser={editUser} departments={allDepts} open={!!editUser} onOpenChange={(v) => { if (!v) setEditUser(null); }} />
      <MoveUserDialog targetUser={moveUser} departments={allDepts} open={!!moveUser} onOpenChange={(v) => { if (!v) setMoveUser(null); }} />
    </div>
  );
}
