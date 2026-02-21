import { useState, useMemo, useEffect, Fragment } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { EvalPeriod, EvalScore, EvalRule, User, Department } from "@shared/schema";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer } from 'recharts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend as BarLegend, ResponsiveContainer as BarContainer } from 'recharts';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, ChevronRight, Settings, Save, X, BarChart3, User as UserIcon } from "lucide-react";

const DIMENSIONS = [
  { dimension: "timeliness", label: "按时完成率", weight: 30 },
  { dimension: "overdue", label: "逾期严重度", weight: 20 },
  { dimension: "quality", label: "交付质量", weight: 25 },
  { dimension: "response", label: "响应速度", weight: 10 },
  { dimension: "collaboration", label: "协作表现", weight: 10 },
  { dimension: "subtask", label: "子任务完成率", weight: 5 },
] as const;

function getEvalStatusLabel(status: string | null) {
  switch (status) {
    case "draft": return "草稿";
    case "scoring": return "打分中";
    case "review": return "审核中";
    case "published": return "已发布";
    default: return status ?? "未知";
  }
}

function getEvalStatusColor(status: string | null) {
  switch (status) {
    case "draft": return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    case "scoring": return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    case "review": return "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300";
    case "published": return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    default: return "bg-gray-100 text-gray-600";
  }
}

function getNextStatus(status: string | null): string | null {
  switch (status) {
    case "draft": return "scoring";
    case "scoring": return "review";
    case "review": return "published";
    default: return null;
  }
}

function getNextStatusLabel(status: string | null): string | null {
  const next = getNextStatus(status);
  if (!next) return null;
  return getEvalStatusLabel(next);
}

