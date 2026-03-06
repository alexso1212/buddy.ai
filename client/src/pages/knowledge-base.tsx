import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import SetupConfirmModal from '@/components/SetupConfirmModal';
import {
  Upload, FileText, Trash2, RefreshCw, Eye, EyeOff,
  BookOpen, AlertCircle, CheckCircle, Loader2, ShieldAlert,
  FileUp, X, Sparkles, AlertTriangle, Brain, Star,
  SquareCheck
} from 'lucide-react';

const CATEGORIES = [
  { value: 'org_chart', label: '组织架构' },
  { value: 'roster', label: '花名册' },
  { value: 'jd', label: '岗位说明' },
  { value: 'contract', label: '劳动合同' },
  { value: 'kpi', label: '考核标准' },
  { value: 'policy', label: '规章制度' },
  { value: 'handbook', label: '员工手册' },
  { value: 'sop', label: '操作流程' },
  { value: 'product', label: '产品' },
  { value: 'sales', label: '销售' },
  { value: 'project', label: '项目' },
  { value: 'finance', label: '财务' },
  { value: 'legal', label: '法务' },
  { value: 'marketing', label: '市场' },
  { value: 'brand', label: '品牌' },
  { value: 'technical', label: '技术' },
  { value: 'general', label: '其他' },
];

