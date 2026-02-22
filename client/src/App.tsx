import { Switch, Route, useLocation, Link } from "wouter";
import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/ThemeProvider";
import NotFound from "@/pages/not-found";
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
    <div className="flex items-center gap-1 rounded-lg bg-sidebar-accent/40 p-1" data-testid="theme-toggle">
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
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80"
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
          "fixed left-0 top-0 h-screen w-60 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 z-50",
          "md:translate-x-0 md:relative md:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="sidebar"
      >
        <div className="md:hidden flex items-center justify-between p-4 border-b border-sidebar-border">
          <h1 className="text-lg font-bold">德湃任务中心</h1>
          <button
            onClick={onClose}
            className="p-1 hover:bg-sidebar-accent rounded-md"
            data-testid="sidebar-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="hidden md:block p-6 border-b border-sidebar-border">
          <h1 className="text-lg font-bold">德湃任务中心</h1>
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
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
                onClick={() => onClose()}
                data-testid={testId}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-3">
          <ThemeToggle />
          <div className="text-sm">
            <p className="font-medium">Alexso</p>
            <p className="text-sidebar-foreground/60 text-xs">(Owner)</p>
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="md:hidden flex items-center gap-2 p-4 bg-card border-b border-border">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-sidebar-accent rounded-md"
              data-testid="menu-toggle"
            >
              <Menu className="w-6 h-6" />
            </button>
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
