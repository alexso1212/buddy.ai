import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import SyncPage from "@/pages/sync";
import Overview from "@/pages/overview";
import Evaluation from "@/pages/evaluation";
import Organization from "@/pages/organization";
import Collaboration from "@/pages/collaboration";
import GanttChart from "@/pages/gantt";
import ProjectDetail from "@/pages/project-detail";
import Projects from "@/pages/projects";
import ProjectWizard from "@/pages/project-wizard";
import {
  CheckSquare,
  FolderKanban,
  BarChart3,
  Award,
  Building2,
  GanttChart as GanttChartIcon,
  RefreshCw,
} from "lucide-react";

function MobileBottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();

  if (!user) return null;

  const isCeoOrAdmin = user.role === "ceo" || user.role === "admin";
  const isCeo = user.role === "ceo";

  const items = [
    { label: "任务", href: "/dashboard", icon: CheckSquare, show: true },
    { label: "项目", href: "/projects", icon: FolderKanban, show: true },
    { label: "概览", href: "/overview", icon: BarChart3, show: isCeoOrAdmin },
    { label: "考核", href: "/evaluation", icon: Award, show: isCeoOrAdmin },
    { label: "组织", href: "/organization", icon: Building2, show: isCeoOrAdmin },
    { label: "甘特图", href: "/gantt", icon: GanttChartIcon, show: isCeoOrAdmin },
    { label: "同步", href: "/sync", icon: RefreshCw, show: isCeo },
  ].filter((item) => item.show);

  const isActive = (href: string) => {
    if (href === "/dashboard") return location === "/dashboard";
    if (href === "/projects") return location === "/projects" || location.startsWith("/project/") || location === "/projects/new";
    return location.startsWith(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden pb-[env(safe-area-inset-bottom)]"
      data-testid="mobile-bottom-nav"
    >
      <div className="flex flex-nowrap overflow-x-auto">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[60px] px-2 py-1.5 no-underline",
                active ? "text-primary" : "text-muted-foreground"
              )}
              data-testid={`mobile-tab-${item.href.replace("/", "")}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] leading-tight whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MobileBottomNav />
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LoginPage} />
      <Route path="/dashboard">
        <AuthenticatedLayout><Dashboard /></AuthenticatedLayout>
      </Route>
      <Route path="/projects">
        <AuthenticatedLayout><Projects /></AuthenticatedLayout>
      </Route>
      <Route path="/projects/new">
        <AuthenticatedLayout><ProjectWizard /></AuthenticatedLayout>
      </Route>
      <Route path="/overview">
        <AuthenticatedLayout><Overview /></AuthenticatedLayout>
      </Route>
      <Route path="/evaluation">
        <AuthenticatedLayout><Evaluation /></AuthenticatedLayout>
      </Route>
      <Route path="/sync">
        <AuthenticatedLayout><SyncPage /></AuthenticatedLayout>
      </Route>
      <Route path="/organization">
        <AuthenticatedLayout><Organization /></AuthenticatedLayout>
      </Route>
      <Route path="/collaboration">
        <AuthenticatedLayout><Collaboration /></AuthenticatedLayout>
      </Route>
      <Route path="/gantt">
        <AuthenticatedLayout><GanttChart /></AuthenticatedLayout>
      </Route>
      <Route path="/project/:id">
        <AuthenticatedLayout><ProjectDetail /></AuthenticatedLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
