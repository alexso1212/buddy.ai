import OpenAI from 'openai';
import { storage } from '../../storage';
import type { AiProvider } from '@shared/schema';

let _cachedProviders: AiProvider[] | null = null;
let _cacheTime = 0;

async function getVerdictClient(): Promise<OpenAI> {
  const now = Date.now();
  if (!_cachedProviders || now - _cacheTime > 60000) {
    try {
      _cachedProviders = await storage.getAiProviders();
      _cacheTime = now;
    } catch {
      if (!_cachedProviders) {
        const apiKey = process.env.CLAUDE_SIMPLE_API_KEY || process.env.AI_API_KEY || '';
        return new OpenAI({ baseURL: 'https://vip.aipro.love/v1', apiKey, timeout: 30000 });
      }
    }
  }
  const model = 'claude-haiku-4-5-20251001';
  for (const p of _cachedProviders!) {
    if (!p.isActive || !p.models.includes(model)) continue;
    const key = process.env[p.apiKeyEnvVar];
    if (key) return new OpenAI({ baseURL: p.baseUrl, apiKey: key, timeout: p.timeout });
  }
  const apiKey = process.env.CLAUDE_SIMPLE_API_KEY || process.env.AI_API_KEY || '';
  return new OpenAI({ baseURL: 'https://vip.aipro.love/v1', apiKey, timeout: 30000 });
}

const VERDICT_SYSTEM_PROMPT = `你是一个企业权责判定专家。你的职责是客观、公正地判断一个任务分配给某个员工是否合理。

## 判定标准

### verdict 类型
1. **in_scope（份内职责）**: 任务明确落在该员工的岗位职责描述中，属于日常工作范围
2. **stretch（延伸职责）**: 任务与员工的核心职责相关但不完全匹配，属于能力可覆盖但不是主要工作内容
3. **out_of_scope（分外工作）**: 任务明显不在员工的职责范围内，属于其他岗位/部门的工作
4. **shared（跨部门协作）**: 任务涉及多个岗位/部门的协作，不能单独归属于某一个人

### 判定依据（按优先级排序）
1. 员工的岗位职责描述（responsibilities）— 最直接的依据
2. 员工的职责边界说明（boundaries）— 明确排除的工作
3. 员工的所属部门 — 部门职能范围
4. 员工的技能匹配度（requiredSkills vs 任务需求）
5. 历史任务分配模式 — 该员工过去是否做过类似任务
6. 团队中其他成员的岗位匹配度 — 是否有更合适的人选

### confidence 评分标准
- 90-100: 非常确定，职责描述中有明确对应的条目
- 70-89: 比较确定，基于部门职能和技能匹配推断
- 50-69: 不太确定，存在模糊地带，建议管理者判断
- 0-49: 无法判定，信息不足

### 输出格式
你必须以 JSON 格式回复，结构如下：
{
  "verdict": "in_scope | stretch | out_of_scope | shared",
  "confidence": 85,
  "reasoning": "判定理由的详细说明，需要引用具体的岗位职责条目",
  "matchedResponsibilities": ["匹配到的职责条目1", "匹配到的职责条目2"],
  "suggestedAssigneeId": null,
  "suggestedReason": null
}

当 verdict 为 out_of_scope 时，必须提供 suggestedAssigneeId（更合适的人选ID）和 suggestedReason。

### 重要原则
- 基于事实判定，不带情感偏向
- 有多个合理人选时，说明每个人选的匹配度
- 如果岗位职责描述不够详细，降低 confidence 并说明
- 永远不要编造不存在的职责描述
- 在 JSON 之外不要输出任何内容
`;

interface UserWithRole {
  id: number;
  displayName: string;
  deptName: string;
  jobTitle: string | null;
  responsibilities: string[];
  boundaries: string[];
  requiredSkills: string[];
}

interface TaskWithDetails {
  id: number;
  title: string;
  description: string | null;
  projectName: string;
  deptName: string | null;
  priority: string;
  type: string;
  tags: string | null;
}

export interface VerdictResult {
  verdict: 'in_scope' | 'stretch' | 'out_of_scope' | 'shared';
  confidence: number;
  reasoning: string;
  matchedResponsibilities: string[];
  suggestedAssigneeId: number | null;
  suggestedReason: string | null;
}

function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

function robustJsonParse(raw: string): any {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    let extracted = match[0];
    try {
      return JSON.parse(extracted);
    } catch {}

    extracted = extracted.replace(/,\s*([\]}])/g, '$1');
    try {
      return JSON.parse(extracted);
    } catch {}

    extracted = extracted.replace(/[\x00-\x1F\x7F]/g, (ch) => {
      if (ch === '\n' || ch === '\r' || ch === '\t') return ch;
      return '';
    });
    try {
      return JSON.parse(extracted);
    } catch {}
  }

  console.error('robustJsonParse failed. Raw content:', raw.slice(0, 500));
  throw new Error('AI 返回的判定结果格式异常，请重试');
}

