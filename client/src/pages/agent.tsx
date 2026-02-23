import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AiMessageBubble from "@/components/ai/AiMessageBubble";
import AiInputBar from "@/components/ai/AiInputBar";
import { Trash2, ListPlus, BarChart3, Users, CheckSquare, Plus, ArrowLeft, MessageSquare, Archive, MoreHorizontal, Pencil, X, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import AgentLogo from "@/components/AgentLogo";
import ThinkingAnimation from "@/components/ThinkingAnimation";

interface ActionPayload {
  actionType: string;
  data: Record<string, any>;
  summary: string;
  confidence?: number;
  missingFields?: string[];
  followUpQuestion?: string;
}

interface FollowUpData {
  message: string;
  creationType?: 'task' | 'project';
  partialData: Record<string, any>;
  steps?: {
    step: number;
    field: string;
    icon: string;
    label: string;
    options: { label: string; value: any; description?: string; icon?: string }[];
    allowCustomInput: boolean;
    customInputPlaceholder?: string;
    allowSkip: boolean;
    skipValue?: any;
    inputType?: 'text' | 'date' | 'textarea';
  }[];
  currentStep?: number;
  questions?: {
    field: string;
    label: string;
    emoji: string;
    options: { label: string; value: any }[];
    allowCustom?: boolean;
  }[];
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  type?: "text" | "confirm" | "multi_confirm" | "follow_up";
  action?: ActionPayload;
  actions?: ActionPayload[];
  confirmed?: boolean | null;
  actionConfirmed?: (boolean | null)[];
  skipped?: boolean;
  actionSkipped?: boolean[];
  followUp?: FollowUpData;
  followUpSubmitted?: boolean;
}

interface Conversation {
  id: number;
  orgId: number;
  userId: number | null;
  title: string;
  starred: boolean;
  projectId: number | null;
  projectName: string | null;
  visibility: string;
  systemPrompt: string | null;
  isArchived: boolean;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const SUGGESTIONS = [
  { text: "创建新任务", icon: ListPlus },
  { text: "查看项目进度", icon: BarChart3 },
  { text: "分析团队负载", icon: Users },
  { text: "查询待办事项", icon: CheckSquare },
];

let msgCounter = 0;
function nextId() {
  return `msg-${++msgCounter}-${Date.now()}`;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function groupConversationsByDate(conversations: Conversation[]): { label: string; items: Conversation[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);

  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const earlier: Conversation[] = [];

  for (const conv of conversations) {
    const d = new Date(conv.updatedAt);
    if (d >= todayStart) {
      today.push(conv);
    } else if (d >= yesterdayStart) {
      yesterday.push(conv);
    } else {
      earlier.push(conv);
    }
  }

  const groups: { label: string; items: Conversation[] }[] = [];
  if (today.length > 0) groups.push({ label: "今天", items: today });
  if (yesterday.length > 0) groups.push({ label: "昨天", items: yesterday });
  if (earlier.length > 0) groups.push({ label: "更早", items: earlier });
  return groups;
}

function ConversationItem({
  conv,
  onSelect,
  onArchive,
  onRename,
  onDelete,
}: {
  conv: Conversation;
  onSelect: (id: number) => void;
  onArchive: (id: number) => void;
  onRename: (id: number, title: string) => void;
  onDelete: (id: number) => void;
}) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(conv.title);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const diffX = touchStartX.current - e.touches[0].clientX;
    const diffY = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (diffY > 30) return;
    if (diffX > 0) {
      setSwipeOffset(Math.min(diffX, 80));
    } else {
      setSwipeOffset(0);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeOffset >= 60) {
      setSwiped(true);
      setSwipeOffset(80);
    } else {
      setSwiped(false);
      setSwipeOffset(0);
    }
  }, [swipeOffset]);

  const handleClick = useCallback(() => {
    if (swiped) {
      setSwiped(false);
      setSwipeOffset(0);
      return;
    }
    if (isRenaming) return;
    onSelect(conv.id);
  }, [swiped, isRenaming, onSelect, conv.id]);

  const startRename = useCallback(() => {
    setRenameValue(conv.title);
    setIsRenaming(true);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }, [conv.title]);

  const confirmRename = useCallback(() => {
    if (cancellingRef.current) return;
    if (renameValue.trim() && renameValue.trim() !== conv.title) {
      onRename(conv.id, renameValue.trim());
    }
    setIsRenaming(false);
  }, [renameValue, conv.title, conv.id, onRename]);

  const cancellingRef = useRef(false);

  const cancelRename = useCallback(() => {
    cancellingRef.current = true;
    setRenameValue(conv.title);
    setIsRenaming(false);
    setTimeout(() => { cancellingRef.current = false; }, 50);
  }, [conv.title]);

  return (
    <div
      className="relative overflow-hidden group"
      data-testid={`conv-item-${conv.id}`}
    >
      {/* Swipe-to-reveal actions (mobile only) */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center md:hidden"
        style={{ width: 80 }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onArchive(conv.id); }}
          className="flex items-center justify-center gap-1 h-full w-full text-[var(--text-secondary)] text-xs"
          style={{ background: 'var(--bg-tertiary, hsl(var(--muted)))' }}
          data-testid={`btn-archive-swipe-${conv.id}`}
        >
          <Archive className="w-4 h-4" strokeWidth={1.5} />
          <span>归档</span>
        </button>
      </div>

      <div
        className="relative bg-[var(--bg-primary,hsl(var(--background)))] px-3 py-2.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-lg mx-2 my-0.5"
        style={{
          transform: `translateX(${-swipeOffset}px)`,
          transition: swipeOffset === 0 || swiped ? 'transform 200ms ease' : 'none',
        }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        data-testid={`conv-row-${conv.id}`}
      >
        <div className="flex items-center justify-between gap-2">
          {isRenaming ? (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmRename();
                  if (e.key === 'Escape') cancelRename();
                }}
                onBlur={confirmRename}
                className="text-sm bg-transparent border-b border-[var(--text-secondary)] text-[var(--text-primary)] outline-none flex-1 min-w-0 py-0.5"
                data-testid={`conv-rename-input-${conv.id}`}
              />
            </div>
          ) : (
            <span
              className="text-sm text-[var(--text-primary)] truncate flex-1"
              data-testid={`conv-title-${conv.id}`}
            >
              {conv.title}
            </span>
          )}
          <div className="flex items-center shrink-0">
            {!isRenaming && (
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="items-center justify-center w-7 h-7 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors hidden md:flex opacity-0 group-hover:opacity-100"
                    data-testid={`btn-conv-menu-${conv.id}`}
                  >
                    <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  className="w-44 border-white/10 rounded-xl shadow-xl p-1"
                  style={{ background: 'rgba(45,44,40,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
                  data-testid={`conv-menu-${conv.id}`}
                >
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); startRename(); }}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#e5e5e5] rounded-lg cursor-pointer hover:bg-white/10 focus:bg-white/10"
                    data-testid={`btn-rename-${conv.id}`}
                  >
                    <Pencil className="w-4 h-4" strokeWidth={1.5} />
                    重命名
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onArchive(conv.id); }}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#e5e5e5] rounded-lg cursor-pointer hover:bg-white/10 focus:bg-white/10"
                    data-testid={`btn-archive-${conv.id}`}
                  >
                    <Archive className="w-4 h-4" strokeWidth={1.5} />
                    归档
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#3a3a3a] my-1" />
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#ef4444] rounded-lg cursor-pointer hover:bg-white/10 focus:bg-white/10"
                    data-testid={`btn-delete-${conv.id}`}
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConversationListView({
  onSelectConversation,
  onNewConversation,
}: {
  onSelectConversation: (id: number) => void;
  onNewConversation: () => void;
}) {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ data: Conversation[] }>({
    queryKey: ['/api/conversations'],
  });

  const conversations = (data?.data || []).filter(c => !c.isArchived);

  const handleArchive = useCallback(async (id: number) => {
    try {
      await apiRequest("PATCH", `/api/conversations/${id}`, { isArchived: true });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({ title: "对话已归档" });
    } catch (err: any) {
      toast({ title: "归档失败", description: err.message, variant: "destructive" });
    }
  }, [toast]);

  const handleRename = useCallback(async (id: number, title: string) => {
    try {
      await apiRequest("PATCH", `/api/conversations/${id}`, { title });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({ title: "已重命名" });
    } catch (err: any) {
      toast({ title: "重命名失败", description: err.message, variant: "destructive" });
    }
  }, [toast]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await apiRequest("DELETE", `/api/conversations/${id}`);
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({ title: "对话已删除" });
    } catch (err: any) {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    }
  }, [toast]);

  const groups = groupConversationsByDate(conversations);

  return (
    <div className="flex flex-col h-full" data-testid="conversation-list-view">
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-medium text-sm transition-colors"
          style={{ background: 'var(--brand)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-hover, var(--brand))'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--brand)'; }}
          data-testid="btn-new-conversation"
        >
          <Plus className="w-4 h-4" />
          新对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" data-testid="conversation-list">
        {isLoading ? (
          <div className="flex items-center justify-center py-16" data-testid="conversations-loading">
            <ThinkingAnimation size={36} label="加载中" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3" data-testid="conversations-empty">
            <MessageSquare className="w-10 h-10 text-[var(--text-secondary)] opacity-30" />
            <span className="text-sm text-[var(--text-secondary)]">暂无对话</span>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} data-testid={`conv-group-${group.label}`}>
              <div className="px-4 pt-4 pb-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]" data-testid={`conv-group-label-${group.label}`}>
                  {group.label}
                </span>
              </div>
              {group.items.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  onSelect={onSelectConversation}
                  onArchive={handleArchive}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Agent() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const activeConvId = params.get('conv') ? parseInt(params.get('conv')!) : null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationHistory = useRef<{ role: string; content: string }[]>([]);
  const [activeConvSystemPrompt, setActiveConvSystemPrompt] = useState<string | undefined>();
  const [convTitle, setConvTitle] = useState<string>("");
  const [showChat, setShowChat] = useState(false);

  const isDetailView = activeConvId !== null || messages.length > 0 || showChat;

  useEffect(() => {
    if (!activeConvId) {
      if (!showChat) {
        setMessages([]);
        conversationHistory.current = [];
        setActiveConvSystemPrompt(undefined);
        setConvTitle("");
      }
      return;
    }

    setMessagesLoading(true);
    (async () => {
      try {
        const convRes = await fetch(`/api/conversations/${activeConvId}`);
        const convJson = await convRes.json();
        if (convJson.data?.systemPrompt) {
          setActiveConvSystemPrompt(convJson.data.systemPrompt);
        } else {
          setActiveConvSystemPrompt(undefined);
        }
        if (convJson.data?.title) {
          setConvTitle(convJson.data.title);
        }

        const res = await fetch(`/api/conversations/${activeConvId}/messages`);
        const json = await res.json();
        const dbMessages: any[] = json.data || [];

        const converted: Message[] = dbMessages.map(m => {
          const base: Message = {
            id: `db-${m.id}`,
            role: m.role as any,
            content: m.content,
            type: (m.type || 'text') as any,
          };
          if (m.metadata) {
            try {
              const meta = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata;
              if (meta.action) base.action = meta.action;
              if (meta.actions) base.actions = meta.actions;
              if (meta.followUp) base.followUp = meta.followUp;
              if (meta.confirmed !== undefined) base.confirmed = meta.confirmed;
              if (meta.actionConfirmed) base.actionConfirmed = meta.actionConfirmed;
              if (meta.actionSkipped) base.actionSkipped = meta.actionSkipped;
              if (meta.followUpSubmitted) base.followUpSubmitted = meta.followUpSubmitted;
              if (meta.skipped) base.skipped = meta.skipped;
            } catch {}
          }
          return base;
        });

        setMessages(converted);

        conversationHistory.current = converted
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: m.content }));
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setMessagesLoading(false);
      }
    })();
  }, [activeConvId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const saveMessageToDB = useCallback(async (conversationId: number, msg: Message) => {
    try {
      const metadata: Record<string, any> = {};
      if (msg.action) metadata.action = msg.action;
      if (msg.actions) metadata.actions = msg.actions;
      if (msg.followUp) metadata.followUp = msg.followUp;
      if (msg.confirmed !== undefined) metadata.confirmed = msg.confirmed;
      if (msg.actionConfirmed) metadata.actionConfirmed = msg.actionConfirmed;
      if (msg.actionSkipped) metadata.actionSkipped = msg.actionSkipped;
      if (msg.followUpSubmitted) metadata.followUpSubmitted = msg.followUpSubmitted;
      if (msg.skipped) metadata.skipped = msg.skipped;

      await apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
        role: msg.role,
        content: msg.content,
        type: msg.type || 'text',
        metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
      });
    } catch (err) {
      console.error('Failed to save message:', err);
    }
  }, []);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    conversationHistory.current = [];
    navigate('/agent', { replace: true });
  }, [navigate]);

  const handleSend = useCallback(
    async (text: string) => {
      let convId = activeConvId;

      const userMsg: Message = {
        id: nextId(),
        role: "user",
        content: text,
        type: "text",
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      conversationHistory.current.push({ role: "user", content: text });

      try {
        const res = await apiRequest("POST", "/api/ai/chat", {
          message: text,
          conversationHistory: conversationHistory.current,
          conversationId: convId || undefined,
          currentUserId: 1,
          systemPrompt: activeConvSystemPrompt || undefined,
        });
        const json = await res.json();
        const data = json.data;

        if (data.conversationId && !convId) {
          convId = data.conversationId;
          const title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
          setConvTitle(title);
          navigate(`/agent?conv=${convId}`, { replace: true });
          queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
        }

        if (convId) {
          saveMessageToDB(convId, userMsg);
        }

        let assistantContent = "";
        if (data.type === "text") {
          assistantContent = data.message || "";
        } else if (data.type === "confirm" && data.action) {
          assistantContent = data.action.followUpQuestion || data.action.summary || "";
        } else if (data.type === "multi_confirm" && data.actions) {
          assistantContent = data.message || data.actions.map((a: ActionPayload) => a.summary).join("\n");
        } else if (data.type === "follow_up" && data.followUp) {
          assistantContent = data.followUp.message || "";
        }

        conversationHistory.current.push({
          role: "assistant",
          content: assistantContent,
        });

        const assistantMsg: Message = {
          id: nextId(),
          role: "assistant",
          content: assistantContent,
          type: data.type,
          action: data.action,
          actions: data.actions,
          followUp: data.followUp,
          confirmed: data.type === "confirm" ? null : undefined,
          actionConfirmed: data.type === "multi_confirm" && data.actions
            ? data.actions.map(() => null)
            : undefined,
          actionSkipped: data.type === "multi_confirm" && data.actions
            ? data.actions.map(() => false)
            : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (convId) saveMessageToDB(convId, assistantMsg);
      } catch (err: any) {
        const errorMsg: Message = {
          id: nextId(),
          role: "system",
          content: err.message || "请求失败，请稍后重试",
        };
        setMessages((prev) => [...prev, errorMsg]);
        if (convId) saveMessageToDB(convId, errorMsg);
      } finally {
        setLoading(false);
      }
    },
    [activeConvId, activeConvSystemPrompt, saveMessageToDB, navigate]
  );

  const handleConfirm = useCallback(
    async (messageId: string, actionIndex?: number) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;

      let action: ActionPayload | undefined;
      if (msg.type === "multi_confirm" && msg.actions && actionIndex !== undefined) {
        action = msg.actions[actionIndex];
      } else {
        action = msg.action;
      }
      if (!action) return;

      try {
        const res = await apiRequest("POST", "/api/ai/confirm", {
          actionType: action.actionType,
          data: action.data,
          currentUserId: 1,
          conversationId: activeConvId || undefined,
        });
        const json = await res.json();
        const result = json.data;

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            if (m.type === "multi_confirm" && actionIndex !== undefined && m.actionConfirmed) {
              const updated = [...m.actionConfirmed];
              updated[actionIndex] = true;
              return { ...m, actionConfirmed: updated };
            }
            return { ...m, confirmed: true };
          })
        );

        const sysMsg: Message = {
          id: nextId(),
          role: "system",
          content: result.message,
        };
        setMessages((prev) => [...prev, sysMsg]);
        if (activeConvId) saveMessageToDB(activeConvId, sysMsg);

        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stats/overview"] });
      } catch (err: any) {
        const sysMsg: Message = {
          id: nextId(),
          role: "system",
          content: err.message || "执行失败，请重试",
        };
        setMessages((prev) => [...prev, sysMsg]);
        if (activeConvId) saveMessageToDB(activeConvId, sysMsg);
      }
    },
    [messages, activeConvId, saveMessageToDB]
  );

  const handleReject = useCallback((messageId: string, actionIndex?: number) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        if (m.type === "multi_confirm" && actionIndex !== undefined && m.actionConfirmed) {
          const updated = [...m.actionConfirmed];
          updated[actionIndex] = false;
          return { ...m, actionConfirmed: updated };
        }
        return { ...m, confirmed: false };
      })
    );
    const sysMsg: Message = {
      id: nextId(),
      role: "system",
      content: "已取消操作",
    };
    setMessages((prev) => [...prev, sysMsg]);
    if (activeConvId) saveMessageToDB(activeConvId, sysMsg);
  }, [activeConvId, saveMessageToDB]);

  const handleSkip = useCallback((messageId: string, actionIndex?: number) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        if (m.type === "multi_confirm" && actionIndex !== undefined && m.actionConfirmed && m.actionSkipped) {
          const updatedConfirm = [...m.actionConfirmed];
          const updatedSkip = [...m.actionSkipped];
          updatedConfirm[actionIndex] = false;
          updatedSkip[actionIndex] = true;
          return { ...m, actionConfirmed: updatedConfirm, actionSkipped: updatedSkip };
        }
        return { ...m, confirmed: false, skipped: true };
      })
    );
    const sysMsg: Message = {
      id: nextId(),
      role: "system",
      content: "已跳过，该任务不会创建",
    };
    setMessages((prev) => [...prev, sysMsg]);
    if (activeConvId) saveMessageToDB(activeConvId, sysMsg);
  }, [activeConvId, saveMessageToDB]);

  const handleFollowUpSubmit = useCallback(
    async (messageId: string, mergedData: Record<string, any>, creationType?: string) => {
      console.log('[handleFollowUpSubmit] 收到数据:', JSON.stringify(mergedData, null, 2));
      console.log('[handleFollowUpSubmit] 创建类型:', creationType);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, followUpSubmitted: true } : m
        )
      );

      let chatMessage: string;
      if (creationType === 'task') {
        chatMessage = `用户已通过引导式创建填写完所有信息，请直接生成确认卡片（不要再追问）。创建类型: 任务。数据: ${JSON.stringify(mergedData)}`;
      } else if (creationType === 'project') {
        chatMessage = `用户已通过引导式创建填写完所有信息，请直接生成确认卡片（不要再追问）。创建类型: 项目。数据: ${JSON.stringify(mergedData)}`;
      } else {
        chatMessage = `用户已选择完成信息，请直接用这些数据创建确认卡片（不要再追问）：${JSON.stringify(mergedData)}`;
      }

      conversationHistory.current.push({
        role: "user",
        content: chatMessage,
      });

      setLoading(true);
      try {
        const res = await apiRequest("POST", "/api/ai/chat", {
          message: chatMessage,
          conversationHistory: conversationHistory.current,
          conversationId: activeConvId || undefined,
          currentUserId: 1,
          systemPrompt: activeConvSystemPrompt || undefined,
        });
        const json = await res.json();
        const data = json.data;
        console.log('[handleFollowUpSubmit] AI 响应:', data.type, data);

        let assistantContent = "";
        if (data.type === "text") {
          assistantContent = data.message || "";
        } else if (data.type === "confirm" && data.action) {
          assistantContent = data.action.summary || "";
        } else if (data.type === "multi_confirm" && data.actions) {
          assistantContent = data.message || data.actions.map((a: any) => a.summary).join("\n");
        } else if (data.type === "follow_up" && data.followUp) {
          assistantContent = data.followUp.message || "";
        }

        conversationHistory.current.push({
          role: "assistant",
          content: assistantContent,
        });

        const assistantMsg: Message = {
          id: nextId(),
          role: "assistant",
          content: assistantContent,
          type: data.type,
          action: data.action,
          actions: data.actions,
          followUp: data.followUp,
          confirmed: data.type === "confirm" ? null : undefined,
          actionConfirmed: data.type === "multi_confirm" && data.actions
            ? data.actions.map(() => null)
            : undefined,
          actionSkipped: data.type === "multi_confirm" && data.actions
            ? data.actions.map(() => false)
            : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (activeConvId) saveMessageToDB(activeConvId, assistantMsg);
      } catch (err: any) {
        const errorMsg: Message = {
          id: nextId(),
          role: "system",
          content: err.message || "请求失败，请稍后重试",
        };
        setMessages((prev) => [...prev, errorMsg]);
        if (activeConvId) saveMessageToDB(activeConvId, errorMsg);
      } finally {
        setLoading(false);
      }
    },
    [activeConvId, activeConvSystemPrompt, saveMessageToDB]
  );

  const handleBack = useCallback(() => {
    setMessages([]);
    conversationHistory.current = [];
    setConvTitle("");
    setShowChat(false);
    setActiveConvSystemPrompt(undefined);
    navigate('/agent', { replace: true });
  }, [navigate]);

  const handleNewConversation = useCallback(() => {
    setMessages([]);
    conversationHistory.current = [];
    setConvTitle("");
    setActiveConvSystemPrompt(undefined);
    setShowChat(true);
    navigate('/agent', { replace: true });
  }, [navigate]);

  const handleSelectConversation = useCallback((id: number) => {
    setShowChat(true);
    navigate(`/agent?conv=${id}`, { replace: true });
  }, [navigate]);

  const showWelcome = !activeConvId && messages.length === 0;

  if (!isDetailView) {
    return (
      <div className="flex flex-col h-full bg-transparent" data-testid="agent-page">
        <ConversationListView
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-transparent" data-testid="agent-page">
      {activeConvId && (
        <div
          className="flex items-center gap-3 px-3 py-2 shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
          data-testid="chat-header"
        >
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-sm text-[var(--text-secondary)] cursor-pointer"
            data-testid="btn-back"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
          <span
            className="flex-1 text-sm font-medium text-[var(--text-primary)] truncate text-center"
            data-testid="text-conv-title"
          >
            {convTitle}
          </span>
          <div className="w-[52px]" />
        </div>
      )}

      {!activeConvId && messages.length === 0 && (
        <div className="flex items-center px-3 py-2 shrink-0">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-sm text-[var(--text-secondary)] cursor-pointer"
            data-testid="btn-back-list"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
        </div>
      )}

      {showWelcome ? (
        <div className="flex-1 flex flex-col items-center justify-center px-3">
          <div className="flex flex-col items-center gap-4 mb-8">
            <AgentLogo size={80} animate={true} glow={true} />
            <h1 className="font-serif text-2xl text-[var(--text-primary)]" data-testid="text-welcome-heading">有什么可以帮你的？</h1>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full max-w-md">
            {SUGGESTIONS.map((s) => {
              const SIcon = s.icon;
              return (
                <button
                  key={s.text}
                  onClick={() => handleSend(s.text)}
                  className="rounded-card border border-[var(--border-subtle)] hover:bg-black/5 dark:hover:bg-white/5 p-4 cursor-pointer text-left transition-colors"
                  data-testid={`suggestion-${s.text}`}
                >
                  <SIcon className="w-4 h-4 text-[var(--text-secondary)] mb-2" />
                  <span className="text-sm text-[var(--text-primary)]">{s.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : messagesLoading ? (
        <div className="flex-1 flex items-center justify-center" data-testid="messages-loading">
          <ThinkingAnimation size={48} label="加载中" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-4 relative" ref={scrollRef} data-testid="agent-messages" style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}>
          <div className="absolute top-2 right-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              data-testid="btn-clear-chat"
              onClick={handleClearChat}
              className="text-[var(--text-secondary)] no-default-hover-elevate"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <AiMessageBubble
                key={msg.id}
                message={msg}
                onConfirm={handleConfirm}
                onReject={handleReject}
                onSkip={handleSkip}
                onFollowUpSubmit={handleFollowUpSubmit}
              />
            ))}
            {loading && (
              <div className="flex justify-start px-3 mb-6" data-testid="ai-loading">
                <ThinkingAnimation size={36} />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-transparent" data-testid="agent-input">
        <div className="max-w-3xl mx-auto px-3 pb-[env(safe-area-inset-bottom)]">
          <AiInputBar onSend={handleSend} loading={loading} />
        </div>
      </div>
    </div>
  );
}
