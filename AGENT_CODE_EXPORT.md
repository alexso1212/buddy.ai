# Agent Page & AI Components — Code Export

> Exported on 2026-03-07 09:46 UTC
> Total files: 17 source files + directory structure

---


## client/src/pages/agent.tsx

**Lines: 2290**

```tsx
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AiMessageBubble from "@/components/ai/AiMessageBubble";
import AiInputBar from "@/components/ai/AiInputBar";
import type { Attachment } from "@/components/ai/AiInputBar";
import { Trash2, ListPlus, BarChart3, Users, CheckSquare, Plus, ArrowLeft, MessageSquare, Pencil, X, Check, ListFilter, ChevronRight, Search, Star, FolderOpen, ArrowDown, AlertCircle, Clock } from "lucide-react";
import InteractiveInputWidget, { formatAnswersForDisplay, formatAnswersForAI, type InteractiveQuestion } from "@/components/ai/InteractiveInputWidget";
import { Button } from "@/components/ui/button";
import AgentLogo from "@/components/AgentLogo";
import ThinkingAnimation from "@/components/ThinkingAnimation";
import { useAuth } from "@/lib/auth";
import { setStreamState, clearStreamState, getStreamState, takeoverStream, isBackgroundStreamActive } from "@/stores/chatStreamStore";

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
  codeFiles?: string[];
  codeFilesFailed?: string[];
  attachments?: { type: string; name: string; mimeType: string; base64: string; previewUrl?: string }[];
  thinking?: string;
  isThinking?: boolean;
  thinkingDuration?: number;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  retryPayload?: { text: string; attachments?: Attachment[] };
  errorType?: 'network' | 'timeout' | 'rate_limit' | 'context_too_long' | 'service_unavailable' | 'stream_interrupted' | 'unknown';
  timestamp?: number;
  toolCalls?: { toolName: string; label: string; status: 'running' | 'complete' | 'error'; detail?: string; type?: string; completedLabel?: string }[];
  retryCount?: number;
  cooldownUntil?: number;
  partialContent?: string;
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

const DEFAULT_SUGGESTIONS = [
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
              background: 'rgba(26, 25, 24, 0.95)',
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
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden" style={{ paddingTop: 16, paddingBottom: 'calc(16px + 3.33vh)', overscrollBehavior: 'contain', touchAction: 'pan-y' }} data-testid="conversation-list">
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
          background: 'linear-gradient(to top, rgba(26,25,24,0.75) 0%, transparent 100%)',
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
              background: 'rgba(26, 25, 24, 0.75)',
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

function BottomInputArea({ onSend, loading, onStop, webSearchEnabled, onWebSearchToggle, codeContextEnabled, onCodeContextToggle, knowledgeBaseEnabled, onKnowledgeBaseToggle, researchEnabled, onResearchToggle, replyStyle, onReplyStyleChange, lastUserMessage, onEscape }: { onSend: (msg: string, attachments?: Attachment[]) => void; loading: boolean; onStop?: () => void; webSearchEnabled?: boolean; onWebSearchToggle?: (enabled: boolean) => void; codeContextEnabled?: boolean; onCodeContextToggle?: (enabled: boolean) => void; knowledgeBaseEnabled?: boolean; onKnowledgeBaseToggle?: (enabled: boolean) => void; researchEnabled?: boolean; onResearchToggle?: (enabled: boolean) => void; replyStyle?: string; onReplyStyleChange?: (style: string) => void; lastUserMessage?: string; onEscape?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

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

    const vv = window.visualViewport;
    if (vv) {
      const handleViewportResize = () => {
        const offset = window.innerHeight - vv.height - vv.offsetTop;
        setKeyboardOffset(Math.max(0, offset));
        updateMask();
      };
      vv.addEventListener('resize', handleViewportResize);
      vv.addEventListener('scroll', handleViewportResize);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', updateMask);
        vv.removeEventListener('resize', handleViewportResize);
        vv.removeEventListener('scroll', handleViewportResize);
      };
    }

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateMask);
    };
  }, [updateMask]);

  return (
    <div
      ref={containerRef}
      className="absolute left-0 right-0"
      style={{
        zIndex: 10,
        pointerEvents: 'none',
        bottom: keyboardOffset,
        transition: keyboardOffset > 0 ? 'none' : 'bottom 250ms ease-out',
      }}
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
          background: 'linear-gradient(to top, rgba(26,25,24,0.85) 0%, transparent 100%)',
        }} />
        <div style={{
          position: 'absolute',
          top: 40,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(26,25,24,0.85)',
        }} />
      </div>

      <div style={{ height: 40 }} />
      <div style={{ pointerEvents: 'auto' }}>
        <div className="max-w-3xl mx-auto px-4">
          <div ref={composerRef}>
            <AiInputBar
              onSend={onSend}
              loading={loading}
              onStop={onStop}
              webSearchEnabled={webSearchEnabled}
              onWebSearchToggle={onWebSearchToggle}
              codeContextEnabled={codeContextEnabled}
              onCodeContextToggle={onCodeContextToggle}
              knowledgeBaseEnabled={knowledgeBaseEnabled}
              onKnowledgeBaseToggle={onKnowledgeBaseToggle}
              researchEnabled={researchEnabled}
              onResearchToggle={onResearchToggle}
              replyStyle={replyStyle}
              onReplyStyleChange={onReplyStyleChange}
              lastUserMessage={lastUserMessage}
              onEscape={onEscape}
            />
          </div>
        </div>
      </div>
      <div style={{
        height: keyboardOffset > 0 ? 4 : 'calc(3.33vh + env(safe-area-inset-bottom, 0px))',
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

  const { data: tasksData } = useQuery<{ data: any[] }>({
    queryKey: ["/api/tasks"],
    staleTime: 60000,
  });

  const { data: balanceData } = useQuery<{ data: any }>({
    queryKey: ['/api/token-usage/balance'],
    staleTime: 300000,
  });
  const balance = balanceData?.data;

  const smartSuggestions = useMemo(() => {
    const tasks = tasksData?.data || [];
    const myTasks = tasks.filter((t: any) => t.assigneeId === currentUserId);
    const overdue = myTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done' && t.status !== 'cancelled');
    const inProgress = myTasks.filter((t: any) => t.status === 'in_progress');
    const todo = myTasks.filter((t: any) => t.status === 'todo');
    const suggestions: { text: string; icon: any; description?: string }[] = [];

    if (overdue.length > 0) {
      suggestions.push({
        text: `我有 ${overdue.length} 个逾期任务，帮我分析优先级`,
        icon: AlertCircle,
        description: '逾期任务分析',
      });
    }
    if (inProgress.length > 0) {
      suggestions.push({
        text: `查看我正在进行的 ${inProgress.length} 个任务状态`,
        icon: Clock,
        description: '进行中任务',
      });
    }
    if (todo.length > 0) {
      suggestions.push({
        text: `帮我规划今天的工作，我有 ${todo.length} 个待办任务`,
        icon: CheckSquare,
        description: '今日规划',
      });
    }
    if (myTasks.length === 0) {
      suggestions.push({
        text: "创建新任务",
        icon: ListPlus,
        description: '快速创建',
      });
    }

    while (suggestions.length < 4) {
      const fallbacks = DEFAULT_SUGGESTIONS.filter(
        (d) => !suggestions.some((s) => s.text === d.text)
      );
      if (fallbacks.length === 0) break;
      suggestions.push(fallbacks[0]);
    }
    return suggestions.slice(0, 4);
  }, [tasksData, currentUserId]);

  const lowBalanceWarned = useRef(false);
  const { toast } = useToast();
  useEffect(() => {
    if (balance && balance.budgetUsd !== null && balance.percentUsed > 80 && !lowBalanceWarned.current) {
      lowBalanceWarned.current = true;
      toast({
        title: '额度即将用尽',
        description: `本月已使用 ${balance.percentUsed.toFixed(0)}%（$${balance.usedUsd.toFixed(2)} / $${balance.budgetUsd.toFixed(2)}）`,
        variant: 'destructive',
      });
    }
  }, [balance]);

  const [messages, setMessages] = useState<Message[]>([]);
  const lastUserMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].content;
    }
    return undefined;
  }, [messages]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [codeContextEnabled, setCodeContextEnabled] = useState(false);
  const [knowledgeBaseEnabled, setKnowledgeBaseEnabled] = useState(false);
  const [researchEnabled, setResearchEnabled] = useState(false);
  const [replyStyle, setReplyStyle] = useState('normal');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [interactiveInput, setInteractiveInput] = useState<InteractiveQuestion[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationHistory = useRef<{ role: string; content: string }[]>([]);
  const [activeConvSystemPrompt, setActiveConvSystemPrompt] = useState<string | undefined>();
  const [convTitle, setConvTitle] = useState<string>("");
  const [showChat, setShowChat] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const streamFullTextRef = useRef('');
  const streamThinkingTextRef = useRef('');
  const streamThinkingDurationRef = useRef(0);
  const streamAssistantMsgIdRef = useRef('');
  const streamDecoderRef = useRef<TextDecoder | null>(null);

  const streamConvIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (isStreamingRef.current && streamConvIdRef.current) {
        if (readerRef.current && streamDecoderRef.current) {
          takeoverStream(
            streamConvIdRef.current,
            readerRef.current,
            streamDecoderRef.current,
            streamFullTextRef.current,
            streamThinkingTextRef.current,
            streamThinkingDurationRef.current,
            streamAssistantMsgIdRef.current,
          );
          readerRef.current = null;
          streamDecoderRef.current = null;
          abortControllerRef.current = null;
        } else if (streamFullTextRef.current && streamConvIdRef.current) {
          const convId = streamConvIdRef.current;
          const content = streamFullTextRef.current;
          const thinking = streamThinkingTextRef.current;
          const thinkingDur = streamThinkingDurationRef.current;
          const token = localStorage.getItem('buddy_token');
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;
          const metadata: Record<string, any> = {};
          if (thinking) metadata.thinking = thinking;
          if (thinkingDur) metadata.thinkingDuration = thinkingDur;
          fetch(`/api/conversations/${convId}/messages`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              role: 'assistant',
              content,
              type: 'text',
              metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
            }),
          }).catch(() => {});
        }
        isStreamingRef.current = false;
      }
    };
  }, []);

  const loadConversationMessages = useCallback(async (convIdToLoad: number) => {
    setMessagesLoading(true);
    try {
      const convRes = await fetch(`/api/conversations/${convIdToLoad}`);
      const convJson = await convRes.json();
      if (convJson.data?.systemPrompt) {
        setActiveConvSystemPrompt(convJson.data.systemPrompt);
      } else {
        setActiveConvSystemPrompt(undefined);
      }
      if (convJson.data?.title) {
        setConvTitle(convJson.data.title);
      }

      const res = await fetch(`/api/conversations/${convIdToLoad}/messages`);
      const json = await res.json();
      const dbMessages: any[] = json.data || [];

      const converted: Message[] = dbMessages.map(m => {
        const base: Message = {
          id: `db-${m.id}`,
          role: m.role as any,
          content: m.content,
          type: (m.type || 'text') as any,
          timestamp: m.createdAt ? new Date(m.createdAt).getTime() : undefined,
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
            if (meta.thinking) base.thinking = meta.thinking;
            if (meta.thinkingDuration) base.thinkingDuration = meta.thinkingDuration;
            if (meta.searchResults) base.searchResults = meta.searchResults;
            if (meta.tokenUsage) base.tokenUsage = meta.tokenUsage;
            if (meta.toolCalls) base.toolCalls = meta.toolCalls.map((tc: any) => ({
              ...tc,
              status: tc.status || 'complete',
              type: tc.type || 'code',
            }));
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
  }, []);

  useEffect(() => {
    setInteractiveInput(null);
    if (!activeConvId) {
      setShowChat(false);
      setMessages([]);
      conversationHistory.current = [];
      setActiveConvSystemPrompt(undefined);
      setConvTitle("");
      return;
    }

    if (isStreamingRef.current && streamConvIdRef.current === activeConvId) return;

    if (isStreamingRef.current && streamConvIdRef.current && streamConvIdRef.current !== activeConvId) {
      setStreamState(streamConvIdRef.current, { isStreaming: true });
      isStreamingRef.current = false;
    }

    if (isBackgroundStreamActive(activeConvId)) {
      setMessagesLoading(true);
      const waitForBg = setInterval(() => {
        if (!isBackgroundStreamActive(activeConvId)) {
          clearInterval(waitForBg);
          loadConversationMessages(activeConvId);
        }
      }, 500);
      return () => clearInterval(waitForBg);
    }

    loadConversationMessages(activeConvId);
  }, [activeConvId]);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
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
      if (msg.thinking) metadata.thinking = msg.thinking;
      if (msg.thinkingDuration) metadata.thinkingDuration = msg.thinkingDuration;
      if (msg.searchResults) metadata.searchResults = msg.searchResults;
      if (msg.tokenUsage) metadata.tokenUsage = msg.tokenUsage;
      if (msg.toolCalls && msg.toolCalls.length > 0) metadata.toolCalls = msg.toolCalls;

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

  const handleInteractiveSubmit = useCallback(
    (answers: Record<string, string[]>) => {
      if (!interactiveInput) return;
      const displayText = formatAnswersForDisplay(interactiveInput, answers);
      const structuredData = formatAnswersForAI(interactiveInput, answers);
      setInteractiveInput(null);
      const responseText = `[用户选择] ${displayText}\n\n${JSON.stringify(structuredData)}`;
      handleSendRef.current?.(responseText);
    },
    [interactiveInput]
  );

  const handleInteractiveDismiss = useCallback(() => {
    setInteractiveInput(null);
  }, []);

  const handleSendRef = useRef<((text: string, attachments?: Attachment[]) => void) | null>(null);

  const handleSend = useCallback(
    async (text: string, attachments?: Attachment[]) => {
      setInteractiveInput(null);
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
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      isStreamingRef.current = true;
      streamConvIdRef.current = convId;

      const isActiveStream = () => streamConvIdRef.current === convId;

      conversationHistory.current.push({ role: "user", content: text });

      const assistantMsgId = nextId();
      const streamingMsg: Message = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        type: "text",
        isStreaming: true,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, streamingMsg]);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      let fullText = '';
      let isTimeoutAbort = false;

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
            codeContextEnabled,
            knowledgeBaseEnabled,
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
        readerRef.current = reader;
        streamAssistantMsgIdRef.current = assistantMsgId;

        const decoder = new TextDecoder();
        streamDecoderRef.current = decoder;
        let buffer = '';
        let thinkingText = '';
        let pendingAction: any = null;
        let lastEventTime = Date.now();
        let thinkingStartTime = 0;
        let tokenUsageData: any = null;

        let tokenBuffer = '';
        let tokenFlushTimer: ReturnType<typeof setTimeout> | null = null;
        const flushTokenBuffer = () => {
          if (!tokenBuffer) return;
          tokenBuffer = '';
          if (!isActiveStream()) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: fullText, isThinking: false }
                : m
            )
          );
        };

        const STREAM_TIMEOUT_MS = 45000;
        const timeoutCheck = setInterval(() => {
          if (Date.now() - lastEventTime > STREAM_TIMEOUT_MS) {
            clearInterval(timeoutCheck);
            isTimeoutAbort = true;
            abortController.abort();
          }
        }, 5000);

        try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          lastEventTime = Date.now();

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
                if (isActiveStream()) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, searchResults: event.results }
                        : m
                    )
                  );
                }
              } else if (event.type === 'code_files' && event.files) {
                if (isActiveStream()) {
                  const codeInfo = `📂 已加载 ${event.files.length} 个代码文件` +
                    (event.failedFiles?.length ? `，${event.failedFiles.length} 个文件未找到` : '');
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, codeFiles: event.files, codeFilesFailed: event.failedFiles }
                        : m
                    )
                  );
                }
              } else if (event.type === 'tool_use' && event.label) {
                if (isActiveStream()) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, toolCalls: [...(m.toolCalls || []), { toolName: event.toolName, label: event.label, status: 'running' as const, type: event.toolType || 'code' }] }
                        : m
                    )
                  );
                }
              } else if (event.type === 'tool_result' && event.toolName) {
                if (isActiveStream()) {
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantMsgId) return m;
                      const calls = [...(m.toolCalls || [])];
                      let idx = -1;
                      for (let j = calls.length - 1; j >= 0; j--) {
                        if (calls[j].toolName === event.toolName && calls[j].status === 'running') { idx = j; break; }
                      }
                      if (idx !== -1) {
                        calls[idx] = { ...calls[idx], status: 'complete' as const, detail: event.detail, completedLabel: event.completedLabel };
                      }
                      return { ...m, toolCalls: calls };
                    })
                  );
                }
              } else if (event.type === 'title' && event.title) {
                if (isActiveStream()) setConvTitle(event.title);
                queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
              } else if (event.type === 'start' && event.conversationId) {
                if (!convId) {
                  convId = event.conversationId;
                  streamConvIdRef.current = convId;
                  if (isActiveStream()) {
                    setConvTitle(text.slice(0, 30) + (text.length > 30 ? '...' : ''));
                    navigate(`/agent?conv=${convId}`, { replace: true });
                  }
                  queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
                }
                if (convId) saveMessageToDB(convId, userMsg);
              } else if (event.type === 'thinking' && event.content) {
                if (!thinkingStartTime) thinkingStartTime = Date.now();
                thinkingText += event.content;
                streamThinkingTextRef.current = thinkingText;
                if (isActiveStream()) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, thinking: thinkingText, isThinking: true }
                        : m
                    )
                  );
                }
              } else if (event.type === 'token' && event.content) {
                fullText += event.content;
                streamFullTextRef.current = fullText;
                tokenBuffer += event.content;
                if (!tokenFlushTimer) {
                  tokenFlushTimer = setTimeout(() => {
                    tokenFlushTimer = null;
                    flushTokenBuffer();
                  }, 50);
                }
              } else if (event.type === 'interactive_input' && event.questions) {
                if (isActiveStream()) {
                  setInteractiveInput(event.questions);
                }
              } else if (event.type === 'action') {
                pendingAction = event;
              } else if (event.type === 'done') {
                if (tokenFlushTimer) {
                  clearTimeout(tokenFlushTimer);
                  tokenFlushTimer = null;
                }
                tokenBuffer = '';

                const finalText = event.fullText || fullText;
                conversationHistory.current.push({ role: "assistant", content: finalText });
                const thinkingDur = thinkingStartTime ? Date.now() - thinkingStartTime : undefined;

                if (event.tokenUsage) {
                  tokenUsageData = event.tokenUsage;
                }

                if (pendingAction) {
                  const msgType = pendingAction.actions ? "multi_confirm" : "confirm";
                  if (isActiveStream()) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMsgId
                          ? {
                              ...m,
                              content: finalText,
                              isStreaming: false,
                              isThinking: false,
                              type: msgType,
                              action: pendingAction.action || undefined,
                              actions: pendingAction.actions || undefined,
                              confirmed: pendingAction.action ? null : undefined,
                              actionConfirmed: pendingAction.actions ? pendingAction.actions.map(() => null) : undefined,
                              thinking: thinkingText || undefined,
                              thinkingDuration: thinkingDur,
                              tokenUsage: tokenUsageData || undefined,
                            }
                          : m
                      )
                    );
                  }
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
                  if (isActiveStream()) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMsgId
                          ? {
                              ...m,
                              content: finalText,
                              isStreaming: false,
                              isThinking: false,
                              thinking: thinkingText || undefined,
                              thinkingDuration: thinkingDur,
                              tokenUsage: tokenUsageData || undefined,
                            }
                          : m
                      )
                    );
                  }
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
                const streamErr = new Error(event.content || 'Stream error');
                (streamErr as any).errorCode = event.errorCode || 'unknown';
                throw streamErr;
              }
            } catch (parseErr: any) {
              if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr;
            }
          }
        }
        } finally {
          clearInterval(timeoutCheck);
          if (tokenFlushTimer) clearTimeout(tokenFlushTimer);
        }

        if (fullText && !conversationHistory.current.some(m => m.content === fullText && m.role === 'assistant')) {
          conversationHistory.current.push({ role: "assistant", content: fullText });
          if (isActiveStream()) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: fullText, isStreaming: false, isThinking: false }
                  : m
              )
            );
          }
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
        if (isActiveStream()) {
          if (err.name === 'AbortError' && !isTimeoutAbort) {
            setMessages((prev) => {
              const streamingMsg = prev.find(m => m.id === assistantMsgId);
              if (streamingMsg?.content) {
                conversationHistory.current.push({ role: "assistant", content: streamingMsg.content });
              }
              return prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, isStreaming: false, isThinking: false }
                  : m
              );
            });
          } else if (err.name === 'AbortError' && isTimeoutAbort) {
            const partialMsg = fullText || '';
            setMessages((prev) => {
              const filtered = prev.filter((m) => m.id !== assistantMsgId);
              return [...filtered, {
                id: nextId(),
                role: "system" as const,
                content: 'Response timed out (45s with no data)',
                errorType: 'timeout' as const,
                retryPayload: { text, attachments },
                partialContent: partialMsg || undefined,
              }];
            });
          } else {
            const errMsg = err.message || '';
            const serverErrorCode = (err as any).errorCode;
            let errorType: Message['errorType'] = 'unknown';

            if (serverErrorCode && serverErrorCode !== 'unknown') {
              errorType = serverErrorCode as Message['errorType'];
            } else if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('network') || errMsg.includes('ECONNREFUSED')) {
              errorType = 'network';
            } else if (errMsg.includes('rate') || errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('Too Many')) {
              errorType = 'rate_limit';
            } else if (errMsg.includes('context') || errMsg.includes('too long') || errMsg.includes('max_tokens') || errMsg.includes('context_length')) {
              errorType = 'context_too_long';
            } else if (errMsg.includes('overloaded') || errMsg.includes('503') || errMsg.includes('unavailable') || errMsg.includes('capacity')) {
              errorType = 'service_unavailable';
            } else if (errMsg.includes('timeout') || errMsg.includes('Timeout')) {
              errorType = 'timeout';
            }

            const partialMsg = fullText || '';

            if (partialMsg && (errorType === 'network' || errorType === 'timeout' || errorType === 'unknown')) {
              errorType = 'stream_interrupted';
            }

            const errorMsgId = nextId();

            if (errorType === 'network') {
              const doAutoRetry = async (attempt: number) => {
                if (attempt > 3) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === errorMsgId
                        ? { ...m, content: 'Network connection failed after 3 attempts', retryCount: 3 }
                        : m
                    )
                  );
                  return;
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === errorMsgId
                      ? { ...m, retryCount: attempt }
                      : m
                  )
                );
                const delays = [1000, 3000, 5000];
                await new Promise(r => setTimeout(r, delays[attempt - 1] || 5000));

                let shouldRetry = false;
                setMessages((prev) => {
                  const stillExists = prev.some(m => m.id === errorMsgId);
                  if (stillExists) {
                    shouldRetry = true;
                    const filtered = prev.filter((m) => m.id !== errorMsgId);
                    rebuildHistoryFromMessages(filtered.filter(m => m.id !== assistantMsgId));
                    return filtered;
                  }
                  return prev;
                });
                if (!shouldRetry) return;
                setTimeout(() => handleSend(text, attachments), 0);
              };

              setMessages((prev) => {
                const filtered = prev.filter((m) => m.id !== assistantMsgId);
                return [...filtered, {
                  id: errorMsgId,
                  role: "system" as const,
                  content: 'Network connection interrupted',
                  errorType: 'network' as const,
                  retryPayload: { text, attachments },
                  retryCount: 0,
                }];
              });

              setTimeout(() => doAutoRetry(1), 100);
            } else if (errorType === 'rate_limit') {
              setMessages((prev) => {
                const filtered = prev.filter((m) => m.id !== assistantMsgId);
                return [...filtered, {
                  id: errorMsgId,
                  role: "system" as const,
                  content: 'Rate limited - too many requests',
                  errorType: 'rate_limit' as const,
                  retryPayload: { text, attachments },
                  cooldownUntil: Date.now() + 30000,
                }];
              });
            } else if (errorType === 'stream_interrupted') {
              if (partialMsg) {
                conversationHistory.current.push({ role: "assistant", content: partialMsg });
              }
              setMessages((prev) => {
                const updated = prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: partialMsg, isStreaming: false, isThinking: false }
                    : m
                );
                return [...updated, {
                  id: errorMsgId,
                  role: "system" as const,
                  content: 'Response was interrupted',
                  errorType: 'stream_interrupted' as const,
                  retryPayload: { text, attachments },
                  partialContent: partialMsg,
                }];
              });
            } else {
              setMessages((prev) => {
                const filtered = prev.filter((m) => m.id !== assistantMsgId);
                return [...filtered, {
                  id: errorMsgId,
                  role: "system" as const,
                  content: errMsg || 'Request failed',
                  errorType,
                  retryPayload: { text, attachments },
                }];
              });
            }
          }
        }
      } finally {
        if (isActiveStream()) {
          setLoading(false);
          isStreamingRef.current = false;
          streamConvIdRef.current = null;
        }
        readerRef.current = null;
        streamDecoderRef.current = null;
        streamFullTextRef.current = '';
        streamThinkingTextRef.current = '';
        streamThinkingDurationRef.current = 0;
        streamAssistantMsgIdRef.current = '';
        abortControllerRef.current = null;
        if (convId) clearStreamState(convId);
      }
    },
    [activeConvId, activeConvSystemPrompt, saveMessageToDB, navigate, currentUserId, replyStyle, webSearchEnabled, codeContextEnabled, knowledgeBaseEnabled]
  );

  handleSendRef.current = handleSend;

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
    async (messageId: string, newContent: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex < 0) return;

      const truncated = messages.slice(0, msgIndex);
      setMessages(truncated);
      rebuildHistoryFromMessages(truncated);

      if (activeConvId) {
        try {
          await apiRequest("POST", `/api/conversations/${activeConvId}/messages/truncate`, {
            keepCount: truncated.filter(m => m.role === 'user' || m.role === 'assistant' || m.role === 'system').length,
          });
        } catch (err) {
          console.error('Failed to truncate DB messages:', err);
        }
      }

      setTimeout(() => handleSend(newContent), 0);
    },
    [messages, handleSend, rebuildHistoryFromMessages, activeConvId]
  );

  const handleRetry = useCallback(
    (messageId: string) => {
      const msg = messages.find(m => m.id === messageId);
      if (!msg?.retryPayload) return;
      const truncated = messages.filter(m => m.id !== messageId);
      setMessages(truncated);
      rebuildHistoryFromMessages(truncated);
      setTimeout(() => handleSend(msg.retryPayload!.text, msg.retryPayload!.attachments), 0);
    },
    [messages, handleSend, rebuildHistoryFromMessages]
  );

  const handleContinueGeneration = useCallback(
    (messageId: string) => {
      const msg = messages.find(m => m.id === messageId);
      if (!msg?.retryPayload) return;
      const cleaned = messages.filter(m => m.id !== messageId);
      setMessages(cleaned);
      rebuildHistoryFromMessages(cleaned);
      const continuePrompt = 'Please continue from where you left off.';
      setTimeout(() => handleSend(continuePrompt, msg.retryPayload!.attachments), 0);
    },
    [messages, handleSend, rebuildHistoryFromMessages]
  );

  const handleNewConversation = useCallback(() => {
    handleClearChat();
  }, [handleClearChat]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && e.shiftKey && key === 'n') {
        e.preventDefault();
        handleNewConversation();
      }
      if (mod && e.shiftKey && key === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggle-sidebar'));
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleNewConversation]);

  const handleTrimAndRetry = useCallback(
    (messageId: string) => {
      const msg = messages.find(m => m.id === messageId);
      if (!msg?.retryPayload) return;
      const maxKeep = 6;
      const relevantMsgs = messages.filter(m => m.role === 'user' || m.role === 'assistant');
      const trimmedMsgs = relevantMsgs.slice(-maxKeep);
      const systemMsgs = messages.filter(m => m.role === 'system' && m.id !== messageId);
      const allTrimmed = [...systemMsgs, ...trimmedMsgs];
      setMessages(allTrimmed);
      rebuildHistoryFromMessages(allTrimmed);
      setTimeout(() => handleSend(msg.retryPayload!.text, msg.retryPayload!.attachments), 0);
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

        if (res.status === 409) {
          const errJson = await res.json();
          const sysMsg: Message = {
            id: nextId(),
            role: "system",
            content: errJson.error || "该任务已被其他人修改，请刷新后重试",
          };
          setMessages((prev) => [...prev, sysMsg]);
          if (activeConvId) saveMessageToDB(activeConvId, sysMsg);
          return;
        }

        const json = await res.json();
        const result = json.data;

        let systemContent = result.message;
        if (result.duplicateWarning) {
          systemContent += `\n⚠️ ${result.duplicateWarning}`;
        }

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
          content: systemContent,
        };
        setMessages((prev) => [...prev, sysMsg]);
        if (activeConvId) saveMessageToDB(activeConvId, sysMsg);

        conversationHistory.current.push({
          role: "assistant" as const,
          content: `[系统] 操作已执行: ${systemContent}`,
        });

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

  const handleConfirmAll = useCallback(
    async (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg || msg.type !== "multi_confirm" || !msg.actions || !msg.actionConfirmed) return;

      const undecidedIndexes = msg.actionConfirmed
        .map((c, i) => (c === null ? i : -1))
        .filter((i) => i !== -1);
      if (undecidedIndexes.length === 0) return;

      const batchActions = undecidedIndexes.map((i) => ({
        actionType: msg.actions![i].actionType,
        data: msg.actions![i].data,
      }));

      try {
        const res = await apiRequest("POST", "/api/ai/confirm-batch", {
          actions: batchActions,
          currentUserId: currentUserId || 1,
          conversationId: activeConvId || undefined,
        });
        const json = await res.json();
        const batchResult = json.data;

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId || !m.actionConfirmed) return m;
            const updated = [...m.actionConfirmed];
            for (let j = 0; j < undecidedIndexes.length; j++) {
              updated[undecidedIndexes[j]] = batchResult.results[j]?.success ?? false;
            }
            return { ...m, actionConfirmed: updated };
          })
        );

        const summaryParts: string[] = [];
        for (const r of batchResult.results) {
          let line = r.message;
          if (r.duplicateWarning) line += ` ⚠️ ${r.duplicateWarning}`;
          summaryParts.push(line);
        }

        const batchSummary = summaryParts.join("\n");
        const sysMsg: Message = {
          id: nextId(),
          role: "system",
          content: batchSummary,
        };
        setMessages((prev) => [...prev, sysMsg]);
        if (activeConvId) saveMessageToDB(activeConvId, sysMsg);

        conversationHistory.current.push({
          role: "assistant" as const,
          content: `[系统] 批量操作已执行: ${batchSummary}`,
        });

        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stats/overview"] });
      } catch (err: any) {
        const sysMsg: Message = {
          id: nextId(),
          role: "system",
          content: err.message || "批量执行失败，请重试",
        };
        setMessages((prev) => [...prev, sysMsg]);
        if (activeConvId) saveMessageToDB(activeConvId, sysMsg);
      }
    },
    [messages, activeConvId, saveMessageToDB, currentUserId]
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
    <div className="relative h-full bg-transparent overflow-x-hidden" style={{ touchAction: 'pan-y' }} data-testid="agent-page">
      

      {showWelcome ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4" style={{ paddingBottom: 80 }}>
          
          <div className="flex flex-col items-center gap-4 mb-8">
            <AgentLogo size={72} animate={true} glow={true} />
            <h1 className="font-serif text-2xl text-[var(--text-primary)]" data-testid="text-welcome-heading">有什么可以帮你的？</h1>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full max-w-md">
            {smartSuggestions.map((s) => {
              const SIcon = s.icon;
              return (
                <button
                  key={s.text}
                  onClick={() => handleSend(s.text)}
                  className="rounded-card border border-[var(--border-subtle)] hover:bg-black/5 dark:hover:bg-white/5 p-4 cursor-pointer text-left transition-colors"
                  data-testid={`suggestion-${s.description || s.text}`}
                >
                  <SIcon className="w-4 h-4 text-[var(--text-secondary)] mb-2" />
                  {s.description && (
                    <span className="text-xs text-[var(--text-secondary)] block mb-1">{s.description}</span>
                  )}
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
          className="absolute inset-0 overflow-y-auto overflow-x-hidden"
          ref={scrollRef}
          onScroll={handleScrollEvent}
          data-testid="agent-messages"
          style={{ paddingTop: 54, paddingBottom: 'calc(160px + 3.33vh)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y' }}
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
                  onConfirmAll={handleConfirmAll}
                  onFollowUpSubmit={handleFollowUpSubmit}
                  onStepAnswer={handleStepAnswer}
                  onRegenerate={handleRegenerate}
                  onEditMessage={handleEditMessage}
                  onRetry={handleRetry}
                  onContinueGeneration={handleContinueGeneration}
                  onNewConversation={handleNewConversation}
                  onTrimAndRetry={handleTrimAndRetry}
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

      {showScrollBtn && messages.length > 0 && (
        <div className="absolute z-30 flex justify-center" style={{ bottom: 'calc(160px + 3.33vh)', left: 0, right: 0, pointerEvents: 'none' }}>
          <button
            onClick={() => scrollToBottom(true)}
            className="flex items-center justify-center hover:scale-105 transition-transform"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
            data-testid="btn-scroll-bottom"
          >
            <ArrowDown className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.85)' }} strokeWidth={2} />
          </button>
        </div>
      )}

      {process.env.NODE_ENV === 'development' && !interactiveInput && (
        <button
          onClick={() => setInteractiveInput([
            { id: "q1", question: "这个任务归哪个部门？", type: "single_select", options: ["产品部", "技术部", "运营部", "市场部"] },
            { id: "q2", question: "涉及哪些领域？", type: "multi_select", options: ["数据分析", "用户研究", "竞品分析"] },
            { id: "q3", question: "请排列优先级", type: "rank_priorities", options: ["成本控制", "交付速度", "质量标准", "团队满意度"] },
          ])}
          className="absolute z-30 text-xs px-3 py-1.5 rounded-full"
          style={{
            top: 60,
            right: 16,
            background: 'rgba(212,184,150,0.2)',
            color: '#D4B896',
            border: '1px solid rgba(212,184,150,0.3)',
          }}
          data-testid="btn-test-widget"
        >
          测试 Widget
        </button>
      )}

      {interactiveInput && (
        <InteractiveInputWidget
          questions={interactiveInput}
          onSubmit={handleInteractiveSubmit}
          onDismiss={handleInteractiveDismiss}
        />
      )}

      <BottomInputArea
        onSend={handleSend}
        loading={loading}
        onStop={handleStop}
        webSearchEnabled={webSearchEnabled}
        onWebSearchToggle={setWebSearchEnabled}
        codeContextEnabled={codeContextEnabled}
        onCodeContextToggle={setCodeContextEnabled}
        knowledgeBaseEnabled={knowledgeBaseEnabled}
        onKnowledgeBaseToggle={setKnowledgeBaseEnabled}
        researchEnabled={researchEnabled}
        onResearchToggle={setResearchEnabled}
        replyStyle={replyStyle}
        onReplyStyleChange={setReplyStyle}
        lastUserMessage={lastUserMessage}
        onEscape={handleStop}
      />
    </div>
  );
}

```

