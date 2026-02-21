import { useState, useMemo, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn, getStatusColor, getStatusLabel, getPriorityLabel, getDeadlineInfo } from "@/lib/utils";
import type { Task, Phase, User } from "@shared/schema";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  LogOut, Lock, Save, ExternalLink, RefreshCw, Bell, MessageSquare, Paperclip,
  Plus, Trash2, BarChart3, Award, Zap, Download, X, ChevronDown, ChevronRight,
  CheckSquare, Send
} from "lucide-react";

type AssigneeMap = Record<string, User[]>;
interface TasksResponse { tasks: Task[]; assigneeMap: AssigneeMap; }
interface NotifData { notifications: Array<{ id: number; user_id: string; task_id: string | null; type: string; title: string; content: string | null; is_read: boolean; created_at: string | null }>; unreadCount: number; }
interface CommentData { id: number; task_id: string; user_id: string; content: string; created_at: string | null; }
interface AttachmentData { id: number; task_id: string; user_id: string; filename: string; filepath: string; filesize: number | null; mime_type: string | null; created_at: string | null; }

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: notifData, isLoading } = useQuery<NotifData>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

  const markReadMut = useMutation({
    mutationFn: async (id: number) => { await apiRequest("PATCH", `/api/notifications/${id}/read`, {}); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markAllReadMut = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/notifications/read-all", {}); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const unread = notifData?.unreadCount ?? 0;
  const notifs = notifData?.notifications ?? [];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "deadline": case "overdue": return "text-red-500";
      case "urge": return "text-orange-500";
      case "comment": return "text-blue-500";
      case "unblock": return "text-green-500";
      case "status": return "text-purple-500";
      case "eval": return "text-indigo-500";
      default: return "text-muted-foreground";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center" data-testid="badge-unread-count">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">通知</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => markAllReadMut.mutate()} data-testid="button-mark-all-read">
              全部已读
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">暂无通知</p>
          ) : (
            <div className="divide-y">
              {notifs.map((n) => (
                <div
                  key={n.id}
                  className={cn("px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors", !n.is_read && "bg-primary/5")}
                  onClick={() => { if (!n.is_read) markReadMut.mutate(n.id); }}
                  data-testid={`notif-item-${n.id}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", !n.is_read ? "bg-primary" : "bg-transparent")} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs leading-relaxed", getTypeIcon(n.type))}>{n.title}</p>
                      {n.content && <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.content}</p>}
                      {n.created_at && <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString("zh-CN")}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function CommentSection({ taskId, allUsers }: { taskId: string; allUsers: User[] }) {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState("");

  const { data: cmts = [] } = useQuery<CommentData[]>({
    queryKey: ["/api/tasks", taskId, "comments"],
  });

  const addCommentMut = useMutation({
    mutationFn: async (content: string) => { await apiRequest("POST", `/api/tasks/${taskId}/comments`, { content }); },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "comments"] });
    },
  });

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">评论 ({cmts.length})</span>
      </div>
      {cmts.length > 0 && (
        <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
          {cmts.map((c) => {
            const u = allUsers.find((u) => u.id === c.user_id);
            return (
              <div key={c.id} className="flex gap-2" data-testid={`comment-${c.id}`}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white shrink-0" style={{ backgroundColor: u?.color ?? "#888" }}>
                  {(u?.name ?? "?")[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{u?.name ?? "未知"}</span>
                    {c.created_at && <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString("zh-CN")}</span>}
                  </div>
                  <p className="text-xs text-foreground mt-0.5">{c.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="添加评论..."
          className="text-xs resize-none"
          rows={1}
          data-testid={`input-comment-${taskId}`}
        />
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0"
          disabled={!newComment.trim() || addCommentMut.isPending}
          onClick={() => addCommentMut.mutate(newComment.trim())}
          data-testid={`button-send-comment-${taskId}`}
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function SubtaskSection({ taskId, allTasks }: { taskId: string; allTasks: Task[] }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const { data: subtasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks", taskId, "subtasks"],
  });

  const canManage = user && (user.role === "ceo" || user.role === "admin" || user.role === "head");

  const toggleMut = useMutation({
    mutationFn: async ({ subId, done }: { subId: string; done: boolean }) => {
      await apiRequest("PATCH", `/api/tasks/${taskId}/subtasks/${subId}`, { status: done ? "done" : "pending" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "subtasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (err: Error) => toast({ title: "更新失败", description: err.message, variant: "destructive" }),
  });

  const addMut = useMutation({
    mutationFn: async (title: string) => { await apiRequest("POST", `/api/tasks/${taskId}/subtasks`, { title }); },
    onSuccess: () => {
      setNewSubtaskTitle("");
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "subtasks"] });
    },
    onError: (err: Error) => toast({ title: "添加失败", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (subId: string) => { await apiRequest("DELETE", `/api/tasks/${taskId}/subtasks/${subId}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "subtasks"] }),
    onError: (err: Error) => toast({ title: "删除失败", description: err.message, variant: "destructive" }),
  });

  const doneCount = subtasks.filter((s) => s.status === "done").length;

  if (subtasks.length === 0 && !canManage) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <CheckSquare className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">子任务 ({doneCount}/{subtasks.length})</span>
        </div>
        {canManage && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowAdd(!showAdd)} data-testid={`button-add-subtask-${taskId}`}>
            <Plus className="w-3 h-3 mr-1" /> 添加
          </Button>
        )}
      </div>
      {subtasks.length > 0 && (
        <div className="space-y-1">
          {subtasks.map((st) => (
            <div key={st.id} className="flex items-center gap-2 group" data-testid={`subtask-${st.id}`}>
              <Checkbox
                checked={st.status === "done"}
                onCheckedChange={(checked) => toggleMut.mutate({ subId: st.id, done: !!checked })}
                data-testid={`checkbox-subtask-${st.id}`}
              />
              <span className={cn("text-xs flex-1", st.status === "done" && "line-through text-muted-foreground")}>{st.title}</span>
              {canManage && (
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteMut.mutate(st.id)} data-testid={`button-delete-subtask-${st.id}`}>
                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {showAdd && (
        <div className="flex gap-2 mt-2">
          <Input
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            placeholder="子任务标题"
            className="text-xs"
            onKeyDown={(e) => { if (e.key === "Enter" && newSubtaskTitle.trim()) addMut.mutate(newSubtaskTitle.trim()); }}
            data-testid={`input-new-subtask-${taskId}`}
          />
          <Button size="sm" className="text-xs" disabled={!newSubtaskTitle.trim()} onClick={() => addMut.mutate(newSubtaskTitle.trim())} data-testid={`button-confirm-subtask-${taskId}`}>
            确定
          </Button>
        </div>
      )}
    </div>
  );
}

function AttachmentSection({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: atts = [] } = useQuery<AttachmentData[]>({
    queryKey: ["/api/tasks", taskId, "attachments"],
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/tasks/${taskId}/attachments`, { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "attachments"] });
      toast({ title: "文件已上传" });
    },
    onError: (err: Error) => toast({ title: "上传失败", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/attachments/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "attachments"] }),
    onError: (err: Error) => toast({ title: "删除失败", description: err.message, variant: "destructive" }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast({ title: "文件过大", description: "最大支持20MB", variant: "destructive" });
        return;
      }
      uploadMut.mutate(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">附件 ({atts.length})</span>
        </div>
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploadMut.isPending} data-testid={`button-upload-${taskId}`}>
          <Plus className="w-3 h-3 mr-1" /> {uploadMut.isPending ? "上传中..." : "上传"}
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} data-testid={`input-file-${taskId}`} />
      </div>
      {atts.length > 0 && (
        <div className="space-y-1">
          {atts.map((att) => (
            <div key={att.id} className="flex items-center gap-2 group text-xs" data-testid={`attachment-${att.id}`}>
              <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{att.filename}</span>
              <span className="text-muted-foreground shrink-0">{formatSize(att.filesize)}</span>
              <a href={`/api/attachments/${att.id}/download`} className="shrink-0" data-testid={`button-download-${att.id}`}>
                <Download className="w-3 h-3 text-muted-foreground hover:text-foreground" />
              </a>
              {(att.user_id === user?.id || user?.role === "ceo" || user?.role === "admin") && (
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => deleteMut.mutate(att.id)} data-testid={`button-delete-attachment-${att.id}`}>
                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task, assignees, allTasks, onClick,
}: {
  task: Task; assignees: User[]; allTasks: Task[]; onClick: () => void;
}) {
  const priority = getPriorityLabel(task.priority ?? 0);
  const deadlineInfo = task.deadline ? getDeadlineInfo(task.deadline, task.grace_deadline) : null;

  const isBlocked = useMemo(() => {
    if (!task.depends_on) return false;
    return task.depends_on.split(",").map((s) => s.trim()).filter(Boolean).some((id) => {
      const dep = allTasks.find((t) => t.id === id);
      return !dep || dep.status !== "done";
    });
  }, [task.depends_on, allTasks]);

  return (
    <Card className={cn("p-3 cursor-pointer hover-elevate", task.parent_id && "ml-6")} onClick={onClick} data-testid={`card-task-${task.id}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          {isBlocked && <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <span className="text-sm font-medium truncate" data-testid={`text-title-${task.id}`}>{task.title}</span>
          {priority && <Badge className={cn("no-default-active-elevate text-xs", priority.color)} variant="secondary">{priority.label}</Badge>}
        </div>
        <Badge className={cn("no-default-active-elevate shrink-0", getStatusColor(task.status ?? "pending"))} variant="secondary">{getStatusLabel(task.status ?? "pending")}</Badge>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {assignees.map((u) => (
            <div key={u.id} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: u.color ?? "#888" }} />
              <span className="text-xs text-muted-foreground">{u.name}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {task.deliverable && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{task.deliverable}</span>}
          {deadlineInfo && <span className={cn("text-xs", deadlineInfo.color)}>{deadlineInfo.text}</span>}
        </div>
      </div>
    </Card>
  );
}

function TaskDetailDialog({
  task, assignees, allTasks, allUsers, open, onOpenChange,
}: {
  task: Task; assignees: User[]; allTasks: Task[]; allUsers: User[]; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [feishuLink, setFeishuLink] = useState(task.feishu_link ?? "");
  const [feishuDirty, setFeishuDirty] = useState(false);

  const { data: logs } = useQuery<Array<{ id: number; task_id: string; user_id: string | null; action: string; old_value: string | null; new_value: string | null; created_at: string | null }>>({
    queryKey: ["/api/tasks", task.id, "logs"],
    enabled: open,
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => { await apiRequest("PATCH", `/api/tasks/${task.id}`, { status: newStatus }); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "状态已更新" });
    },
    onError: (err: Error) => toast({ title: "更新失败", description: err.message, variant: "destructive" }),
  });

  const feishuMutation = useMutation({
    mutationFn: async (link: string) => { await apiRequest("PATCH", `/api/tasks/${task.id}`, { feishu_link: link }); },
    onSuccess: () => { setFeishuDirty(false); queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }); toast({ title: "飞书链接已保存" }); },
    onError: (err: Error) => toast({ title: "保存失败", description: err.message, variant: "destructive" }),
  });

  const urgeMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", `/api/tasks/${task.id}/urge`, {}); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", task.id, "logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "催办已发送" });
    },
    onError: (err: Error) => toast({ title: "催办失败", description: err.message, variant: "destructive" }),
  });

  const isBlocked = useMemo(() => {
    if (!task.depends_on) return false;
    return task.depends_on.split(",").map((s) => s.trim()).filter(Boolean).some((id) => {
      const dep = allTasks.find((t) => t.id === id);
      return !dep || dep.status !== "done";
    });
  }, [task.depends_on, allTasks]);

  const depTasks = useMemo(() => {
    if (!task.depends_on) return [];
    return task.depends_on.split(",").map((s) => s.trim()).filter(Boolean).map((id) => allTasks.find((t) => t.id === id)).filter(Boolean) as Task[];
  }, [task.depends_on, allTasks]);

  const canChangeStatus = useMemo(() => {
    if (!user) return false;
    if (user.role === "ceo" || user.role === "admin") return true;
    const isAssignee = assignees.some((a) => a.id === user.id);
    if (user.role === "head") return isAssignee || assignees.some((a) => a.dept === user.dept);
    return isAssignee;
  }, [user, assignees]);

  const canUrge = user && (user.role === "ceo" || user.role === "admin") && task.status !== "done";
  const reviewer = allUsers.find((u) => u.id === task.reviewer_id);
  const deadlineInfo = task.deadline ? getDeadlineInfo(task.deadline, task.grace_deadline) : null;

  const getNextAction = () => {
    switch (task.status) {
      case "pending": return { label: "开始任务", next: "active" };
      case "active": return { label: "提交审核", next: "review" };
      case "review": return { label: "标记完成", next: "done" };
      case "done": return { label: "重新打开", next: "pending" };
      default: return { label: "开始任务", next: "active" };
    }
  };

  const action = getNextAction();
  const isStartBlocked = task.status === "pending" && isBlocked;

  const getLogLabel = (a: string) => {
    switch (a) {
      case "status_change": return "状态变更";
      case "urge": return "催办";
      case "system_urge": return "系统催办";
      case "auto_unblock": return "自动解锁";
      case "sync_update": return "同步更新";
      case "comment": return "评论";
      default: return a;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-xl" data-testid={`text-detail-title-${task.id}`}>{task.title}</DialogTitle>
            {canUrge && (
              <Button variant="outline" size="sm" className="shrink-0 text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => urgeMutation.mutate()} disabled={urgeMutation.isPending} data-testid={`button-urge-${task.id}`}>
                <Zap className="w-3.5 h-3.5 mr-1" /> {urgeMutation.isPending ? "催办中..." : "催办"}
              </Button>
            )}
          </div>
          <DialogDescription className="sr-only">任务详情</DialogDescription>
        </DialogHeader>

        {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">状态:</span>
              <Badge className={cn("no-default-active-elevate", getStatusColor(task.status ?? "pending"))} variant="secondary">{getStatusLabel(task.status ?? "pending")}</Badge>
            </div>
            {canChangeStatus && (
              <Button size="sm" disabled={isStartBlocked || statusMutation.isPending} onClick={() => statusMutation.mutate(action.next)} data-testid={`button-status-${task.id}`}>
                {statusMutation.isPending ? "处理中..." : action.label}
              </Button>
            )}
          </div>

          {isStartBlocked && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-2 rounded-md">
              <Lock className="w-4 h-4" /><span>前置任务未完成，无法开始</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-muted-foreground">负责人</span>
              <div className="flex flex-col gap-1 mt-1">
                {assignees.map((u) => (
                  <div key={u.id} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: u.color ?? "#888" }} />
                    <span className="text-sm">{u.name}</span>
                  </div>
                ))}
                {assignees.length === 0 && <span className="text-sm text-muted-foreground">未分配</span>}
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">审核人</span>
              {reviewer ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: reviewer.color ?? "#888" }} />
                  <span className="text-sm">{reviewer.name}</span>
                </div>
              ) : <p className="text-sm text-muted-foreground mt-1">未指定</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-muted-foreground">截止日期</span>
              {deadlineInfo ? (
                <p className={cn("text-sm mt-1", deadlineInfo.color)}>{task.deadline} ({deadlineInfo.text})</p>
              ) : <p className="text-sm text-muted-foreground mt-1">未设置</p>}
            </div>
            {task.grace_deadline && (
              <div>
                <span className="text-xs text-muted-foreground">宽限截止</span>
                <p className="text-sm mt-1">{task.grace_deadline}</p>
              </div>
            )}
          </div>

          {task.deliverable && (
            <div>
              <span className="text-xs text-muted-foreground">交付物</span>
              <p className="text-sm mt-1">{task.deliverable}</p>
            </div>
          )}

          <div>
            <span className="text-xs text-muted-foreground">飞书链接</span>
            <div className="flex items-center gap-2 mt-1">
              <Input value={feishuLink} onChange={(e) => { setFeishuLink(e.target.value); setFeishuDirty(true); }} placeholder="粘贴飞书文档链接" data-testid={`input-feishu-${task.id}`} />
              {feishuDirty && <Button size="icon" variant="ghost" onClick={() => feishuMutation.mutate(feishuLink)} disabled={feishuMutation.isPending} data-testid={`button-save-feishu-${task.id}`}><Save /></Button>}
              {task.feishu_link && !feishuDirty && <Button size="icon" variant="ghost" asChild><a href={task.feishu_link} target="_blank" rel="noopener noreferrer" data-testid={`link-feishu-${task.id}`}><ExternalLink /></a></Button>}
            </div>
          </div>

          {depTasks.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">依赖任务</span>
              <div className="flex flex-col gap-1 mt-1">
                {depTasks.map((dep) => (
                  <div key={dep.id} className="flex items-center gap-2">
                    <Badge className={cn("no-default-active-elevate text-xs", getStatusColor(dep.status ?? "pending"))} variant="secondary">{getStatusLabel(dep.status ?? "pending")}</Badge>
                    <span className="text-sm">{dep.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!task.parent_id && <SubtaskSection taskId={task.id} allTasks={allTasks} />}

          <AttachmentSection taskId={task.id} />

          <CommentSection taskId={task.id} allUsers={allUsers} />

          {logs && logs.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">操作日志</span>
              <div className="mt-2 space-y-2">
                {logs.map((log) => {
                  const logUser = allUsers.find((u) => u.id === log.user_id);
                  return (
                    <div key={log.id} className="flex items-start gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                      <div>
                        <span className="font-medium">{logUser?.name ?? "系统"}</span>
                        <span className="text-muted-foreground ml-1">{getLogLabel(log.action)}</span>
                        {log.old_value && log.new_value && <span className="text-muted-foreground ml-1">{getStatusLabel(log.old_value)} → {getStatusLabel(log.new_value)}</span>}
                        {!log.old_value && log.new_value && log.action !== "status_change" && <span className="text-muted-foreground ml-1">{log.new_value}</span>}
                        {log.created_at && <span className="text-muted-foreground ml-2">{new Date(log.created_at).toLocaleString("zh-CN")}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PhaseSection({
  phase, tasks, assigneeMap, allTasks, allUsers, selectedTask, onSelectTask, defaultCollapsed = false,
}: {
  phase: Phase; tasks: Task[]; assigneeMap: AssigneeMap; allTasks: Task[]; allUsers: User[]; selectedTask: Task | null; onSelectTask: (task: Task | null) => void; defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const parentTasks = tasks.filter((t) => !t.parent_id);
  const subtasks = tasks.filter((t) => t.parent_id);

  return (
    <div className="mb-6">
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 rounded-md mb-2 flex-wrap cursor-pointer select-none"
        style={{ backgroundColor: phase.color ? `${phase.color}20` : undefined, borderLeft: `3px solid ${phase.color ?? "hsl(var(--primary))"}` }}
        onClick={() => setCollapsed(!collapsed)}
        data-testid={`toggle-phase-${phase.id}`}
      >
        <div className="flex items-center gap-1.5">
          {collapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          <span className="font-medium text-sm">{phase.label}</span>
          <span className="text-xs text-muted-foreground">({tasks.length})</span>
        </div>
        {phase.date_range && <span className="text-xs text-muted-foreground">{phase.date_range}</span>}
      </div>
      {!collapsed && (
        <div className="space-y-2">
          {parentTasks.map((task) => (
            <div key={task.id}>
              <TaskCard task={task} assignees={assigneeMap[task.id] ?? []} allTasks={allTasks} onClick={() => onSelectTask(task)} />
              {subtasks.filter((st) => st.parent_id === task.id).map((st) => (
                <TaskCard key={st.id} task={st} assignees={assigneeMap[st.id] ?? []} allTasks={allTasks} onClick={() => onSelectTask(st)} />
              ))}
            </div>
          ))}
          {parentTasks.length === 0 && subtasks.length === 0 && <p className="text-sm text-muted-foreground py-2 px-3">暂无任务</p>}
        </div>
      )}
      {selectedTask && tasks.some((t) => t.id === selectedTask.id) && (
        <TaskDetailDialog task={selectedTask} assignees={assigneeMap[selectedTask.id] ?? []} allTasks={allTasks} allUsers={allUsers} open={true} onOpenChange={(o) => { if (!o) onSelectTask(null); }} />
      )}
    </div>
  );
}

function PersonSectionList({
  users, grouped, assigneeMap, allTasks, allUsers, selectedTask, onSelectTask,
}: {
  users: User[]; grouped: Record<string, Task[]>; assigneeMap: AssigneeMap; allTasks: Task[]; allUsers: User[]; selectedTask: Task | null; onSelectTask: (task: Task | null) => void;
}) {
  return (
    <>
      {users.map((u) => {
        const userTasks = grouped[u.id] ?? [];
        if (userTasks.length === 0) return null;
        return <PersonSection key={u.id} user={u} tasks={userTasks} assigneeMap={assigneeMap} allTasks={allTasks} allUsers={allUsers} selectedTask={selectedTask} onSelectTask={onSelectTask} />;
      })}
    </>
  );
}

function PersonSection({
  user, tasks, assigneeMap, allTasks, allUsers, selectedTask, onSelectTask,
}: {
  user: User; tasks: Task[]; assigneeMap: AssigneeMap; allTasks: Task[]; allUsers: User[]; selectedTask: Task | null; onSelectTask: (task: Task | null) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="mb-6">
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-md mb-2 bg-muted/50 cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
        data-testid={`toggle-person-${user.id}`}
      >
        {collapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: user.color ?? "#888" }} />
        <span className="font-medium text-sm">{user.name}</span>
        {user.title && <span className="text-xs text-muted-foreground">{user.title}</span>}
        <span className="text-xs text-muted-foreground">({tasks.length})</span>
      </div>
      {!collapsed && (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} assignees={assigneeMap[task.id] ?? []} allTasks={allTasks} onClick={() => onSelectTask(task)} />
          ))}
        </div>
      )}
      {selectedTask && tasks.some((t) => t.id === selectedTask.id) && (
        <TaskDetailDialog task={selectedTask} assignees={assigneeMap[selectedTask.id] ?? []} allTasks={allTasks} allUsers={allUsers} open={true} onOpenChange={(o) => { if (!o) onSelectTask(null); }} />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("all");

  if (!user) { setLocation("/"); return null; }

  const isCeoOrAdmin = user.role === "ceo" || user.role === "admin";

  const { data: myData, isLoading: myLoading } = useQuery<TasksResponse>({ queryKey: ["/api/tasks?view=mine"] });
  const { data: allData, isLoading: allLoading } = useQuery<TasksResponse>({ queryKey: ["/api/tasks?view=all"] });
  const { data: peopleData, isLoading: peopleLoading } = useQuery<TasksResponse>({ queryKey: ["/api/tasks?view=people"], enabled: isCeoOrAdmin });
  const { data: phasesData } = useQuery<Phase[]>({ queryKey: ["/api/phases"] });
  const { data: usersData } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const phases = phasesData ?? [];
  const allUsers = usersData ?? [];

  const groupByPhase = (tasks: Task[]) => {
    const grouped: Record<string, Task[]> = {};
    for (const p of phases) grouped[p.id] = [];
    grouped["_none"] = [];
    for (const t of tasks) {
      const key = t.phase && grouped[t.phase] !== undefined ? t.phase : "_none";
      grouped[key].push(t);
    }
    return grouped;
  };

  const filteredAllTasks = useMemo(() => {
    if (!allData) return [];
    let filtered = allData.tasks;
    if (statusFilter !== "all") filtered = filtered.filter((t) => t.status === statusFilter);
    if (personFilter !== "all") filtered = filtered.filter((t) => (allData.assigneeMap[t.id] ?? []).some((a) => a.id === personFilter));
    return filtered;
  }, [allData, statusFilter, personFilter]);

  const groupByPerson = (tasks: Task[], aMap: AssigneeMap) => {
    const grouped: Record<string, Task[]> = {};
    for (const u of allUsers) grouped[u.id] = [];
    for (const t of tasks) {
      const assignees = aMap[t.id] ?? [];
      if (assignees.length === 0) {
        if (!grouped["_unassigned"]) grouped["_unassigned"] = [];
        grouped["_unassigned"].push(t);
      } else {
        for (const a of assignees) {
          if (!grouped[a.id]) grouped[a.id] = [];
          grouped[a.id].push(t);
        }
      }
    }
    return grouped;
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-3 border-b bg-background" data-testid="header">
        <h1 className="text-lg font-bold tracking-tight">德湃任务中心</h1>
        <div className="flex items-center gap-2">
          {isCeoOrAdmin && (
            <Link href="/overview">
              <Button variant="ghost" size="sm" data-testid="link-overview">
                <BarChart3 className="w-4 h-4 mr-1" /> 概览
              </Button>
            </Link>
          )}
          {isCeoOrAdmin && (
            <Link href="/evaluation">
              <Button variant="ghost" size="sm" data-testid="link-evaluation">
                <Award className="w-4 h-4 mr-1" /> 考核
              </Button>
            </Link>
          )}
          {user.role === "ceo" && (
            <Link href="/sync">
              <Button variant="ghost" size="sm" data-testid="link-sync">
                <RefreshCw className="w-4 h-4 mr-1" /> 同步
              </Button>
            </Link>
          )}
          <NotificationBell />
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: user.color ?? "#888" }} />
            <span className="text-sm font-medium" data-testid="text-username">{user.name}</span>
          </div>
          <Button size="icon" variant="ghost" onClick={() => logout()} data-testid="button-logout"><LogOut /></Button>
        </div>
      </header>

      <Tabs defaultValue="mine" className="flex flex-col flex-1 min-h-0">
        <div className="px-4 pt-3">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="mine" data-testid="tab-mine">我的任务</TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">全部任务</TabsTrigger>
            {isCeoOrAdmin && <TabsTrigger value="people" data-testid="tab-people">人员视图</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="mine" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {myLoading ? <LoadingSkeleton /> : !myData || myData.tasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-12" data-testid="text-empty-mine">暂无任务</p>
              ) : (() => {
                const grouped = groupByPhase(myData.tasks);
                const allTasksList = myData.tasks;
                return (
                  <>
                    {phases.map((phase) => grouped[phase.id]?.length ? (
                      <PhaseSection key={phase.id} phase={phase} tasks={grouped[phase.id]} assigneeMap={myData.assigneeMap} allTasks={allTasksList} allUsers={allUsers} selectedTask={selectedTask} onSelectTask={setSelectedTask} />
                    ) : null)}
                    {grouped["_none"]?.length > 0 && (
                      <PhaseSection phase={{ id: "_none", label: "未分类", date_range: null, color: "#888", sort_order: 999 }} tasks={grouped["_none"]} assigneeMap={myData.assigneeMap} allTasks={allTasksList} allUsers={allUsers} selectedTask={selectedTask} onSelectTask={setSelectedTask} />
                    )}
                  </>
                );
              })()}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="all" className="flex-1 min-h-0">
          <div className="flex items-center gap-2 px-4 py-2 border-b flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px]" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待开始</SelectItem>
                <SelectItem value="active">进行中</SelectItem>
                <SelectItem value="review">审核中</SelectItem>
                <SelectItem value="done">已完成</SelectItem>
              </SelectContent>
            </Select>
            <Select value={personFilter} onValueChange={setPersonFilter}>
              <SelectTrigger className="w-[120px]" data-testid="select-person-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部人员</SelectItem>
                {allUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="h-full">
            <div className="p-4">
              {allLoading ? <LoadingSkeleton /> : filteredAllTasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-12" data-testid="text-empty-all">暂无任务</p>
              ) : (() => {
                const grouped = groupByPhase(filteredAllTasks);
                const allTasksList = allData?.tasks ?? [];
                const aMap = allData?.assigneeMap ?? {};
                return (
                  <>
                    {phases.map((phase) => grouped[phase.id]?.length ? (
                      <PhaseSection key={phase.id} phase={phase} tasks={grouped[phase.id]} assigneeMap={aMap} allTasks={allTasksList} allUsers={allUsers} selectedTask={selectedTask} onSelectTask={setSelectedTask} defaultCollapsed={true} />
                    ) : null)}
                    {grouped["_none"]?.length > 0 && (
                      <PhaseSection phase={{ id: "_none", label: "未分类", date_range: null, color: "#888", sort_order: 999 }} tasks={grouped["_none"]} assigneeMap={aMap} allTasks={allTasksList} allUsers={allUsers} selectedTask={selectedTask} onSelectTask={setSelectedTask} defaultCollapsed={true} />
                    )}
                  </>
                );
              })()}
            </div>
          </ScrollArea>
        </TabsContent>

        {isCeoOrAdmin && (
          <TabsContent value="people" className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                {peopleLoading ? <LoadingSkeleton /> : !peopleData || peopleData.tasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12" data-testid="text-empty-people">暂无任务</p>
                ) : (() => {
                  const grouped = groupByPerson(peopleData.tasks, peopleData.assigneeMap);
                  return (
                    <>
                      <PersonSectionList users={allUsers} grouped={grouped} assigneeMap={peopleData.assigneeMap} allTasks={peopleData.tasks} allUsers={allUsers} selectedTask={selectedTask} onSelectTask={setSelectedTask} />
                      {grouped["_unassigned"]?.length > 0 && (
                        <PersonSection
                          user={{ id: "_unassigned", name: "未分配", role: "staff", invite_code: "", title: null, department: null, color: "#888" } as User}
                          tasks={grouped["_unassigned"]}
                          assigneeMap={peopleData.assigneeMap}
                          allTasks={peopleData.tasks}
                          allUsers={allUsers}
                          selectedTask={selectedTask}
                          onSelectTask={setSelectedTask}
                        />
                      )}
                    </>
                  );
                })()}
              </div>
            </ScrollArea>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