async function buildUserWithRole(userId: number): Promise<UserWithRole | null> {
  const user = await storage.getUserById(userId);
  if (!user) return null;
  
  const departments = await storage.getDepartments();
  const dept = departments.find(d => d.id === user.deptId);
  
  let jobTitle: string | null = null;
  let responsibilities: string[] = [];
  let boundaries: string[] = [];
  let requiredSkills: string[] = [];
  
  if (user.jobRoleId) {
    const jobRole = await storage.getJobRoleById(user.jobRoleId);
    if (jobRole) {
      jobTitle = jobRole.title;
      responsibilities = parseJsonArray(jobRole.responsibilities);
      boundaries = parseJsonArray(jobRole.boundaries);
      requiredSkills = parseJsonArray(jobRole.requiredSkills);
    }
  }
  
  return {
    id: user.id,
    displayName: user.displayName,
    deptName: dept?.name ?? '未知部门',
    jobTitle,
    responsibilities,
    boundaries,
    requiredSkills,
  };
}

async function buildAllUsersWithRoles(orgId?: number): Promise<UserWithRole[]> {
  const allUsersRaw = await storage.getUsers();
  const allUsers = orgId ? allUsersRaw.filter((u: any) => u.orgId === orgId) : allUsersRaw;
  const departmentsRaw = await storage.getDepartments();
  const departments = orgId ? departmentsRaw.filter((d: any) => d.orgId === orgId) : departmentsRaw;
  const jobRolesData = await storage.getJobRoles();
  const deptMap = new Map(departments.map(d => [d.id, d]));
  const roleMap = new Map(jobRolesData.map(r => [r.id, r]));
  
  return allUsers
    .filter(u => u.isActive)
    .map(u => {
      const dept = u.deptId ? deptMap.get(u.deptId) : null;
      const jobRole = u.jobRoleId ? roleMap.get(u.jobRoleId) : null;
      return {
        id: u.id,
        displayName: u.displayName,
        deptName: dept?.name ?? '未知部门',
        jobTitle: jobRole?.title ?? null,
        responsibilities: parseJsonArray(jobRole?.responsibilities ?? null),
        boundaries: parseJsonArray(jobRole?.boundaries ?? null),
        requiredSkills: parseJsonArray(jobRole?.requiredSkills ?? null),
      };
    });
}

async function buildTaskWithDetails(taskId: number): Promise<TaskWithDetails | null> {
  const task = await storage.getTaskById(taskId);
  if (!task) return null;
  
  const project = await storage.getProjectById(task.projectId);
  const departments = await storage.getDepartments();
  const dept = project?.deptId ? departments.find(d => d.id === project.deptId) : null;
  
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    projectName: project?.name ?? '未知项目',
    deptName: dept?.name ?? null,
    priority: task.priority,
    type: task.type,
    tags: task.tags,
  };
}

function buildVerdictPrompt(
  task: TaskWithDetails,
  targetUser: UserWithRole,
  allUsers: UserWithRole[]
): string {
  return `
## 待判定的任务
- 标题: ${task.title}
- 描述: ${task.description || '无'}
- 项目: ${task.projectName}
- 项目所属部门: ${task.deptName || '未指定'}
- 优先级: ${task.priority}
- 类型: ${task.type}
- 标签: ${task.tags || '无'}

## 被分配的员工
- 姓名: ${targetUser.displayName}
- 部门: ${targetUser.deptName}
- 岗位: ${targetUser.jobTitle || '未定义'}
- 岗位职责: ${JSON.stringify(targetUser.responsibilities)}
- 职责边界（不负责的事）: ${JSON.stringify(targetUser.boundaries)}
- 所需技能: ${JSON.stringify(targetUser.requiredSkills)}

## 团队中的其他成员（用于判断是否有更合适的人选）
${allUsers.filter(u => u.id !== targetUser.id).map(u => `
- ${u.displayName} (ID: ${u.id}) | 部门: ${u.deptName} | 岗位: ${u.jobTitle || '未定义'}
  职责: ${JSON.stringify(u.responsibilities)}
  技能: ${JSON.stringify(u.requiredSkills)}
`).join('')}

请根据以上信息，判定将该任务分配给「${targetUser.displayName}」是否合理。
`;
}

export interface VerdictResultWithUsage extends VerdictResult {
  tokenUsage?: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function judgeTaskAssignment(
  taskId: number,
  userId: number,
  orgId?: number
): Promise<VerdictResultWithUsage> {
  const task = await buildTaskWithDetails(taskId);
  if (!task) throw new Error('Task not found');
  
  const targetUser = await buildUserWithRole(userId);
  if (!targetUser) throw new Error('User not found');
  
  const allUsers = await buildAllUsersWithRoles(orgId);
  
  const prompt = buildVerdictPrompt(task, targetUser, allUsers);
  
  const modelName = 'claude-sonnet-4-6';
  const client = await getVerdictClient();
  const response = await client.chat.completions.create({
    model: modelName,
    max_tokens: 2048,
    temperature: 0.1,
    messages: [
      { role: 'system', content: VERDICT_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  });
  
  const content = response.choices[0]?.message?.content || '{}';
  
  const result: VerdictResultWithUsage = robustJsonParse(content);

  const usage = response.usage;
  if (usage) {
    result.tokenUsage = {
      model: modelName,
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
    };
  }

  return result;
}