---

## client/src/components/ai/AiMessageBubble.tsx

**Lines: 1072**

```tsx
import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, Copy, Share2, ThumbsUp, ThumbsDown, RotateCcw, Pencil, X, Globe, ChevronDown, ChevronUp, ExternalLink, FileText, RefreshCw, PanelRightOpen, Loader2, Search, Terminal, AlertTriangle, WifiOff, Clock, MessageSquarePlus, Scissors, ServerCrash, PlayCircle, AlertCircle } from "lucide-react";
import AiConfirmCard from "./AiConfirmCard";
import AiGuidedCreation from "./AiGuidedCreation";
import AIMessageContent from "./AIMessageContent";
import AgentLogo from "@/components/AgentLogo";
import ThinkingBlock from "./ThinkingBlock";
import ArtifactPanel, { isLongContent, extractArtifactTitle } from "./ArtifactPanel";

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
  codeFiles?: string[];
  codeFilesFailed?: string[];
  attachments?: { type: string; name: string; mimeType: string; base64: string; previewUrl?: string }[];
  thinking?: string;
  isThinking?: boolean;
  thinkingDuration?: number;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  retryPayload?: { text: string; attachments?: any[] };
  errorType?: 'network' | 'timeout' | 'rate_limit' | 'context_too_long' | 'service_unavailable' | 'stream_interrupted' | 'unknown';
  timestamp?: number;
  toolCalls?: { toolName: string; label: string; status: 'running' | 'complete' | 'error'; detail?: string; type?: string; completedLabel?: string }[];
  retryCount?: number;
  cooldownUntil?: number;
  partialContent?: string;
}

interface AiMessageBubbleProps {
  message: Message;
  onConfirm?: (messageId: string, actionIndex?: number) => void;
  onReject?: (messageId: string, actionIndex?: number) => void;
  onSkip?: (messageId: string, actionIndex?: number) => void;
  onConfirmAll?: (messageId: string) => void;
  onFollowUpSubmit?: (messageId: string, mergedData: Record<string, any>, creationType?: string) => void;
  onStepAnswer?: (stepLabel: string, answerLabel: string) => void;
  onRegenerate?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRetry?: (messageId: string) => void;
  onContinueGeneration?: (messageId: string) => void;
  onNewConversation?: () => void;
  onTrimAndRetry?: (messageId: string) => void;
  isLastAssistant?: boolean;
}

function BrandLogo() {
  return <AgentLogo size={28} animate={false} glow={false} />;
}

const DISLIKE_REASONS = [
  { value: 'inaccurate', label: '回答不准确' },
  { value: 'misunderstood', label: '没有理解我的问题' },
  { value: 'length', label: '回复太长/太短' },
  { value: 'format', label: '格式有问题' },
  { value: 'other', label: '其他' },
];

function AiReplyActions({ content, onRegenerate, isLastAssistant }: { content: string; onRegenerate?: () => void; isLastAssistant?: boolean }) {
  const [liked, setLiked] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({ text: content }).catch(() => {});
    } else {
      navigator.clipboard.writeText(content);
    }
  }, [content]);

  const handleDislike = useCallback(() => {
    if (liked === false) {
      setLiked(null);
      setShowFeedback(false);
      setFeedbackSubmitted(false);
    } else {
      setLiked(false);
      if (!feedbackSubmitted) setShowFeedback(true);
    }
  }, [liked, feedbackSubmitted]);

  const handleFeedbackSelect = useCallback((_reason: string) => {
    setFeedbackSubmitted(true);
    setShowFeedback(false);
  }, []);

  return (
    <div className="mt-2 ml-0.5" data-testid="ai-reply-actions">
      <div className="flex items-center gap-1">
        <button
          onClick={handleCopy}
          className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
          title={copied ? "已复制" : "复制"}
          data-testid="btn-copy-reply"
        >
          {copied ? <Check className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />}
        </button>
        {isLastAssistant && onRegenerate && (
          <button
            onClick={onRegenerate}
            className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
            title="重新生成"
            data-testid="btn-regenerate"
          >
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        )}
        <button
          onClick={handleShare}
          className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
          title="分享"
          data-testid="btn-share-reply"
        >
          <Share2 className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => setLiked(liked === true ? null : true)}
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
            liked === true
              ? "text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
          )}
          style={liked === true ? { background: 'rgba(174,86,48,0.15)', color: 'var(--brand)' } : undefined}
          title="有帮助"
          data-testid="btn-like-reply"
        >
          <ThumbsUp className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={handleDislike}
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
            liked === false
              ? "text-red-400"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
          )}
          style={liked === false ? { background: 'rgba(248,113,113,0.1)' } : undefined}
          title="不太好"
          data-testid="btn-dislike-reply"
        >
          <ThumbsDown className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
      {showFeedback && (
        <div
          className="flex flex-wrap gap-1.5 mt-2 ml-0.5"
          style={{ animation: 'messageAppear 200ms ease-out' }}
          data-testid="dislike-feedback-form"
        >
          {DISLIKE_REASONS.map((reason) => (
            <button
              key={reason.value}
              onClick={() => handleFeedbackSelect(reason.value)}
              className="text-xs px-2.5 py-1 rounded-full transition-colors"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-secondary)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              data-testid={`feedback-${reason.value}`}
            >
              {reason.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MultiConfirmGroup({
  message,
  confirmStates,
  hasUndecided,
  onConfirm,
  onReject,
  onSkip,
  onConfirmAll,
}: {
  message: Message;
  confirmStates: (boolean | null)[];
  hasUndecided: boolean;
  onConfirm: (messageId: string, actionIndex?: number) => void;
  onReject: (messageId: string, actionIndex?: number) => void;
  onSkip?: (messageId: string, actionIndex?: number) => void;
  onConfirmAll?: (messageId: string) => void;
}) {
  const [confirmingAll, setConfirmingAll] = useState(false);

  const handleConfirmAll = async () => {
    setConfirmingAll(true);
    if (onConfirmAll) {
      await onConfirmAll(message.id);
    } else {
      const undecidedIndexes = confirmStates
        .map((c, i) => (c === null ? i : -1))
        .filter((i) => i !== -1);
      for (const index of undecidedIndexes) {
        onConfirm(message.id, index);
      }
    }
    setConfirmingAll(false);
  };

  return (
    <div
      className="flex flex-col justify-start px-3 mb-6 space-y-2"
      style={{ animation: 'messageAppear 200ms ease-out' }}
      data-testid={`ai-message-${message.id}`}
    >
      {message.content && (
        <div className="max-w-full">
          <div className="mb-2">
            <BrandLogo />
          </div>
          <AIMessageContent content={message.content} />
          <AiReplyActions content={message.content} />
        </div>
      )}
      {hasUndecided && (
        <div className="max-w-[90%]">
          <button
            onClick={handleConfirmAll}
            disabled={confirmingAll}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
              confirmingAll
                ? "bg-brand/80 text-white/80 cursor-not-allowed"
                : "bg-brand text-white"
            )}
            data-testid={`confirm-all-${message.id}`}
          >
            {confirmingAll ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {confirmingAll ? "执行中..." : "全部确认"}
          </button>
        </div>
      )}
      {message.actions!.map((action, index) => (
        <div key={index} className="max-w-[90%]">
          <AiConfirmCard
            action={action}
            onConfirm={() => onConfirm(message.id, index)}
            onReject={() => onReject(message.id, index)}
            onSkip={onSkip ? () => onSkip(message.id, index) : undefined}
            confirmed={confirmStates[index] ?? null}
            skipped={message.actionSkipped?.[index] ?? false}
            index={index}
          />
        </div>
      ))}
    </div>
  );
}

function SearchSourcesBar({ results }: { results: { title: string; url: string; content: string }[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!results || results.length === 0) return null;

  const getFavicon = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
      return null;
    }
  };

  return (
    <div className="mb-3" data-testid="search-sources-bar">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-opacity opacity-90 hover:opacity-100"
        style={{ color: 'var(--text-secondary)' }}
        data-testid="toggle-sources"
      >
        <Globe className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Sources</span>
        <span style={{ color: 'var(--text-secondary)' }}>
          {results.slice(0, 3).map(r => r.title.slice(0, 20) + (r.title.length > 20 ? '...' : '')).join(' \u00B7 ')}
          {results.length > 3 && ` +${results.length - 3}`}
        </span>
        {expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
      </button>

      {expanded && (
        <div
          className="mt-1.5 rounded-lg overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {results.map((r, i) => {
            const favicon = getFavicon(r.url);
            return (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 px-3 py-2.5 transition-opacity opacity-90 hover:opacity-100"
                style={{ textDecoration: 'none', borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                data-testid={`source-link-${i}`}
              >
                {favicon && (
                  <img src={favicon} alt="" className="w-4 h-4 mt-0.5 rounded-sm shrink-0" style={{ opacity: 0.8 }} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.title}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
                  </div>
                  <div className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)', opacity: 0.7, lineHeight: 1.4 }}>
                    {r.content.slice(0, 120)}{r.content.length > 120 ? '...' : ''}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TokenUsageBadge({ usage }: { usage: { promptTokens: number; completionTokens: number; totalTokens: number } }) {
  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return `${n}`;
  };
  return (
    <span
      className="text-[10px] text-[var(--text-tertiary)] ml-1"
      title={`Prompt: ${usage.promptTokens} | Completion: ${usage.completionTokens} | Total: ${usage.totalTokens}`}
      data-testid="token-usage-badge"
    >
      {formatTokens(usage.totalTokens)} tokens
    </span>
  );
}

function MessageTimestamp({ timestamp }: { timestamp: number }) {
  const time = new Date(timestamp);
  const h = time.getHours().toString().padStart(2, '0');
  const m = time.getMinutes().toString().padStart(2, '0');
  return (
    <span className="text-[10px] text-[var(--text-tertiary)] ml-auto" data-testid="message-timestamp">
      {h}:{m}
    </span>
  );
}

function getToolIcon(type?: string) {
  switch (type) {
    case 'search': return Search;
    case 'file': return FileText;
    case 'code': return Terminal;
    default: return Terminal;
  }
}

function ToolCallCard({ toolCall, index }: { toolCall: { toolName: string; label: string; status: 'running' | 'complete' | 'error'; detail?: string; type?: string; completedLabel?: string }; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getToolIcon(toolCall.type);
  const isRunning = toolCall.status === 'running';
  const isError = toolCall.status === 'error';
  const displayLabel = toolCall.status === 'complete' && toolCall.completedLabel
    ? toolCall.completedLabel
    : toolCall.label;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: isError
          ? 'rgba(239,68,68,0.08)'
          : 'rgba(255,255,255,0.04)',
        border: isError
          ? '1px solid rgba(239,68,68,0.2)'
          : '1px solid rgba(255,255,255,0.06)',
      }}
      data-testid={`tool-call-card-${index}`}
    >
      <button
        onClick={() => !isRunning && toolCall.detail && setExpanded(!expanded)}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-left"
        style={{
          cursor: !isRunning && toolCall.detail ? 'pointer' : 'default',
        }}
        data-testid={`tool-call-toggle-${index}`}
      >
        {isRunning ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: 'var(--brand, #AE5630)' }} />
        ) : isError ? (
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: '#F87171' }} />
        ) : (
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: '#4ADE80' }} />
        )}
        <span
          className="text-xs flex-1 truncate"
          style={{
            color: isError
              ? '#FCA5A5'
              : isRunning
                ? 'var(--text-primary)'
                : 'var(--text-secondary)',
            fontWeight: isRunning ? 500 : 400,
          }}
        >
          {displayLabel}
        </span>
        {!isRunning && toolCall.detail && (
          expanded
            ? <ChevronUp className="w-3 h-3 shrink-0" style={{ color: 'var(--text-secondary)' }} />
            : <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'var(--text-secondary)' }} />
        )}
      </button>
      {expanded && toolCall.detail && (
        <div
          className="px-3 pb-2 text-xs"
          style={{
            color: 'var(--text-secondary)',
            opacity: 0.8,
            lineHeight: 1.5,
            borderTop: '1px solid rgba(255,255,255,0.04)',
            paddingTop: 8,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 200,
            overflowY: 'auto',
          }}
          data-testid={`tool-call-detail-${index}`}
        >
          {toolCall.detail}
        </div>
      )}
    </div>
  );
}

function CooldownTimer({ cooldownUntil }: { cooldownUntil: number }) {
  const [remaining, setRemaining] = useState(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => {
      const r = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil, remaining]);

  if (remaining <= 0) return null;
  return (
    <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }} data-testid="cooldown-timer">
      {remaining}s
    </span>
  );
}

function ErrorBlock({
  message,
  onRetry,
  onContinueGeneration,
  onNewConversation,
  onTrimAndRetry,
}: {
  message: Message;
  onRetry?: (messageId: string) => void;
  onContinueGeneration?: (messageId: string) => void;
  onNewConversation?: () => void;
  onTrimAndRetry?: (messageId: string) => void;
}) {
  const errorType = message.errorType || 'unknown';

  const errorConfig: Record<string, { icon: typeof WifiOff; title: string; description: string; bgColor: string; borderColor: string; iconColor: string }> = {
    network: {
      icon: WifiOff,
      title: 'Connection lost',
      description: message.retryCount && message.retryCount > 0
        ? `Auto-retrying... (attempt ${message.retryCount}/3)`
        : 'Network connection interrupted. Retrying automatically...',
      bgColor: 'rgba(239,68,68,0.08)',
      borderColor: 'rgba(239,68,68,0.2)',
      iconColor: '#ef4444',
    },
    rate_limit: {
      icon: Clock,
      title: 'Rate limited',
      description: 'Too many requests. Please wait before trying again.',
      bgColor: 'rgba(245,158,11,0.08)',
      borderColor: 'rgba(245,158,11,0.2)',
      iconColor: '#f59e0b',
    },
    context_too_long: {
      icon: AlertCircle,
      title: 'Context too long',
      description: 'The conversation has exceeded the maximum context length.',
      bgColor: 'rgba(139,92,246,0.08)',
      borderColor: 'rgba(139,92,246,0.2)',
      iconColor: '#8b5cf6',
    },
    service_unavailable: {
      icon: ServerCrash,
      title: 'Service unavailable',
      description: 'The AI service is temporarily overloaded. Try a different model or wait a moment.',
      bgColor: 'rgba(245,158,11,0.08)',
      borderColor: 'rgba(245,158,11,0.2)',
      iconColor: '#f59e0b',
    },
    stream_interrupted: {
      icon: AlertTriangle,
      title: 'Response interrupted',
      description: 'The response was cut short. You can continue from where it stopped.',
      bgColor: 'rgba(59,130,246,0.08)',
      borderColor: 'rgba(59,130,246,0.2)',
      iconColor: '#3b82f6',
    },
    timeout: {
      icon: Clock,
      title: 'Response timed out',
      description: 'No data received for 45 seconds.',
      bgColor: 'rgba(245,158,11,0.08)',
      borderColor: 'rgba(245,158,11,0.2)',
      iconColor: '#f59e0b',
    },
    unknown: {
      icon: AlertTriangle,
      title: 'Something went wrong',
      description: message.content || 'An unexpected error occurred.',
      bgColor: 'rgba(239,68,68,0.08)',
      borderColor: 'rgba(239,68,68,0.2)',
      iconColor: '#ef4444',
    },
  };

  const config = errorConfig[errorType] || errorConfig.unknown;
  const IconComponent = config.icon;
  const isAutoRetrying = errorType === 'network' && message.retryCount !== undefined && message.retryCount > 0 && message.retryCount < 3;
  const cooldownActive = errorType === 'rate_limit' && message.cooldownUntil && message.cooldownUntil > Date.now();

  return (
    <div
      className="flex flex-col px-3 mb-6 gap-2"
      style={{ animation: 'messageAppear 200ms ease-out' }}
      data-testid={`ai-message-${message.id}`}
    >
      <div
        className="rounded-lg px-4 py-3"
        style={{
          background: config.bgColor,
          border: `1px solid ${config.borderColor}`,
          maxWidth: '90%',
        }}
        data-testid={`error-block-${errorType}`}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            {isAutoRetrying ? (
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: config.iconColor }} />
            ) : (
              <IconComponent className="w-4 h-4" style={{ color: config.iconColor }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }} data-testid="error-title">
              {config.title}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }} data-testid="error-description">
              {config.description}
            </div>
          </div>
          {cooldownActive && <CooldownTimer cooldownUntil={message.cooldownUntil!} />}
        </div>

        {message.partialContent && errorType === 'stream_interrupted' && (
          <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${config.borderColor}` }}>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Partial response received ({message.partialContent.length} chars)
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {errorType === 'stream_interrupted' && onContinueGeneration && (
            <button
              onClick={() => onContinueGeneration(message.id)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors font-medium"
              style={{
                background: 'rgba(59,130,246,0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(59,130,246,0.25)',
              }}
              data-testid="btn-continue-generation"
            >
              <PlayCircle size={12} />
              Continue generating
            </button>
          )}

          {errorType === 'context_too_long' && (
            <>
              {onNewConversation && (
                <button
                  onClick={onNewConversation}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors font-medium"
                  style={{
                    background: 'rgba(139,92,246,0.15)',
                    color: '#a78bfa',
                    border: '1px solid rgba(139,92,246,0.25)',
                  }}
                  data-testid="btn-new-conversation"
                >
                  <MessageSquarePlus size={12} />
                  Start new conversation
                </button>
              )}
              {onTrimAndRetry && (
                <button
                  onClick={() => onTrimAndRetry(message.id)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors font-medium"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: 'var(--text-secondary)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  data-testid="btn-trim-retry"
                >
                  <Scissors size={12} />
                  Trim context & retry
                </button>
              )}
            </>
          )}

          {!isAutoRetrying && errorType !== 'context_too_long' && onRetry && message.retryPayload && (
            <button
              onClick={() => onRetry(message.id)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors font-medium"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-secondary)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              disabled={!!cooldownActive}
              data-testid="btn-retry"
            >
              <RefreshCw size={12} />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AiMessageBubble({
  message,
  onConfirm,
  onReject,
  onSkip,
  onConfirmAll,
  onFollowUpSubmit,
  onStepAnswer,
  onRegenerate,
  onEditMessage,
  onRetry,
  onContinueGeneration,
  onNewConversation,
  onTrimAndRetry,
  isLastAssistant,
}: AiMessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [artifactOpen, setArtifactOpen] = useState(false);
  if (message.role === "system") {
    if (message.errorType && message.errorType !== 'unknown') {
      return (
        <ErrorBlock
          message={message}
          onRetry={onRetry}
          onContinueGeneration={onContinueGeneration}
          onNewConversation={onNewConversation}
          onTrimAndRetry={onTrimAndRetry}
        />
      );
    }

    const isSuccess = message.content.includes("成功") || message.content.includes("已");
    const isError = !!message.retryPayload;
    return (
      <div
        className="flex flex-col items-center px-3 mb-6 gap-2"
        data-testid={`ai-message-${message.id}`}
      >
        {isError ? (
          <ErrorBlock
            message={message}
            onRetry={onRetry}
          />
        ) : (
          <span
            className={cn(
              "text-xs px-3 py-1 rounded-full",
              isSuccess
                ? "bg-brand/10 text-brand dark:text-brand-light"
                : "bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"
            )}
          >
            {message.content}
          </span>
        )}
      </div>
    );
  }

  if (message.role === "user") {
    if (isEditing) {
      return (
        <div
          className="flex justify-end px-3 mb-6"
          style={{ animation: 'messageAppear 200ms ease-out' }}
          data-testid={`ai-message-${message.id}`}
        >
          <div style={{ maxWidth: '82%', width: '100%' }}>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                background: '#000000',
                borderRadius: 18,
                padding: '10px 14px',
                fontFamily: 'var(--font-sans)',
                fontSize: 16,
                lineHeight: 1.5,
                color: 'var(--text-primary)',
                border: '1px solid var(--brand)',
                outline: 'none',
                resize: 'none',
                minHeight: 60,
              }}
              data-testid="edit-message-input"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => { setIsEditing(false); setEditText(message.content); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-white/5 transition-colors"
                data-testid="btn-cancel-edit"
              >
                <X className="w-3.5 h-3.5" />
                取消
              </button>
              <button
                onClick={() => {
                  const trimmed = editText.trim();
                  if (trimmed && trimmed !== message.content && onEditMessage) {
                    onEditMessage(message.id, trimmed);
                  }
                  setIsEditing(false);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
                style={{ background: 'var(--brand)' }}
                data-testid="btn-submit-edit"
              >
                <Check className="w-3.5 h-3.5" />
                发送
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="group flex justify-end px-3 mb-6"
        style={{ animation: 'messageAppear 200ms ease-out' }}
        data-testid={`ai-message-${message.id}`}
      >
        {onEditMessage && (
          <button
            onClick={() => { setEditText(message.content); setIsEditing(true); }}
            className="self-start mt-2 mr-2 flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
            title="编辑消息"
            data-testid="btn-edit-message"
          >
            <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        )}
        <div
          style={{
            maxWidth: '82%',
            background: '#000000',
            borderRadius: 18,
            padding: '10px 14px',
            fontFamily: 'var(--font-sans)',
            fontSize: 16,
            lineHeight: 1.5,
            color: 'var(--text-primary)',
            wordBreak: 'break-word',
          }}
          className="whitespace-pre-wrap"
          data-testid={`user-bubble-${message.id}`}
        >
          {message.attachments && message.attachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: message.content ? 8 : 0 }}>
              {message.attachments.map((att, i) => (
                att.type === 'image' ? (
                  <img
                    key={i}
                    src={att.previewUrl || `data:${att.mimeType};base64,${att.base64}`}
                    alt={att.name}
                    style={{
                      maxWidth: 200,
                      maxHeight: 200,
                      borderRadius: 12,
                      objectFit: 'cover',
                    }}
                    data-testid={`attachment-image-${i}`}
                  />
                ) : (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 8,
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                    }}
                    data-testid={`attachment-file-${i}`}
                  >
                    <FileText size={14} />
                    {att.name}
                  </div>
                )
              ))}
            </div>
          )}
          {message.content}
          {message.timestamp != null && (
            <div className="flex justify-end mt-1">
              <MessageTimestamp timestamp={message.timestamp} />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (
    message.type === "confirm" &&
    message.action &&
    onConfirm &&
    onReject
  ) {
    return (
      <div
        className="flex justify-start px-3 mb-6"
        style={{ animation: 'messageAppear 200ms ease-out' }}
        data-testid={`ai-message-${message.id}`}
      >
        <div className="max-w-[90%]">
          <AiConfirmCard
            action={message.action}
            onConfirm={() => onConfirm(message.id)}
            onReject={() => onReject(message.id)}
            onSkip={onSkip ? () => onSkip(message.id) : undefined}
            confirmed={message.confirmed ?? null}
            skipped={message.skipped ?? false}
          />
        </div>
      </div>
    );
  }

  if (
    message.type === "multi_confirm" &&
    message.actions &&
    onConfirm &&
    onReject
  ) {
    const confirmStates = message.actionConfirmed ?? message.actions.map(() => null);
    const hasUndecided = confirmStates.some((c) => c === null);
    return (
      <MultiConfirmGroup
        message={message}
        confirmStates={confirmStates}
        hasUndecided={hasUndecided}
        onConfirm={onConfirm}
        onReject={onReject}
        onSkip={onSkip}
        onConfirmAll={onConfirmAll}
      />
    );
  }

  if (message.type === "follow_up" && message.followUp && onFollowUpSubmit) {
    const hasSteps = message.followUp.steps && message.followUp.steps.length > 0;
    if (!hasSteps) {
      return (
        <div className="flex justify-start px-3 mb-6" style={{ animation: 'messageAppear 200ms ease-out' }} data-testid={`ai-message-${message.id}`}>
          <div className="max-w-full">
            <div className="mb-2"><BrandLogo /></div>
            <AIMessageContent content={message.followUp.message || message.content} />
            <AiReplyActions content={message.followUp.message || message.content} />
          </div>
        </div>
      );
    }
    return (
      <div className="px-3 mb-6" style={{ animation: 'messageAppear 200ms ease-out' }} data-testid={`ai-message-${message.id}`}>
        <AiGuidedCreation
          followUp={message.followUp as any}
          onComplete={(mergedData, creationType) => onFollowUpSubmit(message.id, mergedData, creationType)}
          completed={message.followUpSubmitted}
          onStepAnswer={onStepAnswer}
        />
      </div>
    );
  }

  const showArtifactButton = !message.isStreaming && isLongContent(message.content);

  return (
    <div
      className="group flex justify-start px-3 mb-6"
      style={{ animation: 'messageAppear 200ms ease-out' }}
      data-testid={`ai-message-${message.id}`}
    >
      <div className="max-w-3xl">
        <div className="mb-2 flex items-center gap-2">
          <BrandLogo />
          {message.timestamp != null && (
            <MessageTimestamp timestamp={message.timestamp} />
          )}
        </div>
        {message.thinking && (
          <ThinkingBlock
            content={message.thinking}
            isStreaming={message.isThinking}
            duration={message.thinkingDuration}
          />
        )}
        {message.searchResults && message.searchResults.length > 0 && (
          <SearchSourcesBar results={message.searchResults} />
        )}
        {message.codeFiles && message.codeFiles.length > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2 text-xs"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#93C5FD' }}
            data-testid="code-files-info"
          >
            <span style={{ fontSize: 14 }}>📂</span>
            <span>已加载 {message.codeFiles.length} 个代码文件</span>
            {message.codeFilesFailed && message.codeFilesFailed.length > 0 && (
              <span style={{ color: '#FCA5A5' }}>· {message.codeFilesFailed.length} 个未找到</span>
            )}
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-3" data-testid="tool-calls-info">
            {message.toolCalls.map((tc, i) => (
              <ToolCallCard key={i} toolCall={tc} index={i} />
            ))}
          </div>
        )}
        <div className={message.isStreaming ? 'streaming-cursor' : ''}>
          <AIMessageContent content={message.content} />
        </div>
        {showArtifactButton && (
          <button
            onClick={() => setArtifactOpen(true)}
            className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-secondary)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            data-testid={`btn-open-artifact-${message.id}`}
          >
            <PanelRightOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
            Open in panel
          </button>
        )}
        {!message.isStreaming && (
          <div className="flex items-center">
            <AiReplyActions
              content={message.content}
              onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
              isLastAssistant={isLastAssistant}
            />
            {message.tokenUsage && <TokenUsageBadge usage={message.tokenUsage} />}
          </div>
        )}
      </div>
      {artifactOpen && (
        <ArtifactPanel
          content={message.content}
          title={extractArtifactTitle(message.content)}
          isOpen={artifactOpen}
          onClose={() => setArtifactOpen(false)}
          messageId={message.id}
        />
      )}
    </div>
  );
}

```

---

## client/src/components/ai/AIMessageContent.tsx

**Lines: 417**

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, useRef, useMemo, useCallback, type ReactNode } from 'react';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import xml from 'highlight.js/lib/languages/xml';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import rust from 'highlight.js/lib/languages/rust';
import { Copy, Check, Share2 } from 'lucide-react';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('jsx', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('css', css);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('rust', rust);

interface AIMessageContentProps {
  content: string;
}

function ActionButton({ onClick, icon, label, doneLabel, doneIcon, testId }: {
  onClick: () => Promise<void> | void;
  icon: ReactNode;
  label: string;
  doneLabel: string;
  doneIcon: ReactNode;
  testId?: string;
}) {
  const [done, setDone] = useState(false);

  const handleClick = useCallback(async () => {
    try {
      await onClick();
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {}
  }, [onClick]);

  return (
    <button
      onClick={handleClick}
      style={{
        fontSize: 12,
        color: 'var(--text-secondary)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px',
        borderRadius: 4,
        transition: 'background 150ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      data-testid={testId || `btn-${label.toLowerCase()}`}
    >
      {done ? doneIcon : icon}
      <span>{done ? doneLabel : label}</span>
    </button>
  );
}

function copyText(text: string) {
  return navigator.clipboard.writeText(text);
}

async function shareText(text: string) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {}
  }
  await navigator.clipboard.writeText(text);
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const highlighted = useMemo(() => {
    try {
      if (language && language !== 'code' && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language }).value;
      }
      const auto = hljs.highlightAuto(code);
      if (auto.relevance > 5) return auto.value;
    } catch {}
    return null;
  }, [code, language]);

  return (
    <div style={{
      background: 'var(--bg-code)',
      borderRadius: 8,
      overflow: 'hidden',
      margin: '16px 0',
    }}>
      <div style={{
        background: 'var(--bg-code-header)',
        padding: '6px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>{language}</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <ActionButton
            onClick={() => copyText(code)}
            icon={<Copy className="w-3.5 h-3.5" />}
            label="Copy"
            doneLabel="Copied!"
            doneIcon={<Check className="w-3.5 h-3.5" />}
            testId="btn-copy-code"
          />
          <ActionButton
            onClick={() => shareText(code)}
            icon={<Share2 className="w-3.5 h-3.5" />}
            label="Share"
            doneLabel="Shared!"
            doneIcon={<Check className="w-3.5 h-3.5" />}
            testId="btn-share-code"
          />
        </div>
      </div>
      <pre style={{
        padding: '14px 16px',
        margin: 0,
        overflowX: 'auto',
        overflowY: 'auto',
        maxHeight: 400,
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-x pan-y',
      }}>
        {highlighted ? (
          <code
            className="hljs"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13.5,
              lineHeight: 1.55,
            }}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <code style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13.5,
            lineHeight: 1.55,
            color: 'var(--text-primary)',
          }}>{code}</code>
        )}
      </pre>
    </div>
  );
}

function TableBlock({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);
  const dragState = useRef<{ isDown: boolean; startX: number; scrollLeft: number }>({ isDown: false, startX: 0, scrollLeft: 0 });

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const canScroll = el.scrollWidth > el.clientWidth;
    const notAtEnd = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setShowFade(canScroll && notAtEnd);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    dragState.current = { isDown: true, startX: e.clientX, scrollLeft: el.scrollLeft };
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
    el.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.isDown) return;
    const el = scrollRef.current;
    if (!el) return;
    const dx = e.clientX - dragState.current.startX;
    el.scrollLeft = dragState.current.scrollLeft - dx;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragState.current.isDown = false;
    const el = scrollRef.current;
    if (!el) return;
    el.style.cursor = 'grab';
    el.style.userSelect = '';
    el.releasePointerCapture(e.pointerId);
  }, []);

  const extractTableText = useCallback(() => {
    const container = containerRef.current;
    if (!container) return '';
    const rows = container.querySelectorAll('tr');
    const mdLines: string[] = [];
    let isFirstRow = true;
    rows.forEach(row => {
      const cells = row.querySelectorAll('th, td');
      const cellTexts: string[] = [];
      cells.forEach(cell => cellTexts.push((cell as HTMLElement).innerText.trim()));
      mdLines.push('| ' + cellTexts.join(' | ') + ' |');
      if (isFirstRow) {
        mdLines.push('| ' + cellTexts.map(() => '---').join(' | ') + ' |');
        isFirstRow = false;
      }
    });
    return mdLines.join('\n');
  }, []);

  return (
    <div ref={containerRef} style={{ margin: '16px 0', position: 'relative' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 2,
        marginBottom: 4,
      }}>
        <ActionButton
          onClick={() => copyText(extractTableText())}
          icon={<Copy className="w-3.5 h-3.5" />}
          label="Copy"
          doneLabel="Copied!"
          doneIcon={<Check className="w-3.5 h-3.5" />}
          testId="btn-copy-table"
        />
        <ActionButton
          onClick={() => shareText(extractTableText())}
          icon={<Share2 className="w-3.5 h-3.5" />}
          label="Share"
          doneLabel="Shared!"
          doneIcon={<Check className="w-3.5 h-3.5" />}
          testId="btn-share-table"
        />
      </div>
      <div
        ref={(el) => {
          (scrollRef as any).current = el;
          if (el) {
            requestAnimationFrame(checkScroll);
            if (el.scrollWidth > el.clientWidth) el.style.cursor = 'grab';
          }
        }}
        onScroll={checkScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
        }}
        data-testid="table-scroll-container"
      >
        <table className="ai-table-zebra" style={{ width: '100%', minWidth: 'max-content', borderCollapse: 'collapse', fontSize: 14 }}>
          {children}
        </table>
      </div>
      {showFade && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 24,
          bottom: 0,
          width: 40,
          background: 'linear-gradient(to right, transparent, var(--bg-main))',
          pointerEvents: 'none',
          borderRadius: '0 8px 8px 0',
        }} />
      )}
    </div>
  );
}

export default function AIMessageContent({ content }: AIMessageContentProps) {
  return (
    <div
      style={{
        fontFamily: "Georgia, 'Noto Serif SC', 'Source Han Serif SC', serif",
        fontSize: '16px',
        lineHeight: '1.65',
        letterSpacing: '0.02em',
        color: 'var(--text-primary)',
      }}
      data-testid="ai-message-content"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p style={{ marginBottom: 16, marginTop: 0 }}>{children}</p>
          ),
          h1: ({ children }) => (
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-bright)', margin: '28px 0 14px', fontFamily: 'inherit' }}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-bright)', margin: '24px 0 12px', fontFamily: 'inherit' }}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-bright)', margin: '24px 0 12px', fontFamily: 'inherit' }}>{children}</h3>
          ),
          strong: ({ children }) => (
            <strong style={{ fontWeight: 700, color: 'var(--text-bright)' }}>{children}</strong>
          ),
          em: ({ children }) => (
            <em style={{ fontStyle: 'italic' }}>{children}</em>
          ),
          ul: ({ children }) => (
            <ul style={{ paddingLeft: 20, marginBottom: 16, marginTop: 0 }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ paddingLeft: 20, marginBottom: 16, marginTop: 0 }}>{children}</ol>
          ),
          li: ({ children }) => (
            <li style={{ marginBottom: 8, color: 'var(--text-primary)' }}>{children}</li>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-icon)', textDecoration: 'underline' }}>{children}</a>
          ),
          blockquote: ({ children }) => (
            <blockquote style={{
              borderLeft: '3px solid var(--brand)',
              paddingLeft: 16,
              margin: '16px 0',
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
            }}>{children}</blockquote>
          ),
          pre: ({ children }) => {
            const codeChild = children as any;
            const props = codeChild?.props || {};
            const className = props.className || '';
            const language = className ? className.replace('language-', '') : 'code';
            const rawCode = String(props.children || '').replace(/\n$/, '');
            return <CodeBlock language={language} code={rawCode} />;
          },
          code: ({ children, className }) => {
            if (className) {
              return <code className={className}>{children}</code>;
            }
            return (
              <code style={{
                background: 'var(--bg-code)',
                borderRadius: 4,
                padding: '2px 6px',
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                color: 'var(--brand-icon)',
              }}>{children}</code>
            );
          },
          hr: () => (
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '24px 0' }} />
          ),
          table: ({ children }) => (
            <TableBlock>{children}</TableBlock>
          ),
          th: ({ children }) => (
            <th style={{
              borderBottom: '2px solid var(--border-medium)',
              padding: '8px 12px',
              textAlign: 'left',
              fontWeight: 600,
              color: 'var(--text-bright)',
              whiteSpace: 'nowrap',
            }}>{children}</th>
          ),
          td: ({ children }) => (
            <td style={{
              borderBottom: '1px solid var(--border-subtle)',
              padding: '8px 12px',
              whiteSpace: 'nowrap',
            }}>{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

```

---

## client/src/components/ai/AiInputBar.tsx

**Lines: 987**

```tsx
import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowUp, Plus, Square, X, Globe, Palette, FileText, Image, Camera, Atom, FolderOpen, LayoutGrid, ChevronRight, Code, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Attachment {
  type: 'image' | 'file';
  name: string;
  mimeType: string;
  base64: string;
  previewUrl?: string;
}

interface AiInputBarProps {
  onSend: (message: string, attachments?: Attachment[]) => void;
  loading: boolean;
  onStop?: () => void;
  webSearchEnabled?: boolean;
  onWebSearchToggle?: (enabled: boolean) => void;
  codeContextEnabled?: boolean;
  onCodeContextToggle?: (enabled: boolean) => void;
  knowledgeBaseEnabled?: boolean;
  onKnowledgeBaseToggle?: (enabled: boolean) => void;
  researchEnabled?: boolean;
  onResearchToggle?: (enabled: boolean) => void;
  replyStyle?: string;
  onReplyStyleChange?: (style: string) => void;
  lastUserMessage?: string;
  onEscape?: () => void;
}

const REPLY_STYLES = [
  { value: 'normal', label: '正常', description: '平衡详细与简洁' },
  { value: 'concise', label: '简洁', description: '简短直接的回答' },
  { value: 'detailed', label: '详细', description: '深入全面的解释' },
  { value: 'professional', label: '专业', description: '正式的商务语气' },
  { value: 'casual', label: '随意', description: '轻松友好的对话' },
];

function useSheetBounce(scrollRef: React.RefObject<HTMLDivElement | null>) {
  const lastY = useRef(0);
  const pulling = useRef(false);
  const pullDir = useRef<'top' | 'bottom' | null>(null);
  const accumulated = useRef(0);
  const edgeY = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const getContentEl = () => el.firstElementChild as HTMLElement | null;

    const onTouchStart = (e: TouchEvent) => {
      lastY.current = e.touches[0].clientY;
      const content = getContentEl();
      if (content) { content.style.transition = 'none'; content.style.transform = 'translateY(0)'; }
      pulling.current = false; pullDir.current = null; accumulated.current = 0; edgeY.current = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const content = getContentEl();
      if (!content) return;
      const touchY = e.touches[0].clientY;
      const moveDir = touchY - lastY.current;
      lastY.current = touchY;
      const atTop = el.scrollTop <= 0;
      const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;

      if (pulling.current) {
        const rawDelta = touchY - edgeY.current;
        if ((pullDir.current === 'top' && rawDelta <= 0) || (pullDir.current === 'bottom' && rawDelta >= 0)) {
          content.style.transform = 'translateY(0)';
          pulling.current = false; pullDir.current = null; accumulated.current = 0;
          return;
        }
        const dampened = rawDelta * 0.4;
        accumulated.current = dampened;
        content.style.transform = `translateY(${dampened}px)`;
        e.preventDefault();
        return;
      }
      if (atTop && moveDir > 0) {
        pulling.current = true; pullDir.current = 'top'; edgeY.current = touchY; accumulated.current = 0; e.preventDefault();
      } else if (atBottom && moveDir < 0) {
        pulling.current = true; pullDir.current = 'bottom'; edgeY.current = touchY; accumulated.current = 0; e.preventDefault();
      }
    };
    const onTouchEnd = () => {
      const content = getContentEl();
      if (!content) return;
      if (pulling.current && accumulated.current !== 0) {
        content.style.transition = 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)';
        content.style.transform = 'translateY(0)';
      }
      pulling.current = false; pullDir.current = null; accumulated.current = 0;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => { el.removeEventListener('touchstart', onTouchStart); el.removeEventListener('touchmove', onTouchMove); el.removeEventListener('touchend', onTouchEnd); };
  }, [scrollRef]);
}

function AddToChatSheet({
  open,
  onClose,
  webSearchEnabled,
  onWebSearchToggle,
  codeContextEnabled,
  onCodeContextToggle,
  knowledgeBaseEnabled,
  onKnowledgeBaseToggle,
  researchEnabled,
  onResearchToggle,
  replyStyle,
  onReplyStyleChange,
  onAttach,
}: {
  open: boolean;
  onClose: () => void;
  webSearchEnabled: boolean;
  onWebSearchToggle: (enabled: boolean) => void;
  codeContextEnabled: boolean;
  onCodeContextToggle: (enabled: boolean) => void;
  knowledgeBaseEnabled: boolean;
  onKnowledgeBaseToggle: (enabled: boolean) => void;
  researchEnabled: boolean;
  onResearchToggle: (enabled: boolean) => void;
  replyStyle: string;
  onReplyStyleChange: (style: string) => void;
  onAttach: (attachments: Attachment[]) => void;
}) {
  const [showStylePicker, setShowStylePicker] = useState(false);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  useSheetBounce(sheetScrollRef);
  const cameraRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) setShowStylePicker(false);
  }, [open]);

  if (!open) return null;

  const currentStyleLabel = REPLY_STYLES.find(s => s.value === replyStyle)?.label || '正常';

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const totalFiles = fileArray.length;
    const newAttachments: Attachment[] = [];
    let processed = 0;
    fileArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const isImage = file.type.startsWith('image/');
        const attachment: Attachment = {
          type: isImage ? 'image' : 'file',
          name: file.name,
          mimeType: file.type,
          base64,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        };
        newAttachments.push(attachment);
        processed++;
        if (processed === totalFiles) {
          onAttach(newAttachments);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
        data-testid="add-to-chat-backdrop"
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          animation: 'slideUpSheet 250ms ease-out',
        }}
        data-testid="add-to-chat-sheet"
      >
        <div
          style={{
            background: '#1E1D1B',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '70vh',
          }}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ flexShrink: 0 }}>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              data-testid="btn-close-sheet"
            >
              <X className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
            <span className="text-sm font-medium text-[var(--text-primary)]">添加到对话</span>
            <div className="w-8" />
          </div>

          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" style={{ flexShrink: 0 }} />

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
            data-testid="input-camera"
          />
          <input
            ref={photosRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
            data-testid="input-photos"
          />
          <input
            ref={filesRef}
            type="file"
            accept=".pdf,.txt,.csv,.json,.md,.doc,.docx,.xls,.xlsx"
            style={{ display: 'none' }}
            onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
            data-testid="input-files"
          />

          <div
            ref={sheetScrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              overscrollBehavior: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
          <div>

          {showStylePicker ? (
            <div className="px-5 pb-2">
              <button
                onClick={() => setShowStylePicker(false)}
                className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-3 hover:text-[var(--text-primary)] transition-colors"
                data-testid="btn-style-back"
              >
                ← 返回
              </button>
              <div className="space-y-1">
                {REPLY_STYLES.map(style => (
                  <button
                    key={style.value}
                    onClick={() => {
                      onReplyStyleChange(style.value);
                      setShowStylePicker(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors",
                      replyStyle === style.value
                        ? "bg-[var(--brand)]/15 text-[var(--brand)]"
                        : "hover:bg-white/5 text-[var(--text-primary)]"
                    )}
                    data-testid={`style-option-${style.value}`}
                  >
                    <div className="text-left">
                      <div className="text-sm font-medium">{style.label}</div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">{style.description}</div>
                    </div>
                    {replyStyle === style.value && (
                      <div className="w-5 h-5 rounded-full bg-[var(--brand)] flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 px-5 mb-5">
                {[
                  { icon: Camera, label: '相机', testId: 'btn-camera', ref: cameraRef },
                  { icon: Image, label: '图片', testId: 'btn-photos', ref: photosRef },
                  { icon: FileText, label: '文件', testId: 'btn-files', ref: filesRef },
                ].map(item => (
                  <button
                    key={item.testId}
                    onClick={() => item.ref.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl transition-colors"
                    style={{
                      background: '#2A2928',
                      cursor: 'pointer',
                    }}
                    data-testid={item.testId}
                  >
                    <item.icon className="w-6 h-6 text-[var(--text-primary)]" strokeWidth={1.5} />
                    <span className="text-xs text-[var(--text-secondary)]">{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="px-5 space-y-1">
                <div
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => onResearchToggle(!researchEnabled)}
                  data-testid="toggle-research"
                >
                  <div className="flex items-center gap-3">
                    <Atom className="w-5 h-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
                    <span className="text-sm text-[var(--text-primary)]">深度研究</span>
                  </div>
                  <div
                    className="relative w-11 h-6 rounded-full transition-colors duration-200"
                    style={{
                      background: researchEnabled ? '#3B82F6' : 'rgba(255,255,255,0.15)',
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                      style={{
                        transform: researchEnabled ? 'translateX(22px)' : 'translateX(2px)',
                      }}
                    />
                  </div>
                </div>

                <div
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => onWebSearchToggle(!webSearchEnabled)}
                  data-testid="toggle-web-search"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
                    <span className="text-sm text-[var(--text-primary)]">网页搜索</span>
                  </div>
                  <div
                    className="relative w-11 h-6 rounded-full transition-colors duration-200"
                    style={{
                      background: webSearchEnabled ? '#3B82F6' : 'rgba(255,255,255,0.15)',
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                      style={{
                        transform: webSearchEnabled ? 'translateX(22px)' : 'translateX(2px)',
                      }}
                    />
                  </div>
                </div>

                <div
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => onCodeContextToggle(!codeContextEnabled)}
                  data-testid="toggle-code-context"
                >
                  <div className="flex items-center gap-3">
                    <Code className="w-5 h-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
                    <span className="text-sm text-[var(--text-primary)]">代码上下文</span>
                  </div>
                  <div
                    className="relative w-11 h-6 rounded-full transition-colors duration-200"
                    style={{
                      background: codeContextEnabled ? '#3B82F6' : 'rgba(255,255,255,0.15)',
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                      style={{
                        transform: codeContextEnabled ? 'translateX(22px)' : 'translateX(2px)',
                      }}
                    />
                  </div>
                </div>

                <div
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => onKnowledgeBaseToggle(!knowledgeBaseEnabled)}
                  data-testid="toggle-knowledge-base"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
                    <span className="text-sm text-[var(--text-primary)]">知识库</span>
                  </div>
                  <div
                    className="relative w-11 h-6 rounded-full transition-colors duration-200"
                    style={{
                      background: knowledgeBaseEnabled ? '#3B82F6' : 'rgba(255,255,255,0.15)',
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                      style={{
                        transform: knowledgeBaseEnabled ? 'translateX(22px)' : 'translateX(2px)',
                      }}
                    />
                  </div>
                </div>

                <div
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  data-testid="btn-add-to-project"
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className="w-5 h-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
                    <span className="text-sm text-[var(--text-primary)]">添加到项目</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-[var(--text-secondary)] max-w-[120px] truncate">未选择</span>
                    <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" strokeWidth={2} />
                  </div>
                </div>

                <div
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => setShowStylePicker(true)}
                  data-testid="btn-choose-style"
                >
                  <div className="flex items-center gap-3">
                    <Palette className="w-5 h-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
                    <span className="text-sm text-[var(--text-primary)]">回复风格</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-[var(--text-secondary)]">{currentStyleLabel}</span>
                    <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" strokeWidth={2} />
                  </div>
                </div>

                <div
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  data-testid="btn-manage-connectors"
                >
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="w-5 h-5 text-[var(--text-secondary)]" strokeWidth={1.5} />
                    <span className="text-sm text-[var(--text-primary)]">管理连接器</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" strokeWidth={2} />
                </div>
              </div>
            </>
          )}

          </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AiInputBar({ onSend, loading, onStop, webSearchEnabled = false, onWebSearchToggle, codeContextEnabled = false, onCodeContextToggle, knowledgeBaseEnabled = false, onKnowledgeBaseToggle, researchEnabled = false, onResearchToggle, replyStyle = 'normal', onReplyStyleChange, lastUserMessage, onEscape }: AiInputBarProps) {
  const [value, setValue] = useState("");
  const [showSheet, setShowSheet] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [glowPos, setGlowPos] = useState({ x: 0.5, y: 0.5 });
  const [showGlow, setShowGlow] = useState(false);
  const glowFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);
  const deformState = useRef({ pressed: false, moveHandler: null as ((e: PointerEvent) => void) | null });

  const computeDeform = useCallback((clientX: number, clientY: number) => {
    const el = composerWrapRef.current;
    if (!el) return { transform: '' };
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rawDx = clientX - cx;
    const rawDy = clientY - cy;
    const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    const maxDist = Math.max(rect.width, rect.height) * 0.8;
    const norm = Math.min(dist / Math.max(maxDist, 1), 1.2);
    const angle = Math.atan2(rawDy, rawDx);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const stretch = 0.025;
    const stretchAlong = norm * stretch;
    const compressPerp = norm * stretch * 0.55;
    const scaleX = 1.0 + stretchAlong * Math.abs(cosA) - compressPerp * Math.abs(sinA);
    const scaleY = 1.0 + stretchAlong * Math.abs(sinA) - compressPerp * Math.abs(cosA);
    const tx = cosA * norm * 1.5;
    const ty = sinA * norm * 1.5;
    return {
      transform: `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scaleX(${scaleX.toFixed(4)}) scaleY(${scaleY.toFixed(4)})`,
    };
  }, []);

  const [spotPos, setSpotPos] = useState<{ x: number; y: number } | null>(null);
  const [spotVisible, setSpotVisible] = useState(false);
  const spotFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateGlowPos = useCallback((clientX: number, clientY: number) => {
    const el = composerWrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setGlowPos({
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    });
    setSpotPos({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
  }, []);

  const handleComposerPointerDown = useCallback((e: React.PointerEvent) => {
    setIsPressed(true);
    setShowGlow(true);
    setSpotVisible(true);
    if (glowFadeTimer.current) clearTimeout(glowFadeTimer.current);
    if (spotFadeTimer.current) clearTimeout(spotFadeTimer.current);
    updateGlowPos(e.clientX, e.clientY);
    if (navigator.vibrate) navigator.vibrate(10);
    const el = composerWrapRef.current;
    if (!el) return;
    deformState.current.pressed = true;
    el.style.willChange = 'transform';
    const { transform } = computeDeform(e.clientX, e.clientY);
    el.style.transition = 'transform 180ms cubic-bezier(0.25,0.46,0.45,0.94)';
    el.style.transform = transform;
    const onMove = (ev: PointerEvent) => {
      if (!deformState.current.pressed || !composerWrapRef.current) return;
      const result = computeDeform(ev.clientX, ev.clientY);
      composerWrapRef.current.style.transition = 'transform 50ms ease-out';
      composerWrapRef.current.style.transform = result.transform;
      updateGlowPos(ev.clientX, ev.clientY);
    };
    deformState.current.moveHandler = onMove;
    window.addEventListener('pointermove', onMove);
  }, [computeDeform, updateGlowPos]);

  const handleComposerPointerUp = useCallback(() => {
    setIsPressed(false);
    deformState.current.pressed = false;
    const el = composerWrapRef.current;
    if (el) {
      el.style.transition = 'transform 360ms cubic-bezier(0.34,1.56,0.64,1)';
      el.style.transform = 'translate(0px, 0px) scaleX(1) scaleY(1)';
      el.style.willChange = '';
    }
    if (deformState.current.moveHandler) {
      window.removeEventListener('pointermove', deformState.current.moveHandler);
      deformState.current.moveHandler = null;
    }
    glowFadeTimer.current = setTimeout(() => setShowGlow(false), 600);
    spotFadeTimer.current = setTimeout(() => setSpotVisible(false), 300);
  }, []);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 288;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }, []);

  const processFiles = useCallback((files: File[]) => {
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const isImage = file.type.startsWith('image/');
        setAttachments(prev => [...prev, {
          type: isImage ? 'image' : 'file',
          name: file.name,
          mimeType: file.type,
          base64,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      processFiles(pastedFiles);
    }
  }, [processFiles]);

  const [isDragOver, setIsDragOver] = useState(false);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer?.files?.length) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  }, [processFiles]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed && attachments.length === 0) return;
    if (loading) return;
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setValue("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, loading, onSend, attachments]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      } else if (e.key === "ArrowUp" && !value.trim() && lastUserMessage) {
        e.preventDefault();
        setValue(lastUserMessage);
        setTimeout(() => {
          const el = textareaRef.current;
          if (el) {
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 288) + "px";
            el.setSelectionRange(lastUserMessage.length, lastUserMessage.length);
          }
        }, 0);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (loading && onEscape) {
          onEscape();
        }
      }
    },
    [handleSend, value, lastUserMessage, loading, onEscape]
  );

  const isEmpty = !value.trim() && attachments.length === 0;

  return (
    <>
      <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div
          ref={composerWrapRef}
          style={{
            borderRadius: 20,
            position: 'relative' as const,
            padding: 1,
            background: showGlow
              ? `radial-gradient(ellipse 120px 80px at ${glowPos.x * 100}% ${glowPos.y * 100}%, rgba(255,255,255,${isPressed ? 0.65 : 0.4}) 0%, rgba(255,255,255,${isPressed ? 0.25 : 0.15}) 50%, rgba(255,255,255,0.08) 100%)`
              : 'linear-gradient(to bottom, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.10) 40%, rgba(255,255,255,0.05) 100%)',
            boxShadow: showGlow
              ? `0 0 ${isPressed ? 24 : 14}px rgba(255,255,255,${isPressed ? 0.15 : 0.08})`
              : 'none',
            outline: isDragOver ? '2px dashed rgba(212,162,127,0.5)' : 'none',
            outlineOffset: 2,
            transition: showGlow && !isPressed
              ? 'background 0.5s ease, box-shadow 0.5s ease'
              : 'background 0.05s ease, box-shadow 0.05s ease',
          }}
          onPointerDown={handleComposerPointerDown}
          onPointerUp={handleComposerPointerUp}
          onPointerLeave={(e) => { handleComposerPointerUp(e as any); handleDragLeave(e as any); }}
          onPointerCancel={handleComposerPointerUp}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-testid="ai-composer"
        >
          <div style={{
            background: '#1A1918',
            borderRadius: 19,
            overflow: 'hidden',
            position: 'relative',
          }}>
          {spotPos && (
            <div
              style={{
                position: 'absolute',
                width: '150%',
                height: 0,
                paddingBottom: '150%',
                borderRadius: '50%',
                background: 'radial-gradient(circle at center, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.01) 60%, rgba(255,255,255,0) 100%)',
                pointerEvents: 'none',
                transform: 'translate(-50%, -50%)',
                left: spotPos.x - 1,
                top: spotPos.y - 1,
                opacity: spotVisible ? 1 : 0,
                transition: 'opacity 300ms ease-out',
                zIndex: 0,
              }}
            />
          )}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="输入消息..."
            disabled={loading}
            rows={1}
            style={{
              width: '100%',
              minHeight: 36,
              maxHeight: 288,
              padding: '14px 16px 8px 16px',
              fontSize: 16,
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.5,
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              display: 'block',
              position: 'relative',
              zIndex: 1,
            }}
            className={cn(
              "placeholder:text-[var(--text-placeholder)]",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            data-testid="ai-input"
          />

          {attachments.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: '4px 16px 8px 16px',
                overflowX: 'auto',
              }}
              data-testid="attachment-previews"
            >
              {attachments.map((att, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    flexShrink: 0,
                  }}
                  data-testid={`attachment-preview-${i}`}
                >
                  {att.type === 'image' ? (
                    <img
                      src={att.previewUrl || `data:${att.mimeType};base64,${att.base64}`}
                      alt={att.name}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                      }}
                    >
                      <FileText className="w-4 h-4 text-[var(--text-secondary)]" />
                      <span style={{ fontSize: 8, color: 'var(--text-secondary)', maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        {att.name.split('.').pop()}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      background: '#444',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    data-testid={`remove-attachment-${i}`}
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 10px 10px 10px',
              position: 'relative',
              zIndex: 1,
            }}
            data-testid="ai-toolbar"
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSheet(true)}
                style={{
                  width: 32,
                  height: 32,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  transition: 'background 150ms',
                }}
                className="hover:bg-white/5"
                data-testid="ai-attach"
              >
                <Plus className="w-5 h-5" />
              </button>

              {webSearchEnabled && (
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                  style={{ background: 'rgba(174,86,48,0.15)', color: 'var(--brand)' }}
                  data-testid="web-search-badge"
                >
                  <Globe className="w-3 h-3" />
                  搜索
                </div>
              )}
              {codeContextEnabled && (
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#60A5FA' }}
                  data-testid="code-context-badge"
                >
                  <Code className="w-3 h-3" />
                  代码
                </div>
              )}
              {knowledgeBaseEnabled && (
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#4ADE80' }}
                  data-testid="knowledge-base-badge"
                >
                  <BookOpen className="w-3 h-3" />
                  知识库
                </div>
              )}
              {researchEnabled && (
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                  style={{ background: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}
                  data-testid="research-badge"
                >
                  <Atom className="w-3 h-3" />
                  深度
                </div>
              )}
            </div>

            {loading ? (
              <button
                onClick={onStop}
                style={{
                  width: 34,
                  height: 34,
                  background: '#ECECEC',
                  borderRadius: '50%',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'opacity 150ms, transform 100ms',
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                data-testid="ai-stop"
              >
                <Square className="w-3 h-3 text-[#1A1918]" strokeWidth={3} fill="#1A1918" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={isEmpty}
                style={{
                  width: 34,
                  height: 34,
                  background: 'var(--brand)',
                  borderRadius: '50%',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isEmpty ? 'default' : 'pointer',
                  opacity: isEmpty ? 0.35 : 1,
                  transition: 'opacity 150ms, transform 100ms',
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                data-testid="ai-send"
              >
                <ArrowUp className="w-4 h-4 text-white" strokeWidth={2.5} />
              </button>
            )}
          </div>
          </div>
        </div>
      </div>

      <AddToChatSheet
        open={showSheet}
        onClose={() => setShowSheet(false)}
        webSearchEnabled={webSearchEnabled}
        onWebSearchToggle={(enabled) => {
          onWebSearchToggle?.(enabled);
        }}
        codeContextEnabled={codeContextEnabled}
        onCodeContextToggle={(enabled) => {
          onCodeContextToggle?.(enabled);
        }}
        knowledgeBaseEnabled={knowledgeBaseEnabled}
        onKnowledgeBaseToggle={(enabled) => {
          onKnowledgeBaseToggle?.(enabled);
        }}
        researchEnabled={researchEnabled}
        onResearchToggle={(enabled) => {
          onResearchToggle?.(enabled);
        }}
        replyStyle={replyStyle}
        onReplyStyleChange={(style) => {
          onReplyStyleChange?.(style);
        }}
        onAttach={(newAttachments) => {
          setAttachments(prev => [...prev, ...newAttachments]);
          setShowSheet(false);
        }}
      />
    </>
  );
}

```

---

## client/src/components/ai/ArtifactPanel.tsx

**Lines: 479**

```tsx
import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Maximize2, Minimize2, Copy, Check, Download, ChevronDown, Paperclip, Loader2, Search } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AIMessageContent from "./AIMessageContent";

interface ArtifactPanelProps {
  content: string;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
  messageId?: string;
}

export default function ArtifactPanel({ content, title, isOpen, onClose, messageId }: ArtifactPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showDeliverableDialog, setShowDeliverableDialog] = useState(false);
  const [deliverableTitle, setDeliverableTitle] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [taskSearch, setTaskSearch] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setIsFullscreen(false);
      setCopied(false);
      setShowScrollBtn(false);
      setShowDeliverableDialog(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || !isOpen) return;
    const checkScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      setShowScrollBtn(!nearBottom && el.scrollHeight > el.clientHeight + 100);
    };
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const observer = new MutationObserver(checkScroll);
    observer.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", checkScroll);
      observer.disconnect();
    };
  }, [isOpen, content]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showDeliverableDialog) {
          setShowDeliverableDialog(false);
        } else if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isFullscreen, showDeliverableDialog, onClose]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (title || "artifact").replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, "_") + ".md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [content, title]);

  const scrollToBottom = useCallback(() => {
    contentRef.current?.scrollTo({ top: contentRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  const { data: tasksRes, isLoading: tasksLoading } = useQuery<{ data: any[] }>({
    queryKey: ['/api/tasks'],
    enabled: showDeliverableDialog,
  });

  const activeTasks = (tasksRes?.data || []).filter(
    (t: any) => t.status !== 'done' && t.status !== 'cancelled'
  );

  const filteredTasks = taskSearch.trim()
    ? activeTasks.filter((t: any) =>
        t.title.toLowerCase().includes(taskSearch.toLowerCase())
      )
    : activeTasks;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTaskId || !messageId) throw new Error("Missing task or message");
      const dbMsgId = messageId.startsWith("db-") ? parseInt(messageId.slice(3)) : parseInt(messageId);
      if (isNaN(dbMsgId)) throw new Error("Invalid message ID");
      const res = await apiRequest("POST", `/api/tasks/${selectedTaskId}/deliverables/from-chat`, {
        messageId: dbMsgId,
        title: deliverableTitle || title || content.slice(0, 30).replace(/\n/g, ' '),
        format: "markdown",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "提交成功", description: "AI 内容已添加为任务交付物" });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', selectedTaskId, 'deliverables'] });
      setShowDeliverableDialog(false);
      setSelectedTaskId(null);
      setDeliverableTitle("");
      setTaskSearch("");
    },
    onError: (err: any) => {
      toast({ title: "提交失败", description: err.message, variant: "destructive" });
    },
  });

  const handleOpenDeliverable = () => {
    setDeliverableTitle(title || extractArtifactTitle(content));
    setShowDeliverableDialog(true);
  };

  if (!isOpen) return null;

  const glassBtn: React.CSSProperties = {
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: "1px solid rgba(255,255,255,0.15)",
    cursor: "pointer",
    transition: "all 180ms ease",
  };

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 10000,
          transition: "opacity 200ms ease",
        }}
        data-testid="artifact-panel-backdrop"
      />
      <div
        style={{
          position: "fixed",
          top: isFullscreen ? 0 : 56,
          right: isFullscreen ? 0 : 12,
          bottom: isFullscreen ? 0 : 12,
          width: isFullscreen ? "100%" : "min(680px, calc(100vw - 24px))",
          background: "var(--bg-primary, #0a0a0a)",
          border: isFullscreen ? "none" : "1px solid rgba(255,255,255,0.1)",
          borderRadius: isFullscreen ? 0 : 12,
          zIndex: 10001,
          display: "flex",
          flexDirection: "column",
          transition: "all 200ms ease",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
        data-testid="artifact-panel"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
            data-testid="artifact-panel-title"
          >
            {title || "Document"}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-[rgba(255,255,255,0.7)] hover:text-white"
              style={glassBtn}
              title={copied ? "Copied" : "Copy"}
              data-testid="artifact-btn-copy"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-[rgba(255,255,255,0.7)] hover:text-white"
              style={glassBtn}
              title="Download as .md"
              data-testid="artifact-btn-download"
            >
              <Download className="w-4 h-4" />
            </button>
            {messageId && String(messageId).startsWith("db-") && (
              <button
                onClick={handleOpenDeliverable}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-[rgba(255,255,255,0.7)] hover:text-white"
                style={glassBtn}
                title="提交为交付物"
                data-testid="artifact-btn-deliverable"
              >
                <Paperclip className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-[rgba(255,255,255,0.7)] hover:text-white"
              style={glassBtn}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              data-testid="artifact-btn-fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-[rgba(255,255,255,0.7)] hover:text-white"
              style={glassBtn}
              title="Close"
              data-testid="artifact-btn-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={contentRef}
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "20px 24px",
            position: "relative",
          }}
          data-testid="artifact-panel-content"
        >
          <AIMessageContent content={content} />
        </div>

        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            style={{
              position: "absolute",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...glassBtn,
              background: "rgba(255,255,255,0.12)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
              zIndex: 2,
              color: "rgba(255,255,255,0.85)",
            }}
            data-testid="artifact-btn-scroll-bottom"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}

        {showDeliverableDialog && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              borderRadius: 12,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowDeliverableDialog(false); }}
            data-testid="deliverable-dialog-backdrop"
          >
            <div
              style={{
                background: "var(--bg-primary, #1a1a1a)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 12,
                padding: 20,
                width: "min(400px, 90%)",
                maxHeight: "80%",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
              data-testid="deliverable-dialog"
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                提交为任务交付物
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>标题</label>
                <input
                  type="text"
                  value={deliverableTitle}
                  onChange={(e) => setDeliverableTitle(e.target.value)}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    color: "var(--text-primary)",
                    fontSize: 14,
                    outline: "none",
                  }}
                  data-testid="deliverable-title-input"
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>选择目标任务</label>
                <div style={{ position: "relative" }}>
                  <Search className="w-3.5 h-3.5" style={{ position: "absolute", left: 10, top: 10, color: "rgba(255,255,255,0.4)" }} />
                  <input
                    type="text"
                    placeholder="搜索任务..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 8,
                      padding: "8px 12px 8px 32px",
                      color: "var(--text-primary)",
                      fontSize: 13,
                      outline: "none",
                    }}
                    data-testid="deliverable-task-search"
                  />
                </div>
                <div
                  style={{
                    maxHeight: 200,
                    overflowY: "auto",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    marginTop: 4,
                  }}
                >
                  {tasksLoading && (
                    <div style={{ padding: "12px", fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      加载任务中...
                    </div>
                  )}
                  {!tasksLoading && filteredTasks.length === 0 && (
                    <div style={{ padding: "12px", fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
                      {taskSearch ? "没有匹配的任务" : "暂无可用任务"}
                    </div>
                  )}
                  {filteredTasks.map((t: any) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        background: selectedTaskId === t.id ? "rgba(180,136,107,0.2)" : "transparent",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        transition: "background 120ms",
                        fontSize: 13,
                        color: "var(--text-primary)",
                      }}
                      data-testid={`deliverable-task-option-${t.id}`}
                    >
                      <div style={{ fontWeight: selectedTaskId === t.id ? 600 : 400 }}>{t.title}</div>
                      {t.projectName && (
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{t.projectName}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => setShowDeliverableDialog(false)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "transparent",
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                  data-testid="deliverable-cancel-btn"
                >
                  取消
                </button>
                <button
                  onClick={() => submitMutation.mutate()}
                  disabled={!selectedTaskId || submitMutation.isPending}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: selectedTaskId ? "#B4886B" : "rgba(255,255,255,0.1)",
                    color: selectedTaskId ? "#fff" : "rgba(255,255,255,0.3)",
                    fontSize: 13,
                    cursor: selectedTaskId ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  data-testid="deliverable-submit-btn"
                >
                  {submitMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  提交
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

export function isLongContent(content: string): boolean {
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks = content.match(codeBlockRegex) || [];
  for (const block of codeBlocks) {
    const lines = block.split("\n");
    if (lines.length > 32) return true;
  }
  if (content.length > 2000) return true;
  return false;
}

export function extractArtifactTitle(content: string): string {
  const headingMatch = content.match(/^#+\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  const codeBlockMatch = content.match(/```(\w+)/);
  if (codeBlockMatch) return `Code (${codeBlockMatch[1]})`;
  return "Document";
}

```

---

## client/src/components/ai/ThinkingBlock.tsx

**Lines: 199**

```tsx
import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, Brain, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
  duration?: number;
}

export default function ThinkingBlock({ content, isStreaming, duration }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [wasStreaming, setWasStreaming] = useState(isStreaming);
  const [copied, setCopied] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const timerStartRef = useRef<number>(Date.now());
  const finalElapsedRef = useRef<number>(0);

  useEffect(() => {
    if (isStreaming) {
      timerStartRef.current = Date.now();
      setElapsedSeconds(0);

      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - timerStartRef.current) / 1000);
        setElapsedSeconds(elapsed);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      finalElapsedRef.current = elapsedSeconds;
    }
  }, [isStreaming]);

  useEffect(() => {
    if (wasStreaming && !isStreaming) {
      setExpanded(false);
    }
    setWasStreaming(isStreaming);
  }, [isStreaming]);

  useEffect(() => {
    if (isStreaming) {
      setExpanded(true);
    }
  }, [isStreaming]);

  useEffect(() => {
    if (expanded && isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, expanded, isStreaming]);

  const getFinishedDurationSeconds = (): number => {
    if (duration) {
      return Math.round(duration / 1000);
    }
    return finalElapsedRef.current || elapsedSeconds;
  };

  const formatCharCount = (text: string) => {
    const len = text.length;
    if (len >= 1000) return `${(len / 1000).toFixed(1)}k chars`;
    return `${len} chars`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const renderLabel = () => {
    if (isStreaming) {
      return elapsedSeconds > 0
        ? `Thinking for ${elapsedSeconds}s...`
        : "Thinking...";
    }
    const secs = getFinishedDurationSeconds();
    if (secs > 0) {
      return `Thought for ${secs} second${secs !== 1 ? 's' : ''}`;
    }
    return "Thought process";
  };

  return (
    <div
      className="mb-3"
      style={{ animation: 'messageAppear 200ms ease-out' }}
      data-testid="thinking-block"
    >
      <div className="flex items-center gap-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs transition-colors group"
          style={{
            color: 'var(--text-secondary)',
            background: 'none',
            border: 'none',
            padding: '4px 0',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
          data-testid="thinking-block-toggle"
        >
          <Brain
            size={14}
            className={cn(
              "transition-colors",
              isStreaming ? "text-brand animate-pulse" : "text-[var(--text-secondary)]"
            )}
          />
          <span style={{ fontWeight: 500 }} data-testid="thinking-block-label">{renderLabel()}</span>
          {content && !isStreaming && (
            <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
              {formatCharCount(content)}
            </span>
          )}
          {expanded ? (
            <ChevronDown size={12} className="text-[var(--text-tertiary)]" />
          ) : (
            <ChevronRight size={12} className="text-[var(--text-tertiary)]" />
          )}
        </button>
        {expanded && !isStreaming && content && (
          <button
            onClick={handleCopy}
            className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
            title={copied ? "Copied" : "Copy thinking content"}
            data-testid="thinking-block-copy"
          >
            {copied ? <Check size={12} strokeWidth={1.5} /> : <Copy size={12} strokeWidth={1.5} />}
          </button>
        )}
      </div>
      <div
        style={{
          overflow: 'hidden',
          transition: 'max-height 300ms ease, opacity 200ms ease',
          maxHeight: expanded ? 200 : 0,
          opacity: expanded ? 1 : 0,
        }}
      >
        <div
          ref={contentRef}
          style={{
            maxHeight: 200,
            overflowY: 'auto',
            marginTop: 4,
            padding: '8px 12px',
            borderLeft: '2px solid var(--border-subtle)',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '0 8px 8px 0',
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-sans)',
          }}
          data-testid="thinking-block-content"
        >
          {content ? (
            <div className="thinking-markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                p: ({ children }) => <p style={{ marginBottom: 8, marginTop: 0 }}>{children}</p>,
                strong: ({ children }) => <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{children}</strong>,
                em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                ul: ({ children }) => <ul style={{ paddingLeft: 16, marginBottom: 8, marginTop: 0 }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ paddingLeft: 16, marginBottom: 8, marginTop: 0 }}>{children}</ol>,
                li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                code: ({ children }) => (
                  <code style={{
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 3,
                    padding: '1px 4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                  }}>{children}</code>
                ),
                h1: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 6px', color: 'var(--text-primary)' }}>{children}</h3>,
                h2: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 6px', color: 'var(--text-primary)' }}>{children}</h3>,
                h3: ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 600, margin: '10px 0 4px', color: 'var(--text-primary)' }}>{children}</h3>,
                blockquote: ({ children }) => (
                  <blockquote style={{ borderLeft: '2px solid var(--border-medium)', paddingLeft: 8, margin: '8px 0', opacity: 0.85 }}>{children}</blockquote>
                ),
                pre: ({ children }) => <pre style={{ fontSize: 12, overflowX: 'auto', margin: '8px 0', padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 4 }}>{children}</pre>,
              }}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (isStreaming ? '...' : '')}
        </div>
      </div>
    </div>
  );
}

