import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2, Users, BookOpen, UserRoundPlus, FileText,
  Plus, Trash2, X, Loader2, Check, Star, AlertTriangle,
  FolderOpen, Sparkles
} from 'lucide-react';

interface FileAnalysis {
  fileName: string;
  category: string;
  orgRelevance: number;
  kbRelevance: number;
  sensitivity: string;
  summary: string;
  suggestedVisibility: string;
  suggestedDepartment?: string;
  mentionedDepartments: string[];
  mentionedRoles: string[];
  mentionedNames: string[];
}

const categoryLabels: Record<string, string> = {
  org_chart: '组织架构', roster: '花名册', jd: '岗位说明', contract: '劳动合同',
  kpi: '考核标准', policy: '规章制度', handbook: '员工手册', sop: '操作流程',
  product: '产品', sales: '销售', project: '项目', finance: '财务',
  legal: '法务', marketing: '市场', brand: '品牌', technical: '技术', general: '其他',
};

const visibilityLabels: Record<string, string> = {
  org: '全员可见', admin: '管理层可见', department: '部门可见',
};

interface DeptChild { name: string; description: string; }
interface DeptItem { name: string; description: string; children?: DeptChild[]; }
interface JobRoleItem { title: string; departmentName: string; responsibilities: string; boundaries: string; requiredSkills: string; }
interface ExtractedMember {
  fullName: string; aliases: string[]; departmentName: string; jobRoleTitle: string;
  employeeId: string; phone: string; email: string; title: string; hireDate: string; contractHighlights: string;
}

interface EnterpriseProfile {
  companyName: string;
  companyDescription: string;
  departments: DeptItem[];
  jobRoles: JobRoleItem[];
  members: ExtractedMember[];
  fileClassifications: FileAnalysis[];
  analyzedFileCount?: number;
  totalFileCount?: number;
}

interface ConfirmResult {
  updatedOrg: boolean;
  departmentsCreated: number;
  jobRolesCreated: number;
  documentsCreated: number;
  membersCreated: number;
}

interface SetupConfirmModalProps {
  open: boolean;
  onClose: () => void;
  initialProfile: EnterpriseProfile;
  extractedFiles: any[];
}

