import OpenAI from 'openai';

const aiClient = new OpenAI({
  baseURL: 'https://vip.aipro.love/v1',
  apiKey: process.env.CLAUDE_SIMPLE_API_KEY || '',
  timeout: 90000,
});

const complexClient = new OpenAI({
  baseURL: 'https://vip.aipro.love/v1',
  apiKey: process.env.CLAUDE_COMPLEX_API_KEY || '',
  timeout: 180000,
});

export interface FileAnalysis {
  fileName: string;
  category: 'policy' | 'contract' | 'jd' | 'manual' | 'general';
  visibility: 'org' | 'admin' | 'department';
  visibleDepartment?: string;
  summary: string;
  mentionedDepartments: string[];
  mentionedRoles: string[];
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

async function analyzeFileWithHaiku(fileName: string, content: string): Promise<FileAnalysis> {
  try {
    const response = await aiClient.chat.completions.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `你是一个企业文档分析助手。分析以下企业文档，返回纯 JSON（不要 markdown 代码块）。

返回格式：
{
  "category": "policy/contract/jd/manual/general 五选一",
  "visibility": "org/admin/department 三选一",
  "visibleDepartment": "如果visibility=department，填部门名（否则填空字符串）",
  "summary": "一句话概括文档内容（30字以内）",
  "mentionedDepartments": ["文档中提到的部门名称列表"],
  "mentionedRoles": ["文档中提到的岗位/职位名称列表"]
}

分类标准：
- policy：规章制度、考勤、休假、行为准则、报销流程
- contract：劳动合同、保密协议、竞业限制
- jd：岗位说明书、职位描述、KPI考核标准
- manual：操作手册、培训资料、使用指南
- general：其他

可见性判断：
- org：全员应知的（考勤、办公规范、报销流程）
- admin：涉及薪资、合同条款、人事的敏感文件
- department：只和特定部门相关的文件`
        },
        {
          role: 'user',
          content: `文件名：${fileName}\n\n文件内容：\n${content.slice(0, 6000)}`
        }
      ],
    });

    const text = response.choices[0]?.message?.content || '';
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      fileName,
      category: parsed.category || 'general',
      visibility: parsed.visibility || 'org',
      visibleDepartment: parsed.visibleDepartment || '',
      summary: parsed.summary || '',
      mentionedDepartments: parsed.mentionedDepartments || [],
      mentionedRoles: parsed.mentionedRoles || [],
    };
  } catch (err: any) {
    console.error(`[Setup AI] Haiku analysis failed for ${fileName}:`, err.message);
    return {
      fileName,
      category: 'general',
      visibility: 'org',
      summary: '无法自动分析',
      mentionedDepartments: [],
      mentionedRoles: [],
    };
  }
}

async function synthesizeWithSonnet(fileAnalyses: FileAnalysis[], fileContents: { fileName: string; content: string }[]): Promise<EnterpriseProfile> {
  const summaryBlock = fileAnalyses.map(f =>
    `【${f.fileName}】类型:${f.category} | 摘要:${f.summary} | 提到的部门:${f.mentionedDepartments.join(',')} | 提到的岗位:${f.mentionedRoles.join(',')}`
  ).join('\n');

  const keyContents = fileContents
    .filter(f => {
      const analysis = fileAnalyses.find(a => a.fileName === f.fileName);
      return analysis && ['jd', 'policy', 'contract'].includes(analysis.category);
    })
    .slice(0, 5)
    .map(f => `### ${f.fileName}\n${f.content.slice(0, 3000)}`)
    .join('\n\n');

  try {
    const response = await complexClient.chat.completions.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `你是一个企业组织架构分析专家。根据多份企业文件的分析摘要，整合出完整的企业组织信息。

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

人员提取规则：
- 从组织架构图、通讯录、劳动合同、签名栏等位置识别人员
- aliases 很重要——收集文件中出现的该人的所有不同称呼
- 如果同一个人在多份文件中出现，合并信息（用最完整的版本）
- 不要提取客户、供应商等外部人员，只提取公司内部员工
- 如果文件中有明确的汇报关系（如"向XX汇报"），记录在该人的 contractHighlights 中
- 不要提取薪资等敏感信息，只提取职责相关的条款`
        },
        {
          role: 'user',
          content: `以下是对一家企业${fileAnalyses.length}份文件的分析结果：

## 文件摘要
${summaryBlock}

## 关键文件内容节选
${keyContents || '（无关键文件内容）'}

请从以上信息中整合出这家企业的组织架构。`
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
      fileClassifications: fileAnalyses,
    };
  } catch (err: any) {
    console.error('[Setup AI] Sonnet synthesis failed:', err.message);
    return {
      companyName: '',
      companyDescription: '',
      departments: [],
      jobRoles: [],
      members: [],
      fileClassifications: fileAnalyses,
    };
  }
}

export async function extractEnterpriseProfile(files: { fileName: string; content: string }[]): Promise<EnterpriseProfile> {
  console.log(`[Setup AI] Starting extraction for ${files.length} files`);

  console.log('[Setup AI] Phase 1: Haiku file analysis...');
  const fileAnalyses = await Promise.all(
    files.map(f => analyzeFileWithHaiku(f.fileName, f.content))
  );
  console.log(`[Setup AI] Phase 1 complete: ${fileAnalyses.length} files analyzed`);

  console.log('[Setup AI] Phase 2: Sonnet synthesis...');
  const profile = await synthesizeWithSonnet(fileAnalyses, files);
  console.log(`[Setup AI] Phase 2 complete: ${profile.departments.length} depts, ${profile.jobRoles.length} roles`);

  return profile;
}
