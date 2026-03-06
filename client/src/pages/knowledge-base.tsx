import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Upload, FileText, Trash2, RefreshCw, Eye, EyeOff,
  BookOpen, AlertCircle, CheckCircle, Loader2, ShieldAlert,
  FileUp, X
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
      return <Badge className="bg-green-600 hover:bg-green-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />已就绪</Badge>;
    case 'processing':
      return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />处理中</Badge>;
    case 'pending':
      return <Badge variant="secondary">待处理</Badge>;
    case 'error':
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />出错</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function FileTypeIcon({ type }: { type: string }) {
  const colorClass = type === 'pdf' ? 'text-red-500' : type === 'docx' ? 'text-blue-500' : 'text-muted-foreground';
  return <FileText className={`w-8 h-8 ${colorClass}`} />;
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
            <span className="text-xs text-muted-foreground font-mono">片段 #{chunk.chunkIndex + 1}</span>
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

  const stats = {
    total: documents.length,
    ready: documents.filter((d: any) => d.status === 'ready').length,
    processing: documents.filter((d: any) => d.status === 'processing' || d.status === 'pending').length,
    error: documents.filter((d: any) => d.status === 'error').length,
  };

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
      toast({ title: '上传成功', description: '文档正在处理中...' });
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
    onError: (err: Error) => {
      toast({ title: '处理失败', description: err.message, variant: 'destructive' });
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
    <div className="flex-1 overflow-y-auto p-6 space-y-6" data-testid="kb-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-foreground" />
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-kb-title">知识库管理</h1>
        </div>
        <Button onClick={() => setUploadOpen(true)} data-testid="button-upload-doc">
          <Upload className="w-4 h-4 mr-2" />
          上传文档
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="kb-stats">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">总文档</div>
            <div className="text-2xl font-bold text-foreground" data-testid="text-stat-total">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">已就绪</div>
            <div className="text-2xl font-bold text-green-500" data-testid="text-stat-ready">{stats.ready}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">处理中</div>
            <div className="text-2xl font-bold text-yellow-500" data-testid="text-stat-processing">{stats.processing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">出错</div>
            <div className="text-2xl font-bold text-destructive" data-testid="text-stat-error">{stats.error}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-category">
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
          <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
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
        <div className="space-y-3" data-testid="kb-document-list">
          {filteredDocs.map((doc: any) => {
            const isExpanded = expandedDocId === doc.id;
            return (
              <Card key={doc.id} data-testid={`card-document-${doc.id}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileTypeIcon type={doc.fileType} />
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground truncate" data-testid={`text-doc-title-${doc.id}`}>{doc.title}</h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {doc.fileName} · {formatFileSize(doc.fileSize)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <span>{getCategoryLabel(doc.category)}</span>
                    <span>·</span>
                    <span>{getVisibilityLabel(doc.visibility)}</span>
                    <span>·</span>
                    <span>{doc.chunkCount} 个片段</span>
                    <span>·</span>
                    <span>{formatDate(doc.createdAt)}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {doc.status === 'ready' && (
                      <Button variant="ghost" size="sm" onClick={() => setExpandedDocId(isExpanded ? null : doc.id)} data-testid={`button-view-chunks-${doc.id}`}>
                        {isExpanded ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                        {isExpanded ? '收起' : '查看片段'}
                      </Button>
                    )}
                    {(doc.status === 'error' || doc.status === 'ready') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => reprocessMutation.mutate(doc.id)}
                        disabled={reprocessMutation.isPending}
                        data-testid={`button-reprocess-${doc.id}`}
                      >
                        <RefreshCw className={`w-4 h-4 mr-1 ${reprocessMutation.isPending ? 'animate-spin' : ''}`} />
                        重新处理
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('确定删除这份文档？关联的所有知识片段也会被删除。')) {
                          deleteMutation.mutate(doc.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${doc.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      删除
                    </Button>
                  </div>

                  {isExpanded && <ChunkPreview documentId={doc.id} />}

                  {doc.status === 'error' && doc.errorMessage && (
                    <div className="text-sm text-destructive flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{doc.errorMessage}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={(open) => { if (!open) resetUploadForm(); else setUploadOpen(true); }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-upload">
          <DialogHeader>
            <DialogTitle>上传知识库文档</DialogTitle>
          </DialogHeader>
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
                <p className="text-xs text-muted-foreground mt-1">支持 PDF / Word / Excel / PPT / TXT / CSV / HTML / MD / RTF / JSON，最大 50MB</p>
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
              <Input
                id="upload-title"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="输入文档标题"
                data-testid="input-upload-title"
              />
            </div>

            <div className="space-y-2">
              <Label>分类</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger data-testid="select-upload-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>可见范围</Label>
              <Select value={uploadVisibility} onValueChange={setUploadVisibility}>
                <SelectTrigger data-testid="select-upload-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY.map(v => (
                    <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetUploadForm} data-testid="button-cancel-upload">取消</Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploadMutation.isPending}
                data-testid="button-confirm-upload"
              >
                {uploadMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                确认上传
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
