import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './prompts';
import { ACTION_SCHEMAS } from './actionSchemas';
import { storage } from '../../storage';

const client = new OpenAI({
  baseURL: process.env.AI_BASE_URL,
  apiKey: process.env.AI_API_KEY,
  timeout: 30000,
});

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
    partialData: Record<string, any>;
    questions: {
      field: string;
      label: string;
      emoji: string;
      options: { label: string; value: any }[];
      allowCustom?: boolean;
    }[];
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

function buildFollowUpResponse(
  parsed: any,
  allUsers: { id: number; displayName: string }[],
  allProjects: { id: number; name: string }[],
  currentUserId: number
): ChatResponse {
  const data = parsed.partialData || parsed.action?.data || {};
  const aiQuestions: any[] = parsed.questions || [];

  const fieldEmojis: Record<string, { label: string; emoji: string }> = {
    projectId: { label: '属于哪个项目？', emoji: '📁' },
    assigneeId: { label: '谁负责？', emoji: '👤' },
    priority: { label: '优先级？', emoji: '🔴' },
    dueDate: { label: '截止日期？', emoji: '📅' },
    type: { label: '任务类型？', emoji: '📋' },
  };

  const now = new Date();
  const today = formatDate(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);
  const friday = getNextDayOfWeek(5);
  const fridayStr = formatDate(friday);
  const monday = getNextDayOfWeek(1);
  const mondayStr = formatDate(monday);

  const optionGenerators: Record<string, () => { options: { label: string; value: any }[]; allowCustom?: boolean }> = {
    projectId: () => ({
      options: allProjects.map(p => ({ label: p.name, value: p.id })),
    }),
    assigneeId: () => {
      const opts: { label: string; value: any }[] = [];
      const currentUser = allUsers.find(u => u.id === currentUserId);
      if (currentUser) {
        opts.push({ label: '我自己', value: currentUser.id });
      }
      for (const u of allUsers) {
        if (u.id !== currentUserId) {
          opts.push({ label: u.displayName, value: u.id });
        }
      }
      return { options: opts };
    },
    priority: () => ({
      options: [
        { label: '紧急', value: 'critical' },
        { label: '高', value: 'high' },
        { label: '中', value: 'medium' },
        { label: '低', value: 'low' },
      ],
    }),
    dueDate: () => ({
      options: [
        { label: '今天', value: today },
        { label: '明天', value: tomorrowStr },
        { label: '本周五', value: fridayStr },
        { label: '下周一', value: mondayStr },
      ],
      allowCustom: true,
    }),
    type: () => ({
      options: [
        { label: '任务', value: 'task' },
        { label: '里程碑', value: 'milestone' },
      ],
    }),
  };

  const questions: ChatResponse['followUp'] extends undefined ? never : NonNullable<ChatResponse['followUp']>['questions'] = [];

  if (aiQuestions.length > 0) {
    for (const q of aiQuestions) {
      if (data[q.field] !== undefined && data[q.field] !== null) continue;
      const gen = optionGenerators[q.field];
      if (gen) {
        const { options, allowCustom } = gen();
        questions.push({
          field: q.field,
          label: q.label || fieldEmojis[q.field]?.label || q.field,
          emoji: q.emoji || fieldEmojis[q.field]?.emoji || '❓',
          options,
          allowCustom,
        });
      }
    }
  } else {
    const missingFields = ['projectId', 'assigneeId', 'dueDate', 'type'].filter(f => {
      return data[f] === undefined || data[f] === null;
    });
    if (!data.priority && missingFields.length > 0) {
      missingFields.push('priority');
    }
    for (const field of missingFields) {
      const gen = optionGenerators[field];
      if (gen) {
        const info = fieldEmojis[field];
        const { options, allowCustom } = gen();
        questions.push({
          field,
          label: info?.label || field,
          emoji: info?.emoji || '❓',
          options,
          allowCustom,
        });
      }
    }
  }

  return {
    type: 'follow_up',
    followUp: {
      message: parsed.message || `需要确认几个信息：`,
      partialData: data,
      questions,
    },
  };
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
  context: { currentUserId: number; currentUserName: string }
): Promise<ChatResponse> {
  const allUsers = await storage.getUsers();
  const allProjects = await storage.getProjects();
  const allTasks = await storage.getTasks({});

  const activeTasks = allTasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');

  const systemPrompt = SYSTEM_PROMPT
    .replace('{{currentUserId}}', String(context.currentUserId))
    .replace('{{currentUserName}}', context.currentUserName)
    .replace('{{currentTime}}', new Date().toISOString())
    .replace('{{teamMembers}}', formatTeamMembers(allUsers))
    .replace('{{projectList}}', formatProjectList(allProjects))
    .replace('{{taskList}}', formatTaskList(activeTasks, allUsers))
    .replace('{{totalTasks}}', String(allTasks.length))
    .replace('{{doneTasks}}', String(allTasks.filter(t => t.status === 'done').length))
    .replace('{{overdueTasks}}', String(allTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done' && t.status !== 'cancelled').length));

  const response = await client.chat.completions.create({
    model: 'claude-sonnet-4-20250514',
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

  let aiText = response.choices[0]?.message?.content || '';

  const codeBlockMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    aiText = codeBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(aiText);

    if (!parsed.type || !['text', 'confirm', 'multi_confirm', 'follow_up'].includes(parsed.type)) {
      if (parsed.message && typeof parsed.message === 'string') {
        return { type: 'text', message: parsed.message };
      }
      return { type: 'text', message: aiText };
    }

    if (parsed.type === 'follow_up') {
      return buildFollowUpResponse(parsed, allUsers, allProjects, context.currentUserId);
    }

    if (parsed.type === 'confirm' && parsed.action) {
      if (parsed.action.actionType && parsed.action.actionType.startsWith('query_')) {
        const result = await executeQuery(parsed.action.actionType, parsed.action.data || {});
        return { type: 'text', message: result };
      }

      if (parsed.action.actionType === 'create_task') {
        const schema = ACTION_SCHEMAS['create_task'];
        if (schema) {
          const validation = schema.safeParse(parsed.action.data);
          if (!validation.success) {
            const actionData = parsed.action.data || {};
            if (actionData.title) {
              return buildFollowUpResponse(
                {
                  message: `好的，帮你创建「${actionData.title}」的任务，需要确认几个信息：`,
                  partialData: actionData,
                  questions: [],
                },
                allUsers,
                allProjects,
                context.currentUserId
              );
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
            return buildFollowUpResponse(
              {
                message: `好的，帮你创建「${actionData.title}」的任务，需要确认几个信息：`,
                partialData: actionData,
                questions: [],
              },
              allUsers,
              allProjects,
              context.currentUserId
            );
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

    return parsed;
  } catch {
    return { type: 'text', message: aiText };
  }
}
