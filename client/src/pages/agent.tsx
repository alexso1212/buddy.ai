import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AiMessageBubble from "@/components/ai/AiMessageBubble";
import AiInputBar from "@/components/ai/AiInputBar";
import type { Attachment } from "@/components/ai/AiInputBar";
import { Trash2, ListPlus, BarChart3, Users, CheckSquare, Plus, ArrowLeft, MessageSquare, Pencil, X, Check, ListFilter, ChevronRight, Search, Star, FolderOpen, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import AgentLogo from "@/components/AgentLogo";
import ThinkingAnimation from "@/components/ThinkingAnimation";
import { useAuth } from "@/lib/auth";

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
  isStreaming?: boolean;
  searchResults?: { title: string; url: string; content: string }[];
  attachments?: { type: string; name: string; mimeType: string; base64: string; previewUrl?: string }[];
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
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} week${Math.floor(diffDay / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDay / 30)} month${Math.floor(diffDay / 30) > 1 ? 's' : ''} ago`;
}

function groupConversationsByDate(conversations: Conversation[]): { label: string; items: Conversation[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 86400000);

  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const prev7: Conversation[] = [];
  const prev30: Conversation[] = [];
  const monthBuckets: Record<string, Conversation[]> = {};

  for (const conv of conversations) {
    const d = new Date(conv.updatedAt);
    if (d >= todayStart) {
      today.push(conv);
    } else if (d >= yesterdayStart) {
      yesterday.push(conv);
    } else if (d >= sevenDaysAgo) {
      prev7.push(conv);
    } else if (d >= thirtyDaysAgo) {
      prev30.push(conv);
    } else {
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      if (!monthBuckets[key]) monthBuckets[key] = [];
      monthBuckets[key].push(conv);
    }
  }

  const groups: { label: string; items: Conversation[] }[] = [];
  if (today.length > 0) groups.push({ label: "Today", items: today });
  if (yesterday.length > 0) groups.push({ label: "Yesterday", items: yesterday });
  if (prev7.length > 0) groups.push({ label: "Previous 7 Days", items: prev7 });
  if (prev30.length > 0) groups.push({ label: "Previous 30 Days", items: prev30 });
  const sortedMonths = Object.keys(monthBuckets).sort((a, b) => {
    const da = new Date(monthBuckets[a][0].updatedAt);
    const db = new Date(monthBuckets[b][0].updatedAt);
    return db.getTime() - da.getTime();
  });
  for (const key of sortedMonths) {
    groups.push({ label: key, items: monthBuckets[key] });
  }
  return groups;
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts: { text: string; match: boolean }[] = [];
  const lower = text.toLowerCase();
  const lowerQ = query.toLowerCase();
  let lastIdx = 0;
  let idx = lower.indexOf(lowerQ);
  while (idx !== -1) {
    if (idx > lastIdx) parts.push({ text: text.slice(lastIdx, idx), match: false });
    parts.push({ text: text.slice(idx, idx + query.length), match: true });
    lastIdx = idx + query.length;
    idx = lower.indexOf(lowerQ, lastIdx);
  }
  if (lastIdx < text.length) parts.push({ text: text.slice(lastIdx), match: false });
  return (
    <>
      {parts.map((p, i) =>
        p.match ? (
          <span key={i} style={{
            background: '#1a1a1a',
            color: '#ffffff',
            padding: '1px 3px',
            borderRadius: 3,
            fontWeight: 500,
          }}>{p.text}</span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

function ConversationItem({
  conv,
  isSelected,
  onSelect,
  onArchive,
  onRename,
  onDelete,
  searchQuery,
}: {
  conv: Conversation & { matchSnippets?: string[] };
  isSelected: boolean;
  onSelect: (id: number) => void;
  onArchive: (id: number) => void;
  onRename: (id: number, title: string) => void;
  onDelete: (id: number) => void;
  searchQuery?: string;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(conv.title);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [highlighted, setHighlighted] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);
  const longPressTriggered = useRef(false);

  const handleClick = useCallback(() => {
    if (isRenaming) return;
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    onSelect(conv.id);
  }, [isRenaming, onSelect, conv.id]);

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

  const closeMenu = useCallback(() => {
    setContextMenu(null);
    setHighlighted(false);
    setTimeout(() => { longPressTriggered.current = false; }, 50);
  }, []);

  const openContextMenu = useCallback((clientX: number, clientY: number) => {
    const rect = itemRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuHeight = 220;
    const menuWidth = 220;
    let x = clientX;
    let y = rect.top - menuHeight - 8;
    if (y < 8) {
      y = rect.bottom + 8;
    }
    if (x + menuWidth > window.innerWidth - 8) {
      x = window.innerWidth - menuWidth - 8;
    }
    if (x < 8) x = 8;
    setHighlighted(true);
    setContextMenu({ x, y });
    navigator.vibrate?.(10);
    if (itemRef.current) {
      itemRef.current.style.transform = 'scale(1.02)';
      setTimeout(() => {
        if (itemRef.current) itemRef.current.style.transform = 'scale(1)';
      }, 150);
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isRenaming) return;
    openContextMenu(e.clientX, e.clientY);
  }, [isRenaming, openContextMenu]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRenaming) return;
    touchMoved.current = false;
    const touch = e.touches[0];
    const tx = touch.clientX;
    const ty = touch.clientY;
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) {
        longPressTriggered.current = true;
        openContextMenu(tx, ty);
      }
    }, 400);
  }, [isRenaming, openContextMenu]);

  const handleTouchMove = useCallback(() => {
    touchMoved.current = true;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (longPressTriggered.current) {
      e.preventDefault();
    }
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const handleScroll = () => closeMenu();
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [contextMenu, closeMenu]);

  const handleStar = useCallback(async () => {
    closeMenu();
    try {
      await apiRequest("PATCH", `/api/conversations/${conv.id}`, { starred: !conv.starred });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    } catch {}
  }, [conv.id, conv.starred, closeMenu]);

  const menuItems = [
    {
      icon: FolderOpen,
      label: "Add to project",
      color: "#ffffff",
      testId: `ctx-add-project-${conv.id}`,
      action: () => { closeMenu(); console.log('Add to project', conv.id); },
    },
    {
      icon: Star,
      label: conv.starred ? "Unstar" : "Star",
      color: "#ffffff",
      testId: `ctx-star-${conv.id}`,
      action: handleStar,
    },
    {
      icon: Pencil,
      label: "Rename",
      color: "#ffffff",
      testId: `ctx-rename-${conv.id}`,
      action: () => { closeMenu(); startRename(); },
    },
    {
      icon: Trash2,
      label: "Delete",
      color: "#ef4444",
      testId: `ctx-delete-${conv.id}`,
      action: () => { closeMenu(); onDelete(conv.id); },
    },
  ];

  return (
    <div
      ref={itemRef}
      className="relative"
      style={{ transition: 'transform 150ms ease' }}
      data-testid={`conv-item-${conv.id}`}
    >
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        role="button"
        tabIndex={0}
        style={{
          width: '100%',
          padding: '16px 16px 16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: highlighted
            ? 'rgba(0,0,0,0.85)'
            : isSelected
              ? 'rgba(255,255,255,0.06)'
              : 'transparent',
          border: isSelected ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
          borderRadius: highlighted ? 16 : isSelected ? 12 : 0,
          margin: isSelected ? '2px 8px' : '0',
          cursor: 'pointer',
          textAlign: 'left' as const,
          transition: 'background 150ms, border-radius 150ms',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        data-testid={`conv-row-${conv.id}`}
      >
        <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
          {isRenaming ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmRename();
                  if (e.key === 'Escape') cancelRename();
                }}
                onBlur={confirmRename}
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontSize: 17,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--text-secondary)',
                  color: '#ECECEC',
                  outline: 'none',
                  width: '100%',
                  padding: '0 0 2px 0',
                }}
                data-testid={`conv-rename-input-${conv.id}`}
              />
            </div>
          ) : (
            <>
              <div style={{
                fontSize: 17,
                fontWeight: 400,
                color: '#ECECEC',
                lineHeight: 1.35,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }} data-testid={`conv-title-${conv.id}`}>
                {searchQuery ? <HighlightText text={conv.title} query={searchQuery} /> : conv.title}
              </div>
              {searchQuery && conv.matchSnippets && conv.matchSnippets.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {conv.matchSnippets.map((snippet, i) => (
                    <div key={i} style={{
                      fontSize: 13,
                      color: '#9A9893',
                      lineHeight: 1.5,
                      marginTop: i > 0 ? 4 : 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }} data-testid={`conv-snippet-${conv.id}-${i}`}>
                      <HighlightText text={snippet} query={searchQuery} />
                    </div>
                  ))}
                </div>
              )}
              <div style={{
                fontSize: 14,
                color: '#7A7874',
                marginTop: 4,
              }} data-testid={`conv-time-${conv.id}`}>
                {formatRelativeTime(conv.updatedAt)}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center shrink-0">
          <ChevronRight size={18} color="#4A4A47" strokeWidth={1.5} />
        </div>
      </div>

      {contextMenu && createPortal(
        <>
          <div
            onClick={closeMenu}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 9998,
            }}
            data-testid={`ctx-backdrop-${conv.id}`}
          />
          <div
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              width: 220,
              background: 'rgba(30, 29, 26, 0.95)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 16,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 9999,
              overflow: 'hidden',
            }}
            data-testid={`ctx-menu-${conv.id}`}
          >
            {menuItems.map((item) => (
              <div
                key={item.testId}
                onClick={(e) => { e.stopPropagation(); item.action(); }}
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  fontSize: 16,
                  color: item.color,
                  transition: 'background 100ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                data-testid={item.testId}
              >
                <item.icon size={18} strokeWidth={1.5} />
                {item.label}
              </div>
            ))}
          </div>
        </>,
        document.body
      )}
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

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    fetch(`/api/conversations/search?q=${encodeURIComponent(debouncedQuery.trim())}`)
      .then(r => r.json())
      .then(json => setSearchResults(json.data || []))
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false));
  }, [debouncedQuery]);

  const displayConversations = searchResults !== null ? searchResults : conversations;
  const filteredGroups = groupConversationsByDate(displayConversations);

  const searchBarRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative h-full" data-testid="conversation-list-view">
      <div className="absolute inset-0 overflow-y-auto" style={{ paddingTop: 16, paddingBottom: 'calc(16px + 3.33vh)', overscrollBehavior: 'contain' }} data-testid="conversation-list">
        {isLoading || searching ? (
          <div className="flex items-center justify-center py-16" data-testid="conversations-loading">
            <ThinkingAnimation size={36} label={searching ? "搜索中" : "加载中"} />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3" data-testid="conversations-empty">
            <MessageSquare className="w-10 h-10 text-[var(--text-secondary)] opacity-30" />
            <span className="text-sm text-[var(--text-secondary)]">{searchQuery ? '无匹配结果' : '暂无对话'}</span>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.label} data-testid={`conv-group-${group.label}`}>
              <div style={{ padding: '20px 20px 8px 20px' }}>
                <span style={{ fontSize: 14, fontWeight: 400, color: '#7A7874', fontFamily: 'sans-serif' }} data-testid={`conv-group-label-${group.label}`}>
                  {group.label}
                </span>
              </div>
              {group.items.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  isSelected={false}
                  onSelect={onSelectConversation}
                  onArchive={handleArchive}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  searchQuery={debouncedQuery}
                />
              ))}
            </div>
          ))
        )}
      </div>

      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ zIndex: 10, pointerEvents: 'none' }}
        data-testid="chats-bottom-bar"
      >
        <div style={{
          height: 40,
          background: 'linear-gradient(to top, rgba(38,38,36,0.75) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />

        <div style={{ pointerEvents: 'auto', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            ref={searchBarRef}
            style={{
              flex: 1, height: 44,
              position: 'relative',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.15)',
              padding: '0 14px',
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(38, 38, 36, 0.75)',
            }}
          >
            <Search size={16} color="#7A7874" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search"
              style={{
                flex: 1, border: 'none', outline: 'none',
                background: 'transparent',
                fontSize: 15, color: '#ECECEC',
              }}
              data-testid="input-search-chats"
            />
          </div>
          <button
            onClick={onNewConversation}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'linear-gradient(145deg, rgba(174,86,48,0.85) 0%, rgba(174,86,48,0.65) 100%)',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 2px 10px rgba(174,86,48,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, cursor: 'pointer',
              transition: 'all 200ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(145deg, rgba(174,86,48,0.95) 0%, rgba(174,86,48,0.75) 100%)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(145deg, rgba(174,86,48,0.85) 0%, rgba(174,86,48,0.65) 100%)'; }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            data-testid="btn-new-conversation"
          >
            <Plus size={22} color="#FFFFFF" strokeWidth={2} />
          </button>
        </div>
        <div style={{
          height: 'calc(3.33vh + env(safe-area-inset-bottom, 0px))',
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
}

function BottomInputArea({ onSend, loading, onStop, webSearchEnabled, onWebSearchToggle, replyStyle, onReplyStyleChange }: { onSend: (msg: string, attachments?: Attachment[]) => void; loading: boolean; onStop?: () => void; webSearchEnabled?: boolean; onWebSearchToggle?: (enabled: boolean) => void; replyStyle?: string; onReplyStyleChange?: (style: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  const updateMask = useCallback(() => {
    const container = containerRef.current;
    const composer = composerRef.current;
    const bg = bgRef.current;
    if (!container || !composer || !bg) return;

    const cRect = container.getBoundingClientRect();
    const iRect = composer.getBoundingClientRect();

    const x = iRect.left - cRect.left;
    const y = iRect.top - cRect.top;
    const w = iRect.width;
    const h = iRect.height;
    const r = 20;

    const mask = `
      url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='${cRect.width}' height='${cRect.height}'>` +
        `<defs><mask id='m'>` +
        `<rect width='100%' height='100%' fill='white'/>` +
        `<rect x='${x}' y='${y}' width='${w}' height='${h}' rx='${r}' ry='${r}' fill='black'/>` +
        `</mask></defs>` +
        `<rect width='100%' height='100%' fill='white' mask='url(%23m)'/>` +
        `</svg>`
      )}")
    `;
    bg.style.maskImage = mask;
    bg.style.maskSize = '100% 100%';
    (bg.style as any).webkitMaskImage = mask;
    (bg.style as any).webkitMaskSize = '100% 100%';
  }, []);

  useEffect(() => {
    updateMask();
    const observer = new ResizeObserver(updateMask);
    if (containerRef.current) observer.observe(containerRef.current);
    if (composerRef.current) observer.observe(composerRef.current);
    window.addEventListener('resize', updateMask);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateMask);
    };
  }, [updateMask]);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-0 left-0 right-0"
      style={{ zIndex: 10, pointerEvents: 'none' }}
      data-testid="agent-input"
    >
      <div
        ref={bgRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        <div style={{
          height: 40,
          background: 'linear-gradient(to top, rgba(38,38,36,0.85) 0%, transparent 100%)',
        }} />
        <div style={{
          position: 'absolute',
          top: 40,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(38,38,36,0.85)',
        }} />
      </div>

      <div style={{ height: 40 }} />
      <div style={{ pointerEvents: 'auto' }}>
        <div className="max-w-3xl mx-auto px-3">
          <div ref={composerRef}>
            <AiInputBar
              onSend={onSend}
              loading={loading}
              onStop={onStop}
              webSearchEnabled={webSearchEnabled}
              onWebSearchToggle={onWebSearchToggle}
              replyStyle={replyStyle}
              onReplyStyleChange={onReplyStyleChange}
            />
          </div>
        </div>
      </div>
      <div style={{
        height: 'calc(3.33vh + env(safe-area-inset-bottom, 0px))',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

export default function Agent() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const activeConvId = params.get('conv') ? parseInt(params.get('conv')!) : null;
  const { currentUserId } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [replyStyle, setReplyStyle] = useState('normal');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationHistory = useRef<{ role: string; content: string }[]>([]);
  const [activeConvSystemPrompt, setActiveConvSystemPrompt] = useState<string | undefined>();
  const [convTitle, setConvTitle] = useState<string>("");
  const [showChat, setShowChat] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);

  useEffect(() => {
    if (!activeConvId) {
      setShowChat(false);
      setMessages([]);
      conversationHistory.current = [];
      setActiveConvSystemPrompt(undefined);
      setConvTitle("");
      return;
    }

    if (isStreamingRef.current) return;

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

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
    }
  }, []);

  const handleScrollEvent = useCallback(() => {
    setShowScrollBtn(!isNearBottom());
  }, [isNearBottom]);

  useEffect(() => {
    if (isNearBottom()) {
      scrollToBottom(false);
    }
  }, [messages, loading, scrollToBottom, isNearBottom]);

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

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const handleSend = useCallback(
    async (text: string, attachments?: Attachment[]) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      let convId = activeConvId;

      const userMsg: Message = {
        id: nextId(),
        role: "user",
        content: text,
        type: "text",
        attachments: attachments,
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      isStreamingRef.current = true;

      conversationHistory.current.push({ role: "user", content: text });

      const assistantMsgId = nextId();
      const streamingMsg: Message = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        type: "text",
        isStreaming: true,
      };
      setMessages((prev) => [...prev, streamingMsg]);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const selectedModel = (() => { try { return localStorage.getItem('buddy_model') || undefined; } catch { return undefined; } })();
        const extendedThinking = (() => { try { return localStorage.getItem('buddy_extended_thinking') === 'true'; } catch { return false; } })();

        const streamHeaders: Record<string, string> = { "Content-Type": "application/json" };
        const token = localStorage.getItem('buddy_token');
        if (token) streamHeaders['Authorization'] = `Bearer ${token}`;

        const res = await fetch("/api/ai/chat/stream", {
          method: "POST",
          headers: streamHeaders,
          body: JSON.stringify({
            message: text,
            conversationHistory: conversationHistory.current,
            conversationId: convId || undefined,
            currentUserId: currentUserId || 1,
            systemPrompt: activeConvSystemPrompt || undefined,
            model: selectedModel,
            extendedThinking,
            replyStyle: replyStyle !== 'normal' ? replyStyle : undefined,
            webSearchEnabled,
            attachments,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({ error: 'Stream failed' }));
          throw new Error(errJson.error || 'Stream failed');
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';
        let pendingAction: any = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

              if (event.type === 'search_results' && event.results) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, searchResults: event.results }
                      : m
                  )
                );
              } else if (event.type === 'start' && event.conversationId) {
                if (!convId) {
                  convId = event.conversationId;
                  const title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
                  setConvTitle(title);
                  navigate(`/agent?conv=${convId}`, { replace: true });
                  queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
                }
                if (convId) saveMessageToDB(convId, userMsg);
              } else if (event.type === 'token' && event.content) {
                fullText += event.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: fullText }
                      : m
                  )
                );
              } else if (event.type === 'action') {
                pendingAction = event;
              } else if (event.type === 'done') {
                const finalText = event.fullText || fullText;
                conversationHistory.current.push({ role: "assistant", content: finalText });

                if (pendingAction) {
                  const msgType = pendingAction.actions ? "multi_confirm" : "confirm";
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? {
                            ...m,
                            content: finalText,
                            isStreaming: false,
                            type: msgType,
                            action: pendingAction.action || undefined,
                            actions: pendingAction.actions || undefined,
                            confirmed: pendingAction.action ? null : undefined,
                            actionConfirmed: pendingAction.actions ? pendingAction.actions.map(() => null) : undefined,
                          }
                        : m
                    )
                  );
                  if (convId) {
                    saveMessageToDB(convId, {
                      id: assistantMsgId,
                      role: "assistant",
                      content: finalText,
                      type: msgType,
                      action: pendingAction.action || undefined,
                      actions: pendingAction.actions || undefined,
                      confirmed: pendingAction.action ? null : undefined,
                      actionConfirmed: pendingAction.actions ? pendingAction.actions.map(() => null) : undefined,
                    });
                  }
                } else {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, content: finalText, isStreaming: false }
                        : m
                    )
                  );
                  if (convId) {
                    saveMessageToDB(convId, {
                      id: assistantMsgId,
                      role: "assistant",
                      content: finalText,
                      type: "text",
                    });
                  }
                }
              } else if (event.type === 'error') {
                throw new Error(event.content || 'Stream error');
              }
            } catch (parseErr: any) {
              if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr;
            }
          }
        }

        if (fullText && !conversationHistory.current.some(m => m.content === fullText && m.role === 'assistant')) {
          conversationHistory.current.push({ role: "assistant", content: fullText });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: fullText, isStreaming: false }
                : m
            )
          );
          if (convId) {
            saveMessageToDB(convId, {
              id: assistantMsgId,
              role: "assistant",
              content: fullText,
              type: "text",
            });
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setMessages((prev) => {
            const streamingMsg = prev.find(m => m.id === assistantMsgId);
            if (streamingMsg?.content) {
              conversationHistory.current.push({ role: "assistant", content: streamingMsg.content });
            }
            return prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, isStreaming: false }
                : m
            );
          });
        } else {
          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== assistantMsgId);
            return [...filtered, {
              id: nextId(),
              role: "system" as const,
              content: err.message || "请求失败，请稍后重试",
            }];
          });
        }
      } finally {
        setLoading(false);
        isStreamingRef.current = false;
        abortControllerRef.current = null;
      }
    },
    [activeConvId, activeConvSystemPrompt, saveMessageToDB, navigate, currentUserId, replyStyle, webSearchEnabled]
  );

  const rebuildHistoryFromMessages = useCallback((msgs: Message[]) => {
    conversationHistory.current = msgs
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  }, []);

  const handleRegenerate = useCallback(
    (messageId: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex < 0) return;

      let lastUserMsg = '';
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          lastUserMsg = messages[i].content;
          break;
        }
      }
      if (!lastUserMsg) return;

      const truncated = messages.slice(0, msgIndex);
      setMessages(truncated);
      rebuildHistoryFromMessages(truncated);

      setTimeout(() => handleSend(lastUserMsg), 0);
    },
    [messages, handleSend, rebuildHistoryFromMessages]
  );

  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex < 0) return;

      const truncated = messages.slice(0, msgIndex);
      setMessages(truncated);
      rebuildHistoryFromMessages(truncated);

      setTimeout(() => handleSend(newContent), 0);
    },
    [messages, handleSend, rebuildHistoryFromMessages]
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
          currentUserId: currentUserId || 1,
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

  const handleStepAnswer = useCallback((stepLabel: string, answerLabel: string) => {
    const stepMsg: Message = {
      id: nextId(),
      role: 'user',
      content: `${stepLabel}: ${answerLabel}`,
      type: 'text',
    };
    setMessages(prev => [...prev, stepMsg]);
    // Auto scroll
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100);
  }, []);

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
        const selectedModel2 = (() => { try { return localStorage.getItem('buddy_model') || undefined; } catch { return undefined; } })();
        const extendedThinking2 = (() => { try { return localStorage.getItem('buddy_extended_thinking') === 'true'; } catch { return false; } })();
        const res = await apiRequest("POST", "/api/ai/chat", {
          message: chatMessage,
          conversationHistory: conversationHistory.current,
          conversationId: activeConvId || undefined,
          currentUserId: currentUserId || 1,
          systemPrompt: activeConvSystemPrompt || undefined,
          model: selectedModel2,
          extendedThinking: extendedThinking2,
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
    [activeConvId, activeConvSystemPrompt, saveMessageToDB, currentUserId]
  );

  const handleBack = useCallback(() => {
    setMessages([]);
    conversationHistory.current = [];
    setConvTitle("");
    setShowChat(false);
    setActiveConvSystemPrompt(undefined);
    navigate('/agent', { replace: true });
  }, [navigate]);

  const showWelcome = !activeConvId && messages.length === 0 && !showChat;

  return (
    <div className="relative h-full bg-transparent" data-testid="agent-page">
      

      {showWelcome ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-3" style={{ paddingBottom: 80 }}>
          
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
        <div className="absolute inset-0 flex items-center justify-center" data-testid="messages-loading">
          <ThinkingAnimation size={48} label="加载中" />
        </div>
      ) : (
        <div
          className="absolute inset-0 overflow-y-auto"
          ref={scrollRef}
          onScroll={handleScrollEvent}
          data-testid="agent-messages"
          style={{ paddingTop: 54, paddingBottom: 'calc(160px + 3.33vh)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
        >
          
          <div className="max-w-3xl mx-auto">
            {(() => {
              const lastAssistantIdx = messages.reduce((acc, m, i) => m.role === 'assistant' && !m.isStreaming ? i : acc, -1);
              return messages.map((msg, idx) => (
                <AiMessageBubble
                  key={msg.id}
                  message={msg}
                  onConfirm={handleConfirm}
                  onReject={handleReject}
                  onSkip={handleSkip}
                  onFollowUpSubmit={handleFollowUpSubmit}
                  onStepAnswer={handleStepAnswer}
                  onRegenerate={handleRegenerate}
                  onEditMessage={handleEditMessage}
                  isLastAssistant={idx === lastAssistantIdx}
                />
              ));
            })()}
            {loading && !messages.some(m => m.isStreaming) && (
              <div className="flex justify-start px-3 mb-6" data-testid="ai-loading">
                <ThinkingAnimation size={36} />
              </div>
            )}
          </div>
        </div>
      )}

      {showScrollBtn && showChat && (
        <div className="absolute z-30 flex justify-center" style={{ bottom: 'calc(160px + 3.33vh)', left: 0, right: 0, pointerEvents: 'none' }}>
          <button
            onClick={() => scrollToBottom(true)}
            className="flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(50,50,48,0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(8px)',
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
            data-testid="btn-scroll-bottom"
          >
            <ArrowDown className="w-4 h-4 text-[var(--text-primary)]" strokeWidth={2} />
          </button>
        </div>
      )}

      <BottomInputArea
        onSend={handleSend}
        loading={loading}
        onStop={handleStop}
        webSearchEnabled={webSearchEnabled}
        onWebSearchToggle={setWebSearchEnabled}
        replyStyle={replyStyle}
        onReplyStyleChange={setReplyStyle}
      />
    </div>
  );
}
