import OpenAI from 'openai';

const aiClient = new OpenAI({
  baseURL: 'https://vip.aipro.love/v1',
  apiKey: process.env.CLAUDE_SIMPLE_API_KEY || '',
  timeout: 90000,
});

const complexClient = new OpenAI({
  baseURL: 'https://vip.aipro.love/v1',
  apiKey: process.env.CLAUDE_COMPLEX_API_KEY || '',
  timeout: 300000,
});

export type DocumentCategory =
  | 'org_chart' | 'roster' | 'jd' | 'contract' | 'kpi'
  | 'policy' | 'handbook' | 'sop'
  | 'product' | 'sales' | 'project'
  | 'finance' | 'legal'
  | 'marketing' | 'brand'
  | 'technical'
  | 'general';

export interface FileAnalysis {
  fileName: string;
  category: DocumentCategory;
  orgRelevance: number;
  kbRelevance: number;
  orgReason: string;
  kbReason: string;
  sensitivity: 'high' | 'medium' | 'low';
  summary: string;
  suggestedVisibility: 'org' | 'admin' | 'department';
  suggestedDepartment: string;
  mentionedDepartments: string[];
  mentionedRoles: string[];
  mentionedNames: string[];
}

export interface ExtractedMember {
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

export interface EnterpriseProfile {
  companyName: string;
  companyDescription: string;
  departments: {
    name: string;
    description: string;
    children?: { name: string; description: string }[];
  }[];
  jobRoles: {
    title: string;
    departmentName: string;
    responsibilities: string;
    boundaries: string;
    requiredSkills: string;
  }[];
  members: ExtractedMember[];
  fileClassifications: FileAnalysis[];
}

export async function analyzeFileWithHaiku(fileName: string, content: string): Promise<FileAnalysis> {
  try {
    const response = await aiClient.chat.completions.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `你是一个企业文档分析助手。请分析以下企业文件，返回纯 JSON（不要 markdown 代码块）。

只看文件名和文件开头内容（前500字符），快速判断以下信息：

{
  "category": "从以下选项中选一个：org_chart/roster/jd/contract/kpi/policy/handbook/sop/product/sales/project/finance/legal/marketing/brand/technical/general",
  "orgRelevance": 4,
  "kbRelevance": 3,
  "orgReason": "一句话说明为什么给这个 orgRelevance 分数",
  "kbReason": "一句话说明为什么给这个 kbRelevance 分数",
  "sensitivity": "low",
  "summary": "一句话概括文件内容（20字以内）",
  "suggestedVisibility": "org/admin/department 三选一",
  "suggestedDepartment": "如果 suggestedVisibility=department，填哪个部门（否则空字符串）",
  "mentionedDepartments": ["识别到的部门名称"],
  "mentionedRoles": ["识别到的岗位/职位名称"],
  "mentionedNames": ["识别到的人名"]
}

分类说明：
- org_chart: 组织架构图
- roster: 花名册/通讯录/人员名册
- jd: 岗位说明书/职位描述
- contract: 劳动合同/保密协议
- kpi: 绩效考核标准/KPI表
- policy: 规章制度（考勤、报销、行政等）
- handbook: 员工手册（综合性文档）
- sop: 标准操作流程
- product: 产品相关（目录、手册、规格）
- sales: 销售相关（话术、客户、报价）
- project: 项目相关（方案、计划、纪要）
- finance: 财务相关
- legal: 法务合同/协议
- marketing: 市场营销相关
- brand: 品牌/公司介绍
- technical: 技术文档
- general: 无法分类的

orgRelevance 评分标准（对理解组织架构的价值，1-5整数）：
  5 = 直接包含组织架构信息（组织架构图、花名册、通讯录）
  4 = 包含岗位职责或人员信息（岗位说明书、劳动合同、绩效考核表）
  3 = 间接包含组织信息（员工手册中提到部门、SOP中提到负责人、项目方案中有分工）
  2 = 可能有零星的人名或部门提及（会议纪要、工作报告）
  1 = 与组织架构完全无关（产品手册、财务数据、发票、市场资料）

kbRelevance 评分标准（员工日常查询价值，1-5整数）：
  5 = 员工高频查询（考勤制度、报销流程、请假规定、产品FAQ）
  4 = 工作参考文档（SOP、产品手册、销售话术、技术规范）
  3 = 偶尔参考（培训计划、项目方案、竞品分析）
  2 = 低频但有存档价值（合同、年度计划、品牌手册）
  1 = 几乎不会被查询（发票、银行流水、物流单号、水电费通知）

sensitivity 判断：
  high = 涉及个人薪资、银行信息、商业核心机密
  medium = 涉及合同条款、客户名单、财务概况
  low = 可以全员公开的制度、流程、产品信息

suggestedVisibility 判断：
  org = 全员应知的（考勤、办公规范、报销流程、产品知识）
  admin = 涉及薪资、合同条款、人事的敏感文件
  department = 只和特定部门相关的文件`
        },
        {
          role: 'user',
          content: `文件名：${fileName}\n\n文件内容（开头部分）：\n${content.slice(0, 500)}`
        }
      ],
    });

    const text = response.choices[0]?.message?.content || '';
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      fileName,
      category: parsed.category || 'general',
      orgRelevance: typeof parsed.orgRelevance === 'number' ? parsed.orgRelevance : 3,
      kbRelevance: typeof parsed.kbRelevance === 'number' ? parsed.kbRelevance : 3,
      orgReason: parsed.orgReason || '',
      kbReason: parsed.kbReason || '',
      sensitivity: ['high', 'medium', 'low'].includes(parsed.sensitivity) ? parsed.sensitivity : 'low',
      summary: parsed.summary || '',
      suggestedVisibility: parsed.suggestedVisibility || 'org',
      suggestedDepartment: parsed.suggestedDepartment || '',
      mentionedDepartments: parsed.mentionedDepartments || [],
      mentionedRoles: parsed.mentionedRoles || [],
      mentionedNames: parsed.mentionedNames || [],
    };
  } catch (err: any) {
    console.error(`[Setup AI] Haiku analysis failed for ${fileName}:`, err.message);
    return {
      fileName,
      category: 'general',
      orgRelevance: 3,
      kbRelevance: 3,
      orgReason: '分析失败，默认中等相关性',
      kbReason: '分析失败，默认中等相关性',
      sensitivity: 'low',
      summary: '无法自动分析',
      suggestedVisibility: 'org',
      suggestedDepartment: '',
      mentionedDepartments: [],
      mentionedRoles: [],
      mentionedNames: [],
    };
  }
}

