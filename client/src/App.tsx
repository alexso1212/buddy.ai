import { Switch, Route, useLocation, Link } from "wouter";
import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/ThemeProvider";
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
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Settings as SettingsIcon,
  Menu,
  X,
  Network,
  Bot,
  Bell,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

const NAV_ITEMS = [
  { label: "仪表盘", icon: LayoutDashboard, path: "/" },
  { label: "图谱", icon: Network, path: "/graph" },
  { label: "助手", icon: Bot, path: "/agent" },
  { label: "项目", icon: FolderKanban, path: "/projects" },
  { label: "任务", icon: CheckSquare, path: "/tasks" },
  { label: "团队", icon: Users, path: "/team" },
  { label: "通知", icon: Bell, path: "/notifications" },
  { label: "设置", icon: SettingsIcon, path: "/settings" },
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

function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [location] = useLocation();

  const { data: unreadRes } = useQuery<{ data: { count: number } }>({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/unread-count?userId=1");
      return res.json();
    },
    refetchInterval: 30000,
  });
  const unreadCount = unreadRes?.data?.count ?? 0;

  const isActive = (path: string) => {
    if (path === "/") {
      return location === "/";
    }
    return location.startsWith(path);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-60 bg-[var(--bg-sidebar)] text-[var(--text-primary)] flex flex-col transition-transform duration-300 z-50",
          "md:translate-x-0 md:relative md:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="sidebar"
      >
        <div className="md:hidden flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <h1 className="text-lg font-bold flex items-center gap-2"><span className="w-2 h-5 rounded-sm bg-brand inline-block"></span>Buddy</h1>
          <button
            onClick={onClose}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md"
            data-testid="sidebar-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="hidden md:block p-6 border-b border-[var(--border-subtle)]">
          <h1 className="text-lg font-bold flex items-center gap-2"><span className="w-2 h-5 rounded-sm bg-brand inline-block"></span>Buddy</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            const testId = item.path === "/" ? "nav-dashboard" : `nav-${item.path.slice(1)}`;

            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-2 rounded-md transition-colors",
                  active
                    ? "bg-brand/10 text-brand"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5"
                )}
                onClick={() => onClose()}
                data-testid={testId}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
                {item.label === "通知" && unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[var(--border-subtle)] space-y-3">
          <ThemeToggle />
          <div className="text-sm">
            <p className="font-medium text-[var(--text-primary)]">Alexso</p>
            <p className="text-[var(--text-secondary)] text-xs">(Owner)</p>
          </div>
        </div>
      </aside>
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen bg-[var(--bg-primary)]">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="md:hidden flex items-center gap-2 p-4 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)]">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-md"
              data-testid="menu-toggle"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-base font-bold text-[var(--text-primary)]">Buddy</span>
          </header>

          <main
            className="flex-1 overflow-auto p-6 ml-0 md:ml-60"
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
