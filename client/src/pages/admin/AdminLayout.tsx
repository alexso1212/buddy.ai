import { useLocation, Link, Redirect } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Cpu,
  Users,
  Building2,
  BookOpen,
  Shield,
  BrainCircuit,
  ArrowLeft,
  ShieldAlert,
} from "lucide-react";

const navItems = [
  { path: "/admin", label: "系统概览", icon: LayoutDashboard, exact: true },
  { path: "/admin/ai", label: "AI 监控", icon: Cpu },
  { path: "/admin/users", label: "用户分析", icon: Users },
  { path: "/admin/orgs", label: "组织管理", icon: Building2 },
  { path: "/admin/kb", label: "知识库", icon: BookOpen },
  { path: "/admin/security", label: "安全审计", icon: Shield },
  { path: "/admin/workforce", label: "AI 依赖分析", icon: BrainCircuit },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();

  if (user && !user.isSuperAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-background" data-testid="admin-access-denied">
        <div className="text-center space-y-3">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">无权访问</h2>
          <p className="text-sm text-muted-foreground">你没有管理后台的访问权限</p>
          <Link href="/agent">
            <span className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline cursor-pointer mt-2" data-testid="link-back-to-app">
              <ArrowLeft className="w-4 h-4" />
              返回应用
            </span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background" data-testid="admin-layout">
      <aside className="w-56 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <h1 className="text-base font-semibold text-foreground" data-testid="text-admin-title">
            管理后台
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Super Admin Panel</p>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.exact
              ? location === item.path
              : location.startsWith(item.path);
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  data-testid={`nav-admin-${item.path.split("/").pop() || "overview"}`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-border">
          <Link href="/agent">
            <div
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
              data-testid="nav-admin-back"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>返回应用</span>
            </div>
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