async function synthesizeWithOpus(
  allFileAnalyses: FileAnalysis[],
  selectedFiles: { fileName: string; content: string }[]
): Promise<EnterpriseProfile> {
  const summaryBlock = allFileAnalyses.map(f =>
    `【${f.fileName}】类型:${f.category} | 组织:${f.orgRelevance}/5 知识库:${f.kbRelevance}/5 | 摘要:${f.summary} | 部门:${f.mentionedDepartments.join(',')} | 岗位:${f.mentionedRoles.join(',')} | 人名:${f.mentionedNames.join(',')}`
  ).join('\n');

  const keyContents = selectedFiles
    .map(f => `### ${f.fileName}\n${f.content}`)
    .join('\n\n');

  try {
    const response = await complexClient.chat.completions.create({
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `你是一个企业组织架构分析专家。根据多份企业文件的分析摘要和关键文件原文，整合出完整的企业组织信息。

返回纯 JSON（不要 markdown 代码块）：
{
  "companyName": "从文件中识别的公司全称（找不到就填空字符串）",
  "companyDescription": "公司简介1-2句话（找不到就填空）",
  "departments": [
    {
      "name": "部门名称",
      "description": "部门职责简述（1句话）",
      "children": [
        { "name": "子部门名", "description": "简述" }
      ]
    }
  ],
  "jobRoles": [
    {
      "title": "岗位名称",
      "departmentName": "所属部门（和departments中的name对应）",
      "responsibilities": "核心职责，用分号分隔",
      "boundaries": "不负责的事项（没有就填空）",
      "requiredSkills": "技能要求（没有就填空）"
    }
  ],
  "members": [
    {
      "fullName": "员工正式姓名（必填）",
      "aliases": ["该员工的其他称呼：英文名、小名、昵称、职位简称等"],
      "departmentName": "所属部门（和departments中的name对应）",
      "jobRoleTitle": "岗位名称（和jobRoles中的title对应）",
      "employeeId": "工号（如果有）",
      "phone": "手机号（如果有）",
      "email": "邮箱（如果有）",
      "title": "职位头衔",
      "hireDate": "入职日期（如果有）",
      "contractHighlights": "合同关键条款摘要（如果是从合同中提取的）"
    }
  ]
}

规则：
- 只提取文件中明确提到的信息，不编造
- 去重：多个文件提到同一个部门只列一次
- 识别层级关系（如"大客户组"隶属于"销售部"放在children里）
- 如果找不到某项信息，对应字段填空字符串或空数组
- departments、jobRoles、members 数组如果完全没有信息就返回空数组

人员提取规则（最重要）：
- 仔细阅读所有关键文件原文，从人员名册、组织架构图、通讯录、劳动合同、签名栏、表格等位置识别人员
- 每个在文件中出现的内部员工都必须提取，不要遗漏
- aliases 很重要——收集文件中出现的该人的所有不同称呼（中文名、英文名、昵称等）
- 如果同一个人在多份文件中出现，合并信息（用最完整的版本）
- 不要提取客户、供应商等外部人员，只提取公司内部员工
- 如果文件中有明确的汇报关系（如"向XX汇报"），记录在该人的 contractHighlights 中
- 不要提取薪资等敏感信息，只提取职责相关的条款`
        },
        {
          role: 'user',
          content: `以下是对一家企业${allFileAnalyses.length}份文件的分析结果：

## 全部文件摘要
${summaryBlock}

## 关键文件内容（共${selectedFiles.length}篇，orgRelevance≥3）
${keyContents || '（无关键文件内容）'}

请从以上信息中整合出这家企业的完整组织架构，特别注意提取所有内部员工信息。`
        }
      ],
    });

    const text = response.choices[0]?.message?.content || '';
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const members = (parsed.members || []).map((m: any) => ({
      fullName: m.fullName || '',
      aliases: Array.isArray(m.aliases) ? m.aliases : [],
      departmentName: m.departmentName || '',
      jobRoleTitle: m.jobRoleTitle || '',
      employeeId: m.employeeId || '',
      phone: m.phone || '',
      email: m.email || '',
      title: m.title || '',
      hireDate: m.hireDate || '',
      contractHighlights: m.contractHighlights || '',
    }));

    return {
      companyName: parsed.companyName || '',
      companyDescription: parsed.companyDescription || '',
      departments: parsed.departments || [],
      jobRoles: parsed.jobRoles || [],
      members,
      fileClassifications: allFileAnalyses,
    };
  } catch (err: any) {
    console.error('[Setup AI] Opus synthesis failed:', err.message);
    return {
      companyName: '',
      companyDescription: '',
      departments: [],
      jobRoles: [],
      members: [],
      fileClassifications: allFileAnalyses,
    };
  }
}

