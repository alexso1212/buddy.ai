import { useState, useEffect } from "react";
import { X, Users, Target, DollarSign, AlertTriangle, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OrgPersonPopover } from "./OrgPersonPopover";
import { useIsMobile } from "./useOrgData";
import type { DeptTreeNode, SafeUser, DeptStatsMap, UserStatsMap } from "./types";
import {
  getCompletionLevel,
  getCompletionColor,
  getCompletionRate,
  getWorkloadLevel,
  getUrgency,
} from "./types";
import type { Department } from "@shared/schema";

interface OrgDetailPanelProps {
  node: DeptTreeNode | null;
  users: SafeUser[];
  deptStats: DeptStatsMap;
  userStats: UserStatsMap;
  currentUser: SafeUser;
  onClose: () => void;
  onEditUser: (u: SafeUser) => void;
  onEditDept: (d: Department) => void;
}

const WORKLOAD_LABELS: Record<string, { label: string; color: string }> = {
  overloaded: { label: "过载", color: "text-red-500" },
  heavy: { label: "较重", color: "text-orange-500" },
  normal: { label: "正常", color: "text-foreground" },
  light: { label: "空闲", color: "text-muted-foreground" },
};

const URGENCY_DOTS: Record<string, { color: string; label: string }> = {
  overdue: { color: "bg-red-500", label: "逾期" },
  dueSoon: { color: "bg-yellow-500", label: "即将到期" },
  blocked: { color: "bg-orange-500", label: "被阻塞" },
  none: { color: "", label: "" },
};

export function OrgDetailPanel({
  node,
  users,
  deptStats,
  userStats,
  currentUser,
  onClose,
  onEditUser,
  onEditDept,
}: OrgDetailPanelProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<"members" | "kpi" | "benefits">("members");
  const [visible, setVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  const isCeo = currentUser.role === "ceo" || currentUser.role === "admin";

  useEffect(() => {
    if (node) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [node]);

  useEffect(() => {
    setActiveTab("members");
  }, [node?.dept.id]);

  if (!shouldRender || !node) return null;

  const dept = node.dept;
  const members = node.members;
  const stats = deptStats[dept.id];
  const total = stats?.total ?? 0;
  const done = stats?.done ?? 0;
  const active = stats?.active ?? 0;
  const rate = getCompletionRate(total, done);
  const level = getCompletionLevel(total, done);
  const color = getCompletionColor(level);
  const workload = getWorkloadLevel(active);
  const wl = WORKLOAD_LABELS[workload];
  const headPerson = members.find((m) => m.id === dept.head_id);

  const tabs = [
    { key: "members" as const, label: "人员", icon: Users, testId: "detail-tab-members" },
    { key: "kpi" as const, label: "职能&KPI", icon: Target, testId: "detail-tab-kpi" },
    ...(isCeo
      ? [{ key: "benefits" as const, label: "利益", icon: DollarSign, testId: "detail-tab-benefits" }]
      : []),
  ];

  const panelContent = (
    <div className="flex flex-col h-full" data-testid="detail-panel">
      <div className="flex items-center justify-between gap-2 p-4 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: dept.color || "#888" }}
          />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{dept.name}</h3>
            {headPerson && (
              <p className="text-xs text-muted-foreground truncate">
                负责人: {headPerson.name}
              </p>
            )}
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          data-testid="detail-close"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="px-4 py-3 border-b space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">
              任务 <span className="font-medium text-foreground">{total}</span>
            </span>
            <span className="text-muted-foreground">
              完成 <span className="font-medium" style={{ color }}>{done}</span>
            </span>
            <span className="text-muted-foreground">
              活跃 <span className="font-medium text-foreground">{active}</span>
            </span>
          </div>
          <span className={`font-medium ${wl.color}`}>{wl.label}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${rate}%`, backgroundColor: color }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">完成率 {rate}%</span>
          {isCeo && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => onEditDept(dept)}
              data-testid="detail-edit-dept"
            >
              编辑部门
            </Button>
          )}
        </div>
      </div>

      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            data-testid={tab.testId}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover-elevate"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "members" && (
          <MembersTab
            members={members}
            userStats={userStats}
            isCeoOrAdmin={isCeo}
            onEditUser={onEditUser}
          />
        )}
        {activeTab === "kpi" && <KpiTab dept={dept} />}
        {activeTab === "benefits" && isCeo && <BenefitsTab dept={dept} />}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div
          className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
          onClick={onClose}
        />
        <div
          className={`fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-xl border-t shadow-lg transition-transform duration-300 ease-out ${
            visible ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ height: "70vh" }}
        >
          <div className="flex justify-center py-2">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
          {panelContent}
        </div>
      </>
    );
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          visible ? "opacity-100 bg-black/20" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-[400px] z-50 bg-background border-l shadow-lg transition-transform duration-300 ease-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {panelContent}
      </div>
    </>
  );
}

function MembersTab({
  members,
  userStats,
  isCeoOrAdmin,
  onEditUser,
}: {
  members: SafeUser[];
  userStats: UserStatsMap;
  isCeoOrAdmin: boolean;
  onEditUser: (u: SafeUser) => void;
}) {
  if (members.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        暂无成员
      </div>
    );
  }

  return (
    <div className="divide-y">
      {members.map((person) => {
        const stats = userStats[person.id];
        const total = stats?.total ?? 0;
        const done = stats?.done ?? 0;
        const rate = getCompletionRate(total, done);
        const level = getCompletionLevel(total, done);
        const barColor = getCompletionColor(level);
        const urgency = getUrgency(stats);
        const urgencyDot = URGENCY_DOTS[urgency];

        return (
          <Popover key={person.id}>
            <PopoverTrigger asChild>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover-elevate transition-colors"
                data-testid={`detail-person-${person.id}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{person.name}</span>
                    {urgency !== "none" && (
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${urgencyDot.color}`}
                        title={urgencyDot.label}
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {person.title || "无职位"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">{total}任务</span>
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${rate}%`, backgroundColor: barColor }}
                    />
                  </div>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <OrgPersonPopover
                person={person}
                userStats={userStats}
                isCeoOrAdmin={isCeoOrAdmin}
                onEditUser={onEditUser}
              />
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}

function KpiTab({ dept }: { dept: Department }) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5">部门职能</h4>
        <p className="text-sm leading-relaxed">
          {dept.description || "暂无描述"}
        </p>
      </div>
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5">KPI 指标</h4>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {dept.kpi_description || "暂无 KPI 描述"}
        </p>
      </div>
    </div>
  );
}

function BenefitsTab({ dept }: { dept: Department }) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5">薪酬说明</h4>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {dept.compensation_note || "暂无薪酬说明"}
        </p>
      </div>
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5">预算说明</h4>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {dept.budget_note || "暂无预算说明"}
        </p>
      </div>
    </div>
  );
}
