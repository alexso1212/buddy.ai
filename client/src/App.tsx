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
  HelpCircle,
  Eye,
  Search,
  Check,
  X,
  MessageSquarePlus,
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

  // Fetch conversations from API
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
          }}>
            {convo.title}
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
                        {filteredRecent.map(renderConvoItem)}
                      </>
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

      {settingsOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              zIndex: 55,
            }}
            onClick={() => setSettingsOpen(false)}
            data-testid="settings-overlay"
          />
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 60,
              background: 'var(--bg-sidebar)',
              borderRadius: '16px 16px 0 0',
              padding: '24px 20px',
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
              animation: 'settingsSlideUp 300ms cubic-bezier(0.165, 0.85, 0.45, 1) forwards',
            }}
            data-testid="settings-action-sheet"
          >
            <style>{`
              @keyframes settingsSlideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
              }
            `}</style>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: '#4A4A47',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 600,
                  color: '#FFFFFF',
                  flexShrink: 0,
                }}
              >
                {authUser?.displayName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: '#ECECEC' }} data-testid="text-settings-username">{authUser?.displayName || '用户'}</div>
                <div style={{ fontSize: 14, color: '#9A9893' }} data-testid="text-settings-email">{authUser?.email || ''}</div>
              </div>
            </div>

            <div style={{ 
              margin: '12px 0 4px',
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
              onClick={() => { setSettingsOpen(false); setOrgSwitcherOpen(true); }}
              data-testid="button-switch-org"
            >
              <Building2 size={18} color="#9A9893" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#9A9893' }}>当前组织</div>
                <div style={{ fontSize: 15, color: '#ECECEC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {authUser?.orgName || '我的团队'}
                </div>
              </div>
              <div style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 6,
                background: authUser?.orgType === 'enterprise' ? 'rgba(255,255,255,0.1)' : 'rgba(174,86,48,0.15)',
                color: authUser?.orgType === 'enterprise' ? '#ECECEC' : '#C4703F',
                fontWeight: 500,
              }}>
                {authUser?.orgType === 'enterprise' ? '企业' : '项目'}
              </div>
              <ChevronRight size={16} color="#9A9893" />
            </div>

            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

            <Link
              href="/settings"
              onClick={() => { setSettingsOpen(false); onClose(); }}
              style={{ textDecoration: 'none' }}
            >
              <div
                style={{
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  borderRadius: 8,
                  padding: '0 8px',
                  cursor: 'pointer',
                  transition: 'background 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                data-testid="settings-item-settings"
              >
                <Settings2 size={20} color="#ECECEC" />
                <span style={{ fontSize: 16, fontWeight: 400, color: '#ECECEC' }}>设置</span>
              </div>
            </Link>

            <Link
              href="/notifications"
              onClick={() => { setSettingsOpen(false); onClose(); }}
              style={{ textDecoration: 'none' }}
            >
              <div
                style={{
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  borderRadius: 8,
                  padding: '0 8px',
                  cursor: 'pointer',
                  transition: 'background 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                data-testid="settings-item-notifications"
              >
                <Bell size={20} color="#ECECEC" />
                <span style={{ fontSize: 16, fontWeight: 400, color: '#ECECEC' }}>通知</span>
              </div>
            </Link>

            <div
              style={{
                height: 48,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                borderRadius: 8,
                padding: '0 8px',
                cursor: 'pointer',
                transition: 'background 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              data-testid="settings-item-darkmode"
            >
              <Moon size={20} color="#ECECEC" />
              <span style={{ fontSize: 16, fontWeight: 400, color: '#ECECEC', flex: 1 }}>深色模式</span>
              <div
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  background: theme === 'dark' ? '#AE5630' : 'rgba(255,255,255,0.2)',
                  position: 'relative',
                  transition: 'background 200ms',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    position: 'absolute',
                    top: 2,
                    left: theme === 'dark' ? 22 : 2,
                    transition: 'left 200ms',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                height: 48,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                borderRadius: 8,
                padding: '0 8px',
                cursor: 'pointer',
                transition: 'background 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => {
                window.location.href = 'mailto:support@buddy.app';
                setSettingsOpen(false);
              }}
              data-testid="settings-item-help"
            >
              <HelpCircle size={20} color="#ECECEC" />
              <span style={{ fontSize: 16, fontWeight: 400, color: '#ECECEC' }}>帮助与反馈</span>
            </div>

            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

            <div
              style={{
                height: 48,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                borderRadius: 8,
                padding: '0 8px',
                cursor: 'pointer',
                transition: 'background 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => {
                setSettingsOpen(false);
                onClose();
                logout();
              }}
              data-testid="settings-item-logout"
            >
              <LogOut size={20} color="#E5534B" />
              <span style={{ fontSize: 16, fontWeight: 400, color: '#E5534B' }}>退出登录</span>
            </div>
          </div>
        </>
      )}

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
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, user, navigate]);

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
  { id: 'claude-opus-4-6', label: 'Opus 4.6', desc: 'Most capable for ambitious work' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', desc: 'Fastest for quick answers' },
];

const MORE_MODELS = [
  { id: 'claude-sonnet-4-20250514', label: 'Sonnet 4', desc: 'Previous generation' },
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
          background: 'rgba(30, 29, 26, 0.95)',
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
    window.addEventListener('open-sidebar', handleOpenSidebar);
    return () => window.removeEventListener('open-sidebar', handleOpenSidebar);
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
        {!isLoginPage && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} sidebarRef={sidebarRef} overlayRef={overlayRef} />}

        <div ref={contentRef} className="flex-1 flex flex-col overflow-hidden relative md:!transform-none">
          {!isGraphPage && !isLoginPage && (
          <>
            <div className="md:hidden" style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 108,
              background: 'linear-gradient(to bottom, rgba(38,38,36,0.99) 0%, transparent 100%)',
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
                  }} data-testid="top-bar-title">{isChatsPage ? 'Chats' : 'Buddy'}</span>
                )}
                <div style={{ width: 42 }} />
              </div>
            </>
          )}

          <main
            className={`flex-1 overflow-auto relative ${isLoginPage ? 'ml-0' : 'ml-0 md:ml-[260px]'}`}
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