```

---

## client/src/components/ai/AiConfirmCard.tsx

**Lines: 242**

```tsx
import { useState } from "react";
import {
  Plus,
  Edit,
  FolderPlus,
  MessageCircle,
  Search,
  Check,
  X,
  SkipForward,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionPayload {
  actionType: string;
  data: Record<string, any>;
  displayData?: Record<string, string>;
  summary: string;
  confidence?: number;
  missingFields?: string[];
  followUpQuestion?: string;
}

interface AiConfirmCardProps {
  action: ActionPayload;
  onConfirm: () => void;
  onReject: () => void;
  onSkip?: () => void;
  confirmed: boolean | null;
  skipped?: boolean;
  index?: number;
}

const ACTION_CONFIG: Record<
  string,
  { icon: typeof Plus; label: string; accentColor: string }
> = {
  create_task: {
    icon: Plus,
    label: "创建任务",
    accentColor: "text-brand",
  },
  update_task: {
    icon: Edit,
    label: "更新任务",
    accentColor: "text-blue-500",
  },
  create_project: {
    icon: FolderPlus,
    label: "创建项目",
    accentColor: "text-brand",
  },
  add_comment: {
    icon: MessageCircle,
    label: "添加评论",
    accentColor: "text-amber-500",
  },
  query_tasks: {
    icon: Search,
    label: "查询任务",
    accentColor: "text-[var(--text-secondary)]",
  },
};

const DATA_LABELS: Record<string, string> = {
  title: "标题",
  projectId: "项目",
  assigneeId: "负责人",
  priority: "优先级",
  status: "状态",
  dueDate: "截止日期",
  weight: "权重",
  description: "描述",
  name: "名称",
  content: "内容",
  taskId: "任务ID",
  progress: "进度",
  tags: "标签",
  type: "类型",
};

export default function AiConfirmCard({
  action,
  onConfirm,
  onReject,
  onSkip,
  confirmed,
  skipped,
  index,
}: AiConfirmCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const buttonsDisabled = isSubmitting || confirmed !== null || !!skipped;

  const config = ACTION_CONFIG[action.actionType] || {
    icon: Search,
    label: action.actionType,
    accentColor: "text-[var(--text-secondary)]",
  };
  const Icon = config.icon;
  const cardId = index !== undefined ? `confirm-card-${index}` : "confirm-card";
  const warnings: string[] = Array.isArray(action.data.warnings) ? action.data.warnings : [];

  return (
    <div
      className="rounded-card bg-card border border-[var(--border-subtle)]"
      data-testid={cardId}
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-muted border-b border-[var(--border-subtle)] rounded-t-card">
        <Icon className={cn("w-4 h-4", config.accentColor)} />
        <span className="text-sm font-medium text-foreground">
          {config.label}
        </span>
      </div>

      <div className="px-4 py-3 space-y-2">
        <p className="text-sm text-foreground">{action.summary}</p>
        <div className="space-y-1">
          {Object.entries(action.data).filter(([key]) => key !== 'warnings').map(([key, val]) => {
            if (val === null || val === undefined) return null;
            let displayVal: string;
            const dd = action.displayData;
            if (key === 'projectId' && dd?.projectName) {
              displayVal = dd.projectName;
            } else if (key === 'assigneeId' && dd?.assigneeName) {
              displayVal = dd.assigneeName;
            } else if (key === 'priority' && dd?.priorityLabel) {
              displayVal = dd.priorityLabel;
            } else if (key === 'status' && dd?.statusLabel) {
              displayVal = dd.statusLabel;
            } else if (typeof val === 'object') {
              if (Array.isArray(val)) {
                displayVal = val.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
              } else {
                displayVal = JSON.stringify(val);
              }
            } else {
              displayVal = String(val);
            }
            return (
              <div key={key} className="flex gap-2 text-xs">
                <span className="text-muted-foreground min-w-[4rem] text-right">
                  {DATA_LABELS[key] || key}
                </span>
                <span className="text-foreground break-all">{displayVal}</span>
              </div>
            );
          })}
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-800">
          {warnings.map((warning, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 py-0.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3 border-t border-[var(--border-subtle)]">
        {confirmed === null && !skipped && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsSubmitting(true);
                Promise.resolve(onConfirm()).catch(() => {}).finally(() => {
                  setTimeout(() => setIsSubmitting(false), 500);
                });
              }}
              disabled={buttonsDisabled}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5",
                "px-3 py-1.5 rounded-lg text-sm font-medium",
                "bg-brand text-white",
                "transition-colors duration-150",
                buttonsDisabled && "opacity-50 cursor-not-allowed"
              )}
              data-testid={index !== undefined ? `confirm-action-${index}` : "confirm-action"}
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {isSubmitting ? "执行中..." : "确认执行"}
            </button>
            {onSkip && (
              <button
                onClick={onSkip}
                disabled={buttonsDisabled}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5",
                  "px-3 py-1.5 rounded-lg text-sm font-medium",
                  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
                  "transition-colors duration-150",
                  buttonsDisabled && "opacity-50 cursor-not-allowed"
                )}
                data-testid={index !== undefined ? `skip-action-${index}` : "skip-action"}
              >
                <SkipForward className="w-3.5 h-3.5" />
                跳过
              </button>
            )}
            <button
              onClick={onReject}
              disabled={buttonsDisabled}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5",
                "px-3 py-1.5 rounded-lg text-sm font-medium",
                "bg-muted text-muted-foreground",
                "transition-colors duration-150",
                buttonsDisabled && "opacity-50 cursor-not-allowed"
              )}
              data-testid={index !== undefined ? `reject-action-${index}` : "reject-action"}
            >
              <X className="w-3.5 h-3.5" />
              取消
            </button>
          </div>
        )}
        {confirmed === true && (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm">
            <Check className="w-4 h-4" />
            已执行
          </div>
        )}
        {confirmed === false && !skipped && (
          <div className="flex items-center gap-1.5 text-red-500 dark:text-red-400 text-sm">
            <X className="w-4 h-4" />
            已取消
          </div>
        )}
        {skipped && (
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-sm">
            <SkipForward className="w-4 h-4" />
            已跳过
          </div>
        )}
      </div>
    </div>
  );
}

