import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { storage } from '../../storage';
import { aggregateBriefingData, BriefingData } from './dataAggregator';

async function briefingComplete(params: { model: string; max_tokens: number; temperature?: number; messages: { role: string; content: string }[] }): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const systemMsg = params.messages.find(m => m.role === 'system');
    const nonSystem = params.messages.filter(m => m.role !== 'system');
    const resp = await client.messages.create({
      model: params.model,
      max_tokens: params.max_tokens,
      temperature: params.temperature ?? 0,
      ...(systemMsg ? { system: systemMsg.content } : {}),
      messages: nonSystem.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    });
    return resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  }
  const aiClient = new OpenAI({
    baseURL: 'https://vip.aipro.love/v1',
    apiKey: process.env.CLAUDE_SIMPLE_API_KEY || '',
    timeout: 30000,
  });
  const resp = await aiClient.chat.completions.create({
    model: params.model,
    max_tokens: params.max_tokens,
    temperature: params.temperature,
    messages: params.messages as any,
  });
  return resp.choices[0]?.message?.content || '';
}

export interface BriefingAction {
  type: 'reassign' | 'change_priority' | 'remind';
  description: string;
  taskId?: number;
  taskTitle?: string;
  fromUserId?: number;
  toUserId?: number;
  toUserName?: string;
  priority?: string;
}

export async function getTodayBriefing(orgId: number, userId: number): Promise<{
  content: string;
  isNew: boolean;
  date: string;
  actions: BriefingAction[];
}> {
  const today = new Date().toISOString().slice(0, 10);

  const data = await aggregateBriefingData(orgId, userId);
  const actions = generateActions(data);

  const cached = await storage.getBriefing(orgId, userId, today);
  if (cached) {
    return { content: cached.content, isNew: false, date: today, actions };
  }

  const content = await generateBriefingWithAI(data, today);

  try {
    await storage.createBriefing({
      orgId,
      userId,
      date: today,
      content,
      dataSnapshot: JSON.stringify(data),
      model: 'claude-haiku-4-5-20251001',
      tokenCount: 0,
    });
  } catch (err: any) {
    console.warn('[Briefing] Failed to cache:', err.message);
  }

  return { content, isNew: true, date: today, actions };
}

function generateActions(data: BriefingData): BriefingAction[] {
  const actions: BriefingAction[] = [];

  for (const t of data.tasksOverdue) {
    if (t.daysOverdue >= 3) {
      actions.push({
        type: 'change_priority',
        description: `"${t.title}" 已逾期 ${t.daysOverdue} 天，建议提升优先级为紧急`,
        taskId: t.id,
        taskTitle: t.title,
        priority: 'urgent',
      });
    }
    actions.push({
      type: 'remind',
      description: `提醒 ${t.assigneeName} 跟进逾期任务 "${t.title}"`,
      taskId: t.id,
      taskTitle: t.title,
      toUserId: t.assigneeId,
      toUserName: t.assigneeName,
    });
  }

  if (data.busiestMember && data.busiestMember.activeTaskCount >= 5) {
    const busiestName = data.busiestMember.name;
    const busiestUserId = data.busiestMember.userId;
    for (const t of data.tasksDueToday) {
      if (t.assigneeName === busiestName) {
        actions.push({
          type: 'reassign',
          description: `${busiestName} 负载较高(${data.busiestMember.activeTaskCount}个任务)，建议转派 "${t.title}"`,
          taskId: t.id,
          taskTitle: t.title,
          fromUserId: busiestUserId,
        });
        break;
      }
    }
  }

  for (const t of data.tasksDueToday) {
    actions.push({
      type: 'remind',
      description: `"${t.title}" 今日到期，提醒 ${t.assigneeName} 按时完成`,
      taskId: t.id,
      taskTitle: t.title,
      toUserId: t.assigneeId,
      toUserName: t.assigneeName,
    });
  }

  return actions.slice(0, 5);
}

