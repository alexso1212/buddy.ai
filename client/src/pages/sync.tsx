import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, ArrowLeft, CheckCircle2, ClipboardPaste, Eye, Upload } from "lucide-react";

const EXAMPLE_JSON = JSON.stringify(
  {
    sync_date: "2026-02-21",
    sync_by: "alex",
    summary: "示例同步数据",
    updates: [
      {
        id: "t01",
        status: "done",
        note: "已完成，合同盘点表已归档",
      },
    ],
    new_tasks: [
      {
        title: "【AI知识库】阶段一验收",
        description: "完成AI知识库的第一阶段开发并验收",
        assignees: ["michael"],
        reviewer_id: "alex",
        deadline: "2026-02-18",
        grace_deadline: "2026-02-20",
        phase: "cny",
        priority: 1,
        deliverable: "验收通过/修改清单",
        status: "pending",
        depends_on: "t01,t02",
        subtasks: ["子任务1", "子任务2"],
      },
    ],
    new_comments: [
      {
        task_id: "t07",
        content: "初稿已审阅，需要修改细节",
      },
    ],
  },
  null,
  2
);

interface ValidatedUpdate {
  id: string;
  status?: string;
  note?: string;
  valid: boolean;
}

interface ValidatedNewTask {
  title: string;
  assignees: string[];
  deadline: string;
  phase?: string;
  valid: boolean;
  [key: string]: unknown;
}

interface ValidatedComment {
  task_id: string;
  content: string;
  valid: boolean;
}

interface ParsedData {
  updates: ValidatedUpdate[];
  new_tasks: ValidatedNewTask[];
  new_comments: ValidatedComment[];
  raw: Record<string, unknown>;
}

interface SyncResult {
  updated: number;
  created: number;
  commented: number;
  skipped: number;
  errors?: string[];
}

interface SyncHistoryEntry {
  id: number;
  sync_date?: string;
  sync_by?: string;
  summary?: string;
  updated?: number;
  created?: number;
  commented?: number;
  skipped?: number;
  created_at?: string;
}

