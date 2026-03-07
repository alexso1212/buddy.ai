## 1. 前端目录结构
```
client/src/App.tsx
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
client/src/hooks/use-auth.ts
client/src/hooks/use-mobile.tsx
client/src/hooks/use-tap-motion.ts
client/src/hooks/use-toast.ts
client/src/index.css
client/src/lib/auth.tsx
client/src/lib/auth-utils.ts
client/src/lib/queryClient.ts
client/src/lib/utils.ts
client/src/main.tsx
client/src/pages/admin/AdminAI.tsx
client/src/pages/admin/AdminKB.tsx
client/src/pages/admin/AdminLayout.tsx
client/src/pages/admin/AdminOrgs.tsx
client/src/pages/admin/AdminOverview.tsx
client/src/pages/admin/AdminSecurity.tsx
client/src/pages/admin/AdminUsers.tsx
client/src/pages/admin/AdminWorkforce.tsx
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
client/src/stores/chatStreamStore.ts
```

## 2. agent.tsx
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

## 3. AI Components

### client/src/components/ai/AiChatButton.tsx
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

### client/src/components/ai/AiChatPanel.tsx
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

### client/src/components/ai/AiConfirmCard.tsx
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

### client/src/components/ai/AiFollowUpCard.tsx
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

### client/src/components/ai/AiGuidedCreation.tsx
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

### client/src/components/ai/AiInputBar.tsx
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

### client/src/components/ai/AiMessageBubble.tsx
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

### client/src/components/ai/AIMessageContent.tsx
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

### client/src/components/ai/AiStepQuestion.tsx
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

## 4. components 目录列表
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

## 5. Auth Pages

### client/src/pages/login.tsx
```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { tapMotionProps } from '@/hooks/use-tap-motion';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

declare global {
  interface Window {
    onTelegramAuth?: (user: any) => void;
  }
}

function TelegramLoginIcon({ onAuth }: { onAuth: (user: any) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    window.onTelegramAuth = onAuth;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'Deltapex_Alex_Bot');
    script.setAttribute('data-size', 'small');
    script.setAttribute('data-radius', '20');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.async = true;
    container.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
      if (container.contains(script)) {
        container.removeChild(script);
      }
    };
  }, [onAuth]);

  return <div ref={containerRef} />;
}

const SLOGANS = [
  '一起协作',
  '智能管理',
  '高效执行',
  '团队赋能',
  '创造价值',
];

function TypingSlogan() {
  const [displayText, setDisplayText] = useState('');
  const [sloganIndex, setSloganIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    const currentSlogan = SLOGANS[sloganIndex];

    if (!isDeleting && charIndex <= currentSlogan.length) {
      const timeout = setTimeout(() => {
        const newText = currentSlogan.slice(0, charIndex);
        setDisplayText(newText);

        if (charIndex > 0 && charIndex <= currentSlogan.length) {
          try {
            if (navigator.vibrate) {
              navigator.vibrate(8);
            }
          } catch {}
        }

        if (charIndex === currentSlogan.length) {
          setTimeout(() => setIsDeleting(true), 2000);
        } else {
          setCharIndex(prev => prev + 1);
        }
      }, 120);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && charIndex >= 0) {
      const timeout = setTimeout(() => {
        setDisplayText(currentSlogan.slice(0, charIndex));
        if (charIndex === 0) {
          setIsDeleting(false);
          setSloganIndex(prev => (prev + 1) % SLOGANS.length);
        } else {
          setCharIndex(prev => prev - 1);
        }
      }, 60);
      return () => clearTimeout(timeout);
    }
  }, [charIndex, isDeleting, sloganIndex]);

  return (
    <div className="flex items-center justify-center gap-0" data-testid="typing-slogan">
      <span
        style={{
          fontSize: '28px',
          fontWeight: 600,
          color: '#E8C5A8',
          letterSpacing: '0.02em',
        }}
      >
        {displayText}
      </span>
      <span
        style={{
          display: 'inline-block',
          width: '3px',
          height: '32px',
          background: '#D4A27F',
          marginLeft: '2px',
          opacity: showCursor ? 1 : 0,
          transition: 'opacity 0.1s',
          borderRadius: '2px',
        }}
      />
    </div>
  );
}

function BuddyLogo() {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: '#D4B896',
      }}
      data-testid="buddy-logo"
    />
  );
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { login, loginWithToken, register } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<'main' | 'login' | 'register'>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const token = params.get('token');
    const error = params.get('error');

    if (error === 'auth_failed') {
      toast({ title: '登录失败', description: '第三方认证失败，请重试', variant: 'destructive' });
      window.history.replaceState({}, '', '/login');
      return;
    }

    if (token) {
      window.history.replaceState({}, '', '/login');
      loginWithToken(token)
        .then(() => {
          toast({ title: '登录成功', description: '正在跳转...' });
          navigate('/agent');
        })
        .catch(() => {
          toast({ title: '登录失败', description: '令牌验证失败', variant: 'destructive' });
        });
    }
  }, []);

  const handleTelegramAuth = useCallback(async (telegramUser: any) => {
    try {
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telegramUser),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Telegram login failed');
      }
      const data = await res.json();
      await loginWithToken(data.token);
      toast({ title: '登录成功', description: '正在跳转...' });
      navigate('/agent');
    } catch (err: any) {
      toast({ title: '登录失败', description: err.message || 'Telegram 认证失败', variant: 'destructive' });
    }
  }, [loginWithToken, navigate, toast]);

  const handleSocialLogin = () => {
    window.location.href = '/api/login';
  };

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      toast({ title: '邮箱格式不正确', variant: 'destructive' });
      return;
    }

    if (password.length < 8) {
      toast({ title: '密码至少需要8个字符', variant: 'destructive' });
      return;
    }

    if (view === 'register') {
      if (!displayName.trim()) {
        toast({ title: '请输入显示名称', variant: 'destructive' });
        return;
      }
      if (password !== confirmPassword) {
        toast({ title: '两次输入的密码不一致', variant: 'destructive' });
        return;
      }
    }

    setIsLoading(true);

    try {
      if (view === 'login') {
        await login(email, password);
        toast({ title: '登录成功', description: '正在跳转...' });
      } else {
        await register(email, password, displayName);
        toast({ title: '注册成功', description: '正在跳转...' });
      }
      navigate('/agent');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '操作失败';
      toast({ title: view === 'login' ? '登录失败' : '注册失败', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = 'w-full h-12 px-4 text-[15px] bg-transparent border border-[rgba(255,255,255,0.15)] rounded-full outline-none focus:border-[rgba(255,255,255,0.4)] transition-colors text-white placeholder:text-[rgba(255,255,255,0.35)]';

  if (view === 'login' || view === 'register') {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: 'var(--bg-sidebar)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
          <button
            onClick={() => setView('main')}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            data-testid="button-back"
            {...tapMotionProps}
          >
            <X size={18} color="rgba(255,255,255,0.6)" />
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <BuddyLogo />
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 600, marginTop: 16, marginBottom: 32 }}>
            {view === 'login' ? '欢迎回来' : '创建账户'}
          </h2>

          <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {view === 'register' && (
              <input
                data-testid="input-display-name"
                type="text"
                placeholder="显示名称"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
                className={inputClass}
              />
            )}

            <input
              data-testid="input-email"
              type="email"
              placeholder="邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className={inputClass}
            />

            <input
              data-testid="input-password"
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className={inputClass}
            />

            {view === 'register' && (
              <input
                data-testid="input-confirm-password"
                type="password"
                placeholder="确认密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className={inputClass}
              />
            )}

            <button
              data-testid="button-submit"
              type="submit"
              disabled={isLoading}
              {...tapMotionProps}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 9999,
                background: '#D4B896',
                color: '#1E1D1A',
                fontSize: '15px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 4,
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {view === 'login' ? '登录中...' : '注册中...'}
                </>
              ) : (
                view === 'login' ? '登录' : '注册'
              )}
            </button>
          </form>

          {view === 'login' && (
            <button
              onClick={() => setView('register')}
              style={{
                marginTop: 20,
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
              data-testid="link-to-register"
              {...tapMotionProps}
            >
              没有账户？<span style={{ color: '#D4A27F', textDecoration: 'underline' }}>注册</span>
            </button>
          )}
          {view === 'register' && (
            <button
              onClick={() => setView('login')}
              style={{
                marginTop: 20,
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
              data-testid="link-to-login"
              {...tapMotionProps}
            >
              已有账户？<span style={{ color: '#D4A27F', textDecoration: 'underline' }}>登录</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: '30vh',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <BuddyLogo />
        </div>
        <TypingSlogan />
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '0 20px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          background: 'linear-gradient(to top, var(--bg-sidebar) 60%, transparent 100%)',
          paddingTop: 40,
        }}
      >
        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleSocialLogin}
            data-testid="button-apple-login"
            {...tapMotionProps}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 9999,
              background: '#D4B896',
              color: '#1E1D1A',
              fontSize: '15px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1E1D1A">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            通过 Apple 继续
          </button>

          <button
            onClick={handleSocialLogin}
            data-testid="button-google-login"
            {...tapMotionProps}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 9999,
              background: '#1a1a1a',
              color: 'white',
              fontSize: '15px',
              fontWeight: 500,
              border: '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <GoogleIcon />
            继续使用 Google 登录
          </button>

          <button
            onClick={() => setView('register')}
            data-testid="button-register"
            {...tapMotionProps}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 9999,
              background: '#1a1a1a',
              color: 'white',
              fontSize: '15px',
              fontWeight: 500,
              border: '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer',
            }}
          >
            注册
          </button>

          <button
            onClick={() => setView('login')}
            data-testid="button-login"
            {...tapMotionProps}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 9999,
              background: 'transparent',
              color: 'white',
              fontSize: '15px',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            登录
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 4 }}>
            <button
              onClick={handleSocialLogin}
              data-testid="button-github-login"
              title="GitHub"
              {...tapMotionProps}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </button>
            <div data-testid="telegram-login-container" style={{ display: 'flex', alignItems: 'center' }}>
              <TelegramLoginIcon onAuth={handleTelegramAuth} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## 6. Global Styles
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  overflow: hidden;
  overscroll-behavior: none;
  position: fixed;
  width: 100%;
  height: 100%;
  height: 100dvh;
}

#root {
  height: 100%;
  height: 100dvh;
  overflow: hidden;
}

* {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
*::-webkit-scrollbar {
  display: none;
}

@keyframes pickerIn {
  from { opacity: 0; transform: translateY(-90%) scale(0.9); }
  to { opacity: 1; transform: translateY(-100%) scale(1); }
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.85; }
}

@keyframes urgentGlowRing {
  0%, 100% {
    stroke-opacity: 0.4;
    stroke-width: 1.5;
  }
  50% {
    stroke-opacity: 1.0;
    stroke-width: 2.5;
  }
}

@keyframes urgentGlowHalo {
  0%, 100% { opacity: 0.08; }
  50% { opacity: 0.25; }
}

.urgent-glow.node-glow-ring {
  animation: urgentGlowRing 1s ease-in-out infinite;
}

.urgent-glow.node-glow-halo {
  animation: urgentGlowHalo 1s ease-in-out infinite;
}

@keyframes soonGlowRing {
  0%, 100% {
    stroke-opacity: 0.3;
    stroke-width: 1.2;
  }
  50% {
    stroke-opacity: 0.8;
    stroke-width: 2;
  }
}

@keyframes soonGlowHalo {
  0%, 100% { opacity: 0.06; }
  50% { opacity: 0.18; }
}

.soon-glow.node-glow-ring {
  animation: soonGlowRing 2.5s ease-in-out infinite;
}

.soon-glow.node-glow-halo {
  animation: soonGlowHalo 2.5s ease-in-out infinite;
}

@keyframes blockedGlowRing {
  0%, 100% {
    stroke-opacity: 0.3;
    stroke-width: 1.2;
  }
  50% {
    stroke-opacity: 0.9;
    stroke-width: 2.2;
  }
}

@keyframes blockedGlowHalo {
  0%, 100% { opacity: 0.06; }
  50% { opacity: 0.20; }
}

.blocked-breathing-glow.node-glow-ring {
  animation: blockedGlowRing 2s ease-in-out infinite;
}

.blocked-breathing-glow.node-glow-halo {
  animation: blockedGlowHalo 2s ease-in-out infinite;
}

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

  /* ===== shadcn/ui Dark HSL 变量（默认模式） ===== */
  --button-outline: rgba(255,255,255, .10);
  --badge-outline: rgba(255,255,255, .05);
  --opaque-button-border-intensity: 9;
  --elevate-1: rgba(255,255,255, .04);
  --elevate-2: rgba(255,255,255, .09);
  --background: 60 2% 15%;
  --foreground: 0 0% 93%;
  --border: 0 0% 16%;
  --card: 60 2% 13%;
  --card-foreground: 0 0% 93%;
  --card-border: 0 0% 14%;
  --sidebar: 60 2% 13%;
  --sidebar-foreground: 0 0% 90%;
  --sidebar-border: 0 0% 16%;
  --sidebar-primary: 217 71% 53%;
  --sidebar-primary-foreground: 0 0% 98%;
  --sidebar-accent: 0 0% 18%;
  --sidebar-accent-foreground: 0 0% 93%;
  --sidebar-ring: 217 71% 53%;
  --popover: 0 0% 14%;
  --popover-foreground: 0 0% 90%;
  --popover-border: 0 0% 20%;
  --primary: 16 60% 43%;
  --primary-foreground: 0 0% 98%;
  --secondary: 0 0% 18%;
  --secondary-foreground: 0 0% 93%;
  --muted: 0 0% 16%;
  --muted-foreground: 0 0% 55%;
  --accent: 0 0% 18%;
  --accent-foreground: 0 0% 93%;
  --destructive: 0 72% 51%;
  --destructive-foreground: 0 0% 100%;
  --input: 0 0% 25%;
  --ring: 16 60% 43%;
  --chart-1: 217 80% 60%;
  --chart-2: 25 90% 55%;
  --chart-3: 160 70% 50%;
  --chart-4: 262 65% 60%;
  --chart-5: 0 80% 60%;
  --radius: .5rem;
  --shadow-2xs: 0 1px 0 rgba(0,0,0,0.15);
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.20);
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.30);
  --shadow: 0 2px 4px rgba(0,0,0,0.25), 0 4px 6px rgba(0,0,0,0.30);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.30), 0 10px 15px rgba(0,0,0,0.35);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.35), 0 20px 25px rgba(0,0,0,0.40);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.40), 0 25px 50px rgba(0,0,0,0.50);
  --shadow-2xl: 0 25px 50px rgba(0,0,0,0.50);
  --tracking-normal: 0em;
  --spacing: 0.25rem;

  --sidebar-primary-border: hsl(var(--sidebar-primary));
  --sidebar-primary-border: hsl(from hsl(var(--sidebar-primary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --sidebar-accent-border: hsl(var(--sidebar-accent));
  --sidebar-accent-border: hsl(from hsl(var(--sidebar-accent)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --primary-border: hsl(var(--primary));
  --primary-border: hsl(from hsl(var(--primary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --secondary-border: hsl(var(--secondary));
  --secondary-border: hsl(from hsl(var(--secondary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --muted-border: hsl(var(--muted));
  --muted-border: hsl(from hsl(var(--muted)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --accent-border: hsl(var(--accent));
  --accent-border: hsl(from hsl(var(--accent)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
```

