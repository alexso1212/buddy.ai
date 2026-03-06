import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload,
  FileText,
  X,
  Loader2,
  Check,
  Building2,
  Users,
  BookOpen,
  ChevronRight,
  Trash2,
  Plus,
  Sparkles,
  ArrowLeft,
  FolderOpen,
  UserRoundPlus,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FileAnalysis {
  fileName: string;
  category: string;
  visibility: string;
  visibleDepartment?: string;
  summary: string;
  mentionedDepartments: string[];
  mentionedRoles: string[];
}

interface DeptChild {
  name: string;
  description: string;
}

interface DeptItem {
  name: string;
  description: string;
  children?: DeptChild[];
}

interface JobRoleItem {
  title: string;
  departmentName: string;
  responsibilities: string;
  boundaries: string;
  requiredSkills: string;
}

interface ExtractedMember {
  fullName: string;
  aliases: string[];
  departmentName: string;
  jobRoleTitle: string;
  employeeId: string;
  phone: string;
  email: string;
  title: string;
  hireDate: string;
  contractHighlights: string;
}

interface EnterpriseProfile {
  companyName: string;
  companyDescription: string;
  departments: DeptItem[];
  jobRoles: JobRoleItem[];
  members: ExtractedMember[];
  fileClassifications: FileAnalysis[];
}

interface AnalyzeResult {
  profile: EnterpriseProfile;
  extractedFiles: { fileName: string; content: string; fileType: string; fileSize: number; filePath: string }[];
}

interface ConfirmResult {
  updatedOrg: boolean;
  departmentsCreated: number;
  jobRolesCreated: number;
  documentsCreated: number;
  membersCreated: number;
}

type Step = "upload" | "analyzing" | "confirm" | "complete";