export default function SyncPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [jsonText, setJsonText] = useState("");
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [results, setResults] = useState<SyncResult | null>(null);
  const [processing, setProcessing] = useState(false);

  const { data: history } = useQuery<SyncHistoryEntry[]>({
    queryKey: ["/api/sync/history"],
    enabled: !!user && user.role === "ceo",
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/");
    } else if (user.role !== "ceo") {
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);

  if (authLoading || !user || user.role !== "ceo") {
    return null;
  }

  function handlePasteExample() {
    setJsonText(EXAMPLE_JSON);
    setParsed(null);
    setResults(null);
  }

  function handleParsePreview() {
    try {
      const data = JSON.parse(jsonText);

      const updates: ValidatedUpdate[] = (data.updates || []).map(
        (u: Record<string, unknown>) => ({
          ...u,
          valid: !!u.id,
        })
      );

      const new_tasks: ValidatedNewTask[] = (data.new_tasks || []).map(
        (t: Record<string, unknown>) => ({
          ...t,
          valid:
            !!t.title &&
            Array.isArray(t.assignees) &&
            (t.assignees as string[]).length > 0 &&
            !!t.deadline,
        })
      );

      const new_comments: ValidatedComment[] = (data.new_comments || []).map(
        (c: Record<string, unknown>) => ({
          ...c,
          valid: !!c.task_id && !!c.content,
        })
      );

      setParsed({ updates, new_tasks, new_comments, raw: data });
      setResults(null);

      toast({
        title: "解析成功",
        description: `${updates.length} 条更新, ${new_tasks.length} 条新任务, ${new_comments.length} 条评论`,
      });
    } catch {
      toast({
        title: "JSON 格式错误",
        description: "请检查 JSON 格式是否正确",
        variant: "destructive",
      });
    }
  }

  async function handleSync() {
    if (!parsed) return;
    setProcessing(true);
    try {
      const res = await apiRequest("POST", "/api/sync", parsed.raw);
      const data: SyncResult = await res.json();
      setResults(data);
      setParsed(null);
      setJsonText("");

      await queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/sync/history"] });

      toast({
        title: "同步完成",
        description: `更新 ${data.updated}, 创建 ${data.created}, 评论 ${data.commented}, 跳过 ${data.skipped}`,
      });
    } catch (err) {
      toast({
        title: "同步失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" />
            <h1 className="text-[13px] md:text-base font-medium" data-testid="text-page-title">
              JSON 同步
            </h1>
          </div>
        </div>

        <Card className="rounded-lg border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-medium">输入 JSON 数据</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              data-testid="input-json"
              rows={16}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder="在此粘贴 JSON 数据..."
              className="font-mono text-sm"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={handlePasteExample}
                data-testid="button-paste-example"
                className="bg-white dark:bg-card border-gray-300 dark:border-border"
              >
                <ClipboardPaste />
                粘贴示例
              </Button>
              <Button
                onClick={handleParsePreview}
                disabled={!jsonText.trim()}
                data-testid="button-parse"
                className="bg-[#1C1C1C] text-white dark:bg-white dark:text-black"
              >
                <Eye />
                解析预览
              </Button>
            </div>
          </CardContent>
        </Card>

        {parsed && (
          <div className="space-y-4" data-testid="section-preview">
            {parsed.updates.length > 0 && (
              <Card className="rounded-lg border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
                    更新任务
                    <Badge variant="secondary" className="rounded-full text-xs font-medium border-0">{parsed.updates.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>备注</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.updates.map((u, i) => (
                        <TableRow
                          key={i}
                          className={!u.valid ? "bg-yellow-50 dark:bg-yellow-950/30" : ""}
                          data-testid={`row-update-${i}`}
                        >
                          <TableCell className="font-mono">{u.id || "-"}</TableCell>
                          <TableCell>
                            {u.status ? (
                              <Badge variant="outline" className="rounded-full text-xs font-medium border-0">{u.status}</Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {u.note || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {parsed.new_tasks.length > 0 && (
              <Card className="rounded-lg border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
                    新建任务
                    <Badge variant="secondary" className="rounded-full text-xs font-medium border-0">{parsed.new_tasks.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>标题</TableHead>
                        <TableHead>负责人</TableHead>
                        <TableHead>截止日期</TableHead>
                        <TableHead>阶段</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.new_tasks.map((t, i) => (
                        <TableRow
                          key={i}
                          className={!t.valid ? "bg-yellow-50 dark:bg-yellow-950/30" : ""}
                          data-testid={`row-new-task-${i}`}
                        >
                          <TableCell>{t.title || "-"}</TableCell>
                          <TableCell>
                            {Array.isArray(t.assignees)
                              ? (t.assignees as string[]).join(", ")
                              : "-"}
                          </TableCell>
                          <TableCell>{t.deadline || "-"}</TableCell>
                          <TableCell>
                            {t.phase ? (
                              <Badge variant="outline" className="rounded-full text-xs font-medium border-0">{t.phase as string}</Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {parsed.new_comments.length > 0 && (
              <Card className="rounded-lg border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
                    新建评论
                    <Badge variant="secondary" className="rounded-full text-xs font-medium border-0">{parsed.new_comments.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>任务 ID</TableHead>
                        <TableHead>内容</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.new_comments.map((c, i) => (
                        <TableRow
                          key={i}
                          className={!c.valid ? "bg-yellow-50 dark:bg-yellow-950/30" : ""}
                          data-testid={`row-comment-${i}`}
                        >
                          <TableCell className="font-mono">
                            {c.task_id || "-"}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {c.content || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <Button
              onClick={handleSync}
              disabled={processing}
              data-testid="button-sync"
              className="w-full bg-[#1C1C1C] text-white dark:bg-white dark:text-black"
            >
              <Upload />
              {processing ? "同步中..." : "确认同步"}
            </Button>
          </div>
        )}

        {results && (
          <Card className="rounded-lg border shadow-sm" data-testid="section-results">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                同步结果
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center" data-testid="result-updated">
                  <div className="text-2xl font-semibold">{results.updated}</div>
                  <div className="text-xs text-muted-foreground">已更新</div>
                </div>
                <div className="text-center" data-testid="result-created">
                  <div className="text-2xl font-semibold">{results.created}</div>
                  <div className="text-xs text-muted-foreground">已创建</div>
                </div>
                <div className="text-center" data-testid="result-commented">
                  <div className="text-2xl font-semibold">{results.commented}</div>
                  <div className="text-xs text-muted-foreground">已评论</div>
                </div>
                <div className="text-center" data-testid="result-skipped">
                  <div className="text-2xl font-semibold">{results.skipped}</div>
                  <div className="text-xs text-muted-foreground">已跳过</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-lg border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium">同步历史</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {history && history.length > 0 ? (
                <div className="divide-y">
                  {history.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="py-3 first:pt-0 last:pb-0" data-testid={`card-history-${entry.id}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {entry.summary || "同步操作"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {entry.created_at
                            ? new Date(entry.created_at).toLocaleString("zh-CN")
                            : entry.sync_date || "-"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground mt-1">
                        {entry.sync_by && <span>操作人: {entry.sync_by}</span>}
                        {entry.updated !== undefined && (
                          <span>更新: {entry.updated}</span>
                        )}
                        {entry.created !== undefined && (
                          <span>创建: {entry.created}</span>
                        )}
                        {entry.commented !== undefined && (
                          <span>评论: {entry.commented}</span>
                        )}
                        {entry.skipped !== undefined && (
                          <span>跳过: {entry.skipped}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="text-center text-sm text-muted-foreground py-8"
                  data-testid="text-no-history"
                >
                  暂无同步记录
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