export interface ExtractionResult extends EnterpriseProfile {
  analyzedFileCount: number;
  totalFileCount: number;
}

export async function extractEnterpriseProfile(
  files: { fileName: string; content: string; skipped?: boolean }[]
): Promise<ExtractionResult> {
  const totalFileCount = files.length;
  console.log(`[Setup AI] Starting extraction for ${totalFileCount} files`);

  const relevantFiles = files.filter(f => !f.skipped);
  const skippedByName = files.filter(f => f.skipped);
  if (skippedByName.length > 0) {
    console.log(`[Setup AI] Stage 0: ${skippedByName.length} files skipped by filename filter`);
  }

  console.log(`[Setup AI] Stage 1: Haiku scoring ${relevantFiles.length} files...`);
  const fileAnalyses = await Promise.all(
    relevantFiles.map(f => analyzeFileWithHaiku(f.fileName, f.content))
  );

  const skippedAnalyses: FileAnalysis[] = skippedByName.map(f => ({
    fileName: f.fileName,
    category: 'general' as const,
    orgRelevance: 1,
    kbRelevance: 1,
    orgReason: '文件名匹配跳过规则',
    kbReason: '文件名匹配跳过规则',
    sensitivity: 'low' as const,
    summary: '文件名过滤跳过',
    suggestedVisibility: 'org' as const,
    suggestedDepartment: '',
    mentionedDepartments: [],
    mentionedRoles: [],
    mentionedNames: [],
  }));

  const allAnalyses = [...fileAnalyses, ...skippedAnalyses];
  console.log(`[Setup AI] Stage 1 complete: scores = [${fileAnalyses.map(f => `${f.fileName}:org${f.orgRelevance}/kb${f.kbRelevance}`).join(', ')}]`);

  const scored = fileAnalyses
    .map((analysis, i) => ({ analysis, file: relevantFiles[i] }))
    .sort((a, b) => b.analysis.orgRelevance - a.analysis.orgRelevance);

  const highValue = scored.filter(s => s.analysis.orgRelevance >= 3);

  const capped = highValue.slice(0, 15);

  let totalChars = 0;
  const finalFiles: { fileName: string; content: string }[] = [];
  for (const item of capped) {
    const charLimit = 8000;
    const contentToSend = item.file.content.slice(0, charLimit);
    if (totalChars + contentToSend.length > 80000) break;
    totalChars += contentToSend.length;
    finalFiles.push({ fileName: item.file.fileName, content: contentToSend });
  }

  const analyzedFileCount = finalFiles.length;
  console.log(`[Setup AI] Stage 1.5 filtering: ${totalFileCount} total → ${relevantFiles.length} after filename → ${highValue.length} org-relevant (orgRelevance≥3) → ${analyzedFileCount} sent to Opus (${totalChars} chars)`);

  console.log(`[Setup AI] Stage 2: Opus deep analysis on ${analyzedFileCount} files...`);
  const profile = await synthesizeWithOpus(allAnalyses, finalFiles);
  console.log(`[Setup AI] Stage 2 complete: ${profile.departments.length} depts, ${profile.jobRoles.length} roles, ${profile.members.length} members`);

  return { ...profile, analyzedFileCount, totalFileCount };
}