export default function SmartSetupPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");

  useEffect(() => {
    if (user && !['owner', 'admin'].includes(user.role)) {
      navigate("/dashboard");
    }
  }, [user, navigate]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [profile, setProfile] = useState<EnterpriseProfile | null>(null);
  const [extractedFiles, setExtractedFiles] = useState<any[]>([]);
  const [result, setResult] = useState<ConfirmResult | null>(null);

  const allowedExtensions = [".pdf", ".docx", ".txt", ".md", ".zip"];

  const analyzeMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const res = await fetch("/api/setup/analyze", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("buddy_token")}`,
        },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "分析失败");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const analyzeResult: AnalyzeResult = data.data;
      setProfile(analyzeResult.profile);
      setExtractedFiles(analyzeResult.extractedFiles);
      setStep("confirm");
    },
    onError: (err: any) => {
      toast({ title: "分析失败", description: err.message, variant: "destructive" });
      setStep("upload");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/setup/confirm", {
        profile,
        extractedFiles,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data.data);
      setStep("complete");
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/job-roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kb/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member-profiles"] });
    },
    onError: (err: any) => {
      toast({ title: "初始化失败", description: err.message, variant: "destructive" });
    },
  });

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files).filter((f) => {
        const ext = "." + f.name.split(".").pop()?.toLowerCase();
        return allowedExtensions.includes(ext);
      });
      setSelectedFiles((prev) => [...prev, ...droppedFiles]);
    },
    [allowedExtensions]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startAnalysis = () => {
    if (selectedFiles.length === 0) {
      toast({ title: "请先选择文件", variant: "destructive" });
      return;
    }
    setStep("analyzing");
    analyzeMutation.mutate(selectedFiles);
  };

  const updateDeptName = (idx: number, name: string) => {
    if (!profile) return;
    const depts = [...profile.departments];
    depts[idx] = { ...depts[idx], name };
    setProfile({ ...profile, departments: depts });
  };

  const updateDeptDesc = (idx: number, description: string) => {
    if (!profile) return;
    const depts = [...profile.departments];
    depts[idx] = { ...depts[idx], description };
    setProfile({ ...profile, departments: depts });
  };

  const removeDept = (idx: number) => {
    if (!profile) return;
    const depts = profile.departments.filter((_, i) => i !== idx);
    setProfile({ ...profile, departments: depts });
  };

  const addDept = () => {
    if (!profile) return;
    setProfile({
      ...profile,
      departments: [...profile.departments, { name: "", description: "", children: [] }],
    });
  };

  const removeChildDept = (parentIdx: number, childIdx: number) => {
    if (!profile) return;
    const depts = [...profile.departments];
    const parent = { ...depts[parentIdx] };
    parent.children = (parent.children || []).filter((_, i) => i !== childIdx);
    depts[parentIdx] = parent;
    setProfile({ ...profile, departments: depts });
  };

  const addChildDept = (parentIdx: number) => {
    if (!profile) return;
    const depts = [...profile.departments];
    const parent = { ...depts[parentIdx] };
    parent.children = [...(parent.children || []), { name: "", description: "" }];
    depts[parentIdx] = parent;
    setProfile({ ...profile, departments: depts });
  };

  const updateChildDept = (parentIdx: number, childIdx: number, field: "name" | "description", value: string) => {
    if (!profile) return;
    const depts = [...profile.departments];
    const parent = { ...depts[parentIdx] };
    const children = [...(parent.children || [])];
    children[childIdx] = { ...children[childIdx], [field]: value };
    parent.children = children;
    depts[parentIdx] = parent;
    setProfile({ ...profile, departments: depts });
  };

  const updateRole = (idx: number, field: keyof JobRoleItem, value: string) => {
    if (!profile) return;
    const roles = [...profile.jobRoles];
    roles[idx] = { ...roles[idx], [field]: value };
    setProfile({ ...profile, jobRoles: roles });
  };

  const removeRole = (idx: number) => {
    if (!profile) return;
    setProfile({ ...profile, jobRoles: profile.jobRoles.filter((_, i) => i !== idx) });
  };

  const addRole = () => {
    if (!profile) return;
    setProfile({
      ...profile,
      jobRoles: [
        ...profile.jobRoles,
        { title: "", departmentName: "", responsibilities: "", boundaries: "", requiredSkills: "" },
      ],
    });
  };

  const updateMember = (idx: number, field: keyof ExtractedMember, value: string | string[]) => {
    if (!profile) return;
    const members = [...profile.members];
    members[idx] = { ...members[idx], [field]: value };
    setProfile({ ...profile, members });
  };

  const removeMember = (idx: number) => {
    if (!profile) return;
    setProfile({ ...profile, members: profile.members.filter((_, i) => i !== idx) });
  };

  const addMember = () => {
    if (!profile) return;
    setProfile({
      ...profile,
      members: [
        ...profile.members,
        {
          fullName: "",
          aliases: [],
          departmentName: "",
          jobRoleTitle: "",
          employeeId: "",
          phone: "",
          email: "",
          title: "",
          hireDate: "",
          contractHighlights: "",
        },
      ],
    });
  };

  const getAllDeptNames = (): string[] => {
    if (!profile) return [];
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
    if (!profile) return [];
    return profile.jobRoles.map((r) => r.title).filter(Boolean);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="min-h-screen bg-[#F5F0EB] dark:bg-[#1A1918]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => navigate("/team")}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft size={20} className="text-[#5D5D5A] dark:text-[#A3A39E]" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles size={24} className="text-[#B4886B]" />
            <h1 className="text-xl font-semibold text-[#2D2D2A] dark:text-[#ECECEC]">企业智能初始化</h1>
          </div>
        </div>
        <p className="text-sm text-[#7A7874] dark:text-[#8A8A85] ml-10 mb-8">
          上传组织架构相关文档，AI 自动提取部门结构和岗位信息，一键同步到系统中
        </p>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8 ml-10" data-testid="step-indicators">
          {[
            { key: "upload", label: "上传文件", num: 1 },
            { key: "analyzing", label: "AI 分析", num: 2 },
            { key: "confirm", label: "确认信息", num: 3 },
            { key: "complete", label: "完成", num: 4 },
          ].map((s, i, arr) => {
            const stepOrder = ["upload", "analyzing", "confirm", "complete"];
            const currentIdx = stepOrder.indexOf(step);
            const thisIdx = stepOrder.indexOf(s.key);
            const isActive = thisIdx === currentIdx;
            const isDone = thisIdx < currentIdx;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    isDone
                      ? "bg-[#B4886B] text-white"
                      : isActive
                        ? "bg-[#2D2D2A] dark:bg-[#ECECEC] text-white dark:text-[#1A1918]"
                        : "bg-black/5 dark:bg-white/5 text-[#7A7874]"
                  }`}
                >
                  {isDone ? <Check size={14} /> : s.num}
                </div>
                <span
                  className={`text-sm hidden sm:inline ${
                    isActive ? "text-[#2D2D2A] dark:text-[#ECECEC] font-medium" : "text-[#7A7874]"
                  }`}
                >
                  {s.label}
                </span>
                {i < arr.length - 1 && (
                  <ChevronRight size={14} className="text-[#C4C0BB] dark:text-[#5D5D5A] mx-1" />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-6" data-testid="step-upload">
            <div
              className={`rounded-2xl border-2 border-dashed transition-colors p-12 text-center ${
                dragOver
                  ? "border-[#B4886B] bg-[#B4886B]/5"
                  : "border-[#C4C0BB] dark:border-[#3D3D3A] hover:border-[#B4886B]/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              data-testid="file-dropzone"
            >
              <Upload size={40} className="mx-auto mb-4 text-[#B4886B]" />
              <p className="text-[#2D2D2A] dark:text-[#ECECEC] font-medium mb-1">
                拖拽文件到这里，或点击选择
              </p>
              <p className="text-sm text-[#7A7874] dark:text-[#8A8A85] mb-4">
                支持 PDF、Word、TXT、Markdown、ZIP 格式，最大 50MB
              </p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="rounded-xl"
                data-testid="button-select-files"
              >
                <FolderOpen size={16} className="mr-2" />
                选择文件
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,.zip"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-file"
              />
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2" data-testid="file-list">
                <p className="text-sm font-medium text-[#2D2D2A] dark:text-[#ECECEC]">
                  已选择 {selectedFiles.length} 个文件
                </p>
                {selectedFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#2D2D2A] border border-[#E8E4DF] dark:border-[#3D3D3A]"
                    data-testid={`file-item-${i}`}
                  >
                    <FileText size={18} className="text-[#B4886B] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#2D2D2A] dark:text-[#ECECEC] truncate">{f.name}</p>
                      <p className="text-xs text-[#7A7874]">{formatFileSize(f.size)}</p>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5"
                      data-testid={`button-remove-file-${i}`}
                    >
                      <X size={14} className="text-[#7A7874]" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={startAnalysis}
                disabled={selectedFiles.length === 0}
                className="rounded-xl bg-[#B4886B] hover:bg-[#A07A5F] text-white px-6"
                data-testid="button-start-analysis"
              >
                <Sparkles size={16} className="mr-2" />
                开始分析
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Analyzing */}
        {step === "analyzing" && (
          <div className="text-center py-16" data-testid="step-analyzing">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#B4886B]/10 mb-6">
              <Loader2 size={32} className="text-[#B4886B] animate-spin" />
            </div>
            <h2 className="text-lg font-medium text-[#2D2D2A] dark:text-[#ECECEC] mb-2">AI 正在分析文档...</h2>
            <p className="text-sm text-[#7A7874] dark:text-[#8A8A85]">
              正在提取组织架构、部门结构和岗位信息，请稍候
            </p>
            <div className="mt-8 space-y-3 max-w-sm mx-auto">
              {selectedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-[#7A7874]">
                  <FileText size={14} />
                  <span className="truncate">{f.name}</span>
                  <Loader2 size={12} className="animate-spin ml-auto flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === "confirm" && profile && (
          <div className="space-y-6" data-testid="step-confirm">
            {/* Company Info */}
            <div className="rounded-2xl bg-white dark:bg-[#2D2D2A] border border-[#E8E4DF] dark:border-[#3D3D3A] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={18} className="text-[#B4886B]" />
                <h3 className="font-medium text-[#2D2D2A] dark:text-[#ECECEC]">组织信息</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#7A7874] mb-1 block">组织名称</label>
                  <Input
                    value={profile.companyName}
                    onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                    className="rounded-xl"
                    data-testid="input-company-name"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#7A7874] mb-1 block">简介</label>
                  <Textarea
                    value={profile.companyDescription}
                    onChange={(e) => setProfile({ ...profile, companyDescription: e.target.value })}
                    className="rounded-xl resize-none"
                    rows={2}
                    data-testid="input-company-desc"
                  />
                </div>
              </div>
            </div>

            {/* Departments */}
            <div className="rounded-2xl bg-white dark:bg-[#2D2D2A] border border-[#E8E4DF] dark:border-[#3D3D3A] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-[#B4886B]" />
                  <h3 className="font-medium text-[#2D2D2A] dark:text-[#ECECEC]">
                    部门结构
                    <span className="text-xs font-normal text-[#7A7874] ml-2">
                      ({profile.departments.length} 个部门)
                    </span>
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addDept}
                  className="text-[#B4886B] hover:text-[#A07A5F]"
                  data-testid="button-add-dept"
                >
                  <Plus size={14} className="mr-1" />
                  添加
                </Button>
              </div>
              <div className="space-y-3">
                {profile.departments.map((dept, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-[#F5F0EB]/50 dark:bg-[#1A1918]/50 border border-[#E8E4DF] dark:border-[#3D3D3A]"
                    data-testid={`dept-item-${i}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <Input
                          value={dept.name}
                          onChange={(e) => updateDeptName(i, e.target.value)}
                          placeholder="部门名称"
                          className="rounded-lg text-sm h-8"
                          data-testid={`input-dept-name-${i}`}
                        />
                        <Input
                          value={dept.description}
                          onChange={(e) => updateDeptDesc(i, e.target.value)}
                          placeholder="部门描述（可选）"
                          className="rounded-lg text-sm h-8 text-[#7A7874]"
                          data-testid={`input-dept-desc-${i}`}
                        />
                      </div>
                      <button
                        onClick={() => removeDept(i)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[#7A7874] hover:text-red-500 transition-colors mt-0.5"
                        data-testid={`button-remove-dept-${i}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {/* Child departments */}
                    {dept.children && dept.children.length > 0 && (
                      <div className="mt-2 ml-4 space-y-2">
                        {dept.children.map((child, ci) => (
                          <div key={ci} className="flex items-center gap-2">
                            <span className="text-[#C4C0BB] text-xs">└</span>
                            <Input
                              value={child.name}
                              onChange={(e) => updateChildDept(i, ci, "name", e.target.value)}
                              placeholder="子部门名称"
                              className="rounded-lg text-sm h-7 flex-1"
                              data-testid={`input-child-dept-${i}-${ci}`}
                            />
                            <button
                              onClick={() => removeChildDept(i, ci)}
                              className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[#7A7874] hover:text-red-500"
                              data-testid={`button-remove-child-dept-${i}-${ci}`}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => addChildDept(i)}
                      className="mt-2 ml-4 text-xs text-[#B4886B] hover:text-[#A07A5F] flex items-center gap-1"
                      data-testid={`button-add-child-dept-${i}`}
                    >
                      <Plus size={12} />
                      添加子部门
                    </button>
                  </div>
                ))}
                {profile.departments.length === 0 && (
                  <p className="text-sm text-[#7A7874] text-center py-4">未识别到部门信息</p>
                )}
              </div>
            </div>

            {/* Job Roles */}
            <div className="rounded-2xl bg-white dark:bg-[#2D2D2A] border border-[#E8E4DF] dark:border-[#3D3D3A] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className="text-[#B4886B]" />
                  <h3 className="font-medium text-[#2D2D2A] dark:text-[#ECECEC]">
                    岗位信息
                    <span className="text-xs font-normal text-[#7A7874] ml-2">
                      ({profile.jobRoles.length} 个岗位)
                    </span>
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addRole}
                  className="text-[#B4886B] hover:text-[#A07A5F]"
                  data-testid="button-add-role"
                >
                  <Plus size={14} className="mr-1" />
                  添加
                </Button>
              </div>
              <div className="space-y-3">
                {profile.jobRoles.map((role, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-[#F5F0EB]/50 dark:bg-[#1A1918]/50 border border-[#E8E4DF] dark:border-[#3D3D3A]"
                    data-testid={`role-item-${i}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input
                          value={role.title}
                          onChange={(e) => updateRole(i, "title", e.target.value)}
                          placeholder="岗位名称"
                          className="rounded-lg text-sm h-8"
                          data-testid={`input-role-title-${i}`}
                        />
                        <Input
                          value={role.departmentName}
                          onChange={(e) => updateRole(i, "departmentName", e.target.value)}
                          placeholder="所属部门"
                          className="rounded-lg text-sm h-8"
                          data-testid={`input-role-dept-${i}`}
                        />
                        <div className="col-span-2">
                          <Textarea
                            value={role.responsibilities}
                            onChange={(e) => updateRole(i, "responsibilities", e.target.value)}
                            placeholder="核心职责"
                            className="rounded-lg text-sm resize-none"
                            rows={2}
                            data-testid={`input-role-responsibilities-${i}`}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => removeRole(i)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[#7A7874] hover:text-red-500 transition-colors mt-0.5"
                        data-testid={`button-remove-role-${i}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {profile.jobRoles.length === 0 && (
                  <p className="text-sm text-[#7A7874] text-center py-4">未识别到岗位信息</p>
                )}
              </div>
            </div>

            {/* Members */}
            <div className="rounded-2xl bg-white dark:bg-[#2D2D2A] border border-[#E8E4DF] dark:border-[#3D3D3A] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <UserRoundPlus size={18} className="text-[#B4886B]" />
                  <h3 className="font-medium text-[#2D2D2A] dark:text-[#ECECEC]">
                    成员档案
                    <span className="text-xs font-normal text-[#7A7874] ml-2">
                      ({profile.members.length} 位成员)
                    </span>
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addMember}
                  className="text-[#B4886B] hover:text-[#A07A5F]"
                  data-testid="button-add-member"
                >
                  <Plus size={14} className="mr-1" />
                  添加
                </Button>
              </div>
              <div className="space-y-3">
                {profile.members.map((member, i) => {
                  const deptNames = getAllDeptNames();
                  const roleTitles = getAllRoleTitles();
                  return (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-[#F5F0EB]/50 dark:bg-[#1A1918]/50 border border-[#E8E4DF] dark:border-[#3D3D3A]"
                      data-testid={`member-item-${i}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={member.fullName}
                              onChange={(e) => updateMember(i, "fullName", e.target.value)}
                              placeholder="姓名"
                              className="rounded-lg text-sm h-8"
                              data-testid={`input-member-name-${i}`}
                            />
                            <Input
                              value={member.aliases.join(", ")}
                              onChange={(e) =>
                                updateMember(
                                  i,
                                  "aliases",
                                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                                )
                              }
                              placeholder="别名（逗号分隔）"
                              className="rounded-lg text-sm h-8"
                              data-testid={`input-member-aliases-${i}`}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={member.departmentName || "__none__"}
                              onValueChange={(val) => updateMember(i, "departmentName", val === "__none__" ? "" : val)}
                            >
                              <SelectTrigger className="rounded-lg text-sm h-8" data-testid={`select-member-dept-${i}`}>
                                <SelectValue placeholder="所属部门" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">未指定</SelectItem>
                                {deptNames.map((dn) => (
                                  <SelectItem key={dn} value={dn}>
                                    {dn}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={member.jobRoleTitle || "__none__"}
                              onValueChange={(val) => updateMember(i, "jobRoleTitle", val === "__none__" ? "" : val)}
                            >
                              <SelectTrigger className="rounded-lg text-sm h-8" data-testid={`select-member-role-${i}`}>
                                <SelectValue placeholder="岗位" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">未指定</SelectItem>
                                {roleTitles.map((rt) => (
                                  <SelectItem key={rt} value={rt}>
                                    {rt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={member.title}
                              onChange={(e) => updateMember(i, "title", e.target.value)}
                              placeholder="职位头衔"
                              className="rounded-lg text-sm h-8"
                              data-testid={`input-member-title-${i}`}
                            />
                            <Input
                              value={member.hireDate}
                              onChange={(e) => updateMember(i, "hireDate", e.target.value)}
                              placeholder="入职日期"
                              className="rounded-lg text-sm h-8"
                              data-testid={`input-member-hiredate-${i}`}
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => removeMember(i)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[#7A7874] hover:text-red-500 transition-colors mt-0.5"
                          data-testid={`button-remove-member-${i}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {profile.members.length === 0 && (
                  <p className="text-sm text-[#7A7874] text-center py-4">未识别到成员信息</p>
                )}
              </div>
            </div>

            {/* File Classifications */}
            {profile.fileClassifications.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-[#2D2D2A] border border-[#E8E4DF] dark:border-[#3D3D3A] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileText size={18} className="text-[#B4886B]" />
                  <h3 className="font-medium text-[#2D2D2A] dark:text-[#ECECEC]">
                    文件分类
                    <span className="text-xs font-normal text-[#7A7874] ml-2">
                      (将自动导入知识库)
                    </span>
                  </h3>
                </div>
                <div className="space-y-2">
                  {profile.fileClassifications.map((fc, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-[#F5F0EB]/50 dark:bg-[#1A1918]/50"
                      data-testid={`file-classification-${i}`}
                    >
                      <FileText size={14} className="text-[#7A7874] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#2D2D2A] dark:text-[#ECECEC] truncate">{fc.fileName}</p>
                        <p className="text-xs text-[#7A7874]">{fc.summary}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#B4886B]/10 text-[#B4886B] flex-shrink-0">
                        {fc.category}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("upload");
                  setProfile(null);
                  setExtractedFiles([]);
                }}
                className="rounded-xl"
                data-testid="button-back-to-upload"
              >
                <ArrowLeft size={16} className="mr-2" />
                重新上传
              </Button>
              <Button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                className="rounded-xl bg-[#B4886B] hover:bg-[#A07A5F] text-white px-6"
                data-testid="button-confirm-setup"
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    正在初始化...
                  </>
                ) : (
                  <>
                    <Check size={16} className="mr-2" />
                    确认并初始化
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === "complete" && result && (
          <div className="text-center py-12" data-testid="step-complete">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-50 dark:bg-green-900/20 mb-6">
              <Check size={32} className="text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-medium text-[#2D2D2A] dark:text-[#ECECEC] mb-2">初始化完成！</h2>
            <p className="text-sm text-[#7A7874] dark:text-[#8A8A85] mb-8">以下信息已同步到系统中</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto mb-8">
              <div className="p-4 rounded-xl bg-white dark:bg-[#2D2D2A] border border-[#E8E4DF] dark:border-[#3D3D3A]">
                <Users size={24} className="mx-auto mb-2 text-[#B4886B]" />
                <p className="text-2xl font-semibold text-[#2D2D2A] dark:text-[#ECECEC]" data-testid="text-depts-created">
                  {result.departmentsCreated}
                </p>
                <p className="text-xs text-[#7A7874]">部门已创建</p>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-[#2D2D2A] border border-[#E8E4DF] dark:border-[#3D3D3A]">
                <BookOpen size={24} className="mx-auto mb-2 text-[#B4886B]" />
                <p className="text-2xl font-semibold text-[#2D2D2A] dark:text-[#ECECEC]" data-testid="text-roles-created">
                  {result.jobRolesCreated}
                </p>
                <p className="text-xs text-[#7A7874]">岗位已创建</p>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-[#2D2D2A] border border-[#E8E4DF] dark:border-[#3D3D3A]">
                <UserRoundPlus size={24} className="mx-auto mb-2 text-[#B4886B]" />
                <p className="text-2xl font-semibold text-[#2D2D2A] dark:text-[#ECECEC]" data-testid="text-members-created">
                  {result.membersCreated || 0}
                </p>
                <p className="text-xs text-[#7A7874]">成员已创建</p>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-[#2D2D2A] border border-[#E8E4DF] dark:border-[#3D3D3A]">
                <FileText size={24} className="mx-auto mb-2 text-[#B4886B]" />
                <p className="text-2xl font-semibold text-[#2D2D2A] dark:text-[#ECECEC]" data-testid="text-docs-created">
                  {result.documentsCreated}
                </p>
                <p className="text-xs text-[#7A7874]">文档已入库</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate("/team")}
                className="rounded-xl"
                data-testid="button-go-team"
              >
                <Users size={16} className="mr-2" />
                查看团队
              </Button>
              <Button
                onClick={() => navigate("/knowledge-base")}
                className="rounded-xl bg-[#B4886B] hover:bg-[#A07A5F] text-white"
                data-testid="button-go-kb"
              >
                <BookOpen size={16} className="mr-2" />
                查看知识库
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
