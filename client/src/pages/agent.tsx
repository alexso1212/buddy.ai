import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AiInputBar from "@/components/ai/AiInputBar";
import type { Attachment } from "@/components/ai/AiInputBar";
import { Trash2, ListPlus, BarChart3, Users, CheckSquare, Plus, ArrowLeft, MessageSquare, Pencil, X, Check, ListFilter, ChevronRight, Search, Star, FolderOpen, ArrowDown, AlertCircle, Clock, Square } from "lucide-react";
import ArtifactSidePanel from "@/components/ai/ArtifactSidePanel";
import ArtifactBottomSheet from "@/components/ai/ArtifactBottomSheet";
import InteractiveInputWidget, { formatAnswersForDisplay, formatAnswersForAI, type InteractiveQuestion } from "@/components/ai/InteractiveInputWidget";
import { Button } from "@/components/ui/button";
import AgentLogo from "@/components/AgentLogo";
import ThinkingAnimation from "@/components/ThinkingAnimation";
import StarburstIndicator from "@/components/ai/StarburstIndicator";
import { useAuth } from "@/lib/auth";
import { setStreamState, clearStreamState, getStreamState, takeoverStream, isBackgroundStreamActive } from "@/stores/chatStreamStore";
import { BuddyRuntimeProvider, type BuddyCallbacks } from "@/components/ai/BuddyRuntime";
import { BuddyUserMessage, BuddyAssistantMessage } from "@/components/ai/BuddyMessages";
import { ThreadPrimitive } from "@assistant-ui/react";

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
  type?: "text" | "confirm" | "multi_confirm" | "follow_up" | "decision_request";
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
    const searchToken = localStorage.getItem('buddy_token');
    const searchHeaders: Record<string, string> = searchToken ? { Authorization: `Bearer ${searchToken}` } : {};
    fetch(`/api/conversations/search?q=${encodeURIComponent(debouncedQuery.trim())}`, { headers: searchHeaders, credentials: 'include' })
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
    const r = 24;

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
  const [artifactPanel, setArtifactPanel] = useState<{ content: string; title: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationHistory = useRef<{ role: string; content: string }[]>([]);
  const [activeConvSystemPrompt, setActiveConvSystemPrompt] = useState<string | undefined>();
  const [convTitle, setConvTitle] = useState<string>("");
  const [showChat, setShowChat] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingDupActionRef = useRef<ActionPayload | null>(null);
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
    const token = localStorage.getItem('buddy_token');
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const convRes = await fetch(`/api/conversations/${convIdToLoad}`, { headers: authHeaders, credentials: 'include' });
      const convJson = await convRes.json();
      if (convJson.data?.systemPrompt) {
        setActiveConvSystemPrompt(convJson.data.systemPrompt);
      } else {
        setActiveConvSystemPrompt(undefined);
      }
      if (convJson.data?.title) {
        setConvTitle(convJson.data.title);
      }

      const res = await fetch(`/api/conversations/${convIdToLoad}/messages`, { headers: authHeaders, credentials: 'include' });
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

  const isAutoScrolling = useRef(true);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    }
  }, []);

  const handleScrollEvent = useCallback(() => {
    const nearBottom = isNearBottom();
    isAutoScrolling.current = nearBottom;
    setShowScrollBtn(!nearBottom);
  }, [isNearBottom]);

  useEffect(() => {
    if (isAutoScrolling.current) {
      scrollToBottom(false);
    }
  }, [messages, loading, scrollToBottom]);

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
    async (answers: Record<string, string[]>) => {
      if (!interactiveInput) return;

      if (answers['dup_check'] && pendingDupActionRef.current) {
        const choice = answers['dup_check'][0];
        const dupAction = pendingDupActionRef.current;
        pendingDupActionRef.current = null;
        setInteractiveInput(null);

        if (choice === '这是不同的任务，继续创建') {
          try {
            const res = await apiRequest("POST", "/api/ai/confirm", {
              actionType: dupAction.actionType,
              data: dupAction.data,
              currentUserId: currentUserId || 1,
              conversationId: activeConvId || undefined,
              forceCreate: true,
            });
            const json = await res.json();
            const result = json.data;
            const sysMsg: Message = {
              id: nextId(),
              role: "system",
              content: result.message || "任务已创建",
            };
            setMessages((prev) => [...prev, sysMsg]);
            if (activeConvId) saveMessageToDB(activeConvId, sysMsg);
            queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
          } catch (err: any) {
            const sysMsg: Message = {
              id: nextId(),
              role: "system",
              content: err.message || "创建失败，请重试",
            };
            setMessages((prev) => [...prev, sysMsg]);
          }
        } else {
          const sysMsg: Message = {
            id: nextId(),
            role: "system",
            content: "已取消创建，不重复创建该任务。",
          };
          setMessages((prev) => [...prev, sysMsg]);
          if (activeConvId) saveMessageToDB(activeConvId, sysMsg);
        }
        return;
      }

      const displayText = formatAnswersForDisplay(interactiveInput, answers);
      const structuredData = formatAnswersForAI(interactiveInput, answers);
      setInteractiveInput(null);
      const responseText = `[用户选择] ${displayText}\n\n${JSON.stringify(structuredData)}`;
      handleSendRef.current?.(responseText);
    },
    [interactiveInput, activeConvId]
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
      isAutoScrolling.current = true;
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

        if (result.error === 'duplicate_suspected' && result.matches?.length > 0) {
          const matchInfo = result.matches.map((m: any) =>
            `- "${m.title}" (${m.status}, 相似度: ${Math.round(m.similarity * 100)}%)`
          ).join('\n');

          const dupMsg: Message = {
            id: nextId(),
            role: "assistant",
            content: `系统检测到相似任务：\n\n${matchInfo}\n\n请确认是否仍要创建新任务。`,
          };
          setMessages((prev) => [...prev, dupMsg]);
          if (activeConvId) saveMessageToDB(activeConvId, dupMsg);

          pendingDupActionRef.current = action;
          setInteractiveInput([{
            id: 'dup_check',
            type: 'single_select' as const,
            question: `已有相似任务「${result.matches[0].title}」(${result.matches[0].status})，如何处理？`,
            options: ['这是同一个任务，不重复创建', '这是不同的任务，继续创建'],
          }]);
          return;
        }

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

  const handleOpenArtifact = useCallback((content: string, title: string) => {
    setArtifactPanel({ content, title });
  }, []);

  const handleCloseArtifact = useCallback(() => {
    setArtifactPanel(null);
  }, []);

  const buddyCallbacks: BuddyCallbacks = useMemo(() => ({
    onConfirm: handleConfirm,
    onReject: handleReject,
    onSkip: handleSkip,
    onConfirmAll: handleConfirmAll,
    onFollowUpSubmit: handleFollowUpSubmit,
    onStepAnswer: handleStepAnswer,
    onRegenerate: handleRegenerate,
    onEditMessage: handleEditMessage,
    onRetry: handleRetry,
    onContinueGeneration: handleContinueGeneration,
    onNewConversation: handleNewConversation,
    onTrimAndRetry: handleTrimAndRetry,
    onOpenArtifact: handleOpenArtifact,
  }), [handleConfirm, handleReject, handleSkip, handleConfirmAll, handleFollowUpSubmit, handleStepAnswer, handleRegenerate, handleEditMessage, handleRetry, handleContinueGeneration, handleNewConversation, handleTrimAndRetry, handleOpenArtifact]);

  const showWelcome = !activeConvId && messages.length === 0 && !showChat;

  return (
    <div className="flex h-full bg-transparent overflow-hidden" data-testid="agent-page">
      <div className="relative flex-1 min-w-0 overflow-x-hidden" style={{ touchAction: 'pan-y', transition: 'flex 350ms cubic-bezier(0.25,1,0.5,1)' }}>

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
        <BuddyRuntimeProvider
          messages={messages}
          isRunning={loading}
          onSend={handleSend}
          onCancel={handleStop}
          callbacks={buddyCallbacks}
        >
          <ThreadPrimitive.Root className="absolute inset-0 flex flex-col" style={{ background: 'transparent' }}>
            <ThreadPrimitive.Viewport
              autoScroll
              className="flex-1 overflow-y-auto overflow-x-hidden"
              ref={scrollRef as any}
              onScroll={handleScrollEvent}
              data-testid="agent-messages"
              style={{ paddingTop: 54, paddingBottom: 'calc(160px + 3.33vh)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y' }}
            >
              <div className="max-w-3xl mx-auto">
                <ThreadPrimitive.Messages
                  components={{
                    UserMessage: BuddyUserMessage,
                    AssistantMessage: BuddyAssistantMessage,
                  }}
                />
                {loading && !messages.some(m => m.isStreaming) && (
                  <div className="flex justify-start px-3 mb-6" data-testid="ai-loading">
                    <StarburstIndicator visible={true} />
                  </div>
                )}
              </div>
            </ThreadPrimitive.Viewport>

            {messages.some(m => m.isStreaming) && (
              <div className="absolute z-30 flex justify-center" style={{ bottom: 'calc(170px + 3.33vh)', left: 0, right: 0, pointerEvents: 'none' }}>
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 transition-all hover:scale-105"
                  style={{
                    padding: '6px 16px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                    fontFamily: 'var(--font-sans)',
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                  }}
                  data-testid="btn-stop-streaming"
                >
                  <Square className="w-3 h-3 fill-current" />
                  停止生成
                </button>
              </div>
            )}

            <ThreadPrimitive.ScrollToBottom asChild>
              <button
                className={`absolute z-30 flex items-center justify-center hover:scale-105 transition-all duration-200 ease-out ${showScrollBtn ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                style={{
                  bottom: 'calc(160px + 3.33vh)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                }}
                data-testid="btn-scroll-bottom"
              >
                <ArrowDown className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.85)' }} strokeWidth={2} />
              </button>
            </ThreadPrimitive.ScrollToBottom>
          </ThreadPrimitive.Root>
        </BuddyRuntimeProvider>
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

      {!isMobile && artifactPanel && (
        <ArtifactSidePanel
          content={artifactPanel.content}
          title={artifactPanel.title}
          isOpen={true}
          onClose={handleCloseArtifact}
        />
      )}

      {isMobile && artifactPanel && (
        <ArtifactBottomSheet
          open={true}
          title={artifactPanel.title}
          content={artifactPanel.content}
          onClose={handleCloseArtifact}
        />
      )}
    </div>
  );
}
