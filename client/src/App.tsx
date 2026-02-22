import { Switch, Route, useLocation } from "wouter";
import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
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
import { Menu, Plus } from "lucide-react";

function Sidebar({ isOpen, onClose, onNewChat }: { isOpen: boolean; onClose: () => void; onNewChat: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 40,
        background: 'var(--overlay)',
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'opacity 300ms ease',
      }} data-testid="sidebar-overlay" />

      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: '82vw', maxWidth: 340,
        background: 'var(--bg-sidebar)',
        zIndex: 50,
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 300ms cubic-bezier(0.165, 0.85, 0.45, 1)',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
      }} data-testid="sidebar">

        <div style={{ padding: '20px 20px 24px 20px', flexShrink: 0 }}>
          <h1 style={{
            fontFamily: "Georgia, 'Noto Serif SC', serif",
            fontSize: 28, fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
          }} data-testid="sidebar-title">Buddy</h1>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{
            fontSize: 14, fontWeight: 500,
            color: 'var(--section-title)',
            padding: '16px 20px 8px 20px',
            fontFamily: 'var(--font-sans)',
          }}>收藏</div>

          <div
            onClick={onClose}
            style={{
              padding: '12px 16px',
              margin: '0 8px 2px 8px',
              borderRadius: 10,
              cursor: 'pointer',
              background: 'var(--sidebar-active)',
              fontSize: 15.5,
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'background 150ms',
            }}
            data-testid="conv-starred-ai"
          >AI 助手</div>

          <div style={{
            fontSize: 14, fontWeight: 500,
            color: 'var(--section-title)',
            padding: '20px 20px 8px 20px',
            fontFamily: 'var(--font-sans)',
          }}>最近对话</div>

          <div
            onClick={() => { onNewChat(); onClose(); }}
            style={{
              padding: '12px 16px',
              margin: '0 8px 2px 8px',
              borderRadius: 10,
              cursor: 'pointer',
              background: 'transparent',
              fontSize: 15.5,
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'background 150ms',
            }}
            data-testid="conv-new"
          >新建对话</div>
        </div>

        <div style={{
          padding: '12px 20px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#4A4A47',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 600, color: '#ECECEC',
            }} data-testid="user-avatar">A</div>
            <span style={{
              fontSize: 15, color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
            }} data-testid="user-name">Alexso</span>
          </div>

          <button
            onClick={() => { onNewChat(); onClose(); }}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--brand)',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 100ms',
            }}
            data-testid="btn-new-chat"
          >
            <Plus size={20} color="#FFFFFF" />
          </button>
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
  const [, setLocation] = useLocation();

  const handleNewChat = () => {
    setLocation("/agent");
  };

  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col h-screen bg-[var(--bg-primary)]">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onNewChat={handleNewChat} />

        <header style={{
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
          <button onClick={() => setSidebarOpen(true)} style={{
            width: 44, height: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-primary)',
          }} data-testid="menu-toggle">
            <Menu size={22} />
          </button>

          <span style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            fontSize: 17, fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
          }} data-testid="top-bar-title">Buddy</span>

          <div style={{ width: 44 }} />
        </header>

        <main
          className="flex-1 overflow-auto"
          data-testid="content-area"
        >
          <Router />
        </main>
      </div>

      <Toaster />
    </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