## 7. App.tsx
```tsx
import { Switch, Route, useLocation, Link, Redirect } from "wouter";
import { useState, useRef, useEffect } from "react";
import { queryClient, apiRequest } from "./lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider, useAuth } from "@/lib/auth";
import AgentLogo from "@/components/AgentLogo";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import Notifications from "@/pages/notifications";
import Agent from "@/pages/agent";
import Dashboard from "@/pages/dashboard";
import ProjectList from "@/pages/project-list";
import ProjectDetail from "@/pages/project-detail";
import TaskList from "@/pages/task-list";
import TaskDetail from "@/pages/task-detail";
import Team from "@/pages/team";
import Settings from "@/pages/settings";
import GraphView from "@/pages/graph-view";
import Artifacts from "@/pages/artifacts";
import ChatsPage from "@/pages/chats";
import OnboardingPage from "@/pages/OnboardingPage";
import KnowledgeBase from "@/pages/knowledge-base";
import SettingsPage from "@/components/SettingsPage";
import AdminOverview from "@/pages/admin/AdminOverview";
import AdminAI from "@/pages/admin/AdminAI";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminOrgs from "@/pages/admin/AdminOrgs";
import AdminKB from "@/pages/admin/AdminKB";
import AdminSecurity from "@/pages/admin/AdminSecurity";
import AdminWorkforce from "@/pages/admin/AdminWorkforce";
import { useStreamingConvIds } from "@/stores/chatStreamStore";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Menu,
  Network,
  Bot,
  Sun,
  Moon,
  Monitor,
  MessageSquare,
  FolderClosed,
  Settings2,
  Code2,
  Building2,
  ChevronRight,
  Plus,
  Bell,
  LogOut,
  Star,
  StarOff,
  Pencil,
  Trash2,
  FolderInput,
  Eye,
  Search,
  Check,
  X,
  MessageSquarePlus,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { tapMotionProps, elasticDeformSmallProps, elasticDeformProps } from '@/hooks/use-tap-motion';

const BUDDY_AI_NAV = [
  { label: 'Chats', icon: MessageSquare, path: '/chats' },
  { label: 'Projects', icon: FolderClosed, path: null },
  { label: 'Artifacts', icon: Settings2, path: '/artifacts' },
  { label: 'Code', icon: Code2, path: null },
];

const ENTERPRISE_NAV = [
  { label: '仪表盘', icon: LayoutDashboard, path: '/dashboard' },
  { label: '图谱', icon: Network, path: '/graph' },
  { label: '项目', icon: FolderKanban, path: '/projects' },
  { label: '任务', icon: CheckSquare, path: '/tasks' },
  { label: '团队', icon: Users, path: '/team' },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options: { value: "light" | "dark" | "system"; icon: typeof Sun; label: string }[] = [
    { value: "light", icon: Sun, label: "浅色" },
    { value: "dark", icon: Moon, label: "深色" },
    { value: "system", icon: Monitor, label: "系统" },
  ];

  return (
    <div className="flex items-center gap-1 rounded-lg bg-black/5 dark:bg-white/5 p-1" data-testid="theme-toggle">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            {...tapMotionProps}
            onClick={() => setTheme(opt.value)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-colors",
              active
                ? "bg-white dark:bg-white/10 shadow-sm text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
            data-testid={`theme-${opt.value}`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function CollapsibleContent({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | string>(isOpen ? 'auto' : 0);
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        const h = contentRef.current?.scrollHeight || 0;
        setHeight(h);
        setTimeout(() => setHeight('auto'), 300);
      });
    } else {
      const h = contentRef.current?.scrollHeight || 0;
      setHeight(h);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0));
      });
      setTimeout(() => setShouldRender(false), 300);
    }
  }, [isOpen]);

  return (
    <div
      ref={contentRef}
      style={{
        height: typeof height === 'number' ? height : height,
        overflow: 'hidden',
        transition: 'height 300ms ease',
      }}
    >
      {shouldRender && children}
    </div>
  );
}

function ProjectPickerSheet({ convId, conversations, onClose, toast }: {
  convId: string;
  conversations: any[];
  onClose: () => void;
  toast: any;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: projectsData } = useQuery<{ data: any[] }>({
    queryKey: ['/api/projects'],
  });
  const projects = projectsData?.data || [];
  const conv = conversations.find((c: any) => String(c.id) === convId);
  const currentProjectId = conv?.projectId;

  const filtered = projects.filter((p: any) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex: 80,
      background: '#2B2A27',
      borderRadius: '16px 16px 0 0',
      maxHeight: '70vh',
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideUp 300ms cubic-bezier(0.165, 0.85, 0.45, 1)',
    }}>
      <div style={{
        padding: '18px 20px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 17, fontWeight: 600, color: '#ECECEC' }}>移到项目</span>
        <button {...tapMotionProps} onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 4,
        }} data-testid="button-close-project-picker">
          <X size={20} color="#9A9893" />
        </button>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 10,
          padding: '0 12px',
          height: 36,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <Search size={16} color="#7A7874" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索项目..."
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', fontSize: 14,
              color: '#ECECEC',
            }}
            data-testid="input-search-project"
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '24px 14px', textAlign: 'center', color: '#9A9893', fontSize: 14 }}>
            没有找到项目
          </div>
        ) : (
          filtered.map((project: any) => (
            <button
              key={project.id}
              {...tapMotionProps}
              onClick={async () => {
                try {
                  await apiRequest("PATCH", `/api/conversations/${convId}`, {
                    projectId: project.id,
                    projectName: project.name,
                  });
                  queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
                  toast({ title: `已移到「${project.name}」` });
                } catch {}
                onClose();
              }}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: project.id === currentProjectId ? 'rgba(174, 86, 48, 0.12)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left' as const,
              }}
              data-testid={`project-option-${project.id}`}
            >
              <FolderClosed size={18} color={project.id === currentProjectId ? '#AE5630' : '#9A9893'} />
              <span style={{
                fontSize: 15, color: '#ECECEC',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1,
              }}>{project.name}</span>
              {project.id === currentProjectId && (
                <Check size={16} color="#AE5630" />
              )}
            </button>
          ))
        )}

        {currentProjectId && (
          <>
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              margin: '8px 6px',
            }} />
            <button
              {...tapMotionProps}
              onClick={async () => {
                try {
                  await apiRequest("PATCH", `/api/conversations/${convId}`, {
                    projectId: null,
                    projectName: null,
                  });
                  queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
                  toast({ title: '已从项目中移除' });
                } catch {}
                onClose();
              }}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
              data-testid="button-remove-from-project"
            >
              <FolderInput size={18} color="#9A9893" />
              <span style={{ fontSize: 15, color: '#9A9893' }}>从项目中移除</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const HL_CLASS = 'sidebar-touch-hl';

function makeTouchHighlight() {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fadeTimer: ReturnType<typeof setTimeout> | null = null;
  let activeEl: HTMLElement | null = null;
  let startY = 0;
  let cancelled = false;

  const clear = () => {
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
    if (timer) { clearTimeout(timer); timer = null; }
    if (activeEl) { activeEl.classList.remove(HL_CLASS); activeEl = null; }
    cancelled = false;
  };

  const scrollHandler = () => {
    cancelled = true;
    clear();
  };

  let boundContainer: HTMLElement | null = null;

  const bindScroll = (container: HTMLElement | null) => {
    if (boundContainer === container) return;
    if (boundContainer) boundContainer.removeEventListener('scroll', scrollHandler);
    boundContainer = container;
    if (container) container.addEventListener('scroll', scrollHandler, { passive: true });
  };

  return {
    bindScroll,
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
      clear();
      cancelled = false;
      startY = e.touches[0].clientY;
      const el = e.currentTarget;
      timer = setTimeout(() => {
        if (!cancelled) {
          activeEl = el;
          el.classList.add(HL_CLASS);
        }
      }, 60);
    },
    onTouchMove: (e: React.TouchEvent<HTMLElement>) => {
      if (cancelled) return;
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dy > 6) {
        cancelled = true;
        clear();
      }
    },
    onTouchEnd: () => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (activeEl) {
        fadeTimer = setTimeout(() => {
          if (activeEl) { activeEl.classList.remove(HL_CLASS); activeEl = null; }
        }, 180);
      }
      cancelled = false;
    },
    onTouchCancel: () => { clear(); },
  };
}

const touchHL = makeTouchHighlight();

function Sidebar({ 
  isOpen, 
  onClose,
  sidebarRef,
  overlayRef,
}: { 
  isOpen: boolean; 
  onClose: () => void;
  sidebarRef: React.RefObject<HTMLElement>;
  overlayRef: React.RefObject<HTMLDivElement>;
}) {
  const { user: authUser, logout, switchOrg: authSwitchOrg } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [location, navigate] = useLocation();
  const [buddyAiOpen, setBuddyAiOpen] = useState(() => {
    try { const s = localStorage.getItem('sidebar_buddyAi'); return s !== null ? s === 'true' : true; } catch { return true; }
  });
  const [enterpriseOpen, setEnterpriseOpen] = useState(() => {
    try { const s = localStorage.getItem('sidebar_enterprise'); return s !== null ? s === 'true' : false; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('sidebar_buddyAi', String(buddyAiOpen)); } catch {}
  }, [buddyAiOpen]);
  useEffect(() => {
    try { localStorage.setItem('sidebar_enterprise', String(enterpriseOpen)); } catch {}
  }, [enterpriseOpen]);

  useEffect(() => {
    touchHL.bindScroll(scrollContainerRef.current);
    return () => touchHL.bindScroll(null);
  }, []);

  const streamingConvIds = useStreamingConvIds();

  const { data: conversationsData } = useQuery<{ data: any[] }>({
    queryKey: ['/api/conversations'],
  });
  const conversations = conversationsData?.data || [];
  const starredConvs = conversations.filter((c: any) => c.starred).sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const recentConvs = conversations.filter((c: any) => !c.starred).sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Get active conversation from URL
  const searchString = window.location.search;
  const activeConvId = new URLSearchParams(searchString).get('conv');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ convoId: string; x: number; y: number } | null>(null);
  const pressTimerRef = useRef<number>(0);
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [renameModal, setRenameModal] = useState<{ convId: string; title: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [projectPicker, setProjectPicker] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [convSearchQuery, setConvSearchQuery] = useState('');
  const [orgSwitcherOpen, setOrgSwitcherOpen] = useState(false);
  const [joinOrgOpen, setJoinOrgOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  const { data: userOrgsData, refetch: refetchOrgs } = useQuery<{ data: any[] }>({
    queryKey: ['/api/user/orgs'],
    enabled: !!authUser,
  });
  const userOrgs = userOrgsData?.data || [];

  const isActive = (path: string) => {
    if (path === '/chats') return location === '/chats';
    return location === path || location.startsWith(path + '/');
  };

  const renderNavItem = (item: { label: string; icon: typeof MessageSquare; path: string | null }, index: number) => {
    const Icon = item.icon;
    const active = item.path ? isActive(item.path) : false;
    const testId = item.path === '/dashboard' ? 'nav-dashboard' : item.path ? `nav-${item.path.slice(1)}` : `nav-${item.label.toLowerCase()}`;

    const content = (
      <div
        className={`sidebar-item ${active ? 'sidebar-item-active' : ''}`}
        style={{
          height: 46,
          padding: '0 20px 0 28px',
          margin: '2px 12px 2px 12px',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: active ? '#000' : 'transparent',
          border: '1px solid transparent',
          cursor: 'pointer',
        }}
        onTouchStart={(e) => { try { navigator.vibrate?.(6); } catch {} touchHL.onTouchStart(e); }}
        onTouchMove={(e) => touchHL.onTouchMove(e)}
        onTouchEnd={() => touchHL.onTouchEnd()}
        onTouchCancel={() => touchHL.onTouchCancel()}
        data-testid={testId}
      >
        <Icon size={20} color="#ECECEC" strokeWidth={1.5} />
        <span style={{ fontSize: 16.5, fontWeight: 400, color: '#ECECEC' }}>{item.label}</span>
      </div>
    );

    if (item.path) {
      return (
        <Link key={item.label} href={item.path} onClick={onClose} style={{ textDecoration: 'none' }}>
          {content}
        </Link>
      );
    }
    return <div key={item.label} onClick={() => toast({ title: '即将推出' })}>{content}</div>;
  };

  const renderConvoItem = (convo: any) => {
    const selected = String(convo.id) === activeConvId;
    return (
      <Link key={convo.id} href={`/agent?conv=${convo.id}`} onClick={onClose} style={{ textDecoration: 'none' }}>
        <div
          className={`sidebar-item ${selected ? 'sidebar-item-active' : ''}`}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            pressTimerRef.current = window.setTimeout(() => {
              if (navigator.vibrate) navigator.vibrate(10);
              setContextMenu({ convoId: String(convo.id), x: touch.clientX, y: touch.clientY });
            }, 500);
            try { navigator.vibrate?.(6); } catch {}
            touchHL.onTouchStart(e);
          }}
          onTouchEnd={() => { clearTimeout(pressTimerRef.current); touchHL.onTouchEnd(); }}
          onTouchMove={(e) => { clearTimeout(pressTimerRef.current); touchHL.onTouchMove(e); }}
          onTouchCancel={() => { clearTimeout(pressTimerRef.current); touchHL.onTouchCancel(); }}
          style={{
            padding: convo.projectName ? '10px 16px' : '12px 16px',
            margin: '0 8px 2px 12px',
            borderRadius: 12,
            background: selected ? '#000' : 'transparent',
            border: '1px solid transparent',
            cursor: 'pointer',
          }}
          data-testid={`convo-${convo.id}`}
        >
          <div style={{
            fontSize: 15.5,
            fontWeight: 400,
            color: '#ECECEC',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            {streamingConvIds.includes(convo.id) && (
              <span className="inline-block w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: '#D4A574' }} data-testid={`streaming-indicator-${convo.id}`} />
            )}
            <span className="overflow-hidden text-ellipsis">{convo.title}</span>
          </div>
          {convo.projectName && (
            <div style={{
              fontSize: 12,
              color: '#9A9893',
              marginTop: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <FolderClosed size={11} />
              {convo.projectName}
            </div>
          )}
        </div>
      </Link>
    );
  };

  const renderGroupHeader = (
    label: string,
    icon: typeof Bot,
    isExpanded: boolean,
    onToggle: () => void,
    testId: string,
  ) => {
    const GroupIcon = icon;
    return (
      <button
        {...tapMotionProps}
        onClick={onToggle}
        style={{
          width: '100%',
          height: 48,
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#ECECEC',
        }}
        data-testid={testId}
      >
        <div style={{
          transition: 'transform 200ms ease',
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          display: 'flex',
          alignItems: 'center',
        }}>
          <ChevronRight size={16} color="#9A9893" />
        </div>
        <GroupIcon size={20} color="#ECECEC" />
        <span style={{ fontSize: 16, fontWeight: 600, color: '#ECECEC' }}>{label}</span>
      </button>
    );
  };

  return (
    <>
      <div
        ref={overlayRef}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 45,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 300ms',
          touchAction: 'none',
        }}
        className="md:hidden"
        onClick={onClose}
        data-testid="sidebar-overlay"
      />

      <aside
        ref={sidebarRef}
        style={{
          width: '82vw',
          maxWidth: 340,
          background: 'var(--bg-sidebar)',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 50,
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
        className="md:!translate-x-0 md:!relative md:!z-auto md:!w-[260px] md:!max-w-[260px]"
        data-testid="sidebar"
      >
        <div style={{ padding: '0 20px 20px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AgentLogo size={24} animate={false} glow={false} />
          <h1
            style={{
              fontFamily: "Georgia, 'Noto Serif SC', serif",
              fontSize: 28,
              fontWeight: 700,
              color: '#ECECEC',
              margin: 0,
            }}
            data-testid="text-sidebar-title"
          >
            Buddy
          </h1>
        </div>

        <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', position: 'relative' } as any}>
          {renderGroupHeader('企业管理', Building2, enterpriseOpen, () => setEnterpriseOpen(v => !v), 'button-toggle-enterprise')}
          <CollapsibleContent isOpen={enterpriseOpen}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '2px 4px',
              padding: '2px 12px 6px 12px',
            }}>
              {ENTERPRISE_NAV.map((item) => {
                const Icon = item.icon;
                const active = item.path ? isActive(item.path) : false;
                const testId = item.path ? `nav-${item.path.slice(1)}` : `nav-${item.label.toLowerCase()}`;
                const inner = (
                  <div
                    className={`sidebar-item sidebar-item-grid ${active ? 'sidebar-item-active' : ''}`}
                    style={{
                      height: 36,
                      padding: '0 12px',
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: active ? '#000' : 'transparent',
                      border: '1px solid transparent',
                      cursor: 'pointer',
                    }}
                    onTouchStart={(e) => { try { navigator.vibrate?.(6); } catch {} touchHL.onTouchStart(e); }}
                    onTouchMove={(e) => touchHL.onTouchMove(e)}
                    onTouchEnd={() => touchHL.onTouchEnd()}
                    onTouchCancel={() => touchHL.onTouchCancel()}
                    data-testid={testId}
                  >
                    <Icon size={16} color="#ECECEC" strokeWidth={1.5} />
                    <span style={{ fontSize: 14, fontWeight: 400, color: '#ECECEC' }}>{item.label}</span>
                  </div>
                );
                return item.path ? (
                  <Link key={item.label} href={item.path} onClick={onClose} style={{ textDecoration: 'none' }}>
                    {inner}
                  </Link>
                ) : (
                  <div key={item.label} onClick={() => toast({ title: '即将推出' })}>{inner}</div>
                );
              })}
              {['owner', 'admin'].includes(authUser?.role || '') && (
                <Link href="/knowledge-base" onClick={onClose} style={{ textDecoration: 'none' }}>
                  <div
                    className={`sidebar-item sidebar-item-grid ${isActive('/knowledge-base') ? 'sidebar-item-active' : ''}`}
                    style={{
                      height: 36,
                      padding: '0 12px',
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: isActive('/knowledge-base') ? '#000' : 'transparent',
                      border: '1px solid transparent',
                      cursor: 'pointer',
                    }}
                    data-testid="nav-knowledge-base"
                  >
                    <BookOpen size={16} color="#ECECEC" strokeWidth={1.5} />
                    <span style={{ fontSize: 14, fontWeight: 400, color: '#ECECEC' }}>知识库</span>
                  </div>
                </Link>
              )}
            </div>
          </CollapsibleContent>

          <div style={{ height: 8 }} />

          {renderGroupHeader('Buddy AI', Bot, buddyAiOpen, () => setBuddyAiOpen(v => !v), 'button-toggle-buddy-ai')}
          <CollapsibleContent isOpen={buddyAiOpen}>
            <div>
              {BUDDY_AI_NAV.map(renderNavItem)}

              {conversations.length > 0 && (
                <div style={{ padding: '12px 16px 6px 16px' }}>
                  <div style={{
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 10,
                    padding: '0 12px',
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <Search size={16} color="#7A7874" />
                    <input
                      value={convSearchQuery}
                      onChange={e => setConvSearchQuery(e.target.value)}
                      placeholder="搜索对话..."
                      style={{
                        flex: 1, border: 'none', outline: 'none',
                        background: 'transparent', fontSize: 14,
                        color: '#ECECEC',
                      }}
                      data-testid="input-search-conversations"
                    />
                    {convSearchQuery && (
                      <button
                        onClick={() => setConvSearchQuery('')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
                        data-testid="button-clear-search"
                      >
                        <X size={14} color="#7A7874" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {(() => {
                const q = convSearchQuery.toLowerCase().trim();
                const filteredStarred = q ? starredConvs.filter((c: any) => (c.title || '').toLowerCase().includes(q) || (c.projectName || '').toLowerCase().includes(q)) : starredConvs;
                const filteredRecent = q ? recentConvs.filter((c: any) => (c.title || '').toLowerCase().includes(q) || (c.projectName || '').toLowerCase().includes(q)) : recentConvs;

                if (conversations.length === 0) {
                  return (
                    <div style={{ padding: '32px 28px', textAlign: 'center' }}>
                      <p style={{ fontSize: 14, color: '#9A9893', lineHeight: 1.5 }}>还没有对话</p>
                      <p style={{ fontSize: 13, color: '#7A7874', marginTop: 4 }}>点击下方 + 开始新对话</p>
                    </div>
                  );
                }

                if (q && filteredStarred.length === 0 && filteredRecent.length === 0) {
                  return (
                    <div style={{ padding: '24px 28px', textAlign: 'center' }}>
                      <p style={{ fontSize: 14, color: '#9A9893' }}>没有找到匹配的对话</p>
                    </div>
                  );
                }

                return (
                  <>
                    {filteredStarred.length > 0 && (
                      <>
                        <div style={{ padding: '20px 20px 8px 28px', fontSize: 14.5, fontWeight: 500, color: '#C4703F' }} data-testid="text-starred-label">
                          收藏
                        </div>
                        {filteredStarred.map(renderConvoItem)}
                      </>
                    )}
                    {filteredRecent.length > 0 && (
                      <>
                        <div style={{ padding: '20px 20px 8px 28px', fontSize: 14.5, fontWeight: 500, color: '#C4703F' }} data-testid="text-recents-label">
                          最近对话
                        </div>
                        {filteredRecent.slice(0, 10).map(renderConvoItem)}
                      </>
                    )}
                    {!q && (starredConvs.length + recentConvs.length) > 0 && (
                      <div style={{ padding: '16px 28px 8px' }}>
                        <Link
                          href="/chats"
                          onClick={() => {
                            if (window.innerWidth < 768) {
                              setSidebarOpen(false);
                            }
                          }}
                          style={{ fontSize: 13, color: '#7A7874', cursor: 'pointer', textDecoration: 'none' }}
                          data-testid="link-view-all-chats"
                        >
                          查看所有对话 →
                        </Link>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </CollapsibleContent>

          <div style={{ height: 'calc(76px + env(safe-area-inset-bottom, 0px))' }} />

          <div
            style={{
              position: 'sticky',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '12px 16px',
              paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              background: 'transparent',
              pointerEvents: 'none',
            }}
          >
            <div
              {...elasticDeformProps}
              style={{
                display: 'flex', alignItems: 'center', cursor: 'pointer',
                padding: '5px 16px 5px 5px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.10)',
                transition: 'background 150ms ease',
                pointerEvents: 'auto',
              }}
              onClick={() => setSettingsOpen(true)}
              data-testid="button-open-settings"
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#FFFFFF',
                  flexShrink: 0,
                }}
                data-testid="img-avatar"
              >
                {authUser?.displayName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span style={{ fontSize: 15, fontWeight: 500, color: '#ECECEC', marginLeft: 10 }} data-testid="text-username">{authUser?.displayName || '用户'}</span>
            </div>

            <button
              {...tapMotionProps}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#AE5630',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'transform 150ms ease, opacity 150ms ease',
                pointerEvents: 'auto',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              onClick={() => {
                onClose();
                navigate('/agent');
              }}
              data-testid="button-new-chat"
            >
              <MessageSquarePlus size={20} color="#FFFFFF" strokeWidth={2} />
            </button>
          </div>
        </div>
      </aside>

      <SettingsPage
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenOrgSwitcher={() => { setSettingsOpen(false); setOrgSwitcherOpen(true); }}
        onCloseSidebar={onClose}
      />

      {orgSwitcherOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 55 }}
            onClick={() => setOrgSwitcherOpen(false)}
            data-testid="org-switcher-overlay"
          />
          <div
            style={{
              position: 'fixed',
              bottom: 0, left: 0, right: 0,
              zIndex: 60,
              background: 'var(--bg-sidebar)',
              borderRadius: '16px 16px 0 0',
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
              animation: 'settingsSlideUp 300ms cubic-bezier(0.165, 0.85, 0.45, 1) forwards',
            }}
            data-testid="org-switcher-sheet"
          >
            <div style={{ padding: '18px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: '#ECECEC' }}>切换组织</span>
              <button onClick={() => setOrgSwitcherOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} data-testid="button-close-org-switcher">
                <X size={20} color="#9A9893" />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px', paddingBottom: 'env(safe-area-inset-bottom)' }}>
              {userOrgs.map((org: any) => (
                <button
                  key={org.orgId}
                  {...tapMotionProps}
                  onClick={async () => {
                    if (org.orgId === authUser?.orgId) {
                      setOrgSwitcherOpen(false);
                      return;
                    }
                    try {
                      await authSwitchOrg(org.orgId);
                      setOrgSwitcherOpen(false);
                      toast({ title: `已切换到「${org.orgName}」` });
                      navigate('/agent');
                    } catch (e: any) {
                      toast({ title: '切换失败', description: e.message, variant: 'destructive' });
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 14px',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: org.orgId === authUser?.orgId ? 'rgba(174, 86, 48, 0.12)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left' as const,
                  }}
                  data-testid={`org-option-${org.orgId}`}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: org.orgType === 'enterprise' ? 'rgba(255,255,255,0.1)' : 'rgba(174,86,48,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Building2 size={18} color={org.orgType === 'enterprise' ? '#ECECEC' : '#C4703F'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, color: '#ECECEC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {org.orgName}
                    </div>
                    <div style={{ fontSize: 12, color: '#9A9893', marginTop: 2 }}>
                      {org.orgType === 'enterprise' ? '企业' : '项目'} · {org.role === 'owner' ? '所有者' : org.role === 'admin' ? '管理员' : org.role === 'head' ? '主管' : '成员'}
                    </div>
                  </div>
                  {org.orgId === authUser?.orgId && (
                    <Check size={16} color="#AE5630" />
                  )}
                </button>
              ))}

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '8px 6px' }} />
              
              <button
                {...tapMotionProps}
                onClick={() => { setOrgSwitcherOpen(false); setJoinOrgOpen(true); }}
                style={{
                  width: '100%',
                  padding: '14px 14px',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                data-testid="button-join-org"
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Plus size={18} color="#9A9893" />
                </div>
                <span style={{ fontSize: 15, color: '#9A9893' }}>加入组织</span>
              </button>
            </div>
          </div>
        </>
      )}

      {joinOrgOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 55 }}
            onClick={() => { setJoinOrgOpen(false); setInviteCode(''); setJoinError(''); }}
            data-testid="join-org-overlay"
          />
          <div
            style={{
              position: 'fixed',
              bottom: 0, left: 0, right: 0,
              zIndex: 60,
              background: 'var(--bg-sidebar)',
              borderRadius: '16px 16px 0 0',
              padding: '24px 20px',
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
              animation: 'settingsSlideUp 300ms cubic-bezier(0.165, 0.85, 0.45, 1) forwards',
            }}
            data-testid="join-org-sheet"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: '#ECECEC' }}>加入组织</span>
              <button onClick={() => { setJoinOrgOpen(false); setInviteCode(''); setJoinError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} data-testid="button-close-join-org">
                <X size={20} color="#9A9893" />
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: '#9A9893', marginBottom: 8 }}>输入邀请码</div>
              <input
                value={inviteCode}
                onChange={e => { setInviteCode(e.target.value); setJoinError(''); }}
                placeholder="请输入邀请码..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(44,43,40,0.5)',
                  color: '#ECECEC',
                  fontSize: 15,
                  outline: 'none',
                }}
                data-testid="input-invite-code"
              />
            </div>

            {joinError && (
              <div style={{ fontSize: 13, color: '#E5534B', marginBottom: 12 }} data-testid="text-join-error">
                {joinError}
              </div>
            )}

            <button
              {...tapMotionProps}
              disabled={!inviteCode.trim() || joinLoading}
              onClick={async () => {
                if (!inviteCode.trim()) return;
                setJoinLoading(true);
                setJoinError('');
                try {
                  const token = localStorage.getItem('buddy_token');
                  const res = await fetch(`/api/invitations/accept/${inviteCode.trim()}`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  
                  if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to join');
                  }
                  
                  const data = await res.json();
                  const newToken = data.data.token;
                  const u = data.data.user;
                  localStorage.setItem('buddy_token', newToken);
                  localStorage.setItem('buddy_user', JSON.stringify(u));
                  setJoinOrgOpen(false);
                  setInviteCode('');
                  toast({ title: `已加入「${u.orgName || '组织'}」` });
                  refetchOrgs();
                  window.location.reload();
                } catch (e: any) {
                  setJoinError(e.message === 'You are already a member of this organization' ? '你已经是该组织的成员' : e.message === 'Invalid or expired invitation' ? '邀请码无效或已过期' : e.message === 'Invitation has expired' ? '邀请已过期' : e.message === 'Invitation has reached maximum uses' ? '邀请已达到使用上限' : '加入失败，请检查邀请码');
                } finally {
                  setJoinLoading(false);
                }
              }}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 12,
                background: inviteCode.trim() ? 'linear-gradient(145deg, rgba(174,86,48,0.85) 0%, rgba(174,86,48,0.65) 100%)' : 'rgba(255,255,255,0.06)',
                border: 'none',
                color: inviteCode.trim() ? '#FFFFFF' : '#9A9893',
                fontSize: 16,
                fontWeight: 600,
                cursor: inviteCode.trim() ? 'pointer' : 'default',
                opacity: joinLoading ? 0.6 : 1,
              }}
              data-testid="button-submit-join"
            >
              {joinLoading ? '加入中...' : '加入组织'}
            </button>
          </div>
        </>
      )}

      {contextMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.2)',
              zIndex: 65,
            }}
            onClick={() => setContextMenu(null)}
            data-testid="context-menu-overlay"
          />
          <div
            style={{
              position: 'fixed',
              left: Math.min(contextMenu.x, window.innerWidth - 220),
              top: Math.min(contextMenu.y, window.innerHeight - 200),
              zIndex: 70,
              background: 'rgba(45,44,40,0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 14,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
              padding: '6px 0',
              minWidth: 200,
              animation: 'contextMenuIn 200ms ease-out forwards',
            }}
            data-testid="context-menu"
          >
            <style>{`
              @keyframes contextMenuIn {
                from { transform: scale(0.95); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
              }
            `}</style>
            {(() => {
              const convo = conversations.find((c: any) => String(c.id) === contextMenu.convoId);
              const isStarred = convo?.starred || false;
              return (
                <>
                  <div
                    style={{
                      height: 44,
                      padding: '0 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      transition: 'background 150ms',
                      borderRadius: 0,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => {
                      if (!contextMenu) return;
                      setProjectPicker(contextMenu.convoId);
                      setContextMenu(null);
                    }}
                    data-testid="context-menu-move-project"
                  >
                    <FolderInput size={18} color="#ECECEC" />
                    <span style={{ fontSize: 15, fontWeight: 400, color: '#ECECEC' }}>移到项目</span>
                  </div>
                  {(() => {
                    const conv = conversations.find((c: any) => String(c.id) === contextMenu.convoId);
                    return conv?.projectId ? (
                      <button
                        {...tapMotionProps}
                        onClick={() => {
                          toast({ title: '可见范围设置即将推出' });
                          setContextMenu(null);
                        }}
                        style={{
                          width: '100%', height: 44,
                          padding: '0 16px',
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: 'none', border: 'none', cursor: 'pointer',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        data-testid="context-menu-visibility"
                      >
                        <Eye size={18} color="#ECECEC" />
                        <span style={{ fontSize: 15, color: '#ECECEC' }}>可见范围</span>
                      </button>
                    ) : null;
                  })()}
                  <div
                    style={{
                      height: 44,
                      padding: '0 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      transition: 'background 150ms',
                      borderRadius: 0,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={async () => {
                      if (!contextMenu) return;
                      const conv = conversations.find((c: any) => String(c.id) === contextMenu.convoId);
                      if (!conv) return;
                      try {
                        await apiRequest("PATCH", `/api/conversations/${contextMenu.convoId}`, { starred: !conv.starred });
                        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
                      } catch {}
                      setContextMenu(null);
                    }}
                    data-testid="context-menu-star"
                  >
                    {isStarred ? <StarOff size={18} color="#ECECEC" /> : <Star size={18} color="#ECECEC" />}
                    <span style={{ fontSize: 15, fontWeight: 400, color: '#ECECEC' }}>{isStarred ? '取消收藏' : '收藏'}</span>
                  </div>
                  <div
                    style={{
                      height: 44,
                      padding: '0 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      transition: 'background 150ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => {
                      if (!contextMenu) return;
                      const conv = conversations.find((c: any) => String(c.id) === contextMenu.convoId);
                      if (!conv) return;
                      setRenameValue(conv.title);
                      setRenameModal({ convId: contextMenu.convoId, title: conv.title });
                      setContextMenu(null);
                    }}
                    data-testid="context-menu-rename"
                  >
                    <Pencil size={18} color="#ECECEC" />
                    <span style={{ fontSize: 15, fontWeight: 400, color: '#ECECEC' }}>重命名</span>
                  </div>
                  <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                  <div
                    style={{
                      height: 44,
                      padding: '0 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      transition: 'background 150ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => {
                      if (!contextMenu) return;
                      setDeleteConfirm(contextMenu.convoId);
                      setContextMenu(null);
                    }}
                    data-testid="context-menu-delete"
                  >
                    <Trash2 size={18} color="#E5534B" />
                    <span style={{ fontSize: 15, fontWeight: 400, color: '#E5534B' }}>删除</span>
                  </div>
                </>
              );
            })()}
          </div>
        </>
      )}

      {renameModal && (
        <>
          <div onClick={() => setRenameModal(null)} style={{
            position: 'fixed', inset: 0, zIndex: 75,
            background: 'rgba(0,0,0,0.5)',
          }} />
          <style>{`@keyframes slideUpIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
          <div style={{
            position: 'fixed',
            bottom: 0, left: 0, right: 0,
            zIndex: 80,
            background: 'rgba(45,44,40,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '16px 16px 0 0',
            padding: '24px 20px',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
            width: '100%',
            maxWidth: 480,
            margin: '0 auto',
            animation: 'slideUpIn 250ms ease-out forwards',
          }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#ECECEC', marginBottom: 16 }}>
              重命名对话
            </div>
            <input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#2B2A27',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                fontSize: 15,
                color: '#ECECEC',
                outline: 'none',
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && renameValue.trim()) {
                  try {
                    await apiRequest("PATCH", `/api/conversations/${renameModal.convId}`, { title: renameValue.trim() });
                    queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
                  } catch {}
                  setRenameModal(null);
                }
              }}
              data-testid="input-rename"
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                {...tapMotionProps}
                onClick={() => setRenameModal(null)}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none', color: '#ECECEC', fontSize: 14,
                  cursor: 'pointer',
                }}
                data-testid="button-cancel-rename"
              >取消</button>
              <button
                {...tapMotionProps}
                onClick={async () => {
                  if (renameValue.trim()) {
                    try {
                      await apiRequest("PATCH", `/api/conversations/${renameModal.convId}`, { title: renameValue.trim() });
                      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
                    } catch {}
                  }
                  setRenameModal(null);
                }}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: '#AE5630',
                  border: 'none', color: '#FFFFFF', fontSize: 14,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
                data-testid="button-confirm-rename"
              >确认</button>
            </div>
          </div>
        </>
      )}

      {deleteConfirm && (
        <>
          <div onClick={() => setDeleteConfirm(null)} style={{
            position: 'fixed', inset: 0, zIndex: 75,
            background: 'rgba(0,0,0,0.5)',
          }} />
          <style>{`@keyframes slideUpIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
          <div style={{
            position: 'fixed',
            bottom: 0, left: 0, right: 0,
            zIndex: 80,
            background: 'rgba(45,44,40,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '16px 16px 0 0',
            padding: '24px 20px',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
            width: '100%',
            maxWidth: 480,
            margin: '0 auto',
            textAlign: 'center' as const,
            animation: 'slideUpIn 250ms ease-out forwards',
          }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#ECECEC', marginBottom: 8 }}>
              确定删除？
            </div>
            <div style={{ fontSize: 14, color: '#9A9893', marginBottom: 20, lineHeight: 1.5 }}>
              此操作无法撤销
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                {...tapMotionProps}
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '8px 24px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none', color: '#ECECEC', fontSize: 14,
                  cursor: 'pointer',
                }}
                data-testid="button-cancel-delete"
              >取消</button>
              <button
                {...tapMotionProps}
                onClick={async () => {
                  try {
                    await apiRequest("DELETE", `/api/conversations/${deleteConfirm}`);
                    queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
                    if (activeConvId === deleteConfirm) {
                      window.location.href = '/agent';
                    }
                  } catch {}
                  setDeleteConfirm(null);
                }}
                style={{
                  padding: '8px 24px', borderRadius: 8,
                  background: '#E5534B',
                  border: 'none', color: '#FFFFFF', fontSize: 14,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
                data-testid="button-confirm-delete"
              >删除</button>
            </div>
          </div>
        </>
      )}

      {projectPicker && (
        <>
          <div onClick={() => setProjectPicker(null)} style={{
            position: 'fixed', inset: 0, zIndex: 75,
            background: 'rgba(0,0,0,0.5)',
          }} />
          <ProjectPickerSheet
            convId={projectPicker}
            conversations={conversations}
            onClose={() => setProjectPicker(null)}
            toast={toast}
          />
        </>
      )}
    </>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!loading && user && !user.onboardingCompleted && !user.orgId && location !== '/onboarding') {
      navigate('/onboarding');
    }
  }, [loading, user, location, navigate]);

  if (loading) {
    return (
      <div style={{
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40,
            border: '3px solid rgba(174,86,48,0.3)',
            borderTopColor: '#AE5630',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route>
        <AuthGuard>
          <Switch>
            <Route path="/admin" component={AdminOverview} />
            <Route path="/admin/ai" component={AdminAI} />
            <Route path="/admin/users" component={AdminUsers} />
            <Route path="/admin/orgs" component={AdminOrgs} />
            <Route path="/admin/kb" component={AdminKB} />
            <Route path="/admin/security" component={AdminSecurity} />
            <Route path="/admin/workforce" component={AdminWorkforce} />
            <Route path="/onboarding" component={OnboardingPage} />
            <Route path="/"><Redirect to="/agent" /></Route>
            <Route path="/chats" component={ChatsPage} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/graph" component={GraphView} />
            <Route path="/agent" component={Agent} />
            <Route path="/projects" component={ProjectList} />
            <Route path="/projects/:id" component={ProjectDetail} />
            <Route path="/tasks" component={TaskList} />
            <Route path="/tasks/:id" component={TaskDetail} />
            <Route path="/team" component={Team} />
            <Route path="/knowledge-base" component={KnowledgeBase} />
            <Route path="/settings" component={Settings} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/artifacts" component={Artifacts} />
            <Route component={NotFound} />
          </Switch>
        </AuthGuard>
      </Route>
    </Switch>
  );
}

const PRIMARY_MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', desc: 'Most efficient for everyday tasks' },
  { id: 'claude-opus-4-6', label: 'Opus 4.6', desc: 'Deep mode · Higher token cost' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', desc: 'Fastest for quick answers' },
];

const MORE_MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o', desc: 'OpenAI flagship model' },
  { id: 'deepseek-chat', label: 'DeepSeek V3', desc: 'Cost-effective alternative' },
];

const ALL_MODELS = [...PRIMARY_MODELS, ...MORE_MODELS];

function ModelSelector() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(() => {
    try { return localStorage.getItem('buddy_model') || ALL_MODELS[0].id; } catch { return ALL_MODELS[0].id; }
  });
  const [extThinking, setExtThinking] = useState(() => {
    try { return localStorage.getItem('buddy_extended_thinking') === 'true'; } catch { return false; }
  });
  const [moreOpen, setMoreOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler as any);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler as any);
    };
  }, [open]);

  const current = ALL_MODELS.find(m => m.id === selected) || ALL_MODELS[0];

  const selectModel = (m: typeof ALL_MODELS[0]) => {
    setSelected(m.id);
    try { localStorage.setItem('buddy_model', m.id); } catch {}
    window.dispatchEvent(new CustomEvent('model-changed', { detail: m.id }));
    setOpen(false);
  };

  const toggleExtThinking = () => {
    const next = !extThinking;
    setExtThinking(next);
    try { localStorage.setItem('buddy_extended_thinking', String(next)); } catch {}
    window.dispatchEvent(new CustomEvent('extended-thinking-changed', { detail: next }));
  };

  const renderModelRow = (m: typeof ALL_MODELS[0]) => (
    <button
      key={m.id}
      {...tapMotionProps}
      onClick={() => selectModel(m)}
      style={{
        width: '100%',
        padding: '12px 14px',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 150ms',
        textAlign: 'left' as const,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      data-testid={`model-option-${m.id}`}
    >
      <div>
        <div style={{ fontSize: 15, color: m.id === selected ? '#C4703F' : '#ECECEC' }}>{m.label}</div>
        <div style={{ fontSize: 12, color: '#7A7874', marginTop: 2 }}>{m.desc}</div>
      </div>
      {m.id === selected && <Check size={16} color="#AE5630" style={{ flexShrink: 0 }} />}
    </button>
  );

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      <button
        {...tapMotionProps}
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 10,
          background: open ? 'rgba(255,255,255,0.08)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'background 150ms',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent'; }}
        data-testid="model-selector-trigger"
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.2,
          }}>{current.label}</span>
          {extThinking && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.2 }}>Extended</span>
          )}
        </div>
        <ChevronRight
          size={14}
          color="var(--text-secondary)"
          style={{
            transform: open ? 'rotate(270deg)' : 'rotate(90deg)',
            transition: 'transform 200ms',
          }}
        />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: 8,
          background: 'rgba(26, 25, 24, 0.95)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.10)',
          padding: 6,
          minWidth: 260,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 50,
          animation: 'fadeIn 150ms ease-out',
        }} data-testid="model-selector-dropdown">
          {PRIMARY_MODELS.map(renderModelRow)}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 8px' }} />

          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'background 150ms',
            }}
            onClick={toggleExtThinking}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            data-testid="toggle-extended-thinking"
          >
            <div>
              <div style={{ fontSize: 15, color: '#ECECEC' }}>Extended thinking</div>
              <div style={{ fontSize: 12, color: '#7A7874', marginTop: 2 }}>Think longer for complex tasks</div>
            </div>
            <div style={{
              width: 40,
              height: 22,
              borderRadius: 11,
              background: extThinking ? '#AE5630' : 'rgba(255,255,255,0.15)',
              position: 'relative',
              transition: 'background 200ms',
              flexShrink: 0,
              marginLeft: 12,
            }}>
              <div style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: 2,
                left: extThinking ? 20 : 2,
                transition: 'left 200ms',
              }} />
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 8px' }} />

          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              transition: 'background 150ms',
            }}
            onClick={() => setMoreOpen(v => !v)}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            data-testid="btn-more-models"
          >
            <ChevronRight
              size={16}
              color="#ECECEC"
              style={{
                transform: moreOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 200ms',
              }}
            />
            <span style={{ fontSize: 15, color: '#ECECEC' }}>More models</span>
          </div>

          {moreOpen && MORE_MODELS.map(renderModelRow)}
        </div>
      )}
    </div>
  );
}

function OrgThemeSync() {
  const { user } = useAuth();
  const { setOrgType } = useTheme();

  useEffect(() => {
    if (user?.orgType) {
      setOrgType(user.orgType);
    }
  }, [user?.orgType, setOrgType]);

  return null;
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();
  const isAgentPage = location === '/agent' || location.startsWith('/agent?');
  const isChatsPage = location === '/chats';
  const isGraphPage = location === '/graph' || location.startsWith('/graph?');
  const isLoginPage = location === '/login' || location.startsWith('/login?');
  const isOnboardingPage = location === '/onboarding';
  const isAdminPage = location === '/admin' || location.startsWith('/admin/');

  const getPageTitle = () => {
    if (isChatsPage) return 'Chats';
    if (location === '/dashboard') return '仪表盘';
    if (location === '/projects') return '项目';
    if (location.startsWith('/projects/')) return '项目详情';
    if (location === '/tasks') return '任务';
    if (location.startsWith('/tasks/')) return '任务详情';
    if (location === '/team') return '团队';
    if (location === '/settings') return '设置';
    if (location === '/notifications') return '通知';
    if (location === '/artifacts') return '成果';
    return 'Buddy';
  };
  
  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    currentX: 0,
    type: '' as '' | 'open' | 'close',
    directionLocked: '' as '' | 'horizontal' | 'vertical',
  });
  
  const sidebarWidth = 340;

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const drag = dragRef.current;
      drag.directionLocked = '';
      
      if (!sidebarOpen && touch.clientX < 25) {
        drag.isDragging = true;
        drag.startX = touch.clientX;
        drag.startY = touch.clientY;
        drag.startTime = Date.now();
        drag.currentX = touch.clientX;
        drag.type = 'open';
        drag.directionLocked = 'horizontal';
      }
      
      if (sidebarOpen && sidebarRef.current) {
        const rect = sidebarRef.current.getBoundingClientRect();
        if (touch.clientX < rect.right + 30) {
          drag.isDragging = true;
          drag.startX = touch.clientX;
          drag.startY = touch.clientY;
          drag.startTime = Date.now();
          drag.currentX = touch.clientX;
          drag.type = 'close';
          drag.directionLocked = '';
        }
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag.isDragging) return;
      
      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      
      if (drag.type === 'close' && drag.directionLocked === '') {
        const dx = Math.abs(touchX - drag.startX);
        const dy = Math.abs(touchY - drag.startY);
        const threshold = 8;
        if (dx < threshold && dy < threshold) return;
        if (dy > dx) {
          drag.directionLocked = 'vertical';
          drag.isDragging = false;
          return;
        }
        drag.directionLocked = 'horizontal';
      }
      
      if (drag.directionLocked === 'vertical') {
        drag.isDragging = false;
        return;
      }
      
      drag.currentX = touchX;
      const deltaX = drag.currentX - drag.startX;
      
      const sidebar = sidebarRef.current;
      const overlay = overlayRef.current;
      if (!sidebar || !overlay) return;
      
      sidebar.style.transition = 'none';
      overlay.style.transition = 'none';
      const content = contentRef.current;
      if (content) content.style.transition = 'none';
      if (drag.type === 'open' && deltaX > 0) {
        const actualWidth = Math.min(sidebar.offsetWidth, sidebarWidth);
        const progress = Math.min(deltaX / actualWidth, 1);
        sidebar.style.transform = `translateX(${-actualWidth + deltaX}px)`;
        if (content) content.style.transform = `translateX(${Math.min(deltaX, actualWidth)}px)`;
        overlay.style.opacity = String(progress * 0.4);
        overlay.style.pointerEvents = 'auto';
        overlay.style.display = 'block';
      }
      
      if (drag.type === 'close' && deltaX < 0) {
        const actualWidth = Math.min(sidebar.offsetWidth, sidebarWidth);
        sidebar.style.transform = `translateX(${deltaX}px)`;
        if (content) content.style.transform = `translateX(${Math.max(actualWidth + deltaX, 0)}px)`;
        const progress = 1 + deltaX / actualWidth;
        overlay.style.opacity = String(Math.max(0, progress * 0.4));
      }
    };
    
    const handleTouchEnd = () => {
      const drag = dragRef.current;
      if (!drag.isDragging) return;
      drag.isDragging = false;
      
      const sidebar = sidebarRef.current;
      const overlay = overlayRef.current;
      if (!sidebar || !overlay) return;
      
      const deltaX = drag.currentX - drag.startX;
      const elapsed = Date.now() - drag.startTime;
      const velocity = Math.abs(deltaX) / elapsed;
      const actualWidth = Math.min(sidebar.offsetWidth, sidebarWidth);
      
      const content = contentRef.current;
      const ease = 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)';
      sidebar.style.transition = ease;
      overlay.style.transition = 'opacity 350ms ease';
      if (content) content.style.transition = ease;
      
      if (drag.type === 'open') {
        if (deltaX > actualWidth * 0.3 || velocity > 0.5) {
          sidebar.style.transform = 'translateX(0)';
          if (content) content.style.transform = `translateX(${actualWidth}px)`;
          overlay.style.opacity = '0.4';
          setSidebarOpen(true);
        } else {
          sidebar.style.transform = 'translateX(-100%)';
          if (content) content.style.transform = 'translateX(0)';
          overlay.style.opacity = '0';
          setTimeout(() => { overlay.style.pointerEvents = 'none'; }, 350);
          setSidebarOpen(false);
        }
      }
      
      if (drag.type === 'close') {
        if (deltaX < -actualWidth * 0.3 || velocity > 0.5) {
          sidebar.style.transform = 'translateX(-100%)';
          if (content) content.style.transform = 'translateX(0)';
          overlay.style.opacity = '0';
          setSidebarOpen(false);
        } else {
          sidebar.style.transform = 'translateX(0)';
          if (content) content.style.transform = `translateX(${actualWidth}px)`;
          overlay.style.opacity = '0.4';
        }
      }
    };
    
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const handleOpenSidebar = () => setSidebarOpen(true);
    const handleToggleSidebar = () => setSidebarOpen(prev => !prev);
    window.addEventListener('open-sidebar', handleOpenSidebar);
    window.addEventListener('toggle-sidebar', handleToggleSidebar);
    return () => {
      window.removeEventListener('open-sidebar', handleOpenSidebar);
      window.removeEventListener('toggle-sidebar', handleToggleSidebar);
    };
  }, []);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const isMobile = window.innerWidth < 768;
    if (!isMobile) {
      content.style.transform = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      const mainEl = content.querySelector('main');
      if (mainEl) {
        (mainEl as HTMLElement).style.overflow = '';
        (mainEl as HTMLElement).style.touchAction = '';
      }
      return;
    }
    const sidebar = sidebarRef.current;
    const w = sidebar ? Math.min(sidebar.offsetWidth, 340) : Math.min(window.innerWidth * 0.82, 340);
    content.style.transition = 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)';
    content.style.transform = sidebarOpen ? `translateX(${w}px)` : 'translateX(0)';

    const mainEl = content.querySelector('main');
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = '0';
      content.style.overflow = 'hidden';
      if (mainEl) {
        (mainEl as HTMLElement).style.overflow = 'hidden';
        (mainEl as HTMLElement).style.touchAction = 'none';
      }
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      content.style.overflow = '';
      if (mainEl) {
        (mainEl as HTMLElement).style.overflow = '';
        (mainEl as HTMLElement).style.touchAction = '';
      }
    }

    const preventScroll = (e: TouchEvent) => {
      if (sidebarOpen) {
        const target = e.target as HTMLElement;
        const sidebarEl = sidebarRef.current;
        if (sidebarEl && sidebarEl.contains(target)) {
          return;
        }
        if (target.closest('[data-testid="settings-page"]')) {
          return;
        }
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventScroll);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      content.style.overflow = '';
      if (mainEl) {
        (mainEl as HTMLElement).style.overflow = '';
        (mainEl as HTMLElement).style.touchAction = '';
      }
    };
  }, [sidebarOpen]);

  return (
    <AuthProvider>
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <OrgThemeSync />
      <div className="flex bg-[var(--bg-primary)]" style={{ height: '100dvh' }}>
        {!isLoginPage && !isOnboardingPage && !isAdminPage && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} sidebarRef={sidebarRef} overlayRef={overlayRef} />}

        <div ref={contentRef} className="flex-1 flex flex-col overflow-hidden relative md:!transform-none">
          {!isGraphPage && !isLoginPage && !isOnboardingPage && !isAdminPage && (
          <>
            <div className="md:hidden" style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 108,
              background: 'linear-gradient(to bottom, rgba(26,25,24,0.99) 0%, transparent 100%)',
              zIndex: 10,
              pointerEvents: 'none',
            }} />
              <div className="md:hidden" style={{
                position: 'absolute',
                top: 12, left: 16, right: 16,
                zIndex: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pointerEvents: 'auto',
              }} data-testid="top-controls">
                <button {...elasticDeformSmallProps} onClick={() => setSidebarOpen(!sidebarOpen)} style={{
                  width: 42, height: 42,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  transition: 'background 150ms',
                }} data-testid="menu-toggle"
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                >
                  <Menu size={20} strokeWidth={1.8} />
                </button>
                {isAgentPage ? (
                  <ModelSelector />
                ) : (
                  <span style={{
                    fontSize: 17, fontWeight: 600,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                  }} data-testid="top-bar-title">{getPageTitle()}</span>
                )}
                <div style={{ width: 42 }} />
              </div>
            </>
          )}

          <main
            className={`flex-1 overflow-auto relative ${isLoginPage || isOnboardingPage ? 'ml-0' : 'ml-0 md:ml-[260px]'} ${!isGraphPage && !isLoginPage && !isOnboardingPage && !isAgentPage ? 'pt-[60px] md:pt-0' : ''}`}
            data-testid="content-area"
          >
            <Router />
          </main>
        </div>
      </div>

      <Toaster />
    </QueryClientProvider>
    </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
```

## 8. SSE Stream Route (actual code)
```typescript
  app.post("/api/ai/chat/stream", authMiddleware, async (req: any, res) => {
    try {
      const { message, conversationHistory, conversationId, currentUserId, systemPrompt, model, extendedThinking, replyStyle, webSearchEnabled, codeContextEnabled, knowledgeBaseEnabled, attachments } = req.body;
      if ((!message || typeof message !== 'string') && (!attachments || attachments.length === 0)) {
        return res.status(400).json({ error: 'message is required' });
      }

      const orgId = req.orgId || 1;
      const userId = currentUserId || req.currentUserId || 1;
      const user = await storage.getUserById(userId);
      const userName = user?.displayName || 'Unknown';
      const msgText = message || '';

      let activeConvId = conversationId || null;
      let isNewConversation = false;

      if (!activeConvId) {
        isNewConversation = true;
        const tempTitle = (msgText || '附件消息').slice(0, 30) + ((msgText || '附件消息').length > 30 ? '...' : '');
        const newConv = await storage.createConversation({
          title: tempTitle,
          orgId,
          userId,
        });
        activeConvId = newConv.id;
      }

      let history = conversationHistory || [];
      if (activeConvId && history.length === 0) {
        const conv = await storage.getConversationById(activeConvId);
        if (conv && conv.orgId !== orgId) {
          return res.status(403).json({ error: 'Access denied to this conversation' });
        }
        const dbMessages = await storage.getChatMessages(activeConvId);
        history = dbMessages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: m.content }));
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      res.write(`data: ${JSON.stringify({ type: 'start', conversationId: activeConvId })}\n\n`);

      let fullText = '';
      let aborted = false;
      req.on('close', () => { aborted = true; });

      let effectiveSystemPrompt = systemPrompt || '';
      if (replyStyle && replyStyle !== 'normal') {
        const styleMap: Record<string, string> = {
          concise: '请用简短直接的方式回答，避免冗长的解释。',
          detailed: '请提供深入全面的解释，包含更多细节和背景信息。',
          professional: '请用正式的商务语气回复，保持专业和严谨。',
          casual: '请用轻松友好的语气对话，像朋友之间聊天一样。',
        };
        effectiveSystemPrompt = (effectiveSystemPrompt ? effectiveSystemPrompt + '\n' : '') + (styleMap[replyStyle] || '');
      }

      if (webSearchEnabled) {
        try {
          const searchResults = await searchWeb(msgText);
          if (searchResults.results.length > 0 || searchResults.answer) {
            let searchContext = `\n\n## 网页搜索结果\n用户开启了网页搜索，以下是与用户问题相关的网页搜索结果，请参考这些信息回答：\n`;
            if (searchResults.answer) {
              searchContext += `\n搜索摘要: ${searchResults.answer}\n`;
            }
            if (searchResults.results.length > 0) {
              searchContext += `\n来源:\n`;
              searchResults.results.forEach((r, i) => {
                searchContext += `${i + 1}. ${r.title} - ${r.url}\n   ${r.content}\n`;
              });
            }
            searchContext += `\n请在回答中适当引用这些来源，并注明信息来自网络搜索。`;
            effectiveSystemPrompt = (effectiveSystemPrompt || '') + searchContext;

            if (searchResults.results.length > 0) {
              res.write(`data: ${JSON.stringify({ type: 'search_results', results: searchResults.results })}\n\n`);
            }
          }
        } catch (searchErr) {
          console.error('Web search failed:', searchErr);
        }
      }

      if (codeContextEnabled) {
        try {
          const { buildCodeContextBlock } = await import('./services/ai/codeContext');
          const { contextBlock, loadedFiles, failedFiles } = buildCodeContextBlock(msgText, true);
          effectiveSystemPrompt = (effectiveSystemPrompt || '') + '\n\n' + contextBlock;
          if (loadedFiles.length > 0 || failedFiles.length > 0) {
            res.write(`data: ${JSON.stringify({ type: 'code_files', files: loadedFiles, failedFiles })}\n\n`);
          }
        } catch (codeErr) {
          console.error('Code context failed:', codeErr);
        }
      }

      const useCodeTools = codeContextEnabled === true;
      const generator = useCodeTools
        ? codeToolChatStream(msgText, history, effectiveSystemPrompt || '', model || undefined)
        : aiChatStream(
            msgText,
            history,
            { currentUserId: userId, currentUserName: userName, customSystemPrompt: effectiveSystemPrompt || undefined, model: model || undefined, extendedThinking: extendedThinking || false, orgId, knowledgeBaseEnabled: knowledgeBaseEnabled || false, userRole: user?.role || 'member', userDeptId: user?.deptId || null },
            attachments
          );

      for await (const chunk of generator) {
        if (aborted || req.socket?.destroyed) break;

        if (chunk.type === 'tool_use' && (chunk as any).toolName) {
          const toolChunk = chunk as any;
          const toolLabel = toolChunk.toolName === 'read_file' ? `Reading ${toolChunk.toolInput?.file_path}...`
            : toolChunk.toolName === 'list_directory' ? `Browsing ${toolChunk.toolInput?.directory || 'project root'}...`
            : toolChunk.toolName === 'search_code' ? `Searching "${toolChunk.toolInput?.query}"...`
            : toolChunk.toolName === 'web_search' ? `Searching the web...`
            : `Using ${toolChunk.toolName}...`;
          const toolType = toolChunk.toolName === 'web_search' ? 'search'
            : (toolChunk.toolName === 'read_file' || toolChunk.toolName === 'list_directory') ? 'file'
            : toolChunk.toolName === 'search_code' ? 'search'
            : 'code';
          res.write(`data: ${JSON.stringify({ type: 'tool_use', toolName: toolChunk.toolName, toolInput: toolChunk.toolInput, label: toolLabel, toolType })}\n\n`);
        } else if ((chunk as any).type === 'tool_result_event') {
          const trChunk = chunk as any;
          const completedLabel = trChunk.toolName === 'read_file' ? `Read file: ${trChunk.result?.slice(0, 60) || 'done'}`
            : trChunk.toolName === 'list_directory' ? `Listed directory`
            : trChunk.toolName === 'search_code' ? `Search complete`
            : trChunk.toolName === 'web_search' ? `Searched the web`
            : `${trChunk.toolName} complete`;
          res.write(`data: ${JSON.stringify({ type: 'tool_result', toolName: trChunk.toolName, completedLabel, detail: trChunk.result || '' })}\n\n`);
        } else if (chunk.type === 'thinking' && chunk.content) {
          res.write(`data: ${JSON.stringify({ type: 'thinking', content: chunk.content })}\n\n`);
        } else if (chunk.type === 'token' && chunk.content) {
          fullText += chunk.content;
          res.write(`data: ${JSON.stringify({ type: 'token', content: chunk.content })}\n\n`);
        } else if (chunk.type === 'done') {
          if (chunk.tokenUsage) {
            const { calculateCost } = await import('./services/ai/tokenCost');
            const cost = calculateCost(
              chunk.tokenUsage.model,
              chunk.tokenUsage.promptTokens,
              chunk.tokenUsage.completionTokens
            );
            try {
              await storage.createTokenUsage({
                orgId,
                userId,
                conversationId: activeConvId || null,
                model: chunk.tokenUsage.model,
                promptTokens: chunk.tokenUsage.promptTokens,
                completionTokens: chunk.tokenUsage.completionTokens,
                totalTokens: chunk.tokenUsage.totalTokens,
                costUsd: cost,
                purpose: knowledgeBaseEnabled ? 'knowledge_qa' : 'chat',
              });
            } catch (tokenErr) {
              console.error('Failed to record token usage:', tokenErr);
            }
          }
          let displayText = fullText;
          const actionMatch = fullText.match(/<<<ACTIONS>>>\s*([\s\S]*?)\s*<<<END_ACTIONS>>>\s*$/);
          if (actionMatch) {
            displayText = fullText.slice(0, fullText.indexOf('<<<ACTIONS>>>')).trim();
            try {
              const actionData = JSON.parse(actionMatch[1].trim());
              if (actionData && actionData.type === 'interactive_input' && actionData.questions) {
                res.write(`data: ${JSON.stringify({ type: 'interactive_input', questions: actionData.questions })}\n\n`);
              } else if (actionData && (actionData.action || actionData.actions)) {
                res.write(`data: ${JSON.stringify({ type: 'action', ...actionData })}\n\n`);
              }
            } catch (parseErr) {
              console.error('Failed to parse action block:', parseErr);
            }
          }
          const donePayload: any = { type: 'done', fullText: displayText };
          if (chunk.tokenUsage) {
            donePayload.tokenUsage = {
              promptTokens: chunk.tokenUsage.promptTokens,
              completionTokens: chunk.tokenUsage.completionTokens,
              totalTokens: chunk.tokenUsage.totalTokens,
            };
          }
          res.write(`data: ${JSON.stringify(donePayload)}\n\n`);
        } else if (chunk.type === 'error') {
          const errContent = chunk.content || '';
          let errorCode = 'unknown';
          if (errContent.includes('rate') || errContent.includes('429') || errContent.includes('quota') || errContent.includes('Too Many')) {
            errorCode = 'rate_limit';
          } else if (errContent.includes('context') || errContent.includes('token') || errContent.includes('too long') || errContent.includes('max_tokens') || errContent.includes('context_length')) {
            errorCode = 'context_too_long';
          } else if (errContent.includes('overloaded') || errContent.includes('503') || errContent.includes('unavailable') || errContent.includes('capacity')) {
            errorCode = 'service_unavailable';
          } else if (errContent.includes('network') || errContent.includes('ECONNREFUSED') || errContent.includes('ETIMEDOUT') || errContent.includes('ENOTFOUND')) {
            errorCode = 'network';
          }
          res.write(`data: ${JSON.stringify({ type: 'error', content: errContent, errorCode })}\n\n`);
        }
      }

      if (isNewConversation && activeConvId && fullText && !aborted) {
        try {
          const title = await Promise.race([
            generateConversationTitle(msgText, fullText),
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
          ]);
          await storage.updateConversation(activeConvId!, { title });
          res.write(`data: ${JSON.stringify({ type: 'title', title })}\n\n`);
        } catch (err) {
          console.error('Title generation error:', err);
        }
      }

      res.end();

      extractMemories(
        [...history, { role: 'user', content: msgText }, { role: 'assistant', content: fullText }],
        userId,
        orgId
      ).catch(err => console.error('Memory extraction error:', err));
    } catch (e: any) {
      console.error('AI Chat Stream error:', e);
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
      try {
        const errContent = e.message || '';
        let errorCode = 'unknown';
        if (errContent.includes('rate') || errContent.includes('429') || errContent.includes('quota') || errContent.includes('Too Many')) {
          errorCode = 'rate_limit';
        } else if (errContent.includes('context') || errContent.includes('token') || errContent.includes('too long') || errContent.includes('max_tokens') || errContent.includes('context_length')) {
          errorCode = 'context_too_long';
        } else if (errContent.includes('overloaded') || errContent.includes('503') || errContent.includes('unavailable') || errContent.includes('capacity')) {
          errorCode = 'service_unavailable';
        } else if (errContent.includes('network') || errContent.includes('ECONNREFUSED') || errContent.includes('ETIMEDOUT') || errContent.includes('ENOTFOUND')) {
          errorCode = 'network';
        }
        res.write(`data: ${JSON.stringify({ type: 'error', content: errContent, errorCode })}\n\n`);
        res.end();
      } catch {}
    }
  });
```
