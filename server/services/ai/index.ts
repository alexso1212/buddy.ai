import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './prompts';
import { ACTION_SCHEMAS } from './actionSchemas';
import { storage } from '../../storage';

const openrouterClient = new OpenAI({
  baseURL: process.env.AI_BASE_URL,
  apiKey: process.env.AI_API_KEY,
  timeout: 30000,
});

const claudeComplexClient = new OpenAI({
  baseURL: 'https://api.anthropic.com/v1/',
  apiKey: process.env.CLAUDE_COMPLEX_API_KEY,
  timeout: 60000,
});

const claudeSimpleClient = new OpenAI({
  baseURL: 'https://api.anthropic.com/v1/',
  apiKey: process.env.CLAUDE_SIMPLE_API_KEY,
  timeout: 30000,
});

const COMPLEX_MODELS = ['claude-opus-4-20250514'];
const SIMPLE_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-20250514'];

function getClientForModel(model: string): OpenAI {
  if (COMPLEX_MODELS.includes(model)) return claudeComplexClient;
  if (SIMPLE_MODELS.includes(model)) return claudeSimpleClient;
  return openrouterClient;
}

interface ChatResponse {
  type: 'text' | 'confirm' | 'multi_confirm' | 'follow_up';
  message?: string;
  action?: {
    actionType: string;
    data: Record<string, any>;
    summary: string;
    confidence: number;
    missingFields?: string[];
    followUpQuestion?: string;
  };
  actions?: {
    actionType: string;
    data: Record<string, any>;
    summary: string;
    confidence: number;
  }[];
  followUp?: {
    message: string;
    creationType: 'task' | 'project';
    partialData: Record<string, any>;
    steps: {
      step: number;
      field: string;
      icon: string;
      label: string;
      options: { label: string; value: any; description?: string; icon?: string }[];
      allowCustomInput: boolean;
      customInputPlaceholder?: string;
      allowSkip: boolean;
      skipValue?: any;
      inputType?: 'text' | 'date' | 'textarea';
    }[];
    currentStep: number;
  };
  tokenUsage?: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getNextDayOfWeek(dayOfWeek: number): Date {
  const now = new Date();
  const current = now.getDay();
  let diff = dayOfWeek - current;
  if (diff <= 0) diff += 7;
  const result = new Date(now);
  result.setDate(now.getDate() + diff);
  return result;
}

function getEndOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
}