function getScoreColor(score: number) {
  if (score >= 90) return "text-green-600 dark:text-green-400";
  if (score >= 70) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getScoreBarColor(score: number) {
  if (score >= 90) return "bg-green-500";
  if (score >= 70) return "bg-yellow-500";
  return "bg-red-500";
}

interface PeriodDetailData {
  period: EvalPeriod;
  scores: EvalScore[];
  rules: EvalRule[];
}

function CreatePeriodDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [scoringDeadline, setScoringDeadline] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/eval/periods", {
        title,
        type,
        start_date: startDate,
        end_date: endDate,
        scoring_deadline: scoringDeadline || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/eval/periods"] });
      toast({ title: "考核周期已创建" });
      onOpenChange(false);
      setTitle("");
      setType("monthly");
      setStartDate("");
      setEndDate("");
      setScoringDeadline("");
    },
    onError: (err: Error) => {
      toast({ title: "创建失败", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>创建考核周期</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">标题</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：2026年2月考核"
              data-testid="input-period-title"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">类型</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="select-period-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">月度</SelectItem>
                <SelectItem value="quarterly">季度</SelectItem>
                <SelectItem value="yearly">年度</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">开始日期</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-period-start"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">结束日期</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-period-end"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">打分截止日期</label>
            <Input
              type="date"
              value={scoringDeadline}
              onChange={(e) => setScoringDeadline(e.target.value)}
              data-testid="input-period-scoring-deadline"
            />
          </div>
          <Button
            className="w-full"
            onClick={() => createMutation.mutate()}
            disabled={!title || !startDate || !endDate || createMutation.isPending}
            data-testid="button-create-period"
          >
            {createMutation.isPending ? "创建中..." : "创建"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UserDetailDialog({
  open,
  onOpenChange,
  targetUser,
  scores,
  rules,
  allUsers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: User;
  scores: EvalScore[];
  rules: EvalRule[];
  allUsers: User[];
}) {
  const userScores = scores.filter((s) => s.user_id === targetUser.id);

  const dimensionData = DIMENSIONS.map((dim) => {
    const rule = rules.find((r) => r.dimension === dim.dimension);
    const scoreEntry = userScores.find((s) => s.dimension === dim.dimension);
    const scoreVal = scoreEntry ? parseFloat(scoreEntry.score) : 0;
    const weight = rule ? parseFloat(rule.weight) : dim.weight;
    const scorer = scoreEntry ? allUsers.find((u) => u.id === scoreEntry.scorer_id) : null;
    return {
      ...dim,
      score: scoreVal,
      weight,
      comment: scoreEntry?.comment ?? null,
      scorerName: scorer?.name ?? null,
      autoCalculated: scoreEntry?.auto_calculated ?? false,
    };
  });

  const weightedTotal = dimensionData.reduce((sum, d) => sum + (d.score * d.weight) / 100, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid={`text-detail-user-${targetUser.id}`}>
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: targetUser.color ?? "#888" }}
            />
            {targetUser.name} - 绩效详情
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">加权总分</span>
            <span className={cn("text-2xl font-bold", getScoreColor(weightedTotal))} data-testid={`text-total-score-${targetUser.id}`}>
              {weightedTotal.toFixed(1)}
            </span>
          </div>

          <div className="space-y-3">
            {dimensionData.map((dim) => (
              <Card key={dim.dimension} className="p-3" data-testid={`card-dimension-${dim.dimension}-${targetUser.id}`}>
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{dim.label}</span>
                    <span className="text-xs text-muted-foreground">权重 {dim.weight}%</span>
                  </div>
                  <span className={cn("text-sm font-bold", getScoreColor(dim.score))}>
                    {dim.score.toFixed(1)}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-md h-5 overflow-hidden">
                  <div
                    className={cn("h-full rounded-md transition-all", getScoreBarColor(dim.score))}
                    style={{ width: `${Math.min(dim.score, 100)}%` }}
                    data-testid={`bar-${dim.dimension}-${targetUser.id}`}
                  />
                </div>
                {(dim.scorerName || dim.comment) && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {dim.scorerName && <span>评分人: {dim.scorerName}</span>}
                    {dim.comment && <span className="ml-2">备注: {dim.comment}</span>}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScoringTable({
  periodId,
  scores,
  rules,
  users,
  allUsers,
  isCeo,
  periodStatus,
}: {
  periodId: string;
  scores: EvalScore[];
  rules: EvalRule[];
  users: User[];
  allUsers: User[];
  isCeo: boolean;
  periodStatus: string | null;
}) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [qualityScores, setQualityScores] = useState<Record<string, string>>({});
  const [qualityComments, setQualityComments] = useState<Record<string, string>>({});

  const scoreMutation = useMutation({
    mutationFn: async (data: { period_id: string; user_id: string; dimension: string; score: number; comment?: string }) => {
      await apiRequest("POST", "/api/eval/scores", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/eval/periods", periodId] });
      toast({ title: "评分已提交" });
    },
    onError: (err: Error) => {
      toast({ title: "提交失败", description: err.message, variant: "destructive" });
    },
  });

  const canScore = periodStatus === "scoring" && (isCeo || currentUser?.role === "admin" || currentUser?.role === "head");

  const getUserScores = (userId: string) => {
    return DIMENSIONS.map((dim) => {
      const rule = rules.find((r) => r.dimension === dim.dimension);
      const scoreEntry = scores.find((s) => s.user_id === userId && s.dimension === dim.dimension);
      const scoreVal = scoreEntry ? parseFloat(scoreEntry.score) : 0;
      const weight = rule ? parseFloat(rule.weight) : dim.weight;
      return { ...dim, score: scoreVal, weight };
    });
  };

  const getWeightedTotal = (userId: string) => {
    const dims = getUserScores(userId);
    return dims.reduce((sum, d) => sum + (d.score * d.weight) / 100, 0);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <BarChart3 className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">评分列表</span>
        <span className="text-xs text-muted-foreground">({users.length} 人)</span>
      </div>

      {users.map((u) => {
        const total = getWeightedTotal(u.id);
        const userDims = getUserScores(u.id);
        const qualityDim = userDims.find((d) => d.dimension === "quality");

        return (
          <Card
            key={u.id}
            className="p-3 hover-elevate cursor-pointer"
            onClick={() => setSelectedUser(u)}
            data-testid={`card-user-score-${u.id}`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: u.color ?? "#888" }}
                />
                <span className="text-sm font-medium truncate" data-testid={`text-user-name-${u.id}`}>
                  {u.name}
                </span>
                {u.title && <span className="text-xs text-muted-foreground truncate">{u.title}</span>}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn("text-lg font-bold", getScoreColor(total))}
                  data-testid={`text-weighted-total-${u.id}`}
                >
                  {total.toFixed(1)}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {userDims.map((dim) => (
                <div key={dim.dimension} className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{dim.label}:</span>
                  <span className={cn("text-xs font-medium", getScoreColor(dim.score))}>
                    {dim.score > 0 ? dim.score.toFixed(0) : "-"}
                  </span>
                </div>
              ))}
            </div>

            {canScore && (
              <div
                className="flex items-center gap-2 mt-2 border-t pt-2 flex-wrap"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-xs text-muted-foreground shrink-0">交付质量:</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={qualityScores[u.id] ?? (qualityDim?.score ? qualityDim.score.toString() : "")}
                  onChange={(e) => setQualityScores((prev) => ({ ...prev, [u.id]: e.target.value }))}
                  className="w-20"
                  placeholder="0-100"
                  data-testid={`input-quality-score-${u.id}`}
                />
                <Input
                  value={qualityComments[u.id] ?? ""}
                  onChange={(e) => setQualityComments((prev) => ({ ...prev, [u.id]: e.target.value }))}
                  className="flex-1 min-w-[100px]"
                  placeholder="备注（可选）"
                  data-testid={`input-quality-comment-${u.id}`}
                />
                <Button
                  size="sm"
                  disabled={!qualityScores[u.id] || scoreMutation.isPending}
                  onClick={() => {
                    const val = parseFloat(qualityScores[u.id]);
                    if (isNaN(val) || val < 0 || val > 100) {
                      toast({ title: "分数需在0-100之间", variant: "destructive" });
                      return;
                    }
                    scoreMutation.mutate({
                      period_id: periodId,
                      user_id: u.id,
                      dimension: "quality",
                      score: val,
                      comment: qualityComments[u.id] || undefined,
                    });
                  }}
                  data-testid={`button-submit-quality-${u.id}`}
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  提交
                </Button>
              </div>
            )}
          </Card>
        );
      })}

      {selectedUser && (
        <UserDetailDialog
          open={true}
          onOpenChange={(o) => { if (!o) setSelectedUser(null); }}
          targetUser={selectedUser}
          scores={scores}
          rules={rules}
          allUsers={allUsers}
        />
      )}
    </div>
  );
}

function RulesSettings() {
  const { toast } = useToast();
  const { data: rules, isLoading } = useQuery<EvalRule[]>({
    queryKey: ["/api/eval/rules"],
  });

  const [editedRules, setEditedRules] = useState<Array<{ dimension: string; label: string; weight: string; formula: string }>>([]);
  const [editing, setEditing] = useState(false);

  const startEditing = () => {
    if (rules) {
      setEditedRules(
        rules.map((r) => ({
          dimension: r.dimension,
          label: r.label,
          weight: r.weight,
          formula: r.formula ?? "",
        }))
      );
    } else {
      setEditedRules(
        DIMENSIONS.map((d) => ({
          dimension: d.dimension,
          label: d.label,
          weight: d.weight.toString(),
          formula: "",
        }))
      );
    }
    setEditing(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/eval/rules", { rules: editedRules });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/eval/rules"] });
      toast({ title: "规则已保存" });
      setEditing(false);
    },
    onError: (err: Error) => {
      toast({ title: "保存失败", description: err.message, variant: "destructive" });
    },
  });

  const totalWeight = editedRules.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const displayRules = editing ? editedRules : (rules ?? []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">评分规则设置</span>
        </div>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={startEditing} data-testid="button-edit-rules">
            编辑规则
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} data-testid="button-cancel-rules">
              <X className="w-3.5 h-3.5 mr-1" />
              取消
            </Button>
            <Button
              size="sm"
              disabled={totalWeight !== 100 || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              data-testid="button-save-rules"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {saveMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        )}
      </div>

      <Card className="p-0 overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 text-muted-foreground font-medium">维度</th>
                <th className="text-left p-3 text-muted-foreground font-medium">标签</th>
                <th className="text-left p-3 text-muted-foreground font-medium">权重(%)</th>
                <th className="text-left p-3 text-muted-foreground font-medium">公式</th>
              </tr>
            </thead>
            <tbody>
              {displayRules.map((rule, idx) => (
                <tr key={rule.dimension} className="border-b last:border-b-0" data-testid={`row-rule-${rule.dimension}`}>
                  <td className="p-3 font-medium">{rule.dimension}</td>
                  <td className="p-3">
                    {editing ? (
                      <Input
                        value={editedRules[idx]?.label ?? ""}
                        onChange={(e) => {
                          const updated = [...editedRules];
                          updated[idx] = { ...updated[idx], label: e.target.value };
                          setEditedRules(updated);
                        }}
                        data-testid={`input-rule-label-${rule.dimension}`}
                      />
                    ) : (
                      rule.label
                    )}
                  </td>
                  <td className="p-3">
                    {editing ? (
                      <Input
                        type="number"
                        value={editedRules[idx]?.weight ?? ""}
                        onChange={(e) => {
                          const updated = [...editedRules];
                          updated[idx] = { ...updated[idx], weight: e.target.value };
                          setEditedRules(updated);
                        }}
                        className="w-20"
                        data-testid={`input-rule-weight-${rule.dimension}`}
                      />
                    ) : (
                      rule.weight
                    )}
                  </td>
                  <td className="p-3">
                    {editing ? (
                      <Input
                        value={editedRules[idx]?.formula ?? ""}
                        onChange={(e) => {
                          const updated = [...editedRules];
                          updated[idx] = { ...updated[idx], formula: e.target.value };
                          setEditedRules(updated);
                        }}
                        placeholder="自动计算公式"
                        data-testid={`input-rule-formula-${rule.dimension}`}
                      />
                    ) : (
                      <span className="text-muted-foreground">{rule.formula || "-"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <div className={cn("text-sm", totalWeight === 100 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
          权重合计: {totalWeight}%{totalWeight !== 100 && " (需等于100%)"}
        </div>
      )}
    </div>
  );
}

const DIMENSION_COLORS: Record<string, string> = {
  timeliness: "#3B82F6",
  overdue: "#EF4444",
  quality: "#10B981",
  response: "#F59E0B",
  collaboration: "#8B5CF6",
  subtask: "#EC4899",
};

function EvalDashboard({
  periods,
  allUsers,
  currentUser,
  isCeo,
}: {
  periods: EvalPeriod[];
  allUsers: User[];
  currentUser: { id: string; role: string; dept: string | null; dept_id: string | null };
  isCeo: boolean;
}) {
  const publishedPeriods = useMemo(
    () => periods.filter((p) => p.status === "published").sort((a, b) => b.end_date.localeCompare(a.end_date)),
    [periods]
  );

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<string>("total");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    if (publishedPeriods.length > 0 && !selectedPeriodId) {
      setSelectedPeriodId(publishedPeriods[0].id);
    }
  }, [publishedPeriods, selectedPeriodId]);

  const prevPeriodId = useMemo(() => {
    if (!selectedPeriodId) return null;
    const idx = publishedPeriods.findIndex((p) => p.id === selectedPeriodId);
    if (idx < 0 || idx >= publishedPeriods.length - 1) return null;
    return publishedPeriods[idx + 1].id;
  }, [selectedPeriodId, publishedPeriods]);

  const { data: periodDetail } = useQuery<PeriodDetailData>({
    queryKey: ["/api/eval/periods", selectedPeriodId],
    enabled: !!selectedPeriodId,
  });

  const { data: prevPeriodDetail } = useQuery<PeriodDetailData>({
    queryKey: ["/api/eval/periods", prevPeriodId],
    enabled: !!prevPeriodId,
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const rules = periodDetail?.rules ?? [];
  const scores = periodDetail?.scores ?? [];
  const prevScores = prevPeriodDetail?.scores ?? [];

  const getWeight = (dimension: string) => {
    const rule = rules.find((r) => r.dimension === dimension);
    if (rule) return parseFloat(rule.weight);
    const dim = DIMENSIONS.find((d) => d.dimension === dimension);
    return dim ? dim.weight : 0;
  };

  const getDimScore = (userId: string, dimension: string, scoreList: EvalScore[]) => {
    const entry = scoreList.find((s) => s.user_id === userId && s.dimension === dimension);
    return entry ? parseFloat(entry.score) : 0;
  };

  const getWeightedTotal = (userId: string, scoreList: EvalScore[]) => {
    return DIMENSIONS.reduce((sum, dim) => {
      const s = getDimScore(userId, dim.dimension, scoreList);
      const w = getWeight(dim.dimension);
      return sum + (s * w) / 100;
    }, 0);
  };

  const visibleUsers = useMemo(() => {
    if (isCeo || currentUser.role === "admin") return allUsers;
    if (currentUser.role === "head") return allUsers.filter((u) => (u.dept_id && u.dept_id === currentUser.dept_id) || u.dept === currentUser.dept);
    return [];
  }, [allUsers, currentUser, isCeo]);

  const rankedUsers = useMemo(() => {
    const withTotals = visibleUsers.map((u) => ({
      user: u,
      total: getWeightedTotal(u.id, scores),
      prevTotal: prevPeriodId ? getWeightedTotal(u.id, prevScores) : null,
      dims: DIMENSIONS.map((dim) => ({
        dimension: dim.dimension,
        label: dim.label,
        score: getDimScore(u.id, dim.dimension, scores),
        prevScore: prevPeriodId ? getDimScore(u.id, dim.dimension, prevScores) : null,
      })),
    }));

    withTotals.sort((a, b) => b.total - a.total);
    const ranked = withTotals.map((item, idx) => ({ ...item, rank: idx + 1 }));

    if (sortCol !== "total" && sortCol !== "rank") {
      ranked.sort((a, b) => {
        const dimA = a.dims.find((d) => d.dimension === sortCol);
        const dimB = b.dims.find((d) => d.dimension === sortCol);
        const valA = dimA?.score ?? 0;
        const valB = dimB?.score ?? 0;
        return sortAsc ? valA - valB : valB - valA;
      });
    } else {
      if (sortAsc) ranked.reverse();
    }

    return ranked;
  }, [visibleUsers, scores, prevScores, prevPeriodId, sortCol, sortAsc, rules]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  const getTrend = (current: number, prev: number | null) => {
    if (prev === null) return "—";
    if (current > prev + 0.5) return "↑";
    if (current < prev - 0.5) return "↓";
    return "→";
  };

  const getTrendColor = (trend: string) => {
    if (trend === "↑") return "text-green-600 dark:text-green-400";
    if (trend === "↓") return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  const deptChartData = useMemo(() => {
    if (!departments || departments.length === 0) return [];
    return departments.map((dept) => {
      const deptUsers = allUsers.filter((u) => u.dept === dept.name || u.dept_id === dept.id);
      if (deptUsers.length === 0) return null;
      const entry: Record<string, any> = { name: dept.name };
      for (const dim of DIMENSIONS) {
        const avg =
          deptUsers.reduce((sum, u) => sum + (getDimScore(u.id, dim.dimension, scores) * getWeight(dim.dimension)) / 100, 0) /
          deptUsers.length;
        entry[dim.dimension] = parseFloat(avg.toFixed(1));
      }
      entry.userCount = deptUsers.length;
      return entry;
    }).filter(Boolean);
  }, [departments, allUsers, scores, rules]);

  if (publishedPeriods.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12" data-testid="text-no-published">
        暂无已发布的考核数据
      </p>
    );
  }

  const sortIndicator = (col: string) => {
    if (sortCol !== col) return "";
    return sortAsc ? " ▲" : " ▼";
  };

  const columns = [
    { key: "rank", label: "排名" },
    { key: "name", label: "姓名" },
    { key: "dept", label: "部门" },
    { key: "total", label: "加权总分" },
    { key: "timeliness", label: "按时率" },
    { key: "overdue", label: "逾期" },
    { key: "quality", label: "质量" },
    { key: "response", label: "响应" },
    { key: "collaboration", label: "协作" },
    { key: "subtask", label: "子任务" },
    { key: "trend", label: "趋势" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground shrink-0">选择周期:</span>
        <Select value={selectedPeriodId ?? ""} onValueChange={setSelectedPeriodId}>
          <SelectTrigger className="w-64" data-testid="select-dashboard-period">
            <SelectValue placeholder="选择考核周期" />
          </SelectTrigger>
          <SelectContent>
            {publishedPeriods.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="p-0 overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left p-3 text-muted-foreground font-medium cursor-pointer select-none whitespace-nowrap"
                    onClick={() => col.key !== "name" && col.key !== "dept" && col.key !== "trend" && handleSort(col.key)}
                    data-testid={`th-${col.key}`}
                  >
                    {col.label}{col.key !== "name" && col.key !== "dept" && col.key !== "trend" ? sortIndicator(col.key) : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rankedUsers.map((item) => {
                const isExpanded = expandedUserId === item.user.id;
                const trend = getTrend(item.total, item.prevTotal);
                return (
                  <Fragment key={item.user.id}>
                    <tr
                      className="border-b last:border-b-0 hover-elevate cursor-pointer"
                      onClick={() => setExpandedUserId(isExpanded ? null : item.user.id)}
                      data-testid={`row-eval-rank-${item.user.id}`}
                    >
                      <td className="p-3 font-medium">{item.rank}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.user.color ?? "#888" }}
                          />
                          {item.user.name}
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{item.user.dept ?? "-"}</td>
                      <td className="p-3">
                        <span className={cn("font-bold", getScoreColor(item.total))} data-testid={`text-eval-total-${item.user.id}`}>
                          {item.total.toFixed(1)}
                        </span>
                      </td>
                      {DIMENSIONS.map((dim) => {
                        const d = item.dims.find((x) => x.dimension === dim.dimension);
                        return (
                          <td key={dim.dimension} className="p-3">
                            <span className={cn("text-xs", getScoreColor(d?.score ?? 0))}>
                              {d && d.score > 0 ? d.score.toFixed(0) : "-"}
                            </span>
                          </td>
                        );
                      })}
                      <td className="p-3">
                        <span className={cn("font-medium", getTrendColor(trend))}>{trend}</span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={columns.length} className="p-4 bg-muted/30">
                          <div className="flex flex-col items-center gap-2">
                            <ResponsiveContainer width="100%" height={300}>
                              <RadarChart data={item.dims.map((d) => ({
                                subject: d.label,
                                current: d.score,
                                previous: d.prevScore ?? undefined,
                              }))}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                                <Radar name="当前周期" dataKey="current" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                                {prevPeriodId && (
                                  <Radar name="上一周期" dataKey="previous" stroke="#9CA3AF" fill="none" strokeDasharray="5 5" />
                                )}
                                <Legend />
                              </RadarChart>
                            </ResponsiveContainer>
                            <p className="text-sm text-muted-foreground">
                              综合 <span className={cn("font-bold", getScoreColor(item.total))}>{item.total.toFixed(1)}</span> 分，排名 {item.rank}/{rankedUsers.length}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {deptChartData.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium" data-testid="text-dept-comparison-title">部门对比</h3>
          <Card className="p-4 overflow-visible">
            <BarContainer width="100%" height={350}>
              <BarChart data={deptChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <BarLegend />
                {DIMENSIONS.map((dim) => (
                  <Bar
                    key={dim.dimension}
                    dataKey={dim.dimension}
                    name={dim.label}
                    stackId="a"
                    fill={DIMENSION_COLORS[dim.dimension]}
                  />
                ))}
              </BarChart>
            </BarContainer>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function Evaluation() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  if (!user) {
    setLocation("/");
    return null;
  }

  const isCeo = user.role === "ceo";
  const isAllowed = user.role === "ceo" || user.role === "admin" || user.role === "head";

  if (!isAllowed) {
    setLocation("/dashboard");
    return null;
  }

  const { data: periods, isLoading: periodsLoading } = useQuery<EvalPeriod[]>({
    queryKey: ["/api/eval/periods"],
  });

  const { data: periodDetail, isLoading: detailLoading } = useQuery<PeriodDetailData>({
    queryKey: ["/api/eval/periods", selectedPeriodId],
    enabled: !!selectedPeriodId,
  });

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/eval/periods/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/eval/periods"] });
      toast({ title: "状态已更新" });
    },
    onError: (err: Error) => {
      toast({ title: "更新失败", description: err.message, variant: "destructive" });
    },
  });

  const users = allUsers ?? [];

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-3 border-b bg-background" data-testid="header-evaluation">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button size="icon" variant="ghost" data-testid="button-back">
              <ArrowLeft />
            </Button>
          </Link>
          <h1 className="text-lg font-bold tracking-tight" data-testid="text-page-title">绩效考核</h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: user.color ?? "#888" }}
          />
          <span className="text-sm font-medium" data-testid="text-username">{user.name}</span>
        </div>
      </header>

      <Tabs defaultValue="periods" className="flex flex-col flex-1 min-h-0">
        <div className="px-4 pt-3">
          <TabsList data-testid="tabs-eval">
            <TabsTrigger value="periods" data-testid="tab-periods">考核周期</TabsTrigger>
            {isCeo && <TabsTrigger value="rules" data-testid="tab-rules">规则设置</TabsTrigger>}
            <TabsTrigger value="dashboard" data-testid="tab-eval-dashboard">数据看板</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="periods" className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">
                {periodsLoading ? "加载中..." : `共 ${periods?.length ?? 0} 个周期`}
              </span>
              {isCeo && (
                <Button size="sm" onClick={() => setShowCreateDialog(true)} data-testid="button-new-period">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  新建周期
                </Button>
              )}
            </div>

            {periodsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : !periods || periods.length === 0 ? (
              <p className="text-center text-muted-foreground py-12" data-testid="text-empty-periods">暂无考核周期</p>
            ) : (
              <div className="space-y-3">
                {periods.map((period) => {
                  const isSelected = selectedPeriodId === period.id;
                  const nextStatusLabel = getNextStatusLabel(period.status);

                  return (
                    <div key={period.id}>
                      <Card
                        className={cn("p-3 hover-elevate cursor-pointer", isSelected && "ring-2 ring-primary")}
                        onClick={() => setSelectedPeriodId(isSelected ? null : period.id)}
                        data-testid={`card-period-${period.id}`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                            <span className="text-sm font-medium" data-testid={`text-period-title-${period.id}`}>
                              {period.title}
                            </span>
                            <Badge
                              className={cn("no-default-active-elevate text-xs", getEvalStatusColor(period.status))}
                              variant="secondary"
                              data-testid={`badge-period-status-${period.id}`}
                            >
                              {getEvalStatusLabel(period.status)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {isCeo && nextStatusLabel && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={statusMutation.isPending}
                                onClick={() => {
                                  const next = getNextStatus(period.status);
                                  if (next) statusMutation.mutate({ id: period.id, status: next });
                                }}
                                data-testid={`button-advance-status-${period.id}`}
                              >
                                {statusMutation.isPending ? "处理中..." : `推进到${nextStatusLabel}`}
                              </Button>
                            )}
                            <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", isSelected && "rotate-90")} />
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>{period.start_date} ~ {period.end_date}</span>
                          {period.scoring_deadline && <span>打分截止: {period.scoring_deadline}</span>}
                          {period.type && <span>类型: {period.type === "monthly" ? "月度" : period.type === "quarterly" ? "季度" : "年度"}</span>}
                        </div>
                      </Card>

                      {isSelected && (
                        <div className="mt-3 ml-4 border-l-2 border-muted pl-4">
                          {detailLoading ? (
                            <div className="space-y-2 py-2">
                              <Skeleton className="h-12 w-full" />
                              <Skeleton className="h-12 w-full" />
                              <Skeleton className="h-12 w-full" />
                            </div>
                          ) : periodDetail ? (
                            <ScoringTable
                              periodId={period.id}
                              scores={periodDetail.scores}
                              rules={periodDetail.rules}
                              users={users}
                              allUsers={users}
                              isCeo={isCeo}
                              periodStatus={period.status}
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground py-4">无法加载数据</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {isCeo && (
          <TabsContent value="rules" className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-4">
              <RulesSettings />
            </div>
          </TabsContent>
        )}

        <TabsContent value="dashboard" className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4">
            {periodsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-60 w-full" />
              </div>
            ) : (
              <EvalDashboard
                periods={periods ?? []}
                allUsers={users}
                currentUser={{ id: user.id, role: user.role, dept: user.dept ?? null, dept_id: user.dept_id ?? null }}
                isCeo={isCeo}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>

      <CreatePeriodDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  );
}
