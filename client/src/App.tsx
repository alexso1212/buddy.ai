import { Switch, Route, useLocation, Link } from "wouter";
import { useState, useRef, useEffect } from "react";
import { queryClient, apiRequest } from "./lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/ThemeProvider";
import AgentLogo from "@/components/AgentLogo";
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
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

const BUDDY_AI_NAV = [
  { label: 'Chats', icon: MessageSquare, path: '/agent' },
  { label: 'Projects', icon: FolderClosed, path: null },
  { label: 'Artifacts', icon: Settings2, path: '/artifacts' },
  { label: 'Code', icon: Code2, path: null },
];

const ENTERPRISE_NAV = [
  { label: '仪表盘', icon: LayoutDashboard, path: '/' },
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
        <button onClick={onClose} style={{
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
              <FolderClosed size={18} color={project.id === currentProjectId ? '#D4A27F' : '#9A9893'} />
              <span style={{
                fontSize: 15, color: '#ECECEC',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1,
              }}>{project.name}</span>
              {project.id === currentProjectId && (
                <Check size={16} color="#D4A27F" />
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
  const [location] = useLocation();
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

  const isActive = (path: string) => {
    if (path === '/') return location === '/';
    return location.startsWith(path);
  };

  const renderNavItem = (item: { label: string; icon: typeof MessageSquare; path: string | null }, index: number) => {
    const Icon = item.icon;
    const active = item.path ? isActive(item.path) : false;
    const testId = item.path === '/' ? 'nav-dashboard' : item.path ? `nav-${item.path.slice(1)}` : `nav-${item.label.toLowerCase()}`;

    const content = (
      <div
        style={{
          height: 46,
          padding: '0 20px 0 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
          cursor: 'pointer',
          transition: 'background 150ms',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
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
          onTouchStart={(e) => {
            const touch = e.touches[0];
            pressTimerRef.current = window.setTimeout(() => {
              if (navigator.vibrate) navigator.vibrate(10);
              setContextMenu({ convoId: String(convo.id), x: touch.clientX, y: touch.clientY });
            }, 500);
          }}
          onTouchEnd={() => clearTimeout(pressTimerRef.current)}
          onTouchMove={() => clearTimeout(pressTimerRef.current)}
          style={{
            padding: convo.projectName ? '10px 16px' : '12px 16px',
            margin: '0 8px 2px 16px',
            borderRadius: 10,
            background: selected ? 'rgba(255,255,255,0.08)' : 'transparent',
            cursor: 'pointer',
            transition: 'background 150ms',
          }}
          onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
          onMouseLeave={e => { if (!selected) e.currentTarget.style.background = selected ? 'rgba(255,255,255,0.08)' : 'transparent'; }}
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
          zIndex: 40,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 300ms',
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

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {renderGroupHeader('企业管理', Building2, enterpriseOpen, () => setEnterpriseOpen(v => !v), 'button-toggle-enterprise')}
          <CollapsibleContent isOpen={enterpriseOpen}>
            <div>
              {ENTERPRISE_NAV.map(renderNavItem)}
            </div>
          </CollapsibleContent>

          <div style={{ height: 8 }} />

          {renderGroupHeader('Buddy AI', Bot, buddyAiOpen, () => setBuddyAiOpen(v => !v), 'button-toggle-buddy-ai')}
          <CollapsibleContent isOpen={buddyAiOpen}>
            <div>
              {BUDDY_AI_NAV.map(renderNavItem)}

              {conversations.length === 0 ? (
                <div style={{ padding: '32px 28px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: '#9A9893', lineHeight: 1.5 }}>还没有对话</p>
                  <p style={{ fontSize: 13, color: '#7A7874', marginTop: 4 }}>点击下方 + 开始新对话</p>
                </div>
              ) : (
                <>
                  {starredConvs.length > 0 && (
                    <>
                      <div style={{ padding: '20px 20px 8px 28px', fontSize: 14.5, fontWeight: 500, color: '#C4845C' }} data-testid="text-starred-label">
                        收藏
                      </div>
                      {starredConvs.map(renderConvoItem)}
                    </>
                  )}
                  {recentConvs.length > 0 && (
                    <>
                      <div style={{ padding: '20px 20px 8px 28px', fontSize: 14.5, fontWeight: 500, color: '#C4845C' }} data-testid="text-recents-label">
                        最近对话
                      </div>
                      {recentConvs.map(renderConvoItem)}
                    </>
                  )}
                </>
              )}
            </div>
          </CollapsibleContent>
        </div>

        <div
          style={{
            padding: '16px 20px',
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            gap: 8,
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setSettingsOpen(true)}
            data-testid="button-open-settings"
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: '#4A4A47',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                fontWeight: 600,
                color: '#FFFFFF',
                flexShrink: 0,
              }}
              data-testid="img-avatar"
            >
              A
            </div>
            <span style={{ fontSize: 15.5, color: '#ECECEC', marginLeft: 10 }} data-testid="text-username">Alexso</span>
          </div>

          <button
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#D4A27F',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'transform 100ms',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            onClick={() => {
              onClose();
              window.location.href = '/agent';
            }}
            data-testid="button-new-chat"
          >
            <Plus size={20} color="#FFFFFF" />
          </button>
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
                A
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: '#ECECEC' }} data-testid="text-settings-username">Alexso</div>
                <div style={{ fontSize: 14, color: '#9A9893' }} data-testid="text-settings-email">alexso@company.com</div>
              </div>
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
                  background: theme === 'dark' ? '#D4A27F' : 'rgba(255,255,255,0.2)',
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
                toast({ title: '已退出登录' });
              }}
              data-testid="settings-item-logout"
            >
              <LogOut size={20} color="#E5534B" />
              <span style={{ fontSize: 16, fontWeight: 400, color: '#E5534B' }}>退出登录</span>
            </div>
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
              background: '#3C3B37',
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
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 80,
            background: '#3C3B37',
            borderRadius: 16,
            padding: '24px 20px',
            width: 'min(340px, 90vw)',
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
                  background: '#D4A27F',
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
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 80,
            background: '#3C3B37',
            borderRadius: 16,
            padding: '24px 20px',
            width: 'min(340px, 90vw)',
            textAlign: 'center' as const,
          }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#ECECEC', marginBottom: 8 }}>
              确定删除？
            </div>
            <div style={{ fontSize: 14, color: '#9A9893', marginBottom: 20, lineHeight: 1.5 }}>
              此操作无法撤销
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
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
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startTime: 0,
    currentX: 0,
    type: '' as '' | 'open' | 'close',
  });
  
  const sidebarWidth = 340;

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const drag = dragRef.current;
      
      if (!sidebarOpen && touch.clientX < 25) {
        drag.isDragging = true;
        drag.startX = touch.clientX;
        drag.startTime = Date.now();
        drag.currentX = touch.clientX;
        drag.type = 'open';
      }
      
      if (sidebarOpen && sidebarRef.current) {
        const rect = sidebarRef.current.getBoundingClientRect();
        if (touch.clientX < rect.right) {
          drag.isDragging = true;
          drag.startX = touch.clientX;
          drag.startTime = Date.now();
          drag.currentX = touch.clientX;
          drag.type = 'close';
        }
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag.isDragging) return;
      
      drag.currentX = e.touches[0].clientX;
      const deltaX = drag.currentX - drag.startX;
      
      const sidebar = sidebarRef.current;
      const overlay = overlayRef.current;
      if (!sidebar || !overlay) return;
      
      sidebar.style.transition = 'none';
      overlay.style.transition = 'none';
      
      if (drag.type === 'open' && deltaX > 0) {
        const actualWidth = Math.min(sidebar.offsetWidth, sidebarWidth);
        const progress = Math.min(deltaX / actualWidth, 1);
        sidebar.style.transform = `translateX(${-actualWidth + deltaX}px)`;
        overlay.style.opacity = String(progress * 0.4);
        overlay.style.pointerEvents = 'auto';
        overlay.style.display = 'block';
      }
      
      if (drag.type === 'close' && deltaX < 0) {
        const actualWidth = Math.min(sidebar.offsetWidth, sidebarWidth);
        sidebar.style.transform = `translateX(${deltaX}px)`;
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
      
      sidebar.style.transition = 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)';
      overlay.style.transition = 'opacity 350ms ease';
      
      if (drag.type === 'open') {
        if (deltaX > actualWidth * 0.3 || velocity > 0.5) {
          sidebar.style.transform = 'translateX(0)';
          overlay.style.opacity = '0.4';
          setSidebarOpen(true);
        } else {
          sidebar.style.transform = 'translateX(-100%)';
          overlay.style.opacity = '0';
          setTimeout(() => { overlay.style.pointerEvents = 'none'; }, 350);
          setSidebarOpen(false);
        }
      }
      
      if (drag.type === 'close') {
        if (deltaX < -actualWidth * 0.3 || velocity > 0.5) {
          sidebar.style.transform = 'translateX(-100%)';
          overlay.style.opacity = '0';
          setSidebarOpen(false);
        } else {
          sidebar.style.transform = 'translateX(0)';
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

  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen bg-[var(--bg-primary)]">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} sidebarRef={sidebarRef} overlayRef={overlayRef} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="md:hidden" style={{
            height: 54,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
            background: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
            position: 'relative',
          }} data-testid="top-bar">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '50%',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              transition: 'background 150ms',
            }} data-testid="menu-toggle"
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
            >
              <Menu size={20} strokeWidth={1.8} />
            </button>
            <span style={{
              position: 'absolute', left: '50%', transform: 'translateX(-50%)',
              fontSize: 17, fontWeight: 600,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
            }} data-testid="top-bar-title">Buddy</span>
            <div style={{ width: 40 }} />
          </header>

          <main
            className="flex-1 overflow-auto ml-0 md:ml-[260px]"
            data-testid="content-area"
          >
            <Router />
          </main>
        </div>
      </div>

      <Toaster />
    </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