function getNextMonthFirst(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function formatDisplayDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function buildGuidedSteps(
  creationType: 'task' | 'project',
  partialData: Record<string, any>,
  missingFields: string[],
  message: string,
  allUsers: any[],
  allProjects: any[],
  allTasks: any[],
  currentUserId: number,
  allDepartments: any[],
  jobRoleMap: Map<number, any>
): ChatResponse {
  const steps: ChatResponse['followUp'] extends undefined ? never : NonNullable<ChatResponse['followUp']>['steps'] = [];
  let stepNum = 1;

  const now = new Date();
  const today = formatDate(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);
  const friday = getNextDayOfWeek(5);
  const fridayStr = formatDate(friday);
  const monday = getNextDayOfWeek(1);
  const mondayStr = formatDate(monday);
  const nextFriday = new Date(friday);
  nextFriday.setDate(friday.getDate() + 7);
  const nextFridayStr = formatDate(nextFriday);
  const endOfMonth = getEndOfMonth();
  const endOfMonthStr = formatDate(endOfMonth);

  const buildUserOptions = () => {
    const opts: { label: string; value: any; description?: string }[] = [];
    const currentUser = allUsers.find((u: any) => u.id === currentUserId);
    if (currentUser) {
      const role = currentUser.jobRoleId ? jobRoleMap.get(currentUser.jobRoleId) : null;
      opts.push({ label: '我自己', value: currentUser.id, description: role?.title || '' });
    }
    for (const u of allUsers) {
      if (u.id !== currentUserId && u.isActive !== false) {
        const role = u.jobRoleId ? jobRoleMap.get(u.jobRoleId) : null;
        opts.push({ label: u.displayName, value: u.id, description: role?.title || '' });
      }
    }
    return opts;
  };

  if (creationType === 'task') {
    const taskFieldOrder = ['title', 'projectId', 'parentTaskId', 'assigneeId', 'dueDate', 'priority', 'weight', 'type', 'description', 'tags'];
    const orderedFields = taskFieldOrder.filter(f => missingFields.includes(f));

    for (const field of orderedFields) {
      const step: any = { step: stepNum++, field, options: [], allowCustomInput: false, allowSkip: false };

      switch (field) {
        case 'title':
          step.icon = '📝';
          step.label = '任务的标题是什么？';
          step.allowCustomInput = true;
          step.customInputPlaceholder = '输入任务标题';
          step.allowSkip = false;
          step.inputType = 'text';
          break;

        case 'projectId':
          step.icon = '📁';
          step.label = '属于哪个项目？';
          step.options = allProjects
            .filter((p: any) => p.status !== 'cancelled')
            .map((p: any) => ({ label: p.name, value: p.id }));
          step.options.push({ label: '➕ 创建新项目', value: 'new_project' });
          step.options.push({ label: '📋 暂不归属项目', value: null });
          step.allowCustomInput = true;
          step.customInputPlaceholder = '输入项目名称搜索...';
          step.allowSkip = false;
          break;

        case 'parentTaskId':
          step.icon = '🏷️';
          step.label = '这是独立任务还是子任务？';
          step.options = [{ label: '独立任务 — 直接挂在项目下', value: null }];
          if (partialData.projectId) {
            const projectTasks = allTasks.filter((t: any) =>
              t.projectId === partialData.projectId && !t.parentTaskId && t.status !== 'cancelled'
            );
            for (const t of projectTasks) {
              step.options.push({ label: t.title, value: t.id, description: `${t.status} | 优先级: ${t.priority}` });
            }
          }
          step.allowCustomInput = false;
          step.allowSkip = true;
          step.skipValue = null;
          break;

        case 'assigneeId':
          step.icon = '👤';
          step.label = '谁来负责？';
          step.options = buildUserOptions();
          step.allowCustomInput = true;
          step.customInputPlaceholder = '输入名字...';
          step.allowSkip = false;
          break;

        case 'dueDate':
          step.icon = '📅';
          step.label = '什么时候需要完成？';
          step.options = [
            { label: `今天 (${formatDisplayDate(now)})`, value: today },
            { label: `明天 (${formatDisplayDate(tomorrow)})`, value: tomorrowStr },
            { label: `本周五 (${formatDisplayDate(friday)})`, value: fridayStr },
            { label: `下周一 (${formatDisplayDate(monday)})`, value: mondayStr },
            { label: `下周五 (${formatDisplayDate(nextFriday)})`, value: nextFridayStr },
            { label: `月底 (${formatDisplayDate(endOfMonth)})`, value: endOfMonthStr },
            { label: '⏭️ 暂不确定，稍后补充', value: null },
          ];
          step.allowCustomInput = true;
          step.inputType = 'date';
          step.allowSkip = true;
          step.skipValue = null;
          break;

        case 'priority':
          step.icon = '🔴';
          step.label = '紧急程度？';
          step.options = [
            { label: '🔴 紧急', value: 'critical', description: '立即处理，阻塞其他工作' },
            { label: '🟠 高', value: 'high', description: '本周内需要重点推进' },
            { label: '🔵 中', value: 'medium', description: '正常优先级' },
            { label: '⚪ 低', value: 'low', description: '有空再处理' },
          ];
          step.allowSkip = true;
          step.skipValue = 'medium';
          break;

        case 'weight':
          step.icon = '⚖️';
          step.label = '重要程度？（影响图谱节点大小，1-10）';
          step.options = [
            { label: '1-3 小事项', value: 2 },
            { label: '4-6 一般', value: 5 },
            { label: '7-8 重要', value: 8 },
            { label: '9-10 核心', value: 10 },
          ];
          step.allowCustomInput = true;
          step.customInputPlaceholder = '输入具体数值';
          step.allowSkip = true;
          step.skipValue = 3;
          break;

        case 'type':
          step.icon = '📋';
          step.label = '任务类型？';
          step.options = [
            { label: '任务', value: 'task' },
            { label: '里程碑', value: 'milestone' },
            { label: 'Bug', value: 'bug' },
            { label: '需求', value: 'request' },
          ];
          step.allowSkip = true;
          step.skipValue = 'task';
          break;

        case 'description':
          step.icon = '📝';
          step.label = '需要添加描述吗？';
          step.allowCustomInput = true;
          step.inputType = 'textarea';
          step.customInputPlaceholder = '输入任务描述...';
          step.allowSkip = true;
          step.skipValue = null;
          break;

        case 'tags':
          step.icon = '🏷️';
          step.label = '添加标签？';
          step.allowCustomInput = true;
          step.customInputPlaceholder = '输入标签，用逗号分隔';
          step.allowSkip = true;
          step.skipValue = null;
          break;
      }

      steps.push(step);
    }
  } else {
    const projectFieldOrder = ['name', 'description', 'deptId', 'ownerId', 'startDate', 'targetDate'];
    const orderedFields = projectFieldOrder.filter(f => missingFields.includes(f));

    const nextMonthFirst = getNextMonthFirst();

    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(now.getMonth() + 1);
    const twoMonthsLater = new Date(now);
    twoMonthsLater.setMonth(now.getMonth() + 2);
    const quarterEnd = new Date(now.getFullYear(), Math.ceil((now.getMonth() + 1) / 3) * 3, 0);
    const halfYearLater = new Date(now);
    halfYearLater.setMonth(now.getMonth() + 6);

    for (const field of orderedFields) {
      const step: any = { step: stepNum++, field, options: [], allowCustomInput: false, allowSkip: false };

      switch (field) {
        case 'name':
          step.icon = '🏗️';
          step.label = '项目名称是什么？';
          step.allowCustomInput = true;
          step.inputType = 'text';
          step.allowSkip = false;
          break;

        case 'description':
          step.icon = '📝';
          step.label = '简单描述一下项目目标和背景：';
          step.allowCustomInput = true;
          step.inputType = 'textarea';
          step.customInputPlaceholder = '输入项目描述';
          step.allowSkip = true;
          step.skipValue = null;
          break;

        case 'deptId':
          step.icon = '🏢';
          step.label = '属于哪个部门？';
          step.options = allDepartments.map((d: any) => ({ label: d.name, value: d.id }));
          step.allowCustomInput = true;
          step.customInputPlaceholder = '输入部门名称...';
          step.allowSkip = true;
          break;

        case 'ownerId':
          step.icon = '👤';
          step.label = '谁是项目负责人？';
          step.options = buildUserOptions();
          step.allowCustomInput = true;
          step.allowSkip = false;
          break;

        case 'startDate':
          step.icon = '📅';
          step.label = '项目什么时候开始？';
          step.options = [
            { label: `今天 (${formatDisplayDate(now)})`, value: today },
            { label: `下周一 (${formatDisplayDate(monday)})`, value: mondayStr },
            { label: `下月1号 (${formatDisplayDate(nextMonthFirst)})`, value: formatDate(nextMonthFirst) },
          ];
          step.allowSkip = true;
          step.inputType = 'date';
          break;

        case 'targetDate':
          step.icon = '🎯';
          step.label = '预计什么时候完成？';
          step.options = [
            { label: `1个月后 (${formatDisplayDate(oneMonthLater)})`, value: formatDate(oneMonthLater) },
            { label: `2个月后 (${formatDisplayDate(twoMonthsLater)})`, value: formatDate(twoMonthsLater) },
            { label: `季度末 (${formatDisplayDate(quarterEnd)})`, value: formatDate(quarterEnd) },
            { label: `半年后 (${formatDisplayDate(halfYearLater)})`, value: formatDate(halfYearLater) },
          ];
          step.allowSkip = true;
          step.inputType = 'date';
          break;
      }

      steps.push(step);
    }
  }

  return {
    type: 'follow_up',
    followUp: {
      message: message || '需要确认几个信息：',
      creationType,
      partialData,
      steps,
      currentStep: 1,
    },
  };
}

function buildDisplayData(data: Record<string, any>, users: any[], projects: any[]): Record<string, string> {
  const display: Record<string, string> = {};

  if (data.projectId && typeof data.projectId === 'number') {
    const project = projects.find((p: any) => p.id === data.projectId);
    if (project) display.projectName = project.name;
  }

  if (data.assigneeId && typeof data.assigneeId === 'number') {
    const user = users.find((u: any) => u.id === data.assigneeId);
    if (user) display.assigneeName = user.displayName || user.email;
  }

  const priorityMap: Record<string, string> = {
    critical: '\u{1F534} \u7D27\u6025',
    high: '\u{1F7E0} \u9AD8',
    medium: '\u{1F7E1} \u4E2D',
    low: '\u{1F7E2} \u4F4E',
    none: '\u26AA \u65E0',
  };
  if (data.priority && priorityMap[data.priority]) {
    display.priorityLabel = priorityMap[data.priority];
  }

  const statusMap: Record<string, string> = {
    todo: '\u5F85\u529E',
    in_progress: '\u8FDB\u884C\u4E2D',
    done: '\u5DF2\u5B8C\u6210',
    blocked: '\u5DF2\u963B\u585E',
    cancelled: '\u5DF2\u53D6\u6D88',
  };
  if (data.status && statusMap[data.status]) {
    display.statusLabel = statusMap[data.status];
  }

  return display;
}

function formatTeamMembers(users: { id: number; displayName: string; role: string; email: string }[]): string {
  return users.map(u => `- ID:${u.id} ${u.displayName}（${u.role}）${u.email}`).join('\n');
}

function formatProjectList(projects: { id: number; name: string; status: string; description?: string | null }[]): string {
  return projects.map(p => `- ID:${p.id} ${p.name}（${p.status}）${p.description || ''}`).join('\n');
}

async function executeQuery(actionType: string, data: Record<string, any>): Promise<string> {
  switch (actionType) {
    case 'query_tasks': {
      const filters: Record<string, any> = {};
      if (data.projectId) filters.projectId = data.projectId;
      if (data.assigneeId) filters.assigneeId = data.assigneeId;
      if (data.status) filters.status = data.status;
      const tasks = await storage.getTasks(filters);
      if (tasks.length === 0) return '当前没有符合条件的任务。';
      const lines = tasks.map((t, i) =>
        `${i + 1}. ${t.title}（${t.status}，优先级: ${t.priority}${t.dueDate ? '，截止: ' + new Date(t.dueDate).toLocaleDateString('zh-CN') : ''}）`
      );
      return `共找到 ${tasks.length} 个任务：\n${lines.join('\n')}`;
    }
    case 'query_projects': {
      const projects = await storage.getProjects();
      if (projects.length === 0) return '当前没有项目。';
      const lines = projects.map((p, i) =>
        `${i + 1}. ${p.name}（${p.status}${p.targetDate ? '，目标: ' + new Date(p.targetDate).toLocaleDateString('zh-CN') : ''}）`
      );
      return `共 ${projects.length} 个项目：\n${lines.join('\n')}`;
    }
    case 'query_verdicts': {
      const verdicts = data.userId 
        ? await storage.getVerdictsByUserId(data.userId)
        : data.taskId
          ? await storage.getVerdictsByTaskId(data.taskId)
          : await storage.getAllVerdicts();
      
      if (verdicts.length === 0) return '暂无权责判定记录。';
      
      if (data.userId) {
        const user = await storage.getUserById(data.userId);
        const stats = { in_scope: 0, stretch: 0, out_of_scope: 0, shared: 0, total: 0 };
        for (const v of verdicts) {
          if (v.verdict in stats) (stats as any)[v.verdict]++;
          stats.total++;
        }
        const pct = (n: number) => stats.total > 0 ? Math.round(n / stats.total * 100) : 0;
        return `${user?.displayName || 'Unknown'}的权责分布（共${stats.total}条判定）：\n` +
          `- 份内职责: ${pct(stats.in_scope)}% (${stats.in_scope}个)\n` +
          `- 延伸职责: ${pct(stats.stretch)}% (${stats.stretch}个)\n` +
          `- 分外工作: ${pct(stats.out_of_scope)}% (${stats.out_of_scope}个)\n` +
          `- 跨部门协作: ${pct(stats.shared)}% (${stats.shared}个)`;
      }
      
      const lines = verdicts.slice(0, 10).map((v, i) => 
        `${i + 1}. 任务ID:${v.taskId} → 用户ID:${v.userId} | ${v.verdict} (${v.confidence}%)`
      );
      return `共${verdicts.length}条判定记录：\n${lines.join('\n')}`;
    }
    case 'query_overview': {
      const allTasks = await storage.getTasks({});
      const total = allTasks.length;
      const byStatus: Record<string, number> = {};
      let overdue = 0;
      const now = new Date();
      for (const t of allTasks) {
        byStatus[t.status] = (byStatus[t.status] || 0) + 1;
        if (t.dueDate && new Date(t.dueDate) < now && t.status !== 'done' && t.status !== 'cancelled') {
          overdue++;
        }
      }
      const statusLines = Object.entries(byStatus).map(([s, c]) => `${s}: ${c}`).join('，');
      return `任务总览：共 ${total} 个任务\n状态分布：${statusLines}\n逾期任务：${overdue} 个`;
    }
    default:
      return '不支持的查询类型';
  }
}

function formatTaskList(tasks: any[], users: any[]): string {
  const userMap = new Map(users.map(u => [u.id, u.displayName]));
  if (tasks.length === 0) return '（暂无任务）';
  return tasks.map(t => {
    const assignee = t.assigneeId ? userMap.get(t.assigneeId) || `ID:${t.assigneeId}` : '未分配';
    const due = t.dueDate ? new Date(t.dueDate).toLocaleDateString('zh-CN') : '';
    return `- ID:${t.id}「${t.title}」状态:${t.status} 优先级:${t.priority} 负责人:${assignee}${due ? ' 截止:' + due : ''} 进度:${t.progress}%`;
  }).join('\n');
}

export async function chat(
  message: string,
  conversationHistory: { role: string; content: string }[],
  context: { currentUserId: number; currentUserName: string; customSystemPrompt?: string; model?: string }
): Promise<ChatResponse> {
  const allUsers = await storage.getUsers();
  const allProjects = await storage.getProjects();
  const allTasks = await storage.getTasks({});
  const allDepartments = await storage.getDepartments();
  const allJobRoles = await storage.getJobRoles();
  const jobRoleMap = new Map(allJobRoles.map(r => [r.id, r]));

  const activeTasks = allTasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');

  const systemPrompt = (context.customSystemPrompt ? context.customSystemPrompt + '\n\n' : '') + SYSTEM_PROMPT
    .replace('{{currentUserId}}', String(context.currentUserId))
    .replace('{{currentUserName}}', context.currentUserName)
    .replace('{{currentTime}}', new Date().toISOString())
    .replace('{{teamMembers}}', formatTeamMembers(allUsers))
    .replace('{{projectList}}', formatProjectList(allProjects))
    .replace('{{taskList}}', formatTaskList(activeTasks, allUsers))
    .replace('{{totalTasks}}', String(allTasks.length))
    .replace('{{doneTasks}}', String(allTasks.filter(t => t.status === 'done').length))
    .replace('{{overdueTasks}}', String(allTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done' && t.status !== 'cancelled').length));

  const modelName = context.model || 'claude-sonnet-4-20250514';
  const aiClient = getClientForModel(modelName);
  const response = await aiClient.chat.completions.create({
    model: modelName,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ],
  });

  const usage = response.usage;
  const tokenInfo: ChatResponse['tokenUsage'] = usage ? {
    model: modelName,
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  } : undefined;

  let aiText = response.choices[0]?.message?.content || '';

  const codeBlockMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    aiText = codeBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(aiText);

    if (!parsed.type || !['text', 'confirm', 'multi_confirm', 'follow_up'].includes(parsed.type)) {
      if (parsed.message && typeof parsed.message === 'string') {
        return { type: 'text', message: parsed.message, tokenUsage: tokenInfo };
      }
      return { type: 'text', message: aiText, tokenUsage: tokenInfo };
    }

    if (parsed.type === 'follow_up') {
      const ct = parsed.creationType || 'task';
      const pd = parsed.partialData || {};
      const mf = parsed.missingFields || ['projectId', 'assigneeId', 'dueDate'];
      const result = buildGuidedSteps(ct, pd, mf, parsed.message || '需要确认几个信息：', allUsers, allProjects, allTasks, context.currentUserId, allDepartments, jobRoleMap);
      result.tokenUsage = tokenInfo;
      return result;
    }

    if (parsed.type === 'confirm' && parsed.action) {
      if (parsed.action.actionType && parsed.action.actionType.startsWith('query_')) {
        const result = await executeQuery(parsed.action.actionType, parsed.action.data || {});
        return { type: 'text', message: result, tokenUsage: tokenInfo };
      }

      if (parsed.action.actionType === 'create_task') {
        const schema = ACTION_SCHEMAS['create_task'];
        if (schema) {
          const validation = schema.safeParse(parsed.action.data);
          if (!validation.success) {
            const actionData = parsed.action.data || {};
            if (actionData.title) {
              const missingFields: string[] = [];
              if (!actionData.projectId) missingFields.push('projectId');
              if (!actionData.assigneeId) missingFields.push('assigneeId');
              if (!actionData.dueDate) missingFields.push('dueDate');
              const result = buildGuidedSteps(
                'task',
                actionData,
                missingFields,
                `好的，帮你创建「${actionData.title}」的任务，需要确认几个信息：`,
                allUsers, allProjects, allTasks, context.currentUserId, allDepartments, jobRoleMap
              );
              result.tokenUsage = tokenInfo;
              return result;
            }
            return {
              type: 'text',
              message: '抱歉，我生成的操作数据有误。请重新描述一下你的需求。',
            };
          }
        }

        if (parsed.action.confidence < 0.7) {
          const actionData = parsed.action.data || {};
          const missingKey = ['projectId', 'assigneeId', 'dueDate'].some(f => !actionData[f]);
          if (missingKey && actionData.title) {
            const missingFields: string[] = [];
            if (!actionData.projectId) missingFields.push('projectId');
            if (!actionData.assigneeId) missingFields.push('assigneeId');
            if (!actionData.dueDate) missingFields.push('dueDate');
            const result = buildGuidedSteps(
              'task',
              actionData,
              missingFields,
              `好的，帮你创建「${actionData.title}」的任务，需要确认几个信息：`,
              allUsers, allProjects, allTasks, context.currentUserId, allDepartments, jobRoleMap
            );
            result.tokenUsage = tokenInfo;
            return result;
          }
        }
      }

      const schema = ACTION_SCHEMAS[parsed.action.actionType];
      if (schema && parsed.action.actionType !== 'create_task') {
        const validation = schema.safeParse(parsed.action.data);
        if (!validation.success) {
          return {
            type: 'text',
            message: '抱歉，我生成的操作数据有误。请重新描述一下你的需求。',
          };
        }
      }
    }

    if (parsed.type === 'multi_confirm' && parsed.actions) {
      const queryActions = parsed.actions.filter((a: any) => a.actionType?.startsWith('query_'));
      const writeActions = parsed.actions.filter((a: any) => !a.actionType?.startsWith('query_'));

      if (queryActions.length > 0) {
        const queryResults = await Promise.all(
          queryActions.map((a: any) => executeQuery(a.actionType, a.data || {}))
        );
        const queryText = queryResults.join('\n\n');

        if (writeActions.length === 0) {
          return { type: 'text', message: queryText };
        }

        return {
          type: 'multi_confirm',
          message: queryText,
          actions: writeActions,
        };
      }

      for (const action of parsed.actions) {
        const schema = ACTION_SCHEMAS[action.actionType];
        if (schema) {
          const validation = schema.safeParse(action.data);
          if (!validation.success) {
            return {
              type: 'text',
              message: '抱歉，批量操作中有数据验证失败。请重新描述一下你的需求。',
            };
          }
        }
      }
    }

    if (parsed.type === 'confirm' && parsed.action) {
      parsed.action.displayData = buildDisplayData(parsed.action.data, allUsers, allProjects);
    }
    if (parsed.type === 'multi_confirm' && parsed.actions) {
      for (const action of parsed.actions) {
        action.displayData = buildDisplayData(action.data, allUsers, allProjects);
      }
    }

    parsed.tokenUsage = tokenInfo;
    return parsed;
  } catch {
    return { type: 'text', message: aiText, tokenUsage: tokenInfo };
  }
}

export async function generateProjectTasks(
  projectName: string,
  projectDescription: string,
  context: { currentUserId: number; currentUserName: string }
): Promise<{ tasks: { title: string; description?: string; priority: string; type: string }[]; tokenUsage?: ChatResponse['tokenUsage'] }> {
  const genModel = 'claude-sonnet-4-20250514';
  const genClient = getClientForModel(genModel);
  const response = await genClient.chat.completions.create({
    model: genModel,
    max_tokens: 2048,
    messages: [
      {
        role: 'system',
        content: `你是一个项目管理专家。用户正在创建一个新项目，请根据项目名称和描述，建议 3-8 个初始任务来拆解这个项目。

输出格式为纯 JSON（不要用 markdown 包裹）：
{
  "tasks": [
    { "title": "任务标题", "description": "简短描述", "priority": "medium", "type": "task" },
    ...
  ]
}

规则：
- 每个任务标题应简洁明确
- 任务应覆盖项目的主要工作模块
- 按逻辑顺序排列
- priority 从 critical/high/medium/low 中选择
- type 一般用 "task"，关键节点用 "milestone"
- 不要编造具体的人名或日期`
      },
      {
        role: 'user',
        content: `项目名称：${projectName}\n项目描述：${projectDescription || '暂无描述'}`
      }
    ],
  });

  const usage = response.usage;
  const modelName = 'claude-sonnet-4-20250514';
  const tokenInfo = usage ? {
    model: modelName,
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  } : undefined;

  let aiText = response.choices[0]?.message?.content || '';
  const codeBlockMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    aiText = codeBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(aiText);
    return { tasks: parsed.tasks || [], tokenUsage: tokenInfo };
  } catch {
    return { tasks: [], tokenUsage: tokenInfo };
  }
}