```

---

## client/src/components/ai/AiFollowUpCard.tsx

**Lines: 172**

```tsx
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, PenLine } from "lucide-react";

interface FollowUpQuestion {
  field: string;
  label: string;
  emoji: string;
  options: { label: string; value: any }[];
  allowCustom?: boolean;
}

interface FollowUpData {
  message: string;
  partialData: Record<string, any>;
  questions: FollowUpQuestion[];
}

interface AiFollowUpCardProps {
  followUp: FollowUpData;
  onSubmit: (mergedData: Record<string, any>) => void;
  submitted?: boolean;
}

export default function AiFollowUpCard({
  followUp,
  onSubmit,
  submitted,
}: AiFollowUpCardProps) {
  const [selections, setSelections] = useState<Record<string, any>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [usingCustom, setUsingCustom] = useState<Record<string, boolean>>({});

  const allAnswered = followUp.questions.every((q) => {
    if (usingCustom[q.field]) return customInputs[q.field]?.trim().length > 0;
    return selections[q.field] !== undefined;
  });

  const handleSelect = (field: string, value: any) => {
    if (submitted) return;
    setUsingCustom((prev) => ({ ...prev, [field]: false }));
    setSelections((prev) => ({ ...prev, [field]: value }));
  };

  const handleCustomToggle = (field: string) => {
    if (submitted) return;
    setUsingCustom((prev) => ({ ...prev, [field]: true }));
    setSelections((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = () => {
    if (!allAnswered || submitted) return;
    const merged: Record<string, any> = { ...followUp.partialData };
    for (const q of followUp.questions) {
      if (usingCustom[q.field]) {
        merged[q.field] = customInputs[q.field]?.trim();
      } else {
        merged[q.field] = selections[q.field];
      }
    }
    onSubmit(merged);
  };

  return (
    <div
      className="rounded-card bg-card border border-[var(--border-subtle)] overflow-hidden"
      data-testid="followup-card"
    >
      <div className="px-4 py-3 text-sm text-foreground font-medium">
        {followUp.message}
      </div>

      <div className="px-4 pb-3 space-y-3">
        {followUp.questions.map((q) => (
          <div key={q.field} className="space-y-1.5">
            <div className="text-xs text-muted-foreground font-medium">
              {q.emoji} {q.label}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((opt, idx) => {
                const isSelected =
                  !usingCustom[q.field] && selections[q.field] === opt.value;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(q.field, opt.value)}
                    disabled={submitted}
                    className={cn(
                      "rounded-full text-sm px-3 py-1.5 transition-colors duration-150",
                      isSelected
                        ? "bg-brand/10 text-brand"
                        : "bg-muted text-foreground",
                      !submitted && !isSelected && "hover:bg-brand/5",
                      submitted && "opacity-70 cursor-not-allowed"
                    )}
                    data-testid={`followup-option-${q.field}-${idx}`}
                  >
                    {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                    {opt.label}
                  </button>
                );
              })}
              {q.allowCustom && (
                <>
                  <button
                    onClick={() => handleCustomToggle(q.field)}
                    disabled={submitted}
                    className={cn(
                      "rounded-full text-sm px-3 py-1.5 transition-colors duration-150 flex items-center gap-1",
                      usingCustom[q.field]
                        ? "bg-brand/10 text-brand"
                        : "bg-muted text-foreground",
                      !submitted && !usingCustom[q.field] && "hover:bg-brand/5",
                      submitted && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    <PenLine className="w-3 h-3" />
                    自定义
                  </button>
                  {usingCustom[q.field] && (
                    <input
                      type="text"
                      value={customInputs[q.field] || ""}
                      onChange={(e) =>
                        setCustomInputs((prev) => ({
                          ...prev,
                          [q.field]: e.target.value,
                        }))
                      }
                      disabled={submitted}
                      placeholder="输入自定义值..."
                      className="border-b border-border bg-transparent text-sm px-1 py-1 outline-none text-foreground placeholder:text-muted-foreground w-32"
                      data-testid={`followup-custom-input-${q.field}`}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-[var(--border-subtle)]">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className={cn(
              "flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 w-full",
              allAnswered
                ? "bg-brand text-white"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            data-testid="followup-confirm"
          >
            <Check className="w-3.5 h-3.5" />
            确认
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-brand text-sm justify-center">
            <Check className="w-4 h-4" />
            已提交
          </div>
        )}
      </div>
    </div>
  );
}

```

---

## client/src/components/ai/AiChatPanel.tsx

**Lines: 253**

```tsx
import { useState, useRef, useEffect, useCallback } from "react";
import { Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import AiMessageBubble from "./AiMessageBubble";
import AiInputBar from "./AiInputBar";
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

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  type?: "text" | "confirm" | "multi_confirm";
  action?: ActionPayload;
  actions?: ActionPayload[];
  confirmed?: boolean | null;
  actionConfirmed?: (boolean | null)[];
}

interface AiChatPanelProps {
  onClose: () => void;
}

let msgCounter = 0;
function nextId() {
  return `msg-${++msgCounter}-${Date.now()}`;
}

export default function AiChatPanel({ onClose }: AiChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: nextId(),
      role: "assistant",
      content: "你好！我是 AI 助手，可以帮你管理任务、创建项目、查询进度。请告诉我你需要什么帮助？",
      type: "text",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationHistory = useRef<{ role: string; content: string }[]>([]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  const handleSend = useCallback(
    async (text: string) => {
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
          currentUserId: 1,
        });
        const json = await res.json();
        const data = json.data;

        let assistantContent = "";
        if (data.type === "text") {
          assistantContent = data.message || "";
        } else if (data.type === "confirm" && data.action) {
          assistantContent = data.action.followUpQuestion || data.action.summary || "";
        } else if (data.type === "multi_confirm" && data.actions) {
          assistantContent = data.actions.map((a: ActionPayload) => a.summary).join("\n");
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
          confirmed: data.type === "confirm" ? null : undefined,
          actionConfirmed: data.type === "multi_confirm" && data.actions
            ? data.actions.map(() => null)
            : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        const errorMsg: Message = {
          id: nextId(),
          role: "system",
          content: err.message || "请求失败，请稍后重试",
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
      }
    },
    []
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
      } catch (err: any) {
        const sysMsg: Message = {
          id: nextId(),
          role: "system",
          content: err.message || "执行失败，请重试",
        };
        setMessages((prev) => [...prev, sysMsg]);
      }
    },
    [messages]
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
  }, []);

  return (
    <div
      className={cn(
        "fixed right-6 bottom-24 z-50 w-[400px] h-[70vh] max-sm:w-[calc(100vw-1.5rem)] max-sm:right-3 max-sm:bottom-20",
        "bg-card rounded-2xl shadow-2xl",
        "flex flex-col overflow-hidden",
        "transition-all duration-200 origin-bottom-right",
        visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
      )}
      data-testid="ai-chat-panel"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-blue-500 to-indigo-600">
        <h3 className="text-sm font-semibold text-white">AI 助手</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            data-testid="ai-minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            data-testid="ai-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3">
        {messages.map((msg) => (
          <AiMessageBubble
            key={msg.id}
            message={msg}
            onConfirm={handleConfirm}
            onReject={handleReject}
          />
        ))}
        {loading && (
          <div className="flex justify-start px-4 mb-6">
            <ThinkingAnimation size={32} />
          </div>
        )}
      </div>

      <AiInputBar onSend={handleSend} loading={loading} />
    </div>
  );
}

```

---

## client/src/components/ai/AiChatButton.tsx

**Lines: 25**

```tsx
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiChatButtonProps {
  onClick: () => void;
}

export default function AiChatButton({ onClick }: AiChatButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed right-6 bottom-6 z-50 w-14 h-14 rounded-full",
        "bg-gradient-to-br from-blue-500 to-indigo-600",
        "flex items-center justify-center",
        "text-white shadow-lg",
        "hover:scale-110 active:scale-95",
        "transition-transform duration-200"
      )}
      data-testid="ai-chat-button"
    >
      <MessageSquare className="w-6 h-6" />
    </button>
  );
}

```

---

## client/src/components/ai/InteractiveInputWidget.tsx

**Lines: 605**

```tsx
import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Paperclip, GripVertical } from "lucide-react";

export interface InteractiveQuestion {
  id: string;
  question: string;
  type: "single_select" | "multi_select" | "rank_priorities";
  options: string[];
}

export interface InteractiveAnswers {
  [questionId: string]: string[];
}

interface Props {
  questions: InteractiveQuestion[];
  onSubmit: (answers: InteractiveAnswers) => void;
  onDismiss: () => void;
}

export function formatAnswersForDisplay(
  questions: InteractiveQuestion[],
  answers: InteractiveAnswers
): string {
  return questions
    .map((q) => {
      const ans = answers[q.id];
      if (!ans || ans.length === 0) return null;
      if (q.type === "rank_priorities") {
        return `${q.question}\n${ans.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
      }
      return `${q.question} ${ans.join("、")}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function formatAnswersForAI(
  questions: InteractiveQuestion[],
  answers: InteractiveAnswers
): Record<string, any> {
  return {
    type: "interactive_response",
    answers: questions.map((q) => ({
      questionId: q.id,
      question: q.question,
      type: q.type,
      ...(q.type === "rank_priorities"
        ? { ranked: answers[q.id] || q.options }
        : { selected: answers[q.id] || [] }),
    })),
  };
}

const springTransition = {
  type: "spring" as const,
  damping: 30,
  stiffness: 350,
  mass: 0.8,
};

const cardVariants = {
  enter: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    scale: 0.92,
    opacity: 0.6,
  }),
  center: {
    x: 0,
    scale: 1,
    opacity: 1,
    transition: { type: "spring", damping: 28, stiffness: 300 },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "-100%" : "100%",
    scale: 0.92,
    opacity: 0.6,
    transition: { type: "spring", damping: 28, stiffness: 300 },
  }),
};

export default function InteractiveInputWidget({
  questions,
  onSubmit,
  onDismiss,
}: Props) {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const [answers, setAnswers] = useState<InteractiveAnswers>(() => {
    const init: InteractiveAnswers = {};
    questions.forEach((q) => {
      if (q.type === "rank_priorities") {
        init[q.id] = [...q.options];
      }
    });
    return init;
  });
  const [customText, setCustomText] = useState("");
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = questions.length;
  const currentQ = questions[currentPage];

  const [spotPos, setSpotPos] = useState<{ x: number; y: number } | null>(null);
  const [spotVisible, setSpotVisible] = useState(false);
  const spotFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (spotFadeTimer.current) clearTimeout(spotFadeTimer.current);
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, []);

  const updateSpot = useCallback((clientX: number, clientY: number) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSpotPos({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
  }, []);

  const handleCardPointerDown = useCallback((e: React.PointerEvent) => {
    setSpotVisible(true);
    if (spotFadeTimer.current) clearTimeout(spotFadeTimer.current);
    updateSpot(e.clientX, e.clientY);
    if (navigator.vibrate) navigator.vibrate(8);
  }, [updateSpot]);

  const handleCardPointerMove = useCallback((e: React.PointerEvent) => {
    if (spotVisible) updateSpot(e.clientX, e.clientY);
  }, [spotVisible, updateSpot]);

  const handleCardPointerUp = useCallback(() => {
    spotFadeTimer.current = setTimeout(() => setSpotVisible(false), 300);
  }, []);

  const goToPage = useCallback((newPage: number) => {
    if (newPage < 0 || newPage >= totalPages || newPage === currentPage) return;
    setDirection(newPage > currentPage ? -1 : 1);
    setCurrentPage(newPage);
    setCustomText("");
  }, [currentPage, totalPages]);

  const handleDragEnd = useCallback((_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeThreshold = 80;
    if (info.offset.x < -swipeThreshold && currentPage < totalPages - 1) {
      goToPage(currentPage + 1);
    } else if (info.offset.x > swipeThreshold && currentPage > 0) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, totalPages, goToPage]);

  const handleSelect = useCallback(
    (questionId: string, option: string, type: string) => {
      setAnswers((prev) => {
        const current = prev[questionId] || [];
        if (type === "single_select") {
          return { ...prev, [questionId]: current[0] === option ? [] : [option] };
        } else {
          return {
            ...prev,
            [questionId]: current.includes(option)
              ? current.filter((o) => o !== option)
              : [...current, option],
          };
        }
      });
    },
    []
  );

  const handleReorder = useCallback((questionId: string, newOrder: string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: newOrder }));
  }, []);

  const handleCustomSubmit = useCallback(() => {
    if (!customText.trim()) return;
    const q = questions[currentPage];
    if (!q) return;
    const trimmed = customText.trim();
    if (q.type === "single_select") {
      setAnswers((prev) => ({ ...prev, [q.id]: [trimmed] }));
    } else if (q.type === "multi_select") {
      setAnswers((prev) => {
        const current = prev[q.id] || [];
        if (current.includes(trimmed)) return prev;
        return { ...prev, [q.id]: [...current, trimmed] };
      });
    }
    setCustomText("");
  }, [customText, currentPage, questions]);

  const handleOptionClick = useCallback(
    (option: string) => {
      const q = questions[currentPage];
      if (!q) return;
      if (q.type === "single_select") {
        const current = answers[q.id] || [];
        const newVal = current[0] === option ? [] : [option];
        setAnswers((prev) => ({ ...prev, [q.id]: newVal }));
        if (newVal.length > 0) {
          if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
          if (currentPage < totalPages - 1) {
            autoAdvanceTimer.current = setTimeout(() => {
              goToPage(currentPage + 1);
            }, 400);
          } else {
            autoAdvanceTimer.current = setTimeout(() => {
              const finalAnswers = { ...answers, [q.id]: newVal };
              onSubmit(finalAnswers);
            }, 400);
          }
        }
      } else {
        handleSelect(q.id, option, q.type);
      }
    },
    [currentPage, totalPages, questions, answers, handleSelect, goToPage, onSubmit]
  );

  const canSubmitCurrent = (() => {
    const q = questions[currentPage];
    if (!q) return false;
    if (q.type === "rank_priorities") return true;
    const ans = answers[q.id];
    return ans && ans.length > 0;
  })();

  const handleConfirmCurrent = useCallback(() => {
    if (currentPage < totalPages - 1) {
      goToPage(currentPage + 1);
    } else {
      onSubmit(answers);
    }
  }, [currentPage, totalPages, answers, onSubmit, goToPage]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  const isSelected = (option: string) => (answers[currentQ?.id] || []).includes(option);

  if (!currentQ) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.5)",
          zIndex: 99,
        }}
        onClick={onDismiss}
        data-testid="interactive-overlay"
      />

      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={springTransition}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          padding: "0 12px 16px",
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        }}
        data-testid="interactive-input-widget"
      >
        <div
          ref={cardRef}
          style={{
            background: "#1c1c1e",
            borderRadius: 16,
            overflow: "hidden",
            position: "relative",
            maxWidth: 560,
            margin: "0 auto",
          }}
          onPointerDown={handleCardPointerDown}
          onPointerMove={handleCardPointerMove}
          onPointerUp={handleCardPointerUp}
          onPointerLeave={handleCardPointerUp}
          onPointerCancel={handleCardPointerUp}
        >
          {spotPos && (
            <div
              style={{
                position: "absolute",
                width: 600,
                height: 600,
                borderRadius: "50%",
                background: "radial-gradient(circle at center, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.01) 60%, rgba(255,255,255,0) 100%)",
                pointerEvents: "none",
                transform: "translate(-50%, -50%)",
                left: spotPos.x,
                top: spotPos.y,
                opacity: spotVisible ? 1 : 0,
                transition: "opacity 300ms ease-out",
                zIndex: 1,
              }}
            />
          )}

          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px 10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {totalPages > 1 && (
                  <>
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 0}
                      style={{
                        background: "none",
                        border: "none",
                        color: currentPage === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.5)",
                        cursor: currentPage === 0 ? "default" : "pointer",
                        padding: "4px 8px",
                        display: "flex",
                        fontSize: 18,
                      }}
                      data-testid="btn-prev-question"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", userSelect: "none" }}>
                      {currentPage + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages - 1}
                      style={{
                        background: "none",
                        border: "none",
                        color: currentPage === totalPages - 1 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.5)",
                        cursor: currentPage === totalPages - 1 ? "default" : "pointer",
                        padding: "4px 8px",
                        display: "flex",
                        fontSize: 18,
                      }}
                      data-testid="btn-next-question"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={onDismiss}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  padding: "4px 8px",
                  display: "flex",
                  fontSize: 20,
                }}
                data-testid="btn-dismiss-widget"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ overflow: "hidden", position: "relative", minHeight: 120 }}>
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.div
                  key={currentPage}
                  custom={direction}
                  variants={cardVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  drag={totalPages > 1 ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.8}
                  onDragEnd={handleDragEnd}
                  style={{ touchAction: totalPages > 1 ? "pan-y" : "auto" }}
                >
                  <div style={{ padding: "4px 20px 14px" }}>
                    <h3
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: "#ffffff",
                        margin: "0 0 16px 0",
                        lineHeight: 1.4,
                      }}
                    >
                      {currentQ.question}
                    </h3>

                    {currentQ.type === "rank_priorities" ? (
                      <div data-no-deform>
                        <Reorder.Group
                          axis="y"
                          values={answers[currentQ.id] || currentQ.options}
                          onReorder={(newOrder) => handleReorder(currentQ.id, newOrder)}
                          style={{ listStyle: "none", padding: 0, margin: 0 }}
                        >
                          {(answers[currentQ.id] || currentQ.options).map((option, index) => (
                            <Reorder.Item
                              key={option}
                              value={option}
                              whileDrag={{
                                scale: 1.03,
                                boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
                                cursor: "grabbing",
                              }}
                              transition={{ duration: 0.2 }}
                              style={{
                                cursor: "grab",
                                touchAction: "none",
                                display: "flex",
                                alignItems: "center",
                                gap: 16,
                                padding: "14px 0",
                                borderBottom: index < (answers[currentQ.id] || currentQ.options).length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                                userSelect: "none",
                              }}
                              data-testid={`rank-item-${option}`}
                            >
                              <span
                                style={{
                                  fontSize: 16,
                                  fontWeight: 500,
                                  color: "rgba(255,255,255,0.4)",
                                  width: 24,
                                  flexShrink: 0,
                                }}
                              >
                                {index + 1}
                              </span>
                              <span
                                style={{
                                  flex: 1,
                                  fontSize: 16,
                                  color: "rgba(255,255,255,0.9)",
                                }}
                              >
                                {option}
                              </span>
                              <GripVertical
                                size={16}
                                style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }}
                              />
                            </Reorder.Item>
                          ))}
                        </Reorder.Group>
                      </div>
                    ) : (
                      <div>
                        {currentQ.options.map((option, index) => {
                          const selected = isSelected(option);
                          return (
                            <button
                              key={option}
                              onClick={() => handleOptionClick(option)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 16,
                                width: "100%",
                                padding: "14px 0",
                                background: selected ? "rgba(255,255,255,0.08)" : "transparent",
                                border: "none",
                                borderBottom: index < currentQ.options.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                                borderRadius: selected ? 8 : 0,
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "background 120ms ease",
                                position: "relative",
                                overflow: "hidden",
                              }}
                              tabIndex={0}
                              data-testid={`option-chip-${currentQ.id}-${option}`}
                            >
                              <span
                                style={{
                                  fontSize: 16,
                                  color: "rgba(255,255,255,0.4)",
                                  width: 24,
                                  flexShrink: 0,
                                }}
                              >
                                {index + 1}
                              </span>
                              <span
                                style={{
                                  flex: 1,
                                  fontSize: 16,
                                  color: "rgba(255,255,255,0.9)",
                                }}
                              >
                                {option}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {(currentQ.type === "multi_select" || currentQ.type === "rank_priorities") && (
              <div style={{ padding: "6px 20px 10px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <button
                  onClick={handleConfirmCurrent}
                  disabled={!canSubmitCurrent}
                  style={{
                    width: "100%",
                    padding: "11px 0",
                    borderRadius: 10,
                    border: "none",
                    fontSize: 15,
                    fontWeight: 500,
                    cursor: canSubmitCurrent ? "pointer" : "not-allowed",
                    background: canSubmitCurrent ? "rgba(212,184,150,0.15)" : "rgba(255,255,255,0.04)",
                    color: canSubmitCurrent ? "#D4B896" : "rgba(255,255,255,0.2)",
                    transition: "all 150ms ease",
                  }}
                  data-testid="btn-confirm-selection"
                >
                  {currentPage < totalPages - 1 ? "下一题" : "确认"}
                </button>
              </div>
            )}

            {currentQ.type !== "rank_priorities" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px 14px",
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Paperclip size={16} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customText.trim()) {
                      e.preventDefault();
                      handleCustomSubmit();
                    }
                  }}
                  placeholder="Type your answer..."
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: 15,
                    color: "rgba(255,255,255,0.4)",
                    lineHeight: 1.4,
                    padding: 0,
                  }}
                  data-testid="interactive-custom-input"
                />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

```

---

## client/src/components/ai/AiGuidedCreation.tsx

**Lines: 541**

```tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Check, AlertCircle } from "lucide-react";
import AiStepQuestion from "./AiStepQuestion";
import ThinkingAnimation from "@/components/ThinkingAnimation";
import { apiRequest } from "@/lib/queryClient";

interface StepOption {
  label: string;
  value: any;
  description?: string;
  icon?: string;
}

interface StepQuestion {
  step: number;
  field: string;
  icon: string;
  label: string;
  options: StepOption[];
  allowCustomInput: boolean;
  customInputPlaceholder?: string;
  allowSkip: boolean;
  skipValue?: any;
  inputType?: 'text' | 'date' | 'textarea';
}

interface StepAnswer {
  field: string;
  value: any;
  displayLabel: string;
}

interface GuidedFollowUpData {
  message: string;
  creationType: 'task' | 'project';
  partialData: Record<string, any>;
  steps: StepQuestion[];
  currentStep: number;
}

interface AiGuidedCreationProps {
  followUp: GuidedFollowUpData;
  onComplete: (mergedData: Record<string, any>, creationType: string) => void;
  completed?: boolean;
  onStepAnswer?: (stepLabel: string, answerLabel: string) => void;
}

function stripEmoji(text: string): string {
  return text.replace(/^[^\u0000-\u007F]+\s*/g, '').replace(/^[\u2600-\u27BF\uD83C-\uDBFF\uDC00-\uDFFF\uFE0F\u200D\u20E3]+\s*/g, '').trim() || text.trim();
}

export default function AiGuidedCreation({
  followUp,
  onComplete,
  completed,
  onStepAnswer,
}: AiGuidedCreationProps) {
  const [dismissed, setDismissed] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<StepAnswer[]>([]);
  const [dynamicSteps, setDynamicSteps] = useState<StepQuestion[]>([...(followUp.steps || [])]);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newProjectMode, setNewProjectMode] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');
  const [animationKey, setAnimationKey] = useState(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const totalSteps = dynamicSteps.length;
  const allDone = currentStepIndex >= totalSteps;

  useEffect(() => {
    if (!allDone || completed || completedRef.current) return;
    completedRef.current = true;

    const currentAnswers = [...answers];
    const merged: Record<string, any> = { ...followUp.partialData };
    for (const ans of currentAnswers) {
      if (ans.value === null || ans.value === undefined) continue;
      merged[ans.field] = ans.value;
    }

    if (followUp.creationType === 'task' && !merged.title) {
      setError("缺少任务标题，无法创建");
      completedRef.current = false;
      return;
    }

    setFinishing(true);
    setError(null);
    console.log('[GuidedCreation] 组装数据:', JSON.stringify(merged, null, 2));
    console.log('[GuidedCreation] 创建类型:', followUp.creationType);

    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          onCompleteRef.current(merged, followUp.creationType);
        } catch (err: any) {
          console.error('[GuidedCreation] onComplete error:', err);
          setError(err.message || "提交失败");
          setFinishing(false);
          completedRef.current = false;
        }
      }, 500);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName.trim(),
          orgId: 1,
          ownerId: 1,
          status: "active",
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const project = json.data;
      if (!project?.id) {
        throw new Error("创建项目失败，未返回项目 ID");
      }

      console.log('[GuidedCreation] 新建项目成功:', project.id, project.name);

      const newAnswer: StepAnswer = {
        field: 'projectId',
        value: project.id,
        displayLabel: `${project.name}（新建）`,
      };
      setAnswers(prev => [...prev, newAnswer]);

      if (onStepAnswer) {
        onStepAnswer(stripEmoji(dynamicSteps[currentStepIndex]?.label || '项目'), `${project.name}（新建）`);
      }

      const nextStep = dynamicSteps[currentStepIndex + 1];
      if (nextStep && nextStep.field === 'parentTaskId') {
        const updated = [...dynamicSteps];
        updated[currentStepIndex + 1] = {
          ...nextStep,
          options: [{ label: "独立任务 — 直接挂在项目下", value: null }],
        };
        setDynamicSteps(updated);
      }

      setNewProjectMode(false);
      setNewProjectName("");
      setSlideDirection('forward');
      setAnimationKey(prev => prev + 1);
      setCurrentStepIndex(prev => prev + 1);
    } catch (err: any) {
      console.error('[GuidedCreation] 创建项目失败:', err?.message || err);
      setError(typeof err?.message === 'string' && err.message.length > 0 ? err.message : "创建项目失败，请重试");
    } finally {
      setCreatingProject(false);
    }
  }, [newProjectName, dynamicSteps, currentStepIndex]);

  const handleSelect = async (value: any, displayLabel: string) => {
    const step = dynamicSteps[currentStepIndex];
    if (!step) return;
    setError(null);

    if (step.field === 'projectId' && value === 'new_project') {
      setNewProjectMode(true);
      return;
    }

    const newAnswer: StepAnswer = {
      field: step.field,
      value,
      displayLabel,
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    if (onStepAnswer) {
      onStepAnswer(stripEmoji(step.label), displayLabel);
    }

    if (step.field === 'projectId' && typeof value === 'number') {
      const nextStep = dynamicSteps[currentStepIndex + 1];
      if (nextStep && nextStep.field === 'parentTaskId') {
        try {
          const res = await fetch(`/api/ai/guided-options?type=parentTasks&projectId=${value}`);
          const json = await res.json();
          const fetchedOptions = Array.isArray(json.data) ? json.data : json.data?.options;
          if (fetchedOptions && fetchedOptions.length > 0) {
            const updated = [...dynamicSteps];
            updated[currentStepIndex + 1] = {
              ...nextStep,
              options: [
                { label: "独立任务 — 直接挂在项目下", value: null },
                ...fetchedOptions,
              ],
            };
            setDynamicSteps(updated);
          }
        } catch {}
      }
    }

    setSlideDirection('forward');
    setAnimationKey(prev => prev + 1);
    setCurrentStepIndex((prev) => prev + 1);
  };

  const handleSkip = () => {
    const step = dynamicSteps[currentStepIndex];
    if (!step) return;

    const newAnswer: StepAnswer = {
      field: step.field,
      value: step.skipValue ?? null,
      displayLabel: "跳过",
    };

    setAnswers((prev) => [...prev, newAnswer]);
    setSlideDirection('forward');
    setAnimationKey(prev => prev + 1);
    setCurrentStepIndex((prev) => prev + 1);
  };

  const handlePrevStep = () => {
    if (currentStepIndex <= 0) return;
    setAnswers(prev => prev.slice(0, -1));
    setSlideDirection('backward');
    setAnimationKey(prev => prev + 1);
    setCurrentStepIndex(prev => prev - 1);
  };

  const handleNextStep = () => {
    if (currentStepIndex >= totalSteps - 1) return;
    if (currentStepIndex >= answers.length) return;
    setSlideDirection('forward');
    setAnimationKey(prev => prev + 1);
    setCurrentStepIndex(prev => prev + 1);
  };

  const handleClose = () => {
    setDismissed(true);
  };

  const currentStep = dynamicSteps[currentStepIndex];
  const canGoBack = currentStepIndex > 0;
  const canGoForward = currentStepIndex < totalSteps - 1 && currentStepIndex < answers.length;

  const slideAnimationStyle = slideDirection === 'forward'
    ? 'wizardSlideForward'
    : 'wizardSlideBackward';

  if (dismissed) return null;

  return (
    <div
      style={{
        background: '#323230',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        margin: '12px 16px',
        overflow: 'hidden',
        animation: 'wizardAppear 250ms ease-out',
      }}
      data-testid="guided-creation"
    >
      <style>{`
        @keyframes wizardAppear {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wizardSlideForward {
          from { opacity: 0; transform: translateX(15px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes wizardSlideBackward {
          from { opacity: 0; transform: translateX(-15px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {!allDone && !completed && (
        <div
          style={{
            height: 48,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
          }}
          data-testid="wizard-nav-bar"
        >
          <button
            onClick={handlePrevStep}
            disabled={!canGoBack}
            style={{
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: canGoBack ? 'pointer' : 'default',
              opacity: canGoBack ? 1 : 0.3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            data-testid="wizard-prev-btn"
          >
            <ChevronLeft style={{ width: 20, height: 20, color: '#9A9893' }} />
          </button>
          <span
            style={{
              fontSize: 14,
              color: '#9A9893',
              margin: '0 4px',
              userSelect: 'none',
            }}
            data-testid="wizard-step-indicator"
          >
            {currentStepIndex + 1} of {totalSteps}
          </span>
          <button
            onClick={handleNextStep}
            disabled={!canGoForward}
            style={{
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: canGoForward ? 'pointer' : 'default',
              opacity: canGoForward ? 1 : 0.3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            data-testid="wizard-next-btn"
          >
            <ChevronRight style={{ width: 20, height: 20, color: '#9A9893' }} />
          </button>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            data-testid="wizard-close-btn"
          >
            <X style={{ width: 20, height: 20, color: '#9A9893' }} />
          </button>
        </div>
      )}

      {!allDone && !completed && !newProjectMode && currentStep && (
        <div
          key={animationKey}
          style={{ animation: `${slideAnimationStyle} 200ms ease-out` }}
        >
          <div
            style={{
              padding: '4px 20px 16px 20px',
              fontSize: 18,
              fontWeight: 500,
              color: '#ECECEC',
              lineHeight: 1.4,
            }}
            data-testid="wizard-step-title"
          >
            {stripEmoji(currentStep.label)}
          </div>

          {answers.length > 0 && !allDone && !completed && (
            <div style={{ padding: '0 20px 8px 20px' }}>
              {answers.map((ans, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginBottom: 4,
                }}>
                  <div style={{
                    background: 'rgba(174,86,48,0.15)',
                    borderRadius: 12,
                    padding: '6px 12px',
                    fontSize: 13,
                    color: '#ECECEC',
                    maxWidth: '80%',
                  }}>
                    <span style={{ color: '#9A9893', fontSize: 12, marginRight: 6 }}>
                      {stripEmoji(dynamicSteps[idx]?.label || '')}:
                    </span>
                    {ans.displayLabel}
                  </div>
                </div>
              ))}
            </div>
          )}

          <AiStepQuestion
            step={currentStep}
            stepNumber={currentStepIndex + 1}
            totalSteps={totalSteps}
            onSelect={handleSelect}
            onSkip={handleSkip}
          />
        </div>
      )}

      {newProjectMode && !completed && (
        <div style={{ padding: '16px 20px' }} data-testid="new-project-input">
          <div style={{ fontSize: 14, color: '#9A9893', marginBottom: 12 }}>输入新项目名称</div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCreateProject();
                }
              }}
              disabled={creatingProject}
              placeholder="输入项目名称..."
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 16,
                color: '#ECECEC',
                outline: 'none',
              }}
              autoFocus
              data-testid="input-new-project-name"
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => {
                setNewProjectMode(false);
                setNewProjectName("");
              }}
              disabled={creatingProject}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                fontSize: 15,
                color: '#9A9893',
                cursor: 'pointer',
              }}
              data-testid="btn-cancel-new-project"
            >
              返回
            </button>
            <button
              onClick={handleCreateProject}
              disabled={creatingProject || !newProjectName.trim()}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 10,
                background: '#AE5630',
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                color: '#FFFFFF',
                cursor: newProjectName.trim() && !creatingProject ? 'pointer' : 'not-allowed',
                opacity: newProjectName.trim() && !creatingProject ? 1 : 0.4,
              }}
              data-testid="btn-create-project"
            >
              {creatingProject ? "创建中..." : "创建项目"}
            </button>
          </div>
        </div>
      )}

      {allDone && !completed && finishing && !error && (
        <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThinkingAnimation size={24} label="组装中..." />
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: '#E5534B',
            fontSize: 14,
          }}
          data-testid="guided-error"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {completed && (
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: '#AE5630',
            fontSize: 14,
          }}
          data-testid="guided-complete"
        >
          <Check className="w-4 h-4" />
          已提交
        </div>
      )}
    </div>
  );
}

```

---

## client/src/components/ai/AiStepQuestion.tsx

**Lines: 267**

```tsx
import { useState, useRef } from "react";
import { Pencil } from "lucide-react";

interface StepOption {
  label: string;
  value: any;
  description?: string;
  icon?: string;
}

interface StepQuestion {
  step: number;
  field: string;
  icon: string;
  label: string;
  options: StepOption[];
  allowCustomInput: boolean;
  customInputPlaceholder?: string;
  allowSkip: boolean;
  skipValue?: any;
  inputType?: 'text' | 'date' | 'textarea';
}

interface AiStepQuestionProps {
  step: StepQuestion;
  stepNumber: number;
  totalSteps: number;
  onSelect: (value: any, displayLabel: string) => void;
  onSkip: () => void;
  disabled?: boolean;
}

export default function AiStepQuestion({
  step,
  onSelect,
  disabled,
}: AiStepQuestionProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [customValue, setCustomValue] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const selectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasOptions = step.options && step.options.length > 0;
  const isSelectType = hasOptions;
  const isInputType = !hasOptions;

  const handleOptionClick = (opt: StepOption, index: number) => {
    if (disabled || selectedIndex !== null) return;
    setSelectedIndex(index);
    if (selectTimeoutRef.current) clearTimeout(selectTimeoutRef.current);
    selectTimeoutRef.current = setTimeout(() => {
      onSelect(opt.value, opt.label);
    }, 200);
  };

  const handleCustomSubmit = () => {
    if (disabled || !customValue.trim()) return;
    onSelect(customValue.trim(), customValue.trim());
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCustomSubmit();
    }
  };

  const handleInputConfirm = () => {
    if (disabled || !inputValue.trim()) return;
    onSelect(inputValue.trim(), inputValue.trim());
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleInputConfirm();
    }
  };

  if (isInputType) {
    return (
      <div data-testid={`step-question-${step.field}`}>
        <style>{`
          .wizard-text-input::placeholder { color: #7A7874; }
        `}</style>
        <div style={{ margin: '0 20px' }}>
          {step.inputType === 'textarea' ? (
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              disabled={disabled}
              placeholder={step.customInputPlaceholder || "输入内容..."}
              rows={3}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 10,
                border: inputFocused
                  ? '1px solid rgba(174,86,48,0.5)'
                  : '1px solid rgba(255,255,255,0.08)',
                fontSize: 16,
                color: '#ECECEC',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 150ms',
                fontFamily: 'inherit',
                resize: 'none',
              }}
              autoFocus
              data-testid={`step-input-${step.field}`}
            />
          ) : (
            <input
              type={step.inputType === 'date' ? 'date' : 'text'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              disabled={disabled}
              placeholder={step.customInputPlaceholder || "输入内容..."}
              className="wizard-text-input"
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 10,
                border: inputFocused
                  ? '1px solid rgba(174,86,48,0.5)'
                  : '1px solid rgba(255,255,255,0.08)',
                fontSize: 16,
                color: '#ECECEC',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 150ms',
              }}
              autoFocus
              data-testid={`step-input-${step.field}`}
            />
          )}
        </div>
        <div style={{ margin: '12px 20px 16px 20px' }}>
          <button
            onClick={handleInputConfirm}
            disabled={disabled || !inputValue.trim()}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 10,
              background: '#AE5630',
              border: 'none',
              fontSize: 15,
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: inputValue.trim() && !disabled ? 'pointer' : 'not-allowed',
              opacity: inputValue.trim() && !disabled ? 1 : 0.4,
              transition: 'opacity 150ms',
            }}
            data-testid={`step-confirm-${step.field}`}
          >
            确认
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid={`step-question-${step.field}`}>
      <style>{`
        .wizard-custom-input::placeholder { color: #7A7874; }
      `}</style>
      {step.options.map((opt, idx) => {
        const isHighlighted = selectedIndex === idx;
        return (
          <div
            key={idx}
            onClick={() => handleOptionClick(opt, idx)}
            style={{
              height: 56,
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: isHighlighted
                ? 'rgba(174,86,48,0.15)'
                : 'transparent',
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => {
              if (!isHighlighted && !disabled) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isHighlighted) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
            onMouseDown={(e) => {
              if (!isHighlighted && !disabled) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              }
            }}
            onMouseUp={(e) => {
              if (!isHighlighted && !disabled) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }
            }}
            data-testid={`step-option-${step.field}-${idx}`}
          >
            <span style={{ fontSize: 15, color: '#7A7874', width: 24, flexShrink: 0, textAlign: 'center' }}>
              {idx + 1}
            </span>
            <span style={{ fontSize: 16, color: '#ECECEC' }}>
              {opt.label}
            </span>
          </div>
        );
      })}

      {step.allowCustomInput && (
        <div
          style={{
            height: 56,
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
          data-testid={`step-custom-row-${step.field}`}
        >
          <span style={{ width: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Pencil style={{ width: 16, height: 16, color: '#7A7874' }} />
          </span>
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={handleCustomKeyDown}
            disabled={disabled}
            placeholder="输入自定义内容..."
            className="wizard-custom-input"
            style={{
              flex: 1,
              fontSize: 16,
              color: '#ECECEC',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
            }}
            data-testid={`step-custom-input-${step.field}`}
          />
        </div>
      )}
    </div>
  );
}

```

---

## server/services/ai/index.ts (model configs + smart routing)

**Total lines: 1654** — showing lines 1-100

```ts
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import { SYSTEM_PROMPT } from './prompts';
import { ACTION_SCHEMAS } from './actionSchemas';
import { storage } from '../../storage';
import { CODE_TOOLS, executeCodeTool } from './codeTools';

const openrouterClient = new OpenAI({
  baseURL: process.env.AI_BASE_URL,
  apiKey: process.env.AI_API_KEY,
  timeout: 30000,
});

const claudeComplexClient = new OpenAI({
  baseURL: 'https://vip.aipro.love/v1',
  apiKey: process.env.CLAUDE_COMPLEX_API_KEY,
  timeout: 180000,
});

const claudeSimpleClient = new OpenAI({
  baseURL: 'https://vip.aipro.love/v1',
  apiKey: process.env.CLAUDE_SIMPLE_API_KEY,
  timeout: 90000,
});

const COMPLEX_MODELS = ['claude-opus-4-6'];
const SIMPLE_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];

function getClientForModel(model: string): OpenAI {
  if (COMPLEX_MODELS.includes(model)) return claudeComplexClient;
  if (SIMPLE_MODELS.includes(model)) return claudeSimpleClient;
  return openrouterClient;
}

type TaskCategory = 'title_generation' | 'auto_judgment' | 'quick_reply' | 'general_chat' | 'code_generation' | 'complex_analysis' | 'document_processing' | 'knowledge_qa';

interface ModelConfig {
  model: string;
  max_tokens: number;
  thinking: { type: 'enabled'; budget_tokens: number } | { type: 'disabled' };
  temperature: number;
}

const TASK_MODEL_CONFIGS: Record<TaskCategory, ModelConfig> = {
  title_generation: {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    thinking: { type: 'disabled' },
    temperature: 0.7,
  },
  auto_judgment: {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    thinking: { type: 'disabled' },
    temperature: 0.0,
  },
  quick_reply: {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    thinking: { type: 'disabled' },
    temperature: 0.5,
  },
  general_chat: {
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    thinking: { type: 'disabled' },
    temperature: 0.7,
  },
  code_generation: {
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    thinking: { type: 'enabled', budget_tokens: 16000 },
    temperature: 0.3,
  },
  complex_analysis: {
    model: 'claude-sonnet-4-6',
    max_tokens: 32000,
    thinking: { type: 'enabled', budget_tokens: 32000 },
    temperature: 0.5,
  },
  document_processing: {
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    thinking: { type: 'enabled', budget_tokens: 10000 },
    temperature: 0.3,
  },
  knowledge_qa: {
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    thinking: { type: 'disabled' },
    temperature: 0.3,
  },
};

const USER_MODEL_MAX_TOKENS: Record<string, number> = {
  'claude-opus-4-6': 64000,
  'claude-sonnet-4-6': 8192,
  'claude-haiku-4-5-20251001': 2048,
  'gpt-4o': 16384,
```

---

## server/services/ai/prompts.ts (system prompt structure)

**Total lines: 215** — showing lines 1-50

```ts
export const SYSTEM_PROMPT = `你是 {{orgName}} 的企业任务管理 AI 助手。你的工作是帮助团队成员用自然语言管理任务。

## 你的能力
你可以帮助用户执行以下操作：
1. create_task — 创建新任务
2. update_task — 更新任务（状态、优先级、负责人、截止日期等）
3. create_project — 创建新项目
4. add_comment — 给任务添加评论
5. 回答查询类问题（任务列表、项目进展、工作概览等）
6. judge_assignment — 判定任务分配是否合理（权责判定），用户说"判断一下"、"合不合理"、"应该谁做"时触发
7. query_verdicts — 查询某人的权责判定历史和统计，用户说"权责分布"、"分外工作"时触发

## 当前系统上下文
- 组织: {{orgName}}
- 当前用户ID: {{currentUserId}}
- 当前用户名: {{currentUserName}}
- 当前时间: {{currentTime}}

## 团队成员
{{teamMembers}}

## 项目列表
{{projectList}}

## 当前活跃任务（未完成/未取消）
{{taskList}}

## 任务统计
- 总任务数: {{totalTasks}}
- 已完成: {{doneTasks}}
- 逾期: {{overdueTasks}}

## 重要规则

### 规则1: 输出格式
你必须以纯 JSON 格式回复（不要用 markdown 代码块包裹），严格遵循以下结构：

**写入操作（创建/更新/删除）→ 必须用 confirm：**
{
  "type": "confirm",
  "action": {
    "actionType": "create_task",
    "data": { "title": "...", "projectId": 4 },
    "summary": "创建任务「完成Q1课程大纲」，分配给Michael，截止3月15日",
    "confidence": 0.9
  }
}

**查询类问题 → 必须用 text，直接给出结果：**
{
```

---

## client/src/index.css (chat-related excerpts)

**Total lines: 663** — showing CSS variables, animations, and code highlight theme

```css
:root {
  /* ===== 字体（全局共享） ===== */
  --font-serif: Georgia, 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif;
  --font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Helvetica Neue', sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', Menlo, Consolas, monospace;

  /* ===== Dark Mode 自定义变量（默认模式） ===== */
  --bg-primary: #1A1918;
  --bg-sidebar: #141312;
  --bg-composer: #232321;
  --bg-bubble: #2A2928;
  --bg-code: #141413;
  --bg-code-header: #1E1D1B;
  --text-primary: #ECECEC;
  --text-secondary: #9A9893;
  --text-placeholder: #7A7874;
  --text-bright: #FFFFFF;
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-medium: rgba(255, 255, 255, 0.12);
  --overlay: rgba(0, 0, 0, 0.4);
  --brand: #AE5630;
  --brand-hover: #C4633A;
  --brand-icon: #C4703F;
  --sidebar-active: rgba(255, 255, 255, 0.08);
  --sidebar-hover: rgba(255, 255, 255, 0.04);
  --section-title: #C4703F;

/* ... (additional theme variants omitted — see full file) ... */

@keyframes messageAppear {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@keyframes slideUpSheet {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes blink-cursor {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.ai-table-zebra tbody tr:nth-child(even) {
  background: rgba(255, 255, 255, 0.03);
}

.streaming-cursor::after {
  content: '▌';
  animation: blink-cursor 0.8s ease-in-out infinite;
  color: var(--text-primary);
  font-weight: 300;
  margin-left: 1px;
}

.sidebar-item {
  transition: background 200ms ease;
  -webkit-tap-highlight-color: transparent;
}
.sidebar-item.sidebar-touch-hl {
  background: rgba(0,0,0,0.4) !important;
}
@media (hover: hover) and (pointer: fine) {
  .sidebar-item:not(.sidebar-item-active):hover {
    background: rgba(0,0,0,0.4) !important;
  }
  .sidebar-item:not(.sidebar-item-active):active {
    background: rgba(0,0,0,0.6) !important;
  }
}
.sidebar-item-active {
  background: #000 !important;
}

.hljs {
  color: #c9d1d9;
  background: transparent;
}
.hljs-keyword,
.hljs-built_in,
.hljs-type { color: #ff7b72; }
.hljs-string,
.hljs-attr { color: #a5d6ff; }
.hljs-number,
.hljs-literal { color: #79c0ff; }
.hljs-comment,
.hljs-doctag { color: #8b949e; font-style: italic; }
.hljs-function .hljs-title,
.hljs-title.function_,
.hljs-title.class_ { color: #d2a8ff; }
.hljs-variable,
.hljs-template-variable { color: #ffa657; }
.hljs-params { color: #c9d1d9; }
.hljs-meta { color: #79c0ff; }
.hljs-regexp { color: #7ee787; }
.hljs-selector-tag,
.hljs-selector-class { color: #7ee787; }
.hljs-property { color: #79c0ff; }
.hljs-punctuation { color: #c9d1d9; }
.hljs-operator { color: #ff7b72; }
.hljs-tag { color: #7ee787; }
.hljs-name { color: #7ee787; }
.hljs-attribute { color: #79c0ff; }
```

---

## Directory Structure — client/src (2 levels)

```
client/src
client/src/App.tsx
client/src/components
client/src/components/AgentLogo.tsx
client/src/components/ai
client/src/components/graph
client/src/components/org
client/src/components/ParticipantAvatars.tsx
client/src/components/SettingsPage.tsx
client/src/components/SetupConfirmModal.tsx
client/src/components/SwipeableTaskCard.tsx
client/src/components/ThemeProvider.tsx
client/src/components/ThinkingAnimation.tsx
client/src/components/ui
client/src/hooks
client/src/hooks/use-auth.ts
client/src/hooks/use-mobile.tsx
client/src/hooks/use-tap-motion.ts
client/src/hooks/use-toast.ts
client/src/index.css
client/src/lib
client/src/lib/auth.tsx
client/src/lib/auth-utils.ts
client/src/lib/queryClient.ts
client/src/lib/utils.ts
client/src/main.tsx
client/src/pages
client/src/pages/admin
client/src/pages/agent.tsx
client/src/pages/artifacts.tsx
client/src/pages/chats.tsx
client/src/pages/collaboration.tsx
client/src/pages/dashboard.tsx
client/src/pages/evaluation.tsx
client/src/pages/gantt.tsx
client/src/pages/graph-view.tsx
client/src/pages/knowledge-base.tsx
client/src/pages/login.tsx
client/src/pages/not-found.tsx
client/src/pages/notifications.tsx
client/src/pages/OnboardingPage.tsx
client/src/pages/organization.tsx
client/src/pages/overview.tsx
client/src/pages/project-detail.tsx
client/src/pages/project-list.tsx
client/src/pages/projects.tsx
client/src/pages/project-wizard.tsx
client/src/pages/settings.tsx
client/src/pages/sync.tsx
client/src/pages/task-detail.tsx
client/src/pages/task-list.tsx
client/src/pages/team.tsx
client/src/stores
client/src/stores/chatStreamStore.ts
```

---

## All files in client/src/components/

```
client/src/components/AgentLogo.tsx
client/src/components/ai/AiChatButton.tsx
client/src/components/ai/AiChatPanel.tsx
client/src/components/ai/AiConfirmCard.tsx
client/src/components/ai/AiFollowUpCard.tsx
client/src/components/ai/AiGuidedCreation.tsx
client/src/components/ai/AiInputBar.tsx
client/src/components/ai/AiMessageBubble.tsx
client/src/components/ai/AIMessageContent.tsx
client/src/components/ai/AiStepQuestion.tsx
client/src/components/ai/ArtifactPanel.tsx
client/src/components/ai/InteractiveInputWidget.tsx
client/src/components/ai/ThinkingBlock.tsx
client/src/components/graph/BloodVesselCanvas.tsx
client/src/components/graph/ForceGraph.tsx
client/src/components/graph/GraphChatFloat.tsx
client/src/components/graph/GraphLegend.tsx
client/src/components/graph/GraphNodeSheet.tsx
client/src/components/graph/GraphSettings.tsx
client/src/components/org/OrgColorLegend.tsx
client/src/components/org/OrgDetailPanel.tsx
client/src/components/org/OrgMindmapSvg.tsx
client/src/components/org/OrgOutline.tsx
client/src/components/org/OrgPersonPopover.tsx
client/src/components/org/OrgPersonRow.tsx
client/src/components/org/types.ts
client/src/components/org/useOrgData.ts
client/src/components/ParticipantAvatars.tsx
client/src/components/SettingsPage.tsx
client/src/components/SetupConfirmModal.tsx
client/src/components/SwipeableTaskCard.tsx
client/src/components/ThemeProvider.tsx
client/src/components/ThinkingAnimation.tsx
client/src/components/ui/accordion.tsx
client/src/components/ui/alert-dialog.tsx
client/src/components/ui/alert.tsx
client/src/components/ui/aspect-ratio.tsx
client/src/components/ui/avatar.tsx
client/src/components/ui/badge.tsx
client/src/components/ui/breadcrumb.tsx
client/src/components/ui/button.tsx
client/src/components/ui/calendar.tsx
client/src/components/ui/card.tsx
client/src/components/ui/carousel.tsx
client/src/components/ui/chart.tsx
client/src/components/ui/checkbox.tsx
client/src/components/ui/collapsible.tsx
client/src/components/ui/command.tsx
client/src/components/ui/context-menu.tsx
client/src/components/ui/dialog.tsx
client/src/components/ui/drawer.tsx
client/src/components/ui/dropdown-menu.tsx
client/src/components/ui/form.tsx
client/src/components/ui/hover-card.tsx
client/src/components/ui/input-otp.tsx
client/src/components/ui/input.tsx
client/src/components/ui/label.tsx
client/src/components/ui/menubar.tsx
client/src/components/ui/navigation-menu.tsx
client/src/components/ui/pagination.tsx
client/src/components/ui/popover.tsx
client/src/components/ui/progress.tsx
client/src/components/ui/radio-group.tsx
client/src/components/ui/resizable.tsx
client/src/components/ui/scroll-area.tsx
client/src/components/ui/select.tsx
client/src/components/ui/separator.tsx
client/src/components/ui/sheet.tsx
client/src/components/ui/sidebar.tsx
client/src/components/ui/skeleton.tsx
client/src/components/ui/slider.tsx
client/src/components/ui/switch.tsx
client/src/components/ui/table.tsx
client/src/components/ui/tabs.tsx
client/src/components/ui/textarea.tsx
client/src/components/ui/toaster.tsx
client/src/components/ui/toast.tsx
client/src/components/ui/toggle-group.tsx
client/src/components/ui/toggle.tsx
client/src/components/ui/tooltip.tsx
```

