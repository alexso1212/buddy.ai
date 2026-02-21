import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User, Department, OrgChange } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
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

type DeptStats = Record<string, { total: number; active: number; done: number; overdue: number; dueSoon: number }>;

const CHANGE_TYPE_LABELS: Record<string, string> = {
  dept_create: "新建部门",
  dept_edit: "编辑部门",
  dept_delete: "删除部门",
  head_change: "更换负责人",
  user_move: "人员调动",
  user_edit: "编辑人员",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "待审批", color: "bg-amber-500/10 text-amber-600" },
  approved: { label: "已通过", color: "bg-emerald-500/10 text-emerald-600" },
  rejected: { label: "已驳回", color: "bg-red-500/10 text-red-500" },
};

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
    </div>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

function PersonPopover({ person, stats, isCeoOrAdmin, onEditUser }: {
  person: SafeUser;
  stats: DeptStats;
  isCeoOrAdmin: boolean;
  onEditUser: (u: SafeUser) => void;
}) {
  const [, navigate] = useLocation();
  const deptStat = person.dept_id ? stats[person.dept_id] : null;
  const active = deptStat?.active ?? 0;
  const done = deptStat?.done ?? 0;
  const total = active + done || 1;

  return (
    <div className="space-y-3" data-testid={`person-popover-${person.id}`}>
      <div>
        <p className="text-sm font-medium">{person.name}</p>
        <p className="text-xs text-muted-foreground">{person.title || "无职位"}</p>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] text-muted-foreground">所属部门任务概况</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>进行中 {active}</span>
          <span>·</span>
          <span>已完成 {done}</span>
        </div>
        <div className="flex h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="bg-blue-500 transition-all duration-200" style={{ width: `${(active / total) * 100}%` }} />
          <div className="bg-emerald-500 transition-all duration-200" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => navigate(`/dashboard?user=${person.id}`)}
          data-testid={`person-tasks-link-${person.id}`}
        >
          查看任务
        </Button>
        {isCeoOrAdmin && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => onEditUser(person)}
            data-testid={`person-edit-btn-${person.id}`}
          >
            编辑
          </Button>
        )}
      </div>
    </div>
  );
}

function PersonRow({ person, isHead, stats, isCeoOrAdmin, onEditUser }: {
  person: SafeUser;
  isHead: boolean;
  stats: DeptStats;
  isCeoOrAdmin: boolean;
  onEditUser: (u: SafeUser) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className="flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover-elevate transition-all duration-200"
          data-testid={`person-row-${person.id}`}
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: person.color ?? "#888" }} />
          <span className="text-[13px] font-medium flex-1 min-w-0 truncate">{person.name}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">{person.title}</span>
          {isHead && (
            <Badge variant="secondary" className="rounded-full text-xs font-medium border-0">负责人</Badge>
          )}
          {person.role === "ceo" && (
            <Badge className="rounded-full text-xs font-medium border-0 bg-blue-500/10 text-blue-600">CEO</Badge>
          )}
          {person.role === "admin" && (
            <Badge className="rounded-full text-xs font-medium border-0 bg-purple-500/10 text-purple-600">管理员</Badge>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <PersonPopover person={person} stats={stats} isCeoOrAdmin={isCeoOrAdmin} onEditUser={onEditUser} />
      </PopoverContent>
    </Popover>
  );
}