const VISIBILITY = [
  { value: 'org', label: '全组织' },
  { value: 'department', label: '指定部门' },
  { value: 'admin', label: '仅管理层' },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

function getCategoryLabel(category: string): string {
  const found = CATEGORIES.find(c => c.value === category);
  return found?.label || category;
}

function getVisibilityLabel(visibility: string): string {
  const map: Record<string, string> = { org: '全组织', department: '指定部门', admin: '仅管理层' };
  return map[visibility] || visibility;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'ready':
      return <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs"><CheckCircle className="w-3 h-3 mr-1" />就绪</Badge>;
    case 'processing':
      return <Badge variant="secondary" className="text-xs"><Loader2 className="w-3 h-3 mr-1 animate-spin" />处理中</Badge>;
    case 'pending':
      return <Badge variant="secondary" className="text-xs">待处理</Badge>;
    case 'error':
      return <Badge variant="destructive" className="text-xs"><AlertCircle className="w-3 h-3 mr-1" />出错</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

function OrgRelevanceBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null;
  if (score >= 4) return <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"><Star className="w-3 h-3 mr-0.5 fill-current" />组织 {score}/5</Badge>;
  if (score >= 3) return <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-500 border-amber-200 dark:border-amber-800">组织 {score}/5</Badge>;
  return null;
}

function SensitivityBadge({ sensitivity }: { sensitivity: string | null }) {
  if (sensitivity !== 'high') return null;
  return <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"><AlertTriangle className="w-3 h-3 mr-0.5" />敏感</Badge>;
}

function FileTypeIcon({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    pdf: 'text-red-500', docx: 'text-blue-500', doc: 'text-blue-500',
    xlsx: 'text-green-600', xls: 'text-green-600', csv: 'text-green-600',
    pptx: 'text-orange-500', html: 'text-purple-500', json: 'text-yellow-600',
  };
  return <FileText className={`w-7 h-7 ${colorMap[type] || 'text-muted-foreground'}`} />;
}

function ChunkPreview({ documentId }: { documentId: number }) {
  const { data, isLoading } = useQuery<{ data: any[] }>({
    queryKey: ['/api/kb/documents', documentId, 'chunks'],
  });
  const chunks = data?.data;
  if (isLoading) return <div className="text-sm text-muted-foreground p-2">加载中...</div>;
  if (!chunks || chunks.length === 0) return <div className="text-sm text-muted-foreground p-2">暂无片段</div>;
  return (
    <div className="space-y-2 mt-2 max-h-96 overflow-y-auto" data-testid="chunk-preview-list">
      {chunks.map((chunk: any) => (
        <div key={chunk.id} className="text-sm p-3 rounded bg-muted/50 border" data-testid={`chunk-item-${chunk.id}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground font-mono">#{chunk.chunkIndex + 1}</span>
            <span className="text-xs text-muted-foreground">{chunk.tokenCount} tokens</span>
          </div>
          <p className="whitespace-pre-wrap line-clamp-4">{chunk.content}</p>
        </div>
      ))}
    </div>
  );
}

export default function KnowledgeBase() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('general');
  const [uploadVisibility, setUploadVisibility] = useState('org');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedDocId, setExpandedDocId] = useState<number | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalKey, setConfirmModalKey] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<{ profile: any; extractedFiles: any[] } | null>(null);

  const userRole = user?.role || 'member';
  const isAdminOrOwner = ['owner', 'admin'].includes(userRole);

  const { data: docsData, isLoading } = useQuery<{ data: any[] }>({
    queryKey: ['/api/kb/documents'],
    refetchInterval: 5000,
  });

  const documents = docsData?.data || [];

  const filteredDocs = documents.filter((doc: any) => {
    if (filterCategory !== 'all' && doc.category !== filterCategory) return false;
    if (filterStatus !== 'all' && doc.status !== filterStatus) return false;
    return true;
  });

  const stats = useMemo(() => {
    const total = documents.length;
    const ready = documents.filter((d: any) => d.status === 'ready').length;
    const processing = documents.filter((d: any) => d.status === 'processing' || d.status === 'pending').length;
    const error = documents.filter((d: any) => d.status === 'error').length;
    const orgRelevant = documents.filter((d: any) => (d.orgRelevance || 0) >= 3).length;
    const classified = documents.filter((d: any) => d.orgRelevance !== null && d.orgRelevance !== undefined).length;
    return { total, ready, processing, error, orgRelevant, classified };
  }, [documents]);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const token = localStorage.getItem('buddy_token');
      const res = await fetch('/api/kb/documents/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '上传失败' }));
        throw new Error(err.error || '上传失败');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kb/documents'] });
      toast({ title: '上传成功', description: '文档正在处理中，AI 将自动分类' });
      resetUploadForm();
    },
    onError: (err: Error) => {
      toast({ title: '上传失败', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      const token = localStorage.getItem('buddy_token');
      const res = await fetch(`/api/kb/documents/${docId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('删除失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kb/documents'] });
      toast({ title: '已删除' });
    },
    onError: (err: Error) => {
      toast({ title: '删除失败', description: err.message, variant: 'destructive' });
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: async (docId: number) => {
      const token = localStorage.getItem('buddy_token');
      const res = await fetch(`/api/kb/documents/${docId}/reprocess`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('重新处理失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kb/documents'] });
      toast({ title: '已开始重新处理' });
    },
  });

  const analyzeKbMutation = useMutation({
    mutationFn: async (documentIds: number[]) => {
      const res = await apiRequest('POST', '/api/setup/analyze-kb', { documentIds });
      return res.json();
    },
    onSuccess: (data) => {
      setAnalysisResult(data.data);
      setConfirmModalKey(prev => prev + 1);
      setConfirmModalOpen(true);
    },
    onError: (err: Error) => {
      toast({ title: '分析失败', description: err.message, variant: 'destructive' });
    },
  });

  function resetUploadForm() {
    setUploadOpen(false);
    setSelectedFile(null);
    setUploadTitle('');
    setUploadCategory('general');
    setUploadVisibility('org');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleUpload() {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', uploadTitle || selectedFile.name.replace(/\.[^/.]+$/, ''));
    formData.append('category', uploadCategory);
    formData.append('visibility', uploadVisibility);
    uploadMutation.mutate(formData);
  }

  function toggleDoc(docId: number) {
    setSelectedDocIds(prev => prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]);
  }

  function selectOrgRelevant() {
    const orgDocIds = documents
      .filter((d: any) => (d.orgRelevance || 0) >= 3 && (d.status === 'ready' || d.status === 'completed'))
      .map((d: any) => d.id);
    setSelectedDocIds(orgDocIds);
  }

  function startOrgAnalysis() {
    if (selectedDocIds.length === 0) {
      toast({ title: '请先选择文档', variant: 'destructive' });
      return;
    }
    analyzeKbMutation.mutate(selectedDocIds);
  }

  if (!isAdminOrOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground" data-testid="kb-no-permission">
        <ShieldAlert className="w-16 h-16" />
        <h2 className="text-xl font-medium text-foreground">无权访问</h2>
        <p>知识库管理仅限管理员和所有者使用</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5" data-testid="kb-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-foreground" />
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-kb-title">知识库</h1>
        </div>
        <Button onClick={() => setUploadOpen(true)} data-testid="button-upload-doc">
          <Upload className="w-4 h-4 mr-2" />
          上传文档
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="kb-stats">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">总文档</div>
            <div className="text-xl font-bold text-foreground" data-testid="text-stat-total">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">已就绪</div>
            <div className="text-xl font-bold text-green-500" data-testid="text-stat-ready">{stats.ready}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">处理中</div>
            <div className="text-xl font-bold text-yellow-500" data-testid="text-stat-processing">{stats.processing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">出错</div>
            <div className="text-xl font-bold text-destructive" data-testid="text-stat-error">{stats.error}</div>
          </CardContent>
        </Card>
      </div>

      {stats.classified > 0 && (
        <Card className="border-[#B4886B]/20 bg-[#B4886B]/5 dark:bg-[#B4886B]/10" data-testid="ai-insight-bar">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#B4886B]/10 flex items-center justify-center flex-shrink-0">
                  <Brain className="w-5 h-5 text-[#B4886B]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">AI 智能分类</p>
                  <p className="text-xs text-muted-foreground">
                    已分类 {stats.classified} 个文档
                    {stats.orgRelevant > 0 && (
                      <span className="ml-1"> · <span className="text-[#B4886B] font-medium">{stats.orgRelevant} 个高价值组织文件</span></span>
                    )}
                  </p>
                </div>
              </div>
              {stats.orgRelevant > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[#B4886B] border-[#B4886B]/30 hover:bg-[#B4886B]/10 text-xs"
                  onClick={() => {
                    selectOrgRelevant();
                    toast({ title: `已选择 ${stats.orgRelevant} 个组织相关文档` });
                  }}
                  data-testid="button-select-org-relevant"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  运行组织分析
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[130px]" data-testid="select-filter-category">
            <SelectValue placeholder="全部分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px]" data-testid="select-filter-status">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="ready">已就绪</SelectItem>
            <SelectItem value="processing">处理中</SelectItem>
            <SelectItem value="pending">待处理</SelectItem>
            <SelectItem value="error">出错</SelectItem>
          </SelectContent>
        </Select>

        {filteredDocs.length > 0 && (
          <p className="text-xs text-muted-foreground ml-auto">
            {filteredDocs.length === documents.length ? `${documents.length} 个文档` : `${filteredDocs.length} / ${documents.length} 个文档`}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          加载中...
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3" data-testid="kb-empty">
          <FileText className="w-12 h-12" />
          <p>{documents.length === 0 ? '暂无文档，点击上方按钮上传' : '没有匹配的文档'}</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="kb-document-list">
          {filteredDocs.map((doc: any) => {
            const isExpanded = expandedDocId === doc.id;
            const isSelected = selectedDocIds.includes(doc.id);
            const isClassified = doc.orgRelevance !== null && doc.orgRelevance !== undefined;
            const isReady = doc.status === 'ready' || doc.status === 'completed';
            return (
              <Card key={doc.id} className={`transition-colors ${isSelected ? 'ring-2 ring-[#B4886B]/40 bg-[#B4886B]/5 dark:bg-[#B4886B]/10' : ''}`} data-testid={`card-document-${doc.id}`}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    {isReady && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleDoc(doc.id)}
                        className="flex-shrink-0"
                        data-testid={`checkbox-doc-${doc.id}`}
                      />
                    )}
                    <FileTypeIcon type={doc.fileType} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground truncate text-sm" data-testid={`text-doc-title-${doc.id}`}>{doc.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {doc.fileName} · {formatFileSize(doc.fileSize)} · {formatDate(doc.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                      {isClassified && (
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(doc.category)}
                        </Badge>
                      )}
                      {!isClassified && doc.category !== 'general' && (
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(doc.category)}
                        </Badge>
                      )}
                      <OrgRelevanceBadge score={doc.orgRelevance} />
                      <SensitivityBadge sensitivity={doc.sensitivity} />
                      <StatusBadge status={doc.status} />
                    </div>
                  </div>

                  {isClassified && doc.aiSummary && (
                    <div className="flex items-center gap-2 ml-10 text-xs text-muted-foreground">
                      <Sparkles className="w-3 h-3 text-[#B4886B] flex-shrink-0" />
                      <span className="truncate">{doc.aiSummary}</span>
                      <span className="flex-shrink-0">· {getVisibilityLabel(doc.visibility)}</span>
                      <span className="flex-shrink-0">· {doc.chunkCount} 片段</span>
                    </div>
                  )}

                  {!isClassified && (
                    <div className="flex items-center gap-2 ml-10 text-xs text-muted-foreground">
                      <span>{getVisibilityLabel(doc.visibility)}</span>
                      <span>·</span>
                      <span>{doc.chunkCount} 个片段</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 ml-10 flex-wrap">
                    {doc.status === 'ready' && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setExpandedDocId(isExpanded ? null : doc.id)} data-testid={`button-view-chunks-${doc.id}`}>
                        {isExpanded ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                        {isExpanded ? '收起' : '片段'}
                      </Button>
                    )}
                    {(doc.status === 'error' || doc.status === 'ready') && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => reprocessMutation.mutate(doc.id)} disabled={reprocessMutation.isPending} data-testid={`button-reprocess-${doc.id}`}>
                        <RefreshCw className={`w-3.5 h-3.5 mr-1 ${reprocessMutation.isPending ? 'animate-spin' : ''}`} />
                        重新处理
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('确定删除这份文档？关联的所有知识片段也会被删除。')) {
                          deleteMutation.mutate(doc.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${doc.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      删除
                    </Button>
                  </div>

                  {isExpanded && <ChunkPreview documentId={doc.id} />}

                  {doc.status === 'error' && doc.errorMessage && (
                    <div className="text-xs text-destructive flex items-center gap-2 ml-10">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{doc.errorMessage}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedDocIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50" data-testid="floating-action-bar">
          <Card className="shadow-lg border-[#B4886B]/30">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <SquareCheck className="w-4 h-4 text-[#B4886B]" />
                <span className="font-medium">已选 {selectedDocIds.length} 个文档</span>
              </div>
              <div className="w-px h-6 bg-border" />
              <Button
                size="sm"
                className="bg-[#B4886B] hover:bg-[#A07A5F] text-white text-xs"
                onClick={startOrgAnalysis}
                disabled={analyzeKbMutation.isPending}
                data-testid="button-start-org-analysis"
              >
                {analyzeKbMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> AI 分析中...</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> AI 组织分析</>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setSelectedDocIds([])}
                data-testid="button-clear-selection"
              >
                取消选择
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={(open) => { if (!open) resetUploadForm(); else setUploadOpen(true); }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-upload">
          <DialogHeader>
            <DialogTitle>上传文档</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">上传后 AI 将自动分类并评估文档价值</p>
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.docx,.doc,.txt,.md,.xlsx,.xls,.csv,.pptx,.html,.htm,.rtf,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setSelectedFile(file);
                  setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
                }
              }}
              data-testid="input-file"
            />

            {!selectedFile ? (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone"
              >
                <FileUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">点击选择文件</p>
                <p className="text-xs text-muted-foreground mt-1">支持 PDF / Word / Excel / PPT / TXT / CSV / HTML / MD / RTF / JSON</p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" data-testid="text-selected-file">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} data-testid="button-clear-file">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="upload-title">文档标题</Label>
              <Input id="upload-title" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="输入文档标题" data-testid="input-upload-title" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>分类 <span className="text-xs text-muted-foreground font-normal">(AI 可覆盖)</span></Label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger data-testid="select-upload-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>可见范围</Label>
                <Select value={uploadVisibility} onValueChange={setUploadVisibility}>
                  <SelectTrigger data-testid="select-upload-visibility"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VISIBILITY.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetUploadForm} data-testid="button-cancel-upload">取消</Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploadMutation.isPending}
                data-testid="button-confirm-upload"
              >
                {uploadMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                上传
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {analysisResult && (
        <SetupConfirmModal
          key={confirmModalKey}
          open={confirmModalOpen}
          onClose={() => {
            setConfirmModalOpen(false);
            setAnalysisResult(null);
            setSelectedDocIds([]);
            queryClient.invalidateQueries({ queryKey: ['/api/kb/documents'] });
          }}
          initialProfile={analysisResult.profile}
          extractedFiles={analysisResult.extractedFiles}
        />
      )}
    </div>
  );
}
