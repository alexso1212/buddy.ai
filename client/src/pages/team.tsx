import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, Department } from "@shared/schema";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

type Tab = "members" | "departments";

export default function Team() {
  const [activeTab, setActiveTab] = useState<Tab>("members");
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddDept, setShowAddDept] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const { toast } = useToast();

  const { data: usersData, isLoading: usersLoading } = useQuery<{ data: User[] }>({
    queryKey: ["/api/users"],
  });

  const { data: deptsData, isLoading: deptsLoading } = useQuery<{ data: Department[] }>({
    queryKey: ["/api/departments"],
  });

  const users = usersData?.data ?? [];
  const departments = deptsData?.data ?? [];

  const deptMap = new Map(departments.map((d) => [d.id, d]));

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
      <h1 className="text-2xl font-bold" data-testid="team-title">团队管理</h1>

      <div className="flex gap-2">
        <Button
          variant={activeTab === "members" ? "default" : "outline"}
          onClick={() => setActiveTab("members")}
          data-testid="tab-members"
        >
          成员列表
        </Button>
        <Button
          variant={activeTab === "departments" ? "default" : "outline"}
          onClick={() => setActiveTab("departments")}
          data-testid="tab-departments"
        >
          部门管理
        </Button>
      </div>

      {activeTab === "members" && (
        <MembersTab
          users={users}
          departments={departments}
          deptMap={deptMap}
          isLoading={usersLoading || deptsLoading}
          showAddUser={showAddUser}
          setShowAddUser={setShowAddUser}
          toast={toast}
        />
      )}

      {activeTab === "departments" && (
        <DepartmentsTab
          departments={departments}
          deptTree={deptTree}
          isLoading={deptsLoading}
          showAddDept={showAddDept}
          setShowAddDept={setShowAddDept}
          editingDept={editingDept}
          setEditingDept={setEditingDept}
          toast={toast}
        />
      )}
    </div>
  );
}

function MembersTab({
  users,
  departments,
  deptMap,
  isLoading,
  showAddUser,
  setShowAddUser,
  toast,
}: {
  users: User[];
  departments: Department[];
  deptMap: Map<number, Department>;
  isLoading: boolean;
  showAddUser: boolean;
  setShowAddUser: (v: boolean) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [deptId, setDeptId] = useState<string>("");

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

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">成员列表</h2>
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
          <Table data-testid="user-table">
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>部门</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                  <TableCell>{user.displayName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.deptId ? deptMap.get(user.deptId)?.name ?? "-" : "-"}
                  </TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>{user.isActive ? "活跃" : "停用"}</TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    暂无成员
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

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
}: {
  departments: Department[];
  deptTree: Array<Department & { level: number }>;
  isLoading: boolean;
  showAddDept: boolean;
  setShowAddDept: (v: boolean) => void;
  editingDept: Department | null;
  setEditingDept: (v: Department | null) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
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
            {deptTree.map((dept) => (
              <div
                key={dept.id}
                className="flex items-center justify-between p-3"
                style={{ paddingLeft: `${dept.level * 24 + 12}px` }}
                data-testid={`dept-item-${dept.id}`}
              >
                <div>
                  <div className="font-medium">{dept.name}</div>
                  {dept.description && (
                    <div className="text-sm text-muted-foreground">{dept.description}</div>
                  )}
                </div>
                <div className="flex gap-1">
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
            ))}
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