function TreeNode({ node, users, stats, currentUser, isMobile, onEditDept, onEditUser, onMoveUser, isFirst, isLast, depth }: {
  node: DeptTreeNode;
  users: SafeUser[];
  stats: DeptStats;
  currentUser: SafeUser;
  isMobile: boolean;
  onEditDept: (d: Department) => void;
  onEditUser: (u: SafeUser) => void;
  onMoveUser: (u: SafeUser) => void;
  isFirst: boolean;
  isLast: boolean;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"members" | "kpi" | "benefits">("members");
  const canEdit = currentUser.role === "ceo" || currentUser.role === "admin";
  const isCeo = currentUser.role === "ceo";
  const head = users.find((u) => u.id === node.dept.head_id);
  const deptStat = stats[node.dept.id];
  const hasOverdue = deptStat?.overdue && deptStat.overdue > 0;
  const hasDueSoon = deptStat?.dueSoon && deptStat.dueSoon > 0;
  const statusColor = hasOverdue ? "bg-red-500" : hasDueSoon ? "bg-amber-500" : "bg-emerald-500";

  const tabs: { key: "members" | "kpi" | "benefits"; label: string }[] = [
    { key: "members", label: "人员" },
    { key: "kpi", label: "职能&KPI" },
  ];
  if (isCeo) {
    tabs.push({ key: "benefits", label: "利益" });
  }

  if (isMobile) {
    return (
      <div className="relative" data-testid={`tree-node-${node.dept.id}`}>
        {depth > 0 && (
          <div className="absolute left-0 top-0 bottom-0 w-px border-l border-dashed border-border" />
        )}
        <div className={`${depth > 0 ? "ml-4" : ""}`}>
          <div
            className={`bg-card border rounded-lg shadow-sm mb-2 transition-all duration-200 ${node.dept.is_planned ? "border-dashed border-amber-400" : "border-border"}`}
            style={{ borderLeftWidth: "3px", borderLeftColor: node.dept.color || "#888", borderLeftStyle: node.dept.is_planned ? "dashed" : "solid" }}
          >
            <div
              className="flex items-center gap-2 p-3 cursor-pointer"
              onClick={() => setExpanded(!expanded)}
              data-testid={`tree-node-toggle-${node.dept.id}`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{node.dept.name}</span>
                  <Badge variant="outline" className="rounded-full text-xs font-medium border-0">{node.members.length}人</Badge>
                  {node.dept.is_planned && (
                    <Badge className="rounded-full text-xs font-medium border-0 bg-amber-500/10 text-amber-600">待招</Badge>
                  )}
                </div>
                {head && <p className="text-xs text-muted-foreground mt-0.5">{head.name}</p>}
              </div>
              {canEdit && (
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onEditDept(node.dept); }} data-testid={`button-edit-dept-${node.dept.id}`}>
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
              )}
              {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </div>

            {expanded && (
              <div className="border-t px-3 pb-3 pt-2">
                <div className="flex items-center gap-0 border-b border-border mb-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      className={`px-3 py-1.5 text-xs transition-all duration-200 border-b-2 ${activeTab === tab.key ? "border-foreground text-foreground font-medium" : "border-transparent text-muted-foreground"}`}
                      onClick={(e) => { e.stopPropagation(); setActiveTab(tab.key); }}
                      data-testid={`tree-tab-${tab.key}-${node.dept.id}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === "members" && (
                  <div className="space-y-0.5">
                    {node.members.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">暂无成员</p>
                    ) : (
                      node.members.map((m) => (
                        <PersonRow
                          key={m.id}
                          person={m}
                          isHead={m.id === node.dept.head_id}
                          stats={stats}
                          isCeoOrAdmin={canEdit}
                          onEditUser={onEditUser}
                        />
                      ))
                    )}
                  </div>
                )}

                {activeTab === "kpi" && (
                  <div className="space-y-2 text-xs text-muted-foreground">
                    {node.dept.description && (
                      <div>
                        <p className="font-medium text-foreground mb-0.5">职能描述</p>
                        <p>{node.dept.description}</p>
                      </div>
                    )}
                    {node.dept.kpi_description && (
                      <div>
                        <p className="font-medium text-foreground mb-0.5">KPI</p>
                        <p>{node.dept.kpi_description}</p>
                      </div>
                    )}
                    {!node.dept.description && !node.dept.kpi_description && (
                      <p>暂无职能与KPI信息</p>
                    )}
                  </div>
                )}

                {activeTab === "benefits" && isCeo && (
                  <div className="space-y-2 text-xs text-muted-foreground">
                    {node.dept.compensation_note && (
                      <div>
                        <p className="font-medium text-foreground mb-0.5">薪酬说明</p>
                        <p>{node.dept.compensation_note}</p>
                      </div>
                    )}
                    {node.dept.budget_note && (
                      <div>
                        <p className="font-medium text-foreground mb-0.5">预算说明</p>
                        <p>{node.dept.budget_note}</p>
                      </div>
                    )}
                    {!node.dept.compensation_note && !node.dept.budget_note && (
                      <p>暂无利益信息</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {node.children.length > 0 && (
            <div className="relative">
              {node.children.map((child, idx) => (
                <TreeNode
                  key={child.dept.id}
                  node={child}
                  users={users}
                  stats={stats}
                  currentUser={currentUser}
                  isMobile={isMobile}
                  onEditDept={onEditDept}
                  onEditUser={onEditUser}
                  onMoveUser={onMoveUser}
                  isFirst={idx === 0}
                  isLast={idx === node.children.length - 1}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center relative" data-testid={`tree-node-${node.dept.id}`}>
      <div
        className={`bg-card border rounded-lg shadow-sm transition-all duration-200 ${expanded ? "w-[280px]" : "w-[200px]"} ${node.dept.is_planned ? "border-dashed border-amber-400" : "border-border"}`}
        style={{ borderLeftWidth: "3px", borderLeftColor: node.dept.color || "#888", borderLeftStyle: node.dept.is_planned ? "dashed" : "solid" }}
      >
        <div
          className="flex items-center gap-2 p-2.5 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
          data-testid={`tree-node-toggle-${node.dept.id}`}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-medium">{node.dept.name}</span>
              <Badge variant="outline" className="rounded-full text-[10px] font-medium border-0 px-1.5">{node.members.length}人</Badge>
              {node.dept.is_planned && (
                <Badge className="rounded-full text-[10px] font-medium border-0 bg-amber-500/10 text-amber-600 px-1.5">待招</Badge>
              )}
            </div>
            {head && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{head.name}</p>}
          </div>
          {canEdit && (
            <button
              className="p-1 rounded hover-elevate text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); onEditDept(node.dept); }}
              data-testid={`button-edit-dept-${node.dept.id}`}
            >
              <Edit2 className="w-3 h-3" />
            </button>
          )}
        </div>

        {expanded && (
          <div className="border-t px-2.5 pb-2.5 pt-1.5">
            <div className="flex items-center gap-0 border-b border-border mb-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`px-2 py-1 text-[11px] transition-all duration-200 border-b-2 ${activeTab === tab.key ? "border-foreground text-foreground font-medium" : "border-transparent text-muted-foreground"}`}
                  onClick={(e) => { e.stopPropagation(); setActiveTab(tab.key); }}
                  data-testid={`tree-tab-${tab.key}-${node.dept.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "members" && (
              <div className="space-y-0.5">
                {node.members.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-1">暂无成员</p>
                ) : (
                  node.members.map((m) => (
                    <PersonRow
                      key={m.id}
                      person={m}
                      isHead={m.id === node.dept.head_id}
                      stats={stats}
                      isCeoOrAdmin={canEdit}
                      onEditUser={onEditUser}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === "kpi" && (
              <div className="space-y-1.5 text-[11px] text-muted-foreground">
                {node.dept.description && (
                  <div>
                    <p className="font-medium text-foreground mb-0.5">职能描述</p>
                    <p>{node.dept.description}</p>
                  </div>
                )}
                {node.dept.kpi_description && (
                  <div>
                    <p className="font-medium text-foreground mb-0.5">KPI</p>
                    <p>{node.dept.kpi_description}</p>
                  </div>
                )}
                {!node.dept.description && !node.dept.kpi_description && (
                  <p>暂无职能与KPI信息</p>
                )}
              </div>
            )}

            {activeTab === "benefits" && isCeo && (
              <div className="space-y-1.5 text-[11px] text-muted-foreground">
                {node.dept.compensation_note && (
                  <div>
                    <p className="font-medium text-foreground mb-0.5">薪酬说明</p>
                    <p>{node.dept.compensation_note}</p>
                  </div>
                )}
                {node.dept.budget_note && (
                  <div>
                    <p className="font-medium text-foreground mb-0.5">预算说明</p>
                    <p>{node.dept.budget_note}</p>
                  </div>
                )}
                {!node.dept.compensation_note && !node.dept.budget_note && (
                  <p>暂无利益信息</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {node.children.length > 0 && (
        <>
          <div className="w-px h-6 border-l border-border" />
          <div className="relative flex gap-6">
            {node.children.length > 1 && (
              <div
                className="absolute top-0 border-t border-border"
                style={{
                  left: `calc(${(100 / node.children.length) * 0.5}%)`,
                  right: `calc(${(100 / node.children.length) * 0.5}%)`,
                }}
              />
            )}
            {node.children.map((child, idx) => (
              <div key={child.dept.id} className="flex flex-col items-center relative">
                <div className="w-px h-6 border-l border-border" />
                <TreeNode
                  node={child}
                  users={users}
                  stats={stats}
                  currentUser={currentUser}
                  isMobile={false}
                  onEditDept={onEditDept}
                  onEditUser={onEditUser}
                  onMoveUser={onMoveUser}
                  isFirst={idx === 0}
                  isLast={idx === node.children.length - 1}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// TODO: Future DnD - add drag-and-drop for person moves between departments
function OrgTree({ deptTree, users, stats, currentUser, onEditDept, onEditUser, onMoveUser }: {
  deptTree: DeptTreeNode[];
  users: SafeUser[];
  stats: DeptStats;
  currentUser: SafeUser;
  onEditDept: (d: Department) => void;
  onEditUser: (u: SafeUser) => void;
  onMoveUser: (u: SafeUser) => void;
}) {
  const isMobile = useIsMobile();

  if (deptTree.length === 0) {
    return <p className="text-center text-muted-foreground py-12">暂无部门数据</p>;
  }

  if (isMobile) {
    return (
      <div className="space-y-2" data-testid="org-tree-mobile">
        {deptTree.map((node, idx) => (
          <TreeNode
            key={node.dept.id}
            node={node}
            users={users}
            stats={stats}
            currentUser={currentUser}
            isMobile={true}
            onEditDept={onEditDept}
            onEditUser={onEditUser}
            onMoveUser={onMoveUser}
            isFirst={idx === 0}
            isLast={idx === deptTree.length - 1}
            depth={0}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-4" data-testid="org-tree-desktop">
      {deptTree.length === 1 ? (
        <TreeNode
          node={deptTree[0]}
          users={users}
          stats={stats}
          currentUser={currentUser}
          isMobile={false}
          onEditDept={onEditDept}
          onEditUser={onEditUser}
          onMoveUser={onMoveUser}
          isFirst={true}
          isLast={true}
          depth={0}
        />
      ) : (
        <div className="flex gap-8 items-start">
          {deptTree.map((node, idx) => (
            <TreeNode
              key={node.dept.id}
              node={node}
              users={users}
              stats={stats}
              currentUser={currentUser}
              isMobile={false}
              onEditDept={onEditDept}
              onEditUser={onEditUser}
              onMoveUser={onMoveUser}
              isFirst={idx === 0}
              isLast={idx === deptTree.length - 1}
              depth={0}
            />
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
          <DialogTitle className="text-base font-medium">{isNew ? "新建部门" : "编辑部门"}</DialogTitle>
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
          <DialogTitle className="text-base font-medium">编辑人员 - {targetUser.name}</DialogTitle>
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
          <DialogTitle className="text-base font-medium">人员调动 - {targetUser.name}</DialogTitle>
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
    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden p-3" data-testid={`change-card-${change.id}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={`rounded-full text-xs font-medium border-0 ${statusInfo.color}`}>{statusInfo.label}</Badge>
            <span className="text-[13px] font-medium">{CHANGE_TYPE_LABELS[change.change_type] || change.change_type}</span>
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
            <Button size="sm" variant="outline" className="text-[13px]" onClick={() => approveMut.mutate("rejected")} disabled={approveMut.isPending} data-testid={`button-reject-${change.id}`}>
              <XCircle className="w-3.5 h-3.5 mr-1" /> 驳回
            </Button>
            <Button size="sm" className="text-[13px]" onClick={() => approveMut.mutate("approved")} disabled={approveMut.isPending} data-testid={`button-approve-${change.id}`}>
              <CheckCircle className="w-3.5 h-3.5 mr-1" /> 通过
            </Button>
          </div>
        </div>
      )}
    </div>
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
  const { data: deptStats } = useQuery<DeptStats>({ queryKey: ["/api/departments/stats"] });

  if (authLoading) return <LoadingSkeleton />;
  if (!user) { navigate("/"); return null; }
  const isCeo = user.role === "ceo";
  const isCeoOrAdmin = isCeo || user.role === "admin";
  if (!isCeoOrAdmin) { navigate("/dashboard"); return null; }

  const allUsers = usersData || [];
  const allDepts = departments || [];
  const allChanges = orgChanges || [];
  const stats: DeptStats = deptStats || {};

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
    const ceoNode = rootNodes.find((n) => n.dept.id === "ceo_office");
    if (ceoNode) {
      const otherRoots = rootNodes.filter((n) => n.dept.id !== "ceo_office");
      ceoNode.children = [...otherRoots, ...ceoNode.children];
      return [ceoNode];
    }
    return rootNodes;
  }, [allDepts, allUsers]);

  const pendingChanges = allChanges.filter((c) => c.status === "pending");

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border-b bg-background" data-testid="org-header">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <Building2 className="w-4 h-4 md:w-5 md:h-5 text-primary shrink-0" />
        <h1 className="text-[13px] md:text-lg font-medium shrink-0">组织架构</h1>
        <div className="flex-1" />
        {isCeoOrAdmin && (
          <Link href="/collaboration">
            <Button variant="outline" size="sm" className="shrink-0" data-testid="link-collaboration">
              <Network className="w-4 h-4 md:mr-1" /><span className="hidden md:inline">协作图谱</span>
            </Button>
          </Link>
        )}
        {isCeoOrAdmin && (
          <Button size="sm" className="shrink-0" onClick={() => setShowNewDept(true)} data-testid="button-new-dept">
            <Plus className="w-4 h-4 md:mr-1" /><span className="hidden md:inline">新建部门</span>
          </Button>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        <Tabs defaultValue="tree" className="flex flex-col h-full">
          <div className="px-4 pt-3">
            <TabsList className="bg-transparent h-auto p-0 gap-0 rounded-none" data-testid="org-tabs">
              <TabsTrigger value="tree" className="bg-transparent rounded-none border-b-2 border-transparent px-3 py-2.5 text-[13px] font-normal text-muted-foreground data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:border-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent" data-testid="tab-tree">
                <Building2 className="w-4 h-4 mr-1" /> 组织树
              </TabsTrigger>
              <TabsTrigger value="approvals" className="bg-transparent rounded-none border-b-2 border-transparent px-3 py-2.5 text-[13px] font-normal text-muted-foreground data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:border-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent" data-testid="tab-approvals">
                <Clock className="w-4 h-4 mr-1" /> 审批
                {pendingChanges.length > 0 && (
                  <Badge variant="destructive" className="ml-1 rounded-full text-[10px] px-1 py-0 h-4">{pendingChanges.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="bg-transparent rounded-none border-b-2 border-transparent px-3 py-2.5 text-[13px] font-normal text-muted-foreground data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:border-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent" data-testid="tab-history">
                <CheckCircle className="w-4 h-4 mr-1" /> 变更历史
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="tree" className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-4 overflow-x-auto">
                {deptsLoading ? <LoadingSkeleton /> : (
                  <OrgTree
                    deptTree={deptTree}
                    users={allUsers}
                    stats={stats}
                    currentUser={user}
                    onEditDept={(d) => setEditDept(d)}
                    onEditUser={(u) => setEditUser(u)}
                    onMoveUser={(u) => setMoveUser(u)}
                  />
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
