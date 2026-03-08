import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import { ACTION_SCHEMAS } from './actionSchemas';
import { storage } from '../../storage';
import { CODE_TOOLS, executeCodeTool } from './codeTools';
import type { AiProvider, AiModelProvider } from '@shared/schema';

let cachedProviders: AiProvider[] | null = null;
let cachedModelProviders: AiModelProvider[] | null = null;
let providersCacheTime = 0;
let modelProvidersCacheTime = 0;
const PROVIDER_CACHE_TTL = 60000;
const clientCache = new Map<string, OpenAI>();

async function loadProviders(): Promise<AiProvider[]> {
  const now = Date.now();
  if (cachedProviders && now - providersCacheTime < PROVIDER_CACHE_TTL) {
    return cachedProviders;
  }
  try {
    cachedProviders = await storage.getAiProviders();
    providersCacheTime = now;
    return cachedProviders;
  } catch (e) {
    if (cachedProviders) return cachedProviders;
    return getHardcodedFallbackProviders();
  }
}

function getHardcodedFallbackProviders(): AiProvider[] {
  return [
    { id: -1, name: 'Claude Simple', type: 'proxy', baseUrl: 'https://vip.aipro.love/v1', apiKeyEnvVar: 'CLAUDE_SIMPLE_API_KEY', models: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-haiku-4-5'], timeout: 90000, priority: 0, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: -2, name: 'Claude Complex', type: 'proxy', baseUrl: 'https://vip.aipro.love/v1', apiKeyEnvVar: 'CLAUDE_COMPLEX_API_KEY', models: ['claude-opus-4-6'], timeout: 180000, priority: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: -3, name: 'OpenRouter', type: 'direct', baseUrl: process.env.AI_BASE_URL || '', apiKeyEnvVar: 'AI_API_KEY', models: ['gpt-4o', 'gpt-5.4', 'gpt-5.4-pro', 'gpt-5.2', 'deepseek-chat'], timeout: 30000, priority: 2, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ];
}

export function invalidateProviderCache() {
  cachedProviders = null;
  cachedModelProviders = null;
  providersCacheTime = 0;
  modelProvidersCacheTime = 0;
  clientCache.clear();
}

async function loadModelProviders(): Promise<AiModelProvider[]> {
  const now = Date.now();
  if (cachedModelProviders && now - modelProvidersCacheTime < PROVIDER_CACHE_TTL) {
    return cachedModelProviders;
  }
  try {
    cachedModelProviders = await storage.getModelProviders();
    modelProvidersCacheTime = now;
    return cachedModelProviders;
  } catch (e) {
    if (cachedModelProviders) return cachedModelProviders;
    return [];
  }
}

const MODEL_ALIAS_MAP: Record<string, string> = {
  'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
  'gpt-5.4': 'gpt-4o',
  'gpt-5.4-pro': 'gpt-4o',
  'gpt-5.2': 'gpt-4o',
};

const REVERSE_MODEL_ALIASES: Record<string, string[]> = {};
for (const [alias, canonical] of Object.entries(MODEL_ALIAS_MAP)) {
  if (!REVERSE_MODEL_ALIASES[canonical]) REVERSE_MODEL_ALIASES[canonical] = [];
  REVERSE_MODEL_ALIASES[canonical].push(alias);
}

function resolveModelId(model: string): string {
  return MODEL_ALIAS_MAP[model] || model;
}

export async function claudeComplete(params: {
  model: string;
  max_tokens: number;
  temperature?: number;
  messages: { role: string; content: string }[];
}): Promise<{ content: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }> {
  const resolved = resolveModelId(params.model);
  const isClaudeModel = resolved.startsWith('claude-');
  const officialKey = isClaudeModel ? await findAnthropicKey(resolved) : null;

  if (isClaudeModel && officialKey) {
    const client = new Anthropic({ apiKey: officialKey });
    const systemMsg = params.messages.find(m => m.role === 'system');
    const nonSystemMsgs = params.messages.filter(m => m.role !== 'system');
    const response = await client.messages.create({
      model: resolved,
      max_tokens: params.max_tokens,
      temperature: params.temperature ?? 0,
      ...(systemMsg ? { system: systemMsg.content } : {}),
      messages: nonSystemMsgs.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });
    const text = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    return {
      content: text,
      usage: {
        prompt_tokens: response.usage?.input_tokens ?? 0,
        completion_tokens: response.usage?.output_tokens ?? 0,
        total_tokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
      },
    };
  }

  const aiClient = await getClientForModel(params.model);
  const response = await aiClient.chat.completions.create({
    model: resolved,
    max_tokens: params.max_tokens,
    temperature: params.temperature ?? 0,
    messages: params.messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
  });
  return {
    content: response.choices[0]?.message?.content || '',
    usage: response.usage ? {
      prompt_tokens: response.usage.prompt_tokens ?? 0,
      completion_tokens: response.usage.completion_tokens ?? 0,
      total_tokens: response.usage.total_tokens ?? 0,
    } : undefined,
  };
}

function getDefaultBaseUrl(modelId: string): string {
  const resolved = resolveModelId(modelId);
  if (resolved.startsWith('claude')) return 'https://vip.aipro.love/v1';
  if (resolved === 'deepseek-chat') return 'https://openrouter.ai/api/v1';
  return 'https://api.openai.com/v1';
}

function resolveApiKey(mp: AiModelProvider): string | null {
  if (mp.apiKey) return mp.apiKey;
  if (mp.apiKeyEnvVar) {
    const envVal = process.env[mp.apiKeyEnvVar];
    if (envVal) return envVal;
    if (mp.apiKeyEnvVar.startsWith('sk-')) return mp.apiKeyEnvVar;
  }
  return null;
}

async function findAnthropicKey(modelId?: string): Promise<string | null> {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  if (!modelId) return null;
  try {
    const modelProviders = await loadModelProviders();
    const resolved = resolveModelId(modelId);
    for (const mp of modelProviders) {
      if (!mp.isActive) continue;
      if (mp.modelId !== modelId && mp.modelId !== resolved) continue;
      const key = resolveApiKey(mp);
      if (key && key.startsWith('sk-ant-')) return key;
    }
  } catch {}
  return null;
}

function getClientForModelProvider(mp: AiModelProvider): OpenAI | null {
  const apiKey = resolveApiKey(mp);
  if (!apiKey) return null;
  const isAnthropicKey = apiKey.startsWith('sk-ant-');
  const hasProxyUrl = mp.baseUrl && !mp.baseUrl.includes('anthropic.com');
  if (isAnthropicKey && !hasProxyUrl) return null;
  const baseUrl = mp.baseUrl || getDefaultBaseUrl(mp.modelId);
  const cacheKey = `mp_${mp.id}_${baseUrl}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new OpenAI({
      baseURL: baseUrl,
      apiKey,
      timeout: mp.timeout,
    });
    clientCache.set(cacheKey, client);
  }
  return client;
}

function getClientForProvider(provider: AiProvider): OpenAI | null {
  const apiKey = process.env[provider.apiKeyEnvVar];
  if (!apiKey) return null;
  const cacheKey = `${provider.id}_${provider.baseUrl}_${provider.apiKeyEnvVar}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new OpenAI({
      baseURL: provider.baseUrl,
      apiKey,
      timeout: provider.timeout,
    });
    clientCache.set(cacheKey, client);
  }
  return client;
}

async function getProvidersForModel(model: string): Promise<{ provider: { name: string; id: number }; client: OpenAI }[]> {
  const resolved = resolveModelId(model);
  const modelProviders = await loadModelProviders();
  const modelSpecific = modelProviders.filter(mp => (mp.modelId === model || mp.modelId === resolved) && mp.isActive);

  if (modelSpecific.length > 0) {
    const result: { provider: { name: string; id: number }; client: OpenAI }[] = [];
    for (const mp of modelSpecific) {
      const client = getClientForModelProvider(mp);
      if (client) result.push({ provider: { name: mp.providerName, id: mp.id }, client });
    }
    if (result.length > 0) return result;
  }

  const providers = await loadProviders();
  const result: { provider: { name: string; id: number }; client: OpenAI }[] = [];
  for (const p of providers) {
    if (!p.isActive) continue;
    if (!p.models.includes(model) && !p.models.includes(resolved)) continue;
    const client = getClientForProvider(p);
    if (client) result.push({ provider: { name: p.name, id: p.id }, client });
  }
  return result;
}

async function getClientForModel(model: string): Promise<OpenAI> {
  const entries = await getProvidersForModel(model);
  if (entries.length > 0) return entries[0].client;
  const apiKey = process.env.CLAUDE_SIMPLE_API_KEY || process.env.CLAUDE_COMPLEX_API_KEY || process.env.AI_API_KEY;
  return new OpenAI({ baseURL: 'https://vip.aipro.love/v1', apiKey: apiKey || '', timeout: 90000 });
}

async function callWithFallback<T>(
  model: string,
  callFn: (client: OpenAI, providerName: string) => Promise<T>,
): Promise<T> {
  const entries = await getProvidersForModel(model);
  if (entries.length === 0) {
    const fallbackClient = await getClientForModel(model);
    return callFn(fallbackClient, 'fallback');
  }
  let lastError: Error | null = null;
  for (const { provider, client } of entries) {
    try {
      return await callFn(client, provider.name);
    } catch (err: any) {
      lastError = err;
      console.error(`[AI Fallback] Provider "${provider.name}" failed for model ${model}: ${err.message}`);
    }
  }
  throw lastError || new Error(`All providers failed for model ${model}`);
}

type TaskCategory = 'title_generation' | 'auto_judgment' | 'quick_reply' | 'general_chat' | 'code_generation' | 'complex_analysis' | 'document_processing' | 'knowledge_qa';

interface ModelConfig {
  model: string;
  max_tokens: number;
  thinking: { type: 'enabled'; budget_tokens: number } | { type: 'disabled' };
  temperature: number;
}

const TASK_MODEL_CONFIGS: Record<TaskCategory, ModelConfig> = {
  title_generation: {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    thinking: { type: 'disabled' },
    temperature: 0.7,
  },
  auto_judgment: {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    thinking: { type: 'disabled' },
    temperature: 0.0,
  },
  quick_reply: {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    thinking: { type: 'disabled' },
    temperature: 0.5,
  },
  general_chat: {
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    thinking: { type: 'disabled' },
    temperature: 0.7,
  },
  code_generation: {
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    thinking: { type: 'enabled', budget_tokens: 16000 },
    temperature: 0.3,
  },
  complex_analysis: {
    model: 'claude-sonnet-4-6',
    max_tokens: 32000,
    thinking: { type: 'enabled', budget_tokens: 32000 },
    temperature: 0.5,
  },
  document_processing: {
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    thinking: { type: 'enabled', budget_tokens: 10000 },
    temperature: 0.3,
  },
  knowledge_qa: {
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    thinking: { type: 'disabled' },
    temperature: 0.3,
  },
};

const USER_MODEL_MAX_TOKENS: Record<string, number> = {
  'claude-opus-4-6': 64000,
  'claude-sonnet-4-6': 8192,
  'claude-haiku-4-5-20251001': 2048,
  'claude-haiku-4-5': 2048,
  'gpt-4o': 16384,
  'gpt-5.4': 16384,
  'gpt-5.4-pro': 32768,
  'gpt-5.2': 16384,
  'deepseek-chat': 8192,
};

function getMaxTokensForModel(model: string): number {
  return USER_MODEL_MAX_TOKENS[model] || 16384;
}

function getConfigForTask(task: TaskCategory, userModel?: string, extendedThinking?: boolean): ModelConfig {
  const baseConfig = { ...TASK_MODEL_CONFIGS[task] };

  if (userModel) {
    baseConfig.model = userModel;
    if (userModel === 'claude-opus-4-6') {
      baseConfig.max_tokens = 64000;
      if (extendedThinking) {
        baseConfig.thinking = { type: 'enabled', budget_tokens: 32000 };
      }
    } else {
      const modelMaxTokens = USER_MODEL_MAX_TOKENS[userModel];
      if (modelMaxTokens && baseConfig.max_tokens > modelMaxTokens) {
        baseConfig.max_tokens = modelMaxTokens;
      }
    }
  }

  if (!extendedThinking) {
    baseConfig.thinking = { type: 'disabled' };
  } else if (baseConfig.model.startsWith('claude-haiku')) {
    baseConfig.thinking = { type: 'disabled' };
  } else if (!baseConfig.model.startsWith('claude-')) {
    baseConfig.thinking = { type: 'disabled' };
  }

  return baseConfig;
}

async function classifyTask(userMessage: string, hasAttachments?: boolean): Promise<TaskCategory> {
  if (hasAttachments) return 'document_processing';

  const lowerMsg = userMessage.toLowerCase();
  const trimmed = userMessage.trim();

  if (/^(hi|hello|hey|你好|嗨|谢谢|ok|好的|thanks|thank you|再见|bye|哈哈|嗯|对|是的|没错|ok了|收到|明白|知道了|确认|可以|没问题|好|行)$/i.test(trimmed)) {
    return 'quick_reply';
  }

  if (/有什么(任务|项目)|多少个?(任务|项目)|进展|状态|列表|到期|逾期|概览|负载|工作量|谁在做/.test(lowerMsg)) {
    return lowerMsg.length < 50 ? 'quick_reply' : 'general_chat';
  }

  if (/代码|code|function|实现一个|写一个.*(函数|组件|脚本)|debug|bug|error|fix|修复|编程|script|api接口|import|export|class\s|component|变量|variable/.test(lowerMsg)) {
    return 'code_generation';
  }

  if (/深度分析|详细分析|对比分析|根因分析|root cause|评估报告|策略规划|战略分析|SWOT|竞品分析/.test(lowerMsg)) {
    return 'complex_analysis';
  }

  if (/(总结|summarize|摘要|提取).*(文档|文件|document|附件|报告|report|纪要|合同)/.test(lowerMsg)) {
    return 'document_processing';
  }

  if (trimmed.length < 50) {
    return 'quick_reply';
  }

  try {
    const response = await claudeComplete({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 30,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Classify the user message into exactly one category. Reply with ONLY the category name, nothing else.
Categories:
- quick_reply: greetings, simple yes/no, short casual chat, simple task queries
- general_chat: normal conversation, task management requests, general discussion
- code_generation: code writing, debugging, technical implementation
- complex_analysis: deep multi-step reasoning, strategic planning, comparative analysis
- document_processing: long document reading, summarization, data extraction from files`
        },
        { role: 'user', content: userMessage.slice(0, 500) }
      ],
    });
    const result = (response.content || '').trim().toLowerCase();
    const validCategories: TaskCategory[] = ['quick_reply', 'general_chat', 'code_generation', 'complex_analysis', 'document_processing'];
    if (validCategories.includes(result as TaskCategory)) return result as TaskCategory;
    return 'general_chat';
  } catch {
    return 'general_chat';
  }
}

const CONTEXT_LIMITS: Record<TaskCategory, number> = {
  title_generation: 4,
  auto_judgment: 4,
  quick_reply: 4,
  general_chat: 20,
  code_generation: 10,
  complex_analysis: 20,
  document_processing: 6,
  knowledge_qa: 10,
};

async function buildOptimizedContext(
  conversationHistory: { role: string; content: string | any[] }[],
  task: TaskCategory,
): Promise<{ role: string; content: string | any[] }[]> {
  const limit = CONTEXT_LIMITS[task];
  const filtered = conversationHistory.filter(
    msg => msg.content && (typeof msg.content === 'string' ? msg.content.trim() !== '' : true)
  );

  if (filtered.length <= limit) {
    return filtered;
  }

  const recentMessages = filtered.slice(-limit);
  const olderMessages = filtered.slice(0, -limit);

  try {
    const olderText = olderMessages
      .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.slice(0, 200) : '[附件内容]'}`)
      .join('\n');

    const response = await claudeComplete({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: '将以下对话历史压缩为简洁摘要（200字以内），保留核心需求、已达成的结论和关键细节。直接输出摘要。'
        },
        { role: 'user', content: olderText.slice(0, 4000) }
      ],
    });

    const summary = response.content || '';

    const firstRecent = recentMessages[0];
    if (firstRecent && firstRecent.role === 'user') {
      const merged = { ...firstRecent, content: `[前期对话摘要]\n${summary}\n\n[最近对话开始]\n${typeof firstRecent.content === 'string' ? firstRecent.content : ''}` };
      return [merged, ...recentMessages.slice(1)];
    }
    return [
      { role: 'user', content: `[前期对话摘要] ${summary}` },
      ...recentMessages,
    ];
  } catch {
    return recentMessages;
  }
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

interface TeamMemberEntry {
  id: number;
  displayName: string;
  role: string;
  email: string;
  idType: 'assigneeId' | 'memberProfileId';
  aliases?: string[];
  deptName?: string;
  jobTitle?: string;
}

function formatTeamMembers(members: TeamMemberEntry[]): string {
  return members.map(m => {
    const aliasStr = m.aliases && m.aliases.length > 0 ? `（${m.aliases.join('/')}）` : '';
    const deptRole = m.deptName || m.jobTitle
      ? ` [${m.deptName || '未分配'}·${m.jobTitle || '未分配'}]`
      : '';
    const status = m.idType === 'memberProfileId' ? '（待认领）' : '';
    return `- ${m.displayName}${aliasStr}${deptRole}${status} → 分配任务时用 ${m.idType}: ${m.id}`;
  }).join('\n');
}

function formatProjectList(projects: { id: number; name: string; status: string; description?: string | null }[]): string {
  return projects.map(p => `- ID:${p.id} ${p.name}（${p.status}）${p.description || ''}`).join('\n');
}

async function loadBusinessContext(orgId?: number) {
  const allUsersRaw = await storage.getUsers();
  const allProjectsRaw = await storage.getProjects();
  const allTasksRaw = await storage.getTasks({});
  const allDepartmentsRaw = await storage.getDepartments();
  const allJobRoles = await storage.getJobRoles();

  const allUsers = orgId ? allUsersRaw.filter((u: any) => u.orgId === orgId) : allUsersRaw;
  const allProjects = orgId ? allProjectsRaw.filter((p: any) => p.orgId === orgId) : allProjectsRaw;
  const allTasks = orgId ? allTasksRaw.filter((t: any) => t.orgId === orgId) : allTasksRaw;
  const allDepartments = orgId ? allDepartmentsRaw.filter((d: any) => d.orgId === orgId) : allDepartmentsRaw;

  const pendingProfiles = orgId ? await storage.getPendingProfilesByOrg(orgId) : [];

  const jobRoleMap = new Map(allJobRoles.map(r => [r.id, r]));
  const deptMap = new Map(allDepartments.map((d: any) => [d.id, d]));
  const activeTasks = allTasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
  const doneTasks = allTasks.filter(t => t.status === 'done');
  const now = new Date();
  const overdueTasks = allTasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done' && t.status !== 'cancelled');

  const teamMembers: TeamMemberEntry[] = [
    ...allUsers.map((u: any) => {
      const dept = u.deptId ? deptMap.get(u.deptId) : null;
      const jr = u.jobRoleId ? jobRoleMap.get(u.jobRoleId) : null;
      return {
        id: u.id,
        displayName: u.displayName || u.email,
        role: u.role || 'member',
        email: u.email,
        idType: 'assigneeId' as const,
        deptName: dept?.name,
        jobTitle: jr?.title,
      };
    }),
    ...pendingProfiles.map(p => {
      const dept = p.deptId ? deptMap.get(p.deptId) : null;
      const jr = p.jobRoleId ? jobRoleMap.get(p.jobRoleId) : null;
      return {
        id: p.id,
        displayName: p.fullName,
        role: 'pending',
        email: p.email || '',
        idType: 'memberProfileId' as const,
        aliases: (() => { try { return p.aliases ? JSON.parse(p.aliases) : []; } catch { return []; } })(),
        deptName: dept?.name,
        jobTitle: jr?.title || p.title || undefined,
      };
    }),
  ];

  return { allUsers, allProjects, allTasks, allDepartments, allJobRoles, jobRoleMap, activeTasks, doneTasks, overdueTasks, teamMembers, pendingProfiles };
}

function buildContextBlock(
  ctx: { currentUserId: number; currentUserName: string; model?: string; orgName?: string },
  allUsers: any[],
  allProjects: any[],
  activeTasks: any[],
  allTasks: any[],
  doneTasks: any[],
  overdueTasks: any[],
  teamMembers?: TeamMemberEntry[],
): string {
  const modelName = ctx.model || 'claude-sonnet-4-6';
  const teamFormatted = teamMembers
    ? formatTeamMembers(teamMembers)
    : formatTeamMembers(allUsers.map((u: any) => ({
        id: u.id,
        displayName: u.displayName || u.email,
        role: u.role || 'member',
        email: u.email,
        idType: 'assigneeId' as const,
      })));
  const projectsFormatted = formatProjectList(allProjects);
  const tasksFormatted = formatTaskList(activeTasks, allUsers, ctx.currentUserId);
  const orgDisplayName = ctx.orgName || '当前组织';

  return `## 当前系统上下文
- 组织: ${orgDisplayName}
- 当前用户ID: ${ctx.currentUserId}
- 当前用户名: ${ctx.currentUserName}
- 当前时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
- 运行模型: ${modelName}

## 团队成员
${teamFormatted}

## 项目列表
${projectsFormatted}

## 当前活跃任务（未完成/未取消）
${tasksFormatted}

## 任务统计
- 总任务数: ${allTasks.length}
- 已完成: ${doneTasks.length}
- 逾期: ${overdueTasks.length}`;
}

export async function buildContextualSystemPrompt(
  context: { currentUserId: number; currentUserName: string; customSystemPrompt?: string; model?: string; orgId?: number },
  mode: 'streaming' = 'streaming'
): Promise<{ prompt: string; allUsers: any[]; allProjects: any[]; allTasks: any[]; allDepartments: any[]; allJobRoles: any[]; jobRoleMap: Map<number, any>; activeTasks: any[] }> {
  const orgId = context.orgId || 1;
  const { allUsers, allProjects, allTasks, allDepartments, allJobRoles, jobRoleMap, activeTasks, doneTasks, overdueTasks, teamMembers } = await loadBusinessContext(orgId);
  const memories = await storage.getUserMemories(context.currentUserId, orgId);

  let orgName = '当前组织';
  try {
    const org = await storage.getOrganizationById(orgId);
    if (org) orgName = org.name;
  } catch {}

  const contextWithOrg = { ...context, orgName };
  const contextBlock = buildContextBlock(contextWithOrg, allUsers, allProjects, activeTasks, allTasks, doneTasks, overdueTasks, teamMembers);
  const modelName = context.model || 'claude-sonnet-4-6';

  let prompt = `你是 Buddy，${orgName} 的智能助手。你熟悉公司的团队、项目和任务情况，能以自然对话的方式帮助团队成员。

${contextBlock}

## 回复规则
- 用自然语言 Markdown 回复，语言跟用户一致
- 基于上面的团队、项目、任务数据回答，不要编造不存在的数据
- 当用户问"你是什么模型"时，如实告知运行在 ${modelName} 上
- 回答简洁专业，必要时引用具体的任务、项目或人员信息

## 操作能力
当用户要求创建/更新/删除时，先用自然语言说明你要做什么，然后在回复末尾输出操作块：

<<<ACTIONS>>>
{"type":"confirm","action":{"actionType":"create_task","data":{"title":"任务标题","projectId":1},"summary":"创建任务「任务标题」","confidence":0.9}}
<<<END_ACTIONS>>>

批量操作用 multi_confirm（支持 ref/dependsOnRef 做批次内依赖）：
<<<ACTIONS>>>
{"type":"multi_confirm","actions":[{"actionType":"create_task","data":{"title":"任务A","projectId":1,"ref":"T1"},"summary":"创建「任务A」","confidence":0.9},{"actionType":"create_task","data":{"title":"任务B","projectId":1,"ref":"T2","dependsOnRef":["T1"]},"summary":"创建「任务B」（依赖T1）","confidence":0.9}]}
<<<END_ACTIONS>>>

可用 actionType 及字段（*为必填）：
- create_task: title*, projectId*, assigneeId, dueDate, priority(critical/high/medium/low), description, weight(1-10), parentTaskId, type(task/subtask/milestone/bug/request), tags, warnings[], ref, dependsOn[], dependsOnRef[]
- update_task: taskId*, title, status, priority, assigneeId, dueDate, weight, progress, description
- create_project: name*, description, deptId, startDate, targetDate
- add_comment: taskId*, content*
- create_user: displayName*, email*, role(owner/admin/head/member), deptId, jobRoleId
- update_user: userId*, displayName, role, deptId, jobRoleId, isActive
- create_department: name*, description, color(hex), parentDeptId

## Widget 交互
需要用户选择/确认时，在回复末尾输出（不要与 confirm/multi_confirm 同时出现）：
<<<ACTIONS>>>
{"type":"interactive_input","questions":[{"id":"q1","question":"问题","type":"single_select","options":["选项A","选项B"]}]}
<<<END_ACTIONS>>>

type 可选：single_select（单选）、multi_select（多选）、confirm（确认/取消）、date_pick（日期）、rank_priorities（排序）

必须弹 Widget 的场景：确认操作、选择选项、是/否判断、澄清歧义、完成后问下一步、批量确认清单。宁可多弹 Widget 也不要让用户打字确认。

## 文档生成
当你生成的内容同时满足以下全部条件时，使用 DOCUMENT 块输出可下载文档：
1. 内容超过 300 字且有明确结构（标题、章节、分段）
2. 内容用途是保存、分享、或作为正式文档（报告、方案、计划、总结、邮件草稿等）
3. 用户的意图是"产出一份东西"而不是"聊聊看法"

格式（放在回复末尾，与 ACTIONS 块不冲突，可同时存在）：
<<<DOCUMENT>>>
{"title":"文档标题","content":"完整的 Markdown 格式内容..."}
<<<END_DOCUMENT>>>

不用 DOCUMENT 块的场景：简短回答、查询结果、讨论性对话、任务操作确认、列表展示。

## 核心规则
- 查询请求绝不输出 ACTIONS 操作块
- 创建前检查已有任务是否重复，重复时用 Widget 让用户选择
- 会议纪要先用表格整理清单 + Widget 确认，用户确认后再 multi_confirm
- projectId/assigneeId 必须是上面系统数据中存在的 ID，不要编造
- 信息不足时用 Widget 引导用户点选补充
- confidence: 信息完整≥0.9, 有推测0.7-0.8, 严重缺失0.5-0.6
- 从会议纪要提取任务时对不确定的字段添加 warnings 数组
- resolve_decision: 系统上下文有待确认决策任务时，用户回复确认信息则输出 confirm/multi_confirm，actionType 为 resolve_decision，data 格式: {"decisionTaskId":123,"updates":{"assigneeId":5}}
- judge_assignment: 用户问"合不合理"等 → confirm，actionType="judge_assignment"，data: {taskId, userId}
- 会议纪要/批量任务必须两步：第1步用表格整理+Widget确认，第2步用户确认后才输出 multi_confirm`;

  if (memories.length > 0) {
    const memoryLines = memories.map(m => `- [${m.category}] ${m.content}`).join('\n');
    prompt += `\n\n## 关于当前用户的记忆
以下是你通过之前对话了解到的关于当前用户的信息：
${memoryLines}`;
  }

  try {
    const pendingDecisions = await storage.getPendingDecisionTasksForUser(context.currentUserId, context.orgId);
    if (pendingDecisions.length > 0) {
      const decisionLines = await Promise.all(pendingDecisions.map(async (d, i) => {
        const originalTask = d.decisionForTaskId ? await storage.getTaskById(d.decisionForTaskId) : null;
        const typeLabels: Record<string, string> = {
          assignee_unclear: '需要确认负责人',
          deadline_missing: '需要确认截止日期',
          scope_unclear: '需要明确任务范围',
          priority_unclear: '需要确认优先级',
          dependency_unclear: '需要确认依赖关系',
        };
        const label = typeLabels[d.decisionType || ''] || '需要确认';
        return `${i + 1}. [决策ID: ${d.id}] 原始任务「${originalTask?.title || '未知'}」(#${d.decisionForTaskId}) — ${label}`;
      }));
      prompt += `\n\n## 待确认决策任务
当前用户有以下待确认的决策任务，如果用户的回复涉及这些决策的确认信息，请使用 resolve_decision 操作来处理：
${decisionLines.join('\n')}`;
    }
  } catch (err) {
    console.error('[AI] Failed to load pending decisions:', err);
  }

  if (context.customSystemPrompt) {
    prompt += `\n\n## 额外指令\n${context.customSystemPrompt}`;
  }

  const modelStyleHints: Record<string, string> = {
    'claude-haiku-4-5-20251001': '回复尽量简短直接，不需要解释推理过程。',
    'claude-haiku-4-5': '回复尽量简短直接，不需要解释推理过程。',
    'claude-sonnet-4-6': '回复清晰有条理，适当解释但避免冗长。使用自然段落。',
    'claude-opus-4-6': '可以进行深入分析，提供多角度思考，但保持条理清晰。',
    'gpt-5.4': '回复清晰有条理，适当解释但避免冗长。',
    'gpt-5.4-pro': '可以进行深入分析，提供详细推理过程。',
    'gpt-5.2': '回复清晰简练，注重效率。',
  };
  const styleHint = modelStyleHints[context.model || 'claude-sonnet-4-6'];
  if (styleHint) {
    prompt += `\n\n## 回复风格\n${styleHint}`;
  }

  return { prompt, allUsers, allProjects, allTasks, allDepartments, allJobRoles, jobRoleMap, activeTasks };
}

async function executeQuery(actionType: string, data: Record<string, any>, orgId?: number): Promise<string> {
  switch (actionType) {
    case 'query_tasks': {
      const filters: Record<string, any> = {};
      if (data.projectId) filters.projectId = data.projectId;
      if (data.assigneeId) filters.assigneeId = data.assigneeId;
      if (data.status) filters.status = data.status;
      const allTasks = await storage.getTasks(filters);
      const tasks = orgId ? allTasks.filter((t: any) => t.orgId === orgId) : allTasks;
      if (tasks.length === 0) return '当前没有符合条件的任务。';
      const lines = tasks.map((t, i) =>
        `${i + 1}. ${t.title}（${t.status}，优先级: ${t.priority}${t.dueDate ? '，截止: ' + new Date(t.dueDate).toLocaleDateString('zh-CN') : ''}）`
      );
      return `共找到 ${tasks.length} 个任务：\n${lines.join('\n')}`;
    }
    case 'query_projects': {
      const allProjects = await storage.getProjects();
      const projects = orgId ? allProjects.filter((p: any) => p.orgId === orgId) : allProjects;
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
      const allTasksRaw = await storage.getTasks({});
      const allTasks = orgId ? allTasksRaw.filter((t: any) => t.orgId === orgId) : allTasksRaw;
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

function formatTaskList(tasks: any[], users: any[], currentUserId?: number): string {
  const userMap = new Map(users.map(u => [u.id, u.displayName]));
  if (tasks.length === 0) return '（暂无任务）';

  const now = new Date();
  const parts: string[] = [];

  const myTasks = currentUserId ? tasks.filter(t => t.assigneeId === currentUserId) : [];
  if (myTasks.length > 0) {
    parts.push(`### 我的任务 (${myTasks.length}个)`);
    for (const t of myTasks) {
      const due = t.dueDate ? new Date(t.dueDate).toLocaleDateString('zh-CN') : '';
      const overdue = t.dueDate && new Date(t.dueDate) < now && t.status !== 'done' ? ' ⚠️逾期' : '';
      parts.push(`- ID:${t.id}「${t.title}」状态:${t.status} 优先级:${t.priority}${due ? ' 截止:' + due : ''}${overdue} 进度:${t.progress}%`);
    }
  }

  const otherTasks = tasks.filter(t => !currentUserId || t.assigneeId !== currentUserId);
  const urgentOthers = otherTasks.filter(t =>
    t.priority === 'critical' || t.priority === 'high' ||
    t.status === 'blocked' ||
    (t.dueDate && new Date(t.dueDate) < now && t.status !== 'done' && t.status !== 'cancelled')
  );
  if (urgentOthers.length > 0) {
    parts.push(`### 需关注的任务 (${urgentOthers.length}个)`);
    for (const t of urgentOthers) {
      const assignee = t.assigneeId ? userMap.get(t.assigneeId) || `ID:${t.assigneeId}` : '未分配';
      const due = t.dueDate ? new Date(t.dueDate).toLocaleDateString('zh-CN') : '';
      const overdue = t.dueDate && new Date(t.dueDate) < now && t.status !== 'done' ? ' ⚠️逾期' : '';
      parts.push(`- ID:${t.id}「${t.title}」${assignee} ${t.status} ${t.priority}${due ? ' 截止:' + due : ''}${overdue}`);
    }
  }

  const normalOthers = otherTasks.filter(t => !urgentOthers.includes(t));
  const MAX_NORMAL = 25;
  if (normalOthers.length > 0) {
    const shown = normalOthers.slice(0, MAX_NORMAL);
    parts.push(`### 其他任务 (${normalOthers.length}个${normalOthers.length > MAX_NORMAL ? `，显示前${MAX_NORMAL}` : ''})`);
    for (const t of shown) {
      const assignee = t.assigneeId ? userMap.get(t.assigneeId) || `${t.assigneeId}` : '-';
      parts.push(`ID:${t.id} ${t.title} | ${assignee} | ${t.status}`);
    }
    if (normalOthers.length > MAX_NORMAL) {
      parts.push(`...还有 ${normalOthers.length - MAX_NORMAL} 个任务，需要时可询问`);
    }
  }

  return parts.join('\n');
}

function parseStreamingResponse(aiText: string, allUsers: any[], allProjects: any[]): any {
  const actionsMatch = aiText.match(/<<<ACTIONS>>>\s*([\s\S]*?)\s*<<<END_ACTIONS>>>/);

  if (!actionsMatch) {
    return { type: 'text', message: aiText.trim() };
  }

  const textBefore = aiText.substring(0, aiText.indexOf('<<<ACTIONS>>>')).trim();

  try {
    const parsed = JSON.parse(actionsMatch[1].trim());

    if (parsed.type === 'confirm' && parsed.action) {
      return {
        type: 'confirm',
        message: textBefore || parsed.action.summary || '',
        action: parsed.action,
      };
    }

    if (parsed.type === 'multi_confirm' && parsed.actions) {
      return {
        type: 'multi_confirm',
        message: textBefore || '',
        actions: parsed.actions,
      };
    }

    if (parsed.type === 'interactive_input' && parsed.questions) {
      return {
        type: 'text',
        message: textBefore || '',
        interactiveInput: parsed.questions,
      };
    }

    return { type: 'text', message: aiText.trim() };
  } catch {
    return { type: 'text', message: textBefore || aiText.trim() };
  }
}

export async function chat(
  message: string,
  conversationHistory: { role: string; content: string }[],
  context: { currentUserId: number; currentUserName: string; customSystemPrompt?: string; model?: string; extendedThinking?: boolean; orgId?: number }
): Promise<ChatResponse> {
  const { prompt: systemPrompt, allUsers, allProjects, allTasks, allDepartments, allJobRoles, jobRoleMap, activeTasks } = await buildContextualSystemPrompt(context, 'streaming');

  const taskCategory = await classifyTask(message);
  const config = getConfigForTask(taskCategory, context.model, context.extendedThinking);
  const modelName = config.model;
  const apiModelName = resolveModelId(modelName);
  const aiClient = await getClientForModel(modelName);

  const optimizedHistory = await buildOptimizedContext(conversationHistory, taskCategory);

  const requestParams: any = {
    model: apiModelName,
    max_tokens: config.max_tokens,
    temperature: config.temperature,
    messages: [
      { role: 'system', content: systemPrompt },
      ...optimizedHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ],
  };

  const isClaudeModel = apiModelName.startsWith('claude-');
  const officialAnthropicKeyChat = isClaudeModel ? await findAnthropicKey(apiModelName) : null;

  let aiText = '';
  let tokenInfo: ChatResponse['tokenUsage'] | undefined;

  if (isClaudeModel && officialAnthropicKeyChat) {
    const nativeClient = new Anthropic({ apiKey: officialAnthropicKeyChat });
    const anthropicMsgs: Anthropic.MessageParam[] = [
      ...optimizedHistory
        .filter(msg => msg.content && (typeof msg.content === 'string' ? msg.content.trim() !== '' : true))
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content as string,
        })),
      { role: 'user', content: message },
    ];

    const nativeParams: any = {
      model: apiModelName,
      max_tokens: config.max_tokens,
      system: systemPrompt,
      messages: anthropicMsgs,
    };

    if (config.thinking.type === 'enabled') {
      nativeParams.thinking = { type: 'enabled', budget_tokens: config.thinking.budget_tokens };
    } else {
      nativeParams.temperature = config.temperature;
    }

    console.log(`[AI] Using official Anthropic API for non-streaming model=${apiModelName}`);
    const nativeResp = await nativeClient.messages.create(nativeParams);
    const textBlocks = nativeResp.content.filter((b: any) => b.type === 'text');
    aiText = textBlocks.map((b: any) => b.text).join('');
    tokenInfo = {
      model: modelName,
      promptTokens: nativeResp.usage?.input_tokens ?? 0,
      completionTokens: nativeResp.usage?.output_tokens ?? 0,
      totalTokens: (nativeResp.usage?.input_tokens ?? 0) + (nativeResp.usage?.output_tokens ?? 0),
    };
  } else {
    if (config.thinking.type === 'enabled' && isClaudeModel) {
      requestParams.extra_body = {
        thinking: {
          type: 'enabled',
          budget_tokens: config.thinking.budget_tokens,
        }
      };
    }

    const response = await aiClient.chat.completions.create(requestParams);
    const usage = response.usage;
    tokenInfo = usage ? {
      model: modelName,
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
    } : undefined;
    aiText = response.choices[0]?.message?.content || '';
  }

  const result = parseStreamingResponse(aiText, allUsers, allProjects);
  result.tokenUsage = tokenInfo;

  if (result.type === 'confirm' && result.action) {
    if (result.action.actionType?.startsWith('query_')) {
      const queryResult = await executeQuery(result.action.actionType, result.action.data || {}, context.orgId);
      return { type: 'text', message: queryResult, tokenUsage: tokenInfo };
    }

    if (result.action.actionType === 'create_task') {
      const schema = ACTION_SCHEMAS['create_task'];
      if (schema) {
        const validation = schema.safeParse(result.action.data);
        if (!validation.success) {
          const actionData = result.action.data || {};
          if (actionData.title) {
            const missingFields: string[] = [];
            if (!actionData.projectId) missingFields.push('projectId');
            if (!actionData.assigneeId) missingFields.push('assigneeId');
            if (!actionData.dueDate) missingFields.push('dueDate');
            const guided = buildGuidedSteps(
              'task', actionData, missingFields,
              `好的，帮你创建「${actionData.title}」的任务，需要确认几个信息：`,
              allUsers, allProjects, allTasks, context.currentUserId, allDepartments, jobRoleMap
            );
            guided.tokenUsage = tokenInfo;
            return guided;
          }
          return { type: 'text', message: '抱歉，我生成的操作数据有误。请重新描述一下你的需求。' };
        }
      }

      if (result.action.confidence < 0.7) {
        const actionData = result.action.data || {};
        const missingKey = ['projectId', 'assigneeId', 'dueDate'].some(f => !actionData[f]);
        if (missingKey && actionData.title) {
          const missingFields: string[] = [];
          if (!actionData.projectId) missingFields.push('projectId');
          if (!actionData.assigneeId) missingFields.push('assigneeId');
          if (!actionData.dueDate) missingFields.push('dueDate');
          const guided = buildGuidedSteps(
            'task', actionData, missingFields,
            `好的，帮你创建「${actionData.title}」的任务，需要确认几个信息：`,
            allUsers, allProjects, allTasks, context.currentUserId, allDepartments, jobRoleMap
          );
          guided.tokenUsage = tokenInfo;
          return guided;
        }
      }
    }

    const schema = ACTION_SCHEMAS[result.action.actionType];
    if (schema && result.action.actionType !== 'create_task') {
      const validation = schema.safeParse(result.action.data);
      if (!validation.success) {
        return { type: 'text', message: '抱歉，我生成的操作数据有误。请重新描述一下你的需求。' };
      }
    }

    result.action.displayData = buildDisplayData(result.action.data, allUsers, allProjects);
  }

  if (result.type === 'multi_confirm' && result.actions) {
    const queryActions = result.actions.filter((a: any) => a.actionType?.startsWith('query_'));
    const writeActions = result.actions.filter((a: any) => !a.actionType?.startsWith('query_'));

    if (queryActions.length > 0) {
      const queryResults = await Promise.all(
        queryActions.map((a: any) => executeQuery(a.actionType, a.data || {}, context.orgId))
      );
      const queryText = queryResults.join('\n\n');
      if (writeActions.length === 0) {
        return { type: 'text', message: queryText, tokenUsage: tokenInfo };
      }
      return { type: 'multi_confirm', message: queryText, actions: writeActions, tokenUsage: tokenInfo } as any;
    }

    for (const action of result.actions) {
      const schema = ACTION_SCHEMAS[action.actionType];
      if (schema) {
        const validation = schema.safeParse(action.data);
        if (!validation.success) {
          return { type: 'text', message: '抱歉，批量操作中有数据验证失败。请重新描述一下你的需求。' };
        }
      }
      action.displayData = buildDisplayData(action.data, allUsers, allProjects);
    }
  }

  return result;
}

export async function* chatStream(
  message: string,
  conversationHistory: { role: string; content: string | any[] }[],
  context: { currentUserId: number; currentUserName: string; customSystemPrompt?: string; model?: string; extendedThinking?: boolean; orgId?: number; knowledgeBaseEnabled?: boolean; userRole?: string; userDeptId?: number | null },
  attachments?: { type: string; name: string; mimeType: string; base64: string }[]
): AsyncGenerator<{ type: 'token' | 'done' | 'error'; content?: string; tokenUsage?: ChatResponse['tokenUsage'] }> {
  const hasAttachments = !!(attachments && attachments.length > 0);
  let taskCategory = await classifyTask(message, hasAttachments);

  const isQueryIntent = ['quick_reply', 'general_chat', 'knowledge_qa', 'complex_analysis', 'document_processing'].includes(taskCategory);
  const shouldInjectKB = context.knowledgeBaseEnabled && isQueryIntent;

  const config = getConfigForTask(taskCategory, context.model, context.extendedThinking);
  const modelName = config.model;
  let { prompt: systemPrompt } = await buildContextualSystemPrompt({ ...context, model: modelName }, 'streaming');

  if (shouldInjectKB && context.orgId) {
    try {
      const { searchKnowledge } = await import('../kb/search');
      const { buildKnowledgePrompt } = await import('./prompts');

      const kbResults = await searchKnowledge({
        orgId: context.orgId,
        query: message,
        topK: 5,
        userRole: context.userRole || 'member',
        userDeptId: context.userDeptId || null,
      });

      if (kbResults.length > 0) {
        const kbPrompt = buildKnowledgePrompt(kbResults.map(r => ({
          content: r.content,
          documentTitle: r.documentTitle,
          category: r.category,
        })));
        systemPrompt += kbPrompt;
        const kbSources = [...new Set(kbResults.map(r => r.documentTitle))];
        console.log(`[KB] Injected ${kbResults.length} chunks from: ${kbSources.join(', ')}`);
      } else {
        console.log(`[KB] No results found for query: ${message.slice(0, 50)}...`);
      }
    } catch (err: any) {
      console.error(`[KB] Search error (non-fatal):`, err.message);
    }
  }

  const aiClient = await getClientForModel(modelName);

  const optimizedHistory = await buildOptimizedContext(conversationHistory, taskCategory);

  let userContent: any = message;
  if (hasAttachments) {
    const contentParts: any[] = [];
    for (const att of attachments!) {
      if (att.type === 'image') {
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${att.mimeType};base64,${att.base64}`,
          }
        });
      } else {
        let fileText = '';
        const buffer = Buffer.from(att.base64, 'base64');
        const ext = att.name.toLowerCase().split('.').pop() || '';
        if (ext === 'docx') {
          try {
            const result = await mammoth.extractRawText({ buffer });
            fileText = result.value;
          } catch {
            fileText = '[无法解析此 .docx 文件]';
          }
        } else if (ext === 'pdf') {
          try {
            const pdfParse = (await import('pdf-parse')).default;
            const pdfData = await pdfParse(buffer);
            fileText = pdfData.text;
            if (fileText.length > 50000) {
              fileText = fileText.slice(0, 50000) + '\n\n[PDF 内容过长，已截断至前50000字符]';
            }
          } catch {
            fileText = '[无法解析此 PDF 文件，可能是扫描件或加密文件]';
          }
        } else if (['txt', 'csv', 'json', 'md', 'xml', 'html', 'css', 'js', 'ts', 'py', 'yaml', 'yml', 'log', 'ini', 'cfg', 'env', 'sh', 'bat'].includes(ext)) {
          fileText = buffer.toString('utf-8');
        } else {
          fileText = `[不支持直接解析的文件格式: .${ext}]`;
        }
        contentParts.push({
          type: 'text',
          text: `[附件: ${att.name}]\n内容:\n${fileText}`,
        });
      }
    }
    contentParts.push({ type: 'text', text: message || '请查看附件' });
    userContent = contentParts;
  }

  const apiModelName = resolveModelId(modelName);
  const isClaudeModel = apiModelName.startsWith('claude-');
  const officialAnthropicKey = isClaudeModel ? await findAnthropicKey(apiModelName) : null;

  if (isClaudeModel && officialAnthropicKey) {
    const nativeClient = new Anthropic({
      apiKey: officialAnthropicKey,
    });

    const anthropicMessages: Anthropic.MessageParam[] = [
      ...optimizedHistory
        .filter(msg => msg.content && (typeof msg.content === 'string' ? msg.content.trim() !== '' : true))
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content as string,
        })),
      { role: 'user', content: userContent as string },
    ];

    const streamParams: any = {
      model: apiModelName,
      max_tokens: config.max_tokens,
      system: systemPrompt,
      messages: anthropicMessages,
      stream: true,
    };

    if (config.thinking.type === 'enabled') {
      streamParams.thinking = {
        type: 'enabled',
        budget_tokens: config.thinking.budget_tokens,
      };
      delete streamParams.temperature;
    } else {
      streamParams.temperature = config.temperature;
    }

    try {
      console.log(`[AI] Using official Anthropic API for model=${apiModelName}`);
      const stream = nativeClient.messages.stream(streamParams);
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta as any;
          if (delta.type === 'thinking_delta' && delta.thinking) {
            yield { type: 'thinking' as const, content: delta.thinking };
          } else if (delta.type === 'text_delta' && delta.text) {
            yield { type: 'token' as const, content: delta.text };
          }
        } else if (event.type === 'message_delta') {
          const usage = (event as any).usage;
          if (usage) {
            totalCompletionTokens = usage.output_tokens ?? 0;
          }
        } else if (event.type === 'message_start') {
          const usage = (event as any).message?.usage;
          if (usage) {
            totalPromptTokens = usage.input_tokens ?? 0;
          }
        }
      }

      yield {
        type: 'done' as const,
        tokenUsage: {
          model: modelName,
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: totalPromptTokens + totalCompletionTokens,
        }
      };
    } catch (err: any) {
      const statusCode = err.status || err.statusCode || '';
      const detail = err.error?.error?.message || err.message || 'Stream error';
      console.error(`[AI Stream Error] model=${modelName} status=${statusCode} message=${detail}`);
      yield { type: 'error' as const, content: detail };
    }
    return;
  }

  const requestParams: any = {
    model: apiModelName,
    max_tokens: config.max_tokens,
    temperature: config.temperature,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...optimizedHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: userContent },
    ],
  };

  if (!isClaudeModel) {
    requestParams.stream_options = { include_usage: true };
  }

  if (config.thinking.type === 'enabled' && isClaudeModel) {
    requestParams.extra_body = {
      thinking: {
        type: 'enabled',
        budget_tokens: config.thinking.budget_tokens,
      }
    };
  }

  try {
    const stream = await aiClient.chat.completions.create(requestParams);
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for await (const chunk of stream as any) {
      const delta = chunk.choices?.[0]?.delta;
      if ((delta as any)?.reasoning_content) {
        yield { type: 'thinking', content: (delta as any).reasoning_content };
      }
      if (delta?.content) {
        yield { type: 'token', content: delta.content };
      }
      if (chunk.usage) {
        totalPromptTokens = chunk.usage.prompt_tokens ?? 0;
        totalCompletionTokens = chunk.usage.completion_tokens ?? 0;
      }
    }

    yield {
      type: 'done',
      tokenUsage: {
        model: modelName,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      }
    };
  } catch (err: any) {
    const statusCode = err.status || err.statusCode || '';
    const errBody = err.error?.message || err.response?.data?.error?.message || '';
    const detail = errBody || err.message || 'Stream error';
    console.error(`[AI Stream Error] model=${modelName} status=${statusCode} message=${detail}`);
    yield { type: 'error', content: detail };
  }
}

export async function generateProjectTasks(
  projectName: string,
  projectDescription: string,
  context: { currentUserId: number; currentUserName: string }
): Promise<{ tasks: { title: string; description?: string; priority: string; type: string }[]; tokenUsage?: ChatResponse['tokenUsage'] }> {
  const genModel = 'claude-sonnet-4-6';
  const response = await claudeComplete({
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

  const modelName = 'claude-sonnet-4-6';
  const tokenInfo = response.usage ? {
    model: modelName,
    promptTokens: response.usage.prompt_tokens ?? 0,
    completionTokens: response.usage.completion_tokens ?? 0,
    totalTokens: response.usage.total_tokens ?? 0,
  } : undefined;

  let aiText = response.content || '';
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

export async function extractMemories(
  conversationMessages: { role: string; content: string }[],
  userId: number,
  orgId: number
): Promise<void> {
  if (conversationMessages.length < 2) return;

  const model = 'claude-haiku-4-5-20251001';

  const conversationText = conversationMessages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  try {
    const response = await claudeComplete({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: `你是一个记忆提取助手。分析以下对话，提取值得记住的用户偏好、事实、工作风格或上下文信息。

只提取明确的、有价值的信息，不要猜测。如果没有值得记住的信息，返回空数组。

输出格式为纯 JSON（不要用 markdown 包裹）：
{
  "memories": [
    { "category": "preference|fact|work_style|context", "content": "简短描述" }
  ]
}

category 说明：
- preference: 用户的偏好（如回复风格、语言偏好等）
- fact: 关于用户的事实（如负责的项目、专业领域等）
- work_style: 工作风格（如喜欢详细计划、偏好快速迭代等）
- context: 重要的上下文信息（如正在处理的紧急事项等）`
        },
        {
          role: 'user',
          content: conversationText
        }
      ],
    });

    let aiText = response.content || '';
    const codeBlockMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      aiText = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(aiText);
    const memories = parsed.memories || [];

    for (const mem of memories) {
      if (mem.category && mem.content) {
        await storage.createUserMemory({
          userId,
          orgId,
          category: mem.category,
          content: mem.content,
          source: 'auto',
        });
      }
    }
  } catch (err) {
    console.error('Failed to extract memories:', err);
  }
}

export async function generateConversationTitle(
  userMessage: string,
  assistantReply: string
): Promise<string> {
  const truncatedUser = userMessage.slice(0, 500);
  const truncatedAssistant = assistantReply.slice(0, 500);

  const response = await claudeComplete({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 60,
    messages: [
      {
        role: 'system',
        content: '根据用户和AI的对话，生成一个简短的对话标题（2-8个词）。直接输出标题文字，不要加引号、标点或解释。用对话的主要语言。'
      },
      {
        role: 'user',
        content: `用户: ${truncatedUser}\n\nAI: ${truncatedAssistant}`
      }
    ],
  });

  const title = (response.content || '').trim().slice(0, 50);
  return title || userMessage.slice(0, 30);
}

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_SIMPLE_API_KEY,
  ...(process.env.ANTHROPIC_API_KEY ? {} : { baseURL: 'https://vip.aipro.love' }),
});

export async function* codeToolChatStream(
  message: string,
  conversationHistory: { role: string; content: string | any[] }[],
  systemPrompt: string,
  modelName?: string,
): AsyncGenerator<{ type: string; content?: string; toolName?: string; toolInput?: any; tokenUsage?: ChatResponse['tokenUsage']; result?: string }> {
  const model = modelName || 'claude-sonnet-4-6';
  const MAX_TOOL_ROUNDS = 8;

  const messages: Anthropic.MessageParam[] = conversationHistory
    .filter(msg => msg.content && (typeof msg.content === 'string' ? msg.content.trim() !== '' : true))
    .map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content as string,
    }));

  messages.push({ role: 'user', content: message });

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  const MAX_TOOL_RESULT_LENGTH = 15000;

  function truncateToolResult(result: string): string {
    if (result.length <= MAX_TOOL_RESULT_LENGTH) return result;
    return result.slice(0, MAX_TOOL_RESULT_LENGTH) + `\n\n[内容已截断，共 ${result.length} 字符，已显示前 ${MAX_TOOL_RESULT_LENGTH} 字符]`;
  }

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropicClient.messages.create({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        tools: CODE_TOOLS as Anthropic.Tool[],
        messages,
      });

      totalPromptTokens += response.usage?.input_tokens ?? 0;
      totalCompletionTokens += response.usage?.output_tokens ?? 0;

      if (response.stop_reason === 'tool_use') {
        const assistantContent = response.content;
        messages.push({ role: 'assistant', content: assistantContent });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of assistantContent) {
          if (block.type === 'tool_use') {
            yield { type: 'tool_use', toolName: block.name, toolInput: block.input };

            const result = truncateToolResult(executeCodeTool(block.name, block.input as Record<string, any>));
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });

            const resultSummary = typeof result === 'string'
              ? result.slice(0, 200)
              : Array.isArray(result) ? JSON.stringify(result).slice(0, 200) : '';
            yield { type: 'tool_result_event', toolName: block.name, result: resultSummary };
          }
        }

        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      for (const block of response.content) {
        if (block.type === 'text') {
          yield { type: 'token', content: block.text };
        }
      }

      yield {
        type: 'done',
        tokenUsage: {
          model,
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: totalPromptTokens + totalCompletionTokens,
        },
      };
      return;
    }

    yield { type: 'token', content: '\n\n[已达到最大工具调用轮次限制]' };
    yield {
      type: 'done',
      tokenUsage: {
        model,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      },
    };
  } catch (err: any) {
    const statusCode = err.status || err.statusCode || '';
    const errBody = err.error?.message || err.response?.data?.error?.message || '';
    const detail = errBody || err.message || 'Code tool stream error';
    console.error(`[AI CodeTool Stream Error] model=${model} status=${statusCode} message=${detail}`);
    yield { type: 'error', content: detail };
  }
}