export default function SetupConfirmModal({ open, onClose, initialProfile, extractedFiles }: SetupConfirmModalProps) {
  const { toast } = useToast();
  const [profile, setProfile] = useState<EnterpriseProfile>(initialProfile);
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [step, setStep] = useState<'confirm' | 'complete'>('confirm');

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/setup/confirm', { profile, extractedFiles });
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data.data);
      setStep('complete');
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-roles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/kb/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member-profiles'] });
    },
    onError: (err: Error) => {
      toast({ title: '应用失败', description: err.message, variant: 'destructive' });
    },
  });

  const updateDeptName = (idx: number, name: string) => {
    const depts = [...profile.departments];
    depts[idx] = { ...depts[idx], name };
    setProfile({ ...profile, departments: depts });
  };

  const updateDeptDesc = (idx: number, description: string) => {
    const depts = [...profile.departments];
    depts[idx] = { ...depts[idx], description };
    setProfile({ ...profile, departments: depts });
  };

  const removeDept = (idx: number) => {
    setProfile({ ...profile, departments: profile.departments.filter((_, i) => i !== idx) });
  };

  const addDept = () => {
    setProfile({ ...profile, departments: [...profile.departments, { name: '', description: '', children: [] }] });
  };

  const removeChildDept = (parentIdx: number, childIdx: number) => {
    const depts = [...profile.departments];
    const parent = { ...depts[parentIdx] };
    parent.children = (parent.children || []).filter((_, i) => i !== childIdx);
    depts[parentIdx] = parent;
    setProfile({ ...profile, departments: depts });
  };

  const addChildDept = (parentIdx: number) => {
    const depts = [...profile.departments];
    const parent = { ...depts[parentIdx] };
    parent.children = [...(parent.children || []), { name: '', description: '' }];
    depts[parentIdx] = parent;
    setProfile({ ...profile, departments: depts });
  };

  const updateChildDept = (parentIdx: number, childIdx: number, field: 'name' | 'description', value: string) => {
    const depts = [...profile.departments];
    const parent = { ...depts[parentIdx] };
    const children = [...(parent.children || [])];
    children[childIdx] = { ...children[childIdx], [field]: value };
    parent.children = children;
    depts[parentIdx] = parent;
    setProfile({ ...profile, departments: depts });
  };

  const updateRole = (idx: number, field: keyof JobRoleItem, value: string) => {
    const roles = [...profile.jobRoles];
    roles[idx] = { ...roles[idx], [field]: value };
    setProfile({ ...profile, jobRoles: roles });
  };

  const removeRole = (idx: number) => {
    setProfile({ ...profile, jobRoles: profile.jobRoles.filter((_, i) => i !== idx) });
  };

  const addRole = () => {
    setProfile({
      ...profile,
      jobRoles: [...profile.jobRoles, { title: '', departmentName: '', responsibilities: '', boundaries: '', requiredSkills: '' }],
    });
  };

  const updateMember = (idx: number, field: keyof ExtractedMember, value: string | string[]) => {
    const members = [...profile.members];
    members[idx] = { ...members[idx], [field]: value };
    setProfile({ ...profile, members });
  };

  const removeMember = (idx: number) => {
    setProfile({ ...profile, members: profile.members.filter((_, i) => i !== idx) });
  };

  const addMember = () => {
    setProfile({
      ...profile,
      members: [...profile.members, {
        fullName: '', aliases: [], departmentName: '', jobRoleTitle: '',
        employeeId: '', phone: '', email: '', title: '', hireDate: '', contractHighlights: '',
      }],
    });
  };

  const getAllDeptNames = (): string[] => {
    const names: string[] = [];
    for (const dept of profile.departments) {
      if (dept.name) names.push(dept.name);
      if (dept.children) {
        for (const child of dept.children) {
          if (child.name) names.push(child.name);
        }
      }
    }
    return names;
  };

  const getAllRoleTitles = (): string[] => {
    return profile.jobRoles.map((r) => r.title).filter(Boolean);
  };

  const handleClose = () => {
    setStep('confirm');
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0" data-testid="dialog-setup-confirm">
        <DialogTitle className="sr-only">AI 组织分析结果</DialogTitle>
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#B4886B]/10 flex items-center justify-center">
                <Sparkles size={18} className="text-[#B4886B]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground" data-testid="text-modal-title">
                  {step === 'confirm' ? 'AI 组织分析结果' : '分析完成'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {step === 'confirm' ? '请确认以下识别信息，确认后将同步到系统' : '以下信息已成功同步'}
                </p>
              </div>
            </div>
          </div>

          {step === 'confirm' && profile.totalFileCount && profile.analyzedFileCount && profile.totalFileCount > profile.analyzedFileCount && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3 bg-muted/50 rounded-lg px-3 py-2" data-testid="text-filter-stats">
              <FileText size={14} className="text-[#B4886B] shrink-0" />
              <span>AI 深度分析了 {profile.analyzedFileCount}/{profile.totalFileCount} 个关键文件</span>
            </div>
          )}
        </div>

        <div className="p-6">
          {step === 'confirm' && (
            <div className="space-y-5">
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={16} className="text-[#B4886B]" />
                  <h3 className="font-medium text-foreground text-sm">组织信息</h3>
                </div>
                <div className="space-y-2">
                  <Input
                    value={profile.companyName}
                    onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                    placeholder="组织名称"
                    className="text-sm"
                    data-testid="input-company-name"
                  />
                  <Textarea
                    value={profile.companyDescription}
                    onChange={(e) => setProfile({ ...profile, companyDescription: e.target.value })}
                    placeholder="简介"
                    className="text-sm resize-none"
                    rows={2}
                    data-testid="input-company-desc"
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-[#B4886B]" />
                    <h3 className="font-medium text-foreground text-sm">
                      部门结构 <span className="text-xs font-normal text-muted-foreground ml-1">({profile.departments.length})</span>
                    </h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={addDept} className="text-[#B4886B] hover:text-[#A07A5F] h-7 text-xs" data-testid="button-add-dept">
                    <Plus size={12} className="mr-1" /> 添加
                  </Button>
                </div>
                <div className="space-y-2">
                  {profile.departments.map((dept, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-muted/40 border" data-testid={`dept-item-${i}`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-1.5">
                          <Input value={dept.name} onChange={(e) => updateDeptName(i, e.target.value)} placeholder="部门名称" className="text-sm h-8" data-testid={`input-dept-name-${i}`} />
                          <Input value={dept.description} onChange={(e) => updateDeptDesc(i, e.target.value)} placeholder="部门描述" className="text-sm h-8 text-muted-foreground" data-testid={`input-dept-desc-${i}`} />
                        </div>
                        <button onClick={() => removeDept(i)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" data-testid={`button-remove-dept-${i}`}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {dept.children && dept.children.length > 0 && (
                        <div className="mt-1.5 ml-4 space-y-1">
                          {dept.children.map((child, ci) => (
                            <div key={ci} className="flex items-center gap-1.5">
                              <span className="text-muted-foreground text-xs">└</span>
                              <Input value={child.name} onChange={(e) => updateChildDept(i, ci, 'name', e.target.value)} placeholder="子部门" className="text-sm h-7 flex-1" data-testid={`input-child-dept-${i}-${ci}`} />
                              <button onClick={() => removeChildDept(i, ci)} className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" data-testid={`button-remove-child-dept-${i}-${ci}`}>
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <button onClick={() => addChildDept(i)} className="mt-1.5 ml-4 text-xs text-[#B4886B] hover:text-[#A07A5F] flex items-center gap-0.5" data-testid={`button-add-child-dept-${i}`}>
                        <Plus size={11} /> 子部门
                      </button>
                    </div>
                  ))}
                  {profile.departments.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">未识别到部门信息</p>}
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-[#B4886B]" />
                    <h3 className="font-medium text-foreground text-sm">
                      岗位信息 <span className="text-xs font-normal text-muted-foreground ml-1">({profile.jobRoles.length})</span>
                    </h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={addRole} className="text-[#B4886B] hover:text-[#A07A5F] h-7 text-xs" data-testid="button-add-role">
                    <Plus size={12} className="mr-1" /> 添加
                  </Button>
                </div>
                <div className="space-y-2">
                  {profile.jobRoles.map((role, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-muted/40 border" data-testid={`role-item-${i}`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 grid grid-cols-2 gap-1.5">
                          <Input value={role.title} onChange={(e) => updateRole(i, 'title', e.target.value)} placeholder="岗位名称" className="text-sm h-8" data-testid={`input-role-title-${i}`} />
                          <Input value={role.departmentName} onChange={(e) => updateRole(i, 'departmentName', e.target.value)} placeholder="所属部门" className="text-sm h-8" data-testid={`input-role-dept-${i}`} />
                          <div className="col-span-2">
                            <Textarea value={role.responsibilities} onChange={(e) => updateRole(i, 'responsibilities', e.target.value)} placeholder="核心职责" className="text-sm resize-none" rows={2} data-testid={`input-role-responsibilities-${i}`} />
                          </div>
                        </div>
                        <button onClick={() => removeRole(i)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" data-testid={`button-remove-role-${i}`}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {profile.jobRoles.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">未识别到岗位信息</p>}
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <UserRoundPlus size={16} className="text-[#B4886B]" />
                    <h3 className="font-medium text-foreground text-sm">
                      成员档案 <span className="text-xs font-normal text-muted-foreground ml-1">({profile.members.length})</span>
                    </h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={addMember} className="text-[#B4886B] hover:text-[#A07A5F] h-7 text-xs" data-testid="button-add-member">
                    <Plus size={12} className="mr-1" /> 添加
                  </Button>
                </div>
                <div className="space-y-2">
                  {profile.members.map((member, i) => {
                    const deptNames = getAllDeptNames();
                    const roleTitles = getAllRoleTitles();
                    return (
                      <div key={i} className="p-2.5 rounded-lg bg-muted/40 border" data-testid={`member-item-${i}`}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 space-y-1.5">
                            <div className="grid grid-cols-2 gap-1.5">
                              <Input value={member.fullName} onChange={(e) => updateMember(i, 'fullName', e.target.value)} placeholder="姓名" className="text-sm h-8" data-testid={`input-member-name-${i}`} />
                              <Input
                                value={member.aliases.join(', ')}
                                onChange={(e) => updateMember(i, 'aliases', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                                placeholder="别名"
                                className="text-sm h-8"
                                data-testid={`input-member-aliases-${i}`}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <Select value={member.departmentName || '__none__'} onValueChange={(val) => updateMember(i, 'departmentName', val === '__none__' ? '' : val)}>
                                <SelectTrigger className="text-sm h-8" data-testid={`select-member-dept-${i}`}><SelectValue placeholder="部门" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">未指定</SelectItem>
                                  {deptNames.map((dn) => <SelectItem key={dn} value={dn}>{dn}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Select value={member.jobRoleTitle || '__none__'} onValueChange={(val) => updateMember(i, 'jobRoleTitle', val === '__none__' ? '' : val)}>
                                <SelectTrigger className="text-sm h-8" data-testid={`select-member-role-${i}`}><SelectValue placeholder="岗位" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">未指定</SelectItem>
                                  {roleTitles.map((rt) => <SelectItem key={rt} value={rt}>{rt}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <Input value={member.title} onChange={(e) => updateMember(i, 'title', e.target.value)} placeholder="职位头衔" className="text-sm h-8" data-testid={`input-member-title-${i}`} />
                              <Input value={member.hireDate} onChange={(e) => updateMember(i, 'hireDate', e.target.value)} placeholder="入职日期" className="text-sm h-8" data-testid={`input-member-hiredate-${i}`} />
                            </div>
                          </div>
                          <button onClick={() => removeMember(i)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" data-testid={`button-remove-member-${i}`}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {profile.members.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">未识别到成员信息</p>}
                </div>
              </div>

              {profile.fileClassifications.length > 0 && (() => {
                const coreFiles = profile.fileClassifications.filter(fc => fc.orgRelevance >= 3);
                const kbFiles = profile.fileClassifications.filter(fc => fc.orgRelevance < 3 && fc.kbRelevance >= 2);
                const otherFiles = profile.fileClassifications.filter(fc => fc.orgRelevance < 3 && fc.kbRelevance < 2);

                const renderFileRow = (fc: FileAnalysis, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30" data-testid={`file-classification-${i}`}>
                    <FileText size={13} className="text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm text-foreground truncate">{fc.fileName}</p>
                        {fc.sensitivity === 'high' && (
                          <span className="text-xs px-1 py-0.5 rounded bg-destructive/10 text-destructive flex-shrink-0 inline-flex items-center gap-0.5" data-testid={`badge-sensitive-${i}`}>
                            <AlertTriangle size={9} /> 敏感
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{fc.summary}</p>
                    </div>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#B4886B]/10 text-[#B4886B] flex-shrink-0">
                      {categoryLabels[fc.category] || fc.category}
                    </span>
                  </div>
                );

                return (
                  <div className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText size={16} className="text-[#B4886B]" />
                      <h3 className="font-medium text-foreground text-sm">文档分类</h3>
                    </div>
                    <div className="space-y-3">
                      {coreFiles.length > 0 && (
                        <div data-testid="file-group-core">
                          <p className="text-xs font-medium text-[#B4886B] mb-1.5 flex items-center gap-1"><Star size={11} /> 核心组织文件</p>
                          <div className="space-y-1">{coreFiles.map((fc, i) => renderFileRow(fc, i))}</div>
                        </div>
                      )}
                      {kbFiles.length > 0 && (
                        <div data-testid="file-group-kb">
                          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1"><BookOpen size={11} /> 知识库文档</p>
                          <div className="space-y-1">{kbFiles.map((fc, i) => renderFileRow(fc, coreFiles.length + i))}</div>
                        </div>
                      )}
                      {otherFiles.length > 0 && (
                        <div data-testid="file-group-other">
                          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1"><FolderOpen size={11} /> 其他文件</p>
                          <div className="space-y-1">{otherFiles.map((fc, i) => renderFileRow(fc, coreFiles.length + kbFiles.length + i))}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={handleClose} data-testid="button-cancel-setup">
                  取消
                </Button>
                <Button
                  onClick={() => confirmMutation.mutate()}
                  disabled={confirmMutation.isPending}
                  className="bg-[#B4886B] hover:bg-[#A07A5F] text-white"
                  data-testid="button-confirm-setup"
                >
                  {confirmMutation.isPending ? (
                    <><Loader2 size={15} className="mr-1.5 animate-spin" /> 正在应用...</>
                  ) : (
                    <><Check size={15} className="mr-1.5" /> 确认并应用</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 'complete' && result && (
            <div className="text-center py-8" data-testid="step-complete">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-900/20 mb-5">
                <Check size={28} className="text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-lg font-medium text-foreground mb-1">组织分析已应用</h2>
              <p className="text-sm text-muted-foreground mb-6">以下信息已同步到系统中</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto mb-6">
                {[
                  { icon: Users, count: result.departmentsCreated, label: '部门', testId: 'text-depts-created' },
                  { icon: BookOpen, count: result.jobRolesCreated, label: '岗位', testId: 'text-roles-created' },
                  { icon: UserRoundPlus, count: result.membersCreated || 0, label: '成员', testId: 'text-members-created' },
                  { icon: FileText, count: result.documentsCreated, label: '文档', testId: 'text-docs-created' },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-xl border bg-card">
                    <item.icon size={20} className="mx-auto mb-1.5 text-[#B4886B]" />
                    <p className="text-xl font-semibold text-foreground" data-testid={item.testId}>{item.count}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>

              <Button onClick={handleClose} className="bg-[#B4886B] hover:bg-[#A07A5F] text-white" data-testid="button-close-result">
                完成
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