async function generateBriefingWithAI(data: BriefingData, dateStr: string): Promise<string> {
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date(dateStr).getDay()];

  const dataBlock = `
当前日期：${dateStr}（周${weekday}）
用户：${data.userName}
组织：${data.orgName}
团队人数：${data.memberCount}

活跃任务总数：${data.totalActiveTasks}

今日到期任务（${data.tasksDueToday.length}个）：
${data.tasksDueToday.length > 0 ? data.tasksDueToday.map(t => `- 「${t.title}」负责人：${t.assigneeName}`).join('\n') : '无'}

逾期任务（${data.tasksOverdue.length}个）：
${data.tasksOverdue.length > 0 ? data.tasksOverdue.map(t => `- 「${t.title}」已逾期${t.daysOverdue}天，负责人：${t.assigneeName}`).join('\n') : '无'}

昨日完成任务（${data.tasksCompletedYesterday.length}个）：
${data.tasksCompletedYesterday.length > 0 ? data.tasksCompletedYesterday.map(t => `- 「${t.title}」完成者：${t.completedBy}`).join('\n') : '无'}

昨日新建任务数：${data.tasksCreatedYesterday}

团队负载最高：${data.busiestMember ? `${data.busiestMember.name}（${data.busiestMember.activeTaskCount}个进行中任务）` : '无数据'}

知识库文档数：${data.kbDocCount}
最近上传：${data.kbRecentUploads.length > 0 ? data.kbRecentUploads.map(d => d.title).join('、') : '无'}
`.trim();

  try {
    const content = await briefingComplete({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content: `你是一个企业管理AI助手，每天早上给老板生成一份简洁的工作简报。

要求：
- 用 Markdown 格式
- 语气亲切专业，像一个靠谱的助理在汇报
- 以"早安"开头，包含日期和星期
- 分为以下几个板块（如果某个板块没有数据就跳过，不要写"无"）：
  📋 今日重点（今日到期的任务，最多5个）
  ⚠️ 需要关注（逾期任务，语气要有紧迫感但不吓人）
  ✅ 昨日成果（完成的任务，表扬一下）
  💡 AI建议（根据数据给1-2条具体建议，比如"建议协调XX的任务负载"或"XX任务已逾期3天建议重新评估"）
- 整体控制在 200-400 字
- 不要编造数据中没有的信息
- 如果今天没什么特别的，就说"今天没有紧急事项，适合推进重点项目"`
        },
        {
          role: 'user',
          content: `请根据以下数据生成今日简报：\n\n${dataBlock}`
        }
      ],
    });

    return content || generateFallbackBriefing(data, dateStr, weekday);
  } catch (err: any) {
    console.error('[Briefing] AI generation failed:', err.message);
    return generateFallbackBriefing(data, dateStr, weekday);
  }
}

function generateFallbackBriefing(data: BriefingData, dateStr: string, weekday: string): string {
  const lines: string[] = [];
  lines.push(`## 🌅 早安，${data.userName}！`);
  lines.push(`今天是 ${dateStr} 周${weekday}\n`);

  if (data.tasksDueToday.length > 0) {
    lines.push(`### 📋 今日到期`);
    data.tasksDueToday.forEach(t => lines.push(`- ${t.title}（${t.assigneeName}）`));
    lines.push('');
  }

  if (data.tasksOverdue.length > 0) {
    lines.push(`### ⚠️ 逾期提醒`);
    data.tasksOverdue.forEach(t => lines.push(`- ${t.title} — 已逾期${t.daysOverdue}天`));
    lines.push('');
  }

  if (data.tasksCompletedYesterday.length > 0) {
    lines.push(`### ✅ 昨日完成`);
    data.tasksCompletedYesterday.forEach(t => lines.push(`- ${t.title}（${t.completedBy}）`));
    lines.push('');
  }

  if (data.totalActiveTasks === 0 && data.tasksOverdue.length === 0) {
    lines.push('今天没有紧急事项，适合推进重点项目。');
  }

  lines.push(`\n---\n*活跃任务 ${data.totalActiveTasks} 个 · 团队 ${data.memberCount} 人 · 知识库 ${data.kbDocCount} 份文档*`);
  return lines.join('\n');
}
