import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, storage } from '../storage';
import { invalidateProviderCache } from '../services/ai/index';

const providerCreateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['proxy', 'direct']).default('direct'),
  baseUrl: z.string().url(),
  apiKeyEnvVar: z.string().min(1),
  models: z.array(z.string().min(1)).min(1),
  timeout: z.number().int().positive().default(90000),
  isActive: z.boolean().default(true),
});

const providerUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['proxy', 'direct']).optional(),
  baseUrl: z.string().url().optional(),
  apiKeyEnvVar: z.string().min(1).optional(),
  models: z.array(z.string().min(1)).min(1).optional(),
  timeout: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

const adminRouter = Router();

function isSuperAdmin(user: any): boolean {
  if (user.isSuperAdmin) return true;
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e: string) => e.trim()).filter(Boolean);
  if (adminEmails.includes(user.email)) return true;
  return false;
}

export async function superAdminMiddleware(req: any, res: any, next: any) {
  if (!req.currentUserId) {
    return res.status(401).json({ error: '未登录' });
  }
  const user = await storage.getUserById(req.currentUserId);
  if (!user || !isSuperAdmin(user)) {
    return res.status(403).json({ error: '无权访问管理后台' });
  }
  req.isSuperAdmin = true;
  next();
}

export async function adminOrOwnerMiddleware(req: any, res: any, next: any) {
  if (!req.currentUserId) {
    return res.status(401).json({ error: '未登录' });
  }
  const user = await storage.getUserById(req.currentUserId);
  if (!user) {
    return res.status(403).json({ error: '无权访问管理后台' });
  }
  if (isSuperAdmin(user)) {
    req.isSuperAdmin = true;
    return next();
  }
  if (req.userRole === 'owner') {
    req.isSuperAdmin = false;
    return next();
  }
  return res.status(403).json({ error: '无权访问管理后台' });
}

function requireSuperAdmin(req: any, res: any, next: any) {
  if (!req.isSuperAdmin) {
    return res.status(403).json({ error: '此功能仅限超级管理员' });
  }
  next();
}

adminRouter.get("/health", requireSuperAdmin, async (_req, res) => {
  let dbOk = false, dbLatency = 0;
  try {
    const t = Date.now();
    await db.execute(sql`SELECT 1`);
    dbLatency = Date.now() - t;
    dbOk = true;
  } catch {}

  const mem = process.memoryUsage();
  const aiSimple = !!process.env.CLAUDE_SIMPLE_API_KEY;
  const aiComplex = !!process.env.CLAUDE_COMPLEX_API_KEY;
  const aiOpenRouter = !!process.env.AI_API_KEY;

  res.json({
    data: {
      status: dbOk ? 'healthy' : 'degraded',
      uptime: Math.floor(process.uptime()),
      db: { ok: dbOk, latencyMs: dbLatency },
      ai: {
        simpleKey: aiSimple,
        complexKey: aiComplex,
        openRouterKey: aiOpenRouter,
      },
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
      },
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    }
  });
});

adminRouter.get("/overview", requireSuperAdmin, async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE) as new_users_today,
        (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as new_users_week,
        (SELECT COUNT(*) FROM organizations) as total_orgs,
        (SELECT COUNT(DISTINCT user_id) FROM activity_logs WHERE created_at >= CURRENT_DATE) as dau,
        (SELECT COUNT(DISTINCT user_id) FROM activity_logs WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as wau,
        (SELECT COUNT(DISTINCT user_id) FROM activity_logs WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as mau,
        (SELECT COUNT(*) FROM tasks) as total_tasks,
        (SELECT COUNT(*) FROM tasks WHERE status NOT IN ('done','cancelled')) as active_tasks,
        (SELECT COUNT(*) FROM tasks WHERE due_date IS NOT NULL AND due_date < CURRENT_DATE AND status NOT IN ('done','cancelled')) as overdue_tasks,
        (SELECT COUNT(*) FROM tasks WHERE created_at >= CURRENT_DATE) as tasks_created_today,
        (SELECT COUNT(*) FROM kb_documents) as total_kb_docs,
        (SELECT COUNT(*) FROM kb_documents WHERE status = 'error') as failed_kb_docs,
        (SELECT COUNT(*) FROM kb_chunks) as total_kb_chunks,
        (SELECT COALESCE(SUM(total_tokens), 0) FROM token_usage WHERE created_at >= CURRENT_DATE) as tokens_today,
        (SELECT COALESCE(SUM(total_tokens), 0) FROM token_usage WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) as tokens_month,
        (SELECT COALESCE(SUM(CAST(cost_usd AS NUMERIC)), 0) FROM token_usage WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) as cost_month_usd,
        (SELECT COUNT(*) FROM token_usage WHERE created_at >= CURRENT_DATE) as ai_calls_today,
        (SELECT COUNT(*) FROM member_profiles WHERE status = 'pending') as pending_profiles,
        (SELECT COUNT(*) FROM conversations WHERE created_at >= CURRENT_DATE) as conversations_today
    `);
    res.json({ data: result.rows[0] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.get("/ai/stats", async (req: any, res) => {
  try {
    const period = (req.query.period as string) || 'month';
    let dateFilter: ReturnType<typeof sql>;
    switch (period) {
      case 'today': dateFilter = sql`tu.created_at >= CURRENT_DATE`; break;
      case 'week': dateFilter = sql`tu.created_at >= CURRENT_DATE - INTERVAL '7 days'`; break;
      default: dateFilter = sql`tu.created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
    }

    if (!req.isSuperAdmin && !req.orgId) {
      return res.status(403).json({ error: '无法确定组织' });
    }

    const orgFilter = req.isSuperAdmin ? sql`` : sql` AND tu.org_id = ${req.orgId}`;

    const byModel = await db.execute(sql`
      SELECT 
        tu.model, 
        COUNT(*) as calls,
        COALESCE(SUM(tu.prompt_tokens), 0) as prompt_tokens,
        COALESCE(SUM(tu.completion_tokens), 0) as completion_tokens,
        COALESCE(SUM(tu.total_tokens), 0) as total_tokens,
        COALESCE(SUM(CAST(tu.cost_usd AS NUMERIC)), 0) as cost_usd
      FROM token_usage tu
      WHERE ${dateFilter}${orgFilter}
      GROUP BY tu.model
      ORDER BY total_tokens DESC
    `);

    const byPurpose = await db.execute(sql`
      SELECT 
        tu.purpose, 
        COUNT(*) as calls,
        COALESCE(SUM(tu.total_tokens), 0) as total_tokens,
        COALESCE(SUM(CAST(tu.cost_usd AS NUMERIC)), 0) as cost_usd
      FROM token_usage tu
      WHERE ${dateFilter}${orgFilter}
      GROUP BY tu.purpose
      ORDER BY total_tokens DESC
    `);

    let byOrg = { rows: [] as any[] };
    if (req.isSuperAdmin) {
      byOrg = await db.execute(sql`
        SELECT 
          tu.org_id,
          o.name as org_name,
          COUNT(*) as calls,
          COALESCE(SUM(tu.total_tokens), 0) as total_tokens,
          COALESCE(SUM(CAST(tu.cost_usd AS NUMERIC)), 0) as cost_usd
        FROM token_usage tu
        LEFT JOIN organizations o ON tu.org_id = o.id
        WHERE ${dateFilter}
        GROUP BY tu.org_id, o.name
        ORDER BY total_tokens DESC
        LIMIT 10
      `);
    }

    res.json({ data: { byModel: byModel.rows, byPurpose: byPurpose.rows, byOrg: byOrg.rows } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.get("/ai/hourly", async (req: any, res) => {
  try {
    if (!req.isSuperAdmin && !req.orgId) {
      return res.status(403).json({ error: '无法确定组织' });
    }
    const orgFilter = req.isSuperAdmin ? sql`` : sql` AND org_id = ${req.orgId}`;
    const result = await db.execute(sql`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as calls,
        COALESCE(SUM(total_tokens), 0) as tokens
      FROM token_usage
      WHERE created_at >= NOW() - INTERVAL '24 hours'${orgFilter}
      GROUP BY hour
      ORDER BY hour
    `);
    res.json({ data: result.rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.get("/ai/config", requireSuperAdmin, async (_req, res) => {
  try {
    const providers = await storage.getAiProviders();
    const enriched = providers.map(p => ({
      ...p,
      keyConfigured: !!process.env[p.apiKeyEnvVar],
    }));
    const taskRouting = {
      quick_reply: { model: 'claude-haiku-4-5-20251001' },
      title_generation: { model: 'claude-haiku-4-5-20251001' },
      auto_judgment: { model: 'claude-haiku-4-5-20251001' },
      general_chat: { model: 'claude-sonnet-4-6' },
      code_generation: { model: 'claude-sonnet-4-6' },
      complex_analysis: { model: 'claude-sonnet-4-6' },
      document_processing: { model: 'claude-sonnet-4-6' },
      knowledge_qa: { model: 'claude-sonnet-4-6' },
    };
    res.json({ data: { providers: enriched, taskRouting } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.get("/ai/providers", requireSuperAdmin, async (_req, res) => {
  try {
    const providers = await storage.getAiProviders();
    const enriched = providers.map(p => ({
      ...p,
      keyConfigured: !!process.env[p.apiKeyEnvVar],
    }));
    res.json({ data: enriched });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.post("/ai/providers", requireSuperAdmin, async (req, res) => {
  try {
    const parsed = providerCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const existing = await storage.getAiProviders();
    const maxPriority = existing.length > 0 ? Math.max(...existing.map(p => p.priority)) + 1 : 0;
    const provider = await storage.createAiProvider({
      ...parsed.data,
      priority: maxPriority,
    });
    invalidateProviderCache();
    res.json({ data: { ...provider, keyConfigured: !!process.env[provider.apiKeyEnvVar] } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.patch("/ai/providers/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await storage.getAiProvider(id);
    if (!existing) return res.status(404).json({ error: 'Provider not found' });
    const parsed = providerUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const provider = await storage.updateAiProvider(id, parsed.data);
    invalidateProviderCache();
    res.json({ data: { ...provider, keyConfigured: !!process.env[provider.apiKeyEnvVar] } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.delete("/ai/providers/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await storage.getAiProvider(id);
    if (!existing) return res.status(404).json({ error: 'Provider not found' });
    await storage.deleteAiProvider(id);
    invalidateProviderCache();
    res.json({ data: { success: true } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.put("/ai/providers/reorder", requireSuperAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }
    await storage.reorderAiProviders(ids);
    invalidateProviderCache();
    const providers = await storage.getAiProviders();
    res.json({ data: providers.map(p => ({ ...p, keyConfigured: !!process.env[p.apiKeyEnvVar] })) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.post("/ai/providers/:id/test", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const provider = await storage.getAiProvider(id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    const apiKey = process.env[provider.apiKeyEnvVar];
    if (!apiKey) {
      return res.json({ data: { success: false, error: `环境变量 ${provider.apiKeyEnvVar} 未配置` } });
    }
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ baseURL: provider.baseUrl, apiKey, timeout: 15000 });
    const startTime = Date.now();
    try {
      await client.chat.completions.create({
        model: provider.models[0],
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      });
      const latency = Date.now() - startTime;
      res.json({ data: { success: true, latency, model: provider.models[0] } });
    } catch (apiErr: any) {
      const latency = Date.now() - startTime;
      res.json({ data: { success: false, error: apiErr.message, latency } });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

const modelProviderCreateSchema = z.object({
  modelId: z.string().min(1),
  providerName: z.string().min(1),
  baseUrl: z.string().url().nullable().optional().or(z.literal('').transform(() => null)),
  apiKeyEnvVar: z.string().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  timeout: z.number().int().positive().default(90000),
  isActive: z.boolean().default(true),
}).refine(d => d.apiKeyEnvVar || d.apiKey, { message: '请提供 API Key 或环境变量名' });

const modelProviderUpdateSchema = z.object({
  providerName: z.string().min(1).optional(),
  baseUrl: z.string().nullable().optional(),
  apiKeyEnvVar: z.string().nullable().optional(),
  apiKey: z.string().nullable().optional(),
  timeout: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

adminRouter.get("/ai/model-providers", requireSuperAdmin, async (_req, res) => {
  try {
    const providers = await storage.getModelProviders();
    const enriched = providers.map(p => ({
      ...p,
      apiKey: p.apiKey ? `${p.apiKey.slice(0, 8)}...${p.apiKey.slice(-4)}` : null,
      keyConfigured: !!(p.apiKey || (p.apiKeyEnvVar && process.env[p.apiKeyEnvVar])),
    }));
    res.json({ data: enriched });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.post("/ai/model-providers", requireSuperAdmin, async (req, res) => {
  try {
    const parsed = modelProviderCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const existing = await storage.getModelProvidersByModel(parsed.data.modelId);
    const maxPriority = existing.length > 0 ? Math.max(...existing.map(p => p.priority)) + 1 : 0;
    const provider = await storage.createModelProvider({
      ...parsed.data,
      apiKeyEnvVar: parsed.data.apiKeyEnvVar || null,
      apiKey: parsed.data.apiKey || null,
      baseUrl: parsed.data.baseUrl || null,
      priority: maxPriority,
    });
    invalidateProviderCache();
    res.json({ data: { ...provider, apiKey: provider.apiKey ? '***' : null, keyConfigured: !!(provider.apiKey || (provider.apiKeyEnvVar && process.env[provider.apiKeyEnvVar])) } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.patch("/ai/model-providers/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await storage.getModelProvider(id);
    if (!existing) return res.status(404).json({ error: 'Provider not found' });
    const parsed = modelProviderUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const provider = await storage.updateModelProvider(id, parsed.data);
    invalidateProviderCache();
    res.json({ data: { ...provider, apiKey: provider.apiKey ? '***' : null, keyConfigured: !!(provider.apiKey || (provider.apiKeyEnvVar && process.env[provider.apiKeyEnvVar])) } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.delete("/ai/model-providers/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await storage.getModelProvider(id);
    if (!existing) return res.status(404).json({ error: 'Provider not found' });
    await storage.deleteModelProvider(id);
    invalidateProviderCache();
    res.json({ data: { success: true } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.put("/ai/model-providers/reorder", requireSuperAdmin, async (req, res) => {
  try {
    const { modelId, ids } = req.body;
    if (!modelId || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'modelId and ids array required' });
    }
    await storage.reorderModelProviders(modelId, ids);
    invalidateProviderCache();
    const providers = await storage.getModelProvidersByModel(modelId);
    res.json({ data: providers.map(p => ({ ...p, keyConfigured: !!(p.apiKeyEnvVar ? process.env[p.apiKeyEnvVar] : undefined) })) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.post("/ai/model-providers/:id/test", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const provider = await storage.getModelProvider(id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    let apiKey = provider.apiKey || (provider.apiKeyEnvVar ? process.env[provider.apiKeyEnvVar] : null);
    if (!apiKey && provider.apiKeyEnvVar && provider.apiKeyEnvVar.startsWith('sk-')) {
      apiKey = provider.apiKeyEnvVar;
    }
    if (!apiKey) {
      return res.json({ data: { success: false, error: provider.apiKeyEnvVar ? `环境变量 ${provider.apiKeyEnvVar} 未配置` : 'API Key 未配置' } });
    }

    const isClaudeModel = provider.modelId.startsWith('claude');
    const isAnthropicKey = apiKey.startsWith('sk-ant-');
    const hasProxyUrl = provider.baseUrl && !provider.baseUrl.includes('anthropic.com');

    if (isClaudeModel && isAnthropicKey && !hasProxyUrl) {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey, timeout: 15000 });
      const startTime = Date.now();
      try {
        await client.messages.create({
          model: provider.modelId,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        });
        const latency = Date.now() - startTime;
        res.json({ data: { success: true, latency, model: provider.modelId } });
      } catch (apiErr: any) {
        const latency = Date.now() - startTime;
        res.json({ data: { success: false, error: apiErr.message, latency } });
      }
      return;
    }

    const defaultBaseUrl = isClaudeModel
      ? 'https://vip.aipro.love/v1'
      : provider.modelId === 'deepseek-chat'
        ? 'https://openrouter.ai/api/v1'
        : 'https://api.openai.com/v1';
    const baseUrl = provider.baseUrl || defaultBaseUrl;
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ baseURL: baseUrl, apiKey, timeout: 15000 });
    const startTime = Date.now();
    try {
      await client.chat.completions.create({
        model: provider.modelId,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      });
      const latency = Date.now() - startTime;
      res.json({ data: { success: true, latency, model: provider.modelId } });
    } catch (apiErr: any) {
      const latency = Date.now() - startTime;
      res.json({ data: { success: false, error: apiErr.message, latency } });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.post("/ai/probe-models", requireSuperAdmin, async (req, res) => {
  try {
    const { baseUrl, apiKey, apiKeyEnvVar } = req.body;
    const key = apiKey || (apiKeyEnvVar ? process.env[apiKeyEnvVar] : null);
    if (!key) return res.status(400).json({ error: 'API Key 未提供' });
    if (!baseUrl) return res.status(400).json({ error: 'Base URL 未提供' });
    try {
      const parsed = new URL(baseUrl);
      const host = parsed.hostname;
      if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|localhost|::1|\[::1\])/.test(host)) {
        return res.status(400).json({ error: '不允许访问内网地址' });
      }
    } catch {
      return res.status(400).json({ error: 'Base URL 格式无效' });
    }
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ baseURL: baseUrl, apiKey: key, timeout: 15000 });
    const result = await client.models.list();
    const models: { id: string; name: string }[] = [];
    for await (const m of result) {
      models.push({ id: m.id, name: m.id });
    }
    models.sort((a, b) => a.id.localeCompare(b.id));
    res.json({ data: { models } });
  } catch (e: any) {
    res.status(500).json({ error: `探测失败: ${e.message}` });
  }
});

const batchCreateSchema = z.object({
  modelIds: z.array(z.string().min(1)).min(1),
  providerName: z.string().min(1),
  baseUrl: z.string().url().nullable().optional().or(z.literal('').transform(() => null)),
  apiKeyEnvVar: z.string().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  timeout: z.number().int().positive().default(90000),
  isActive: z.boolean().default(true),
}).refine(d => d.apiKeyEnvVar || d.apiKey, { message: '请提供 API Key 或环境变量名' });

adminRouter.post("/ai/model-providers/batch", requireSuperAdmin, async (req, res) => {
  try {
    const parsed = batchCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const created: any[] = [];
    for (const modelId of parsed.data.modelIds) {
      const existing = await storage.getModelProvidersByModel(modelId);
      const maxPriority = existing.length > 0 ? Math.max(...existing.map(p => p.priority)) + 1 : 0;
      const provider = await storage.createModelProvider({
        modelId,
        providerName: parsed.data.providerName,
        baseUrl: parsed.data.baseUrl || null,
        apiKeyEnvVar: parsed.data.apiKeyEnvVar || null,
        apiKey: parsed.data.apiKey || null,
        timeout: parsed.data.timeout,
        isActive: parsed.data.isActive,
        priority: maxPriority,
      });
      created.push({ ...provider, apiKey: provider.apiKey ? '***' : null });
    }
    invalidateProviderCache();
    res.json({ data: created });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

const DEFAULT_CHAT_MODELS = JSON.stringify([
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', desc: '日常任务首选' },
  { id: 'claude-opus-4-6', label: 'Opus 4.6', desc: '深度分析模式' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', desc: '快速响应' },
  { id: 'gpt-5.4', label: 'GPT-5.4', desc: 'OpenAI 最新旗舰' },
  { id: 'deepseek-chat', label: 'DeepSeek V3.2', desc: '高性价比' },
]);

const chatModelEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  desc: z.string().default(""),
});
const chatModelsArraySchema = z.array(chatModelEntrySchema).min(1);

adminRouter.get("/ai/chat-models", requireSuperAdmin, async (_req, res) => {
  try {
    const val = await storage.getSystemConfig('chat_visible_models');
    if (val) {
      try {
        const parsed = JSON.parse(val);
        const validated = chatModelsArraySchema.safeParse(parsed);
        if (validated.success) {
          return res.json({ data: validated.data });
        }
      } catch {}
    }
    res.json({ data: JSON.parse(DEFAULT_CHAT_MODELS) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.put("/ai/chat-models", requireSuperAdmin, async (req, res) => {
  try {
    const { models } = req.body;
    const validated = chatModelsArraySchema.safeParse(models);
    if (!validated.success) {
      return res.status(400).json({ error: '无效的模型列表', details: validated.error.flatten() });
    }
    await storage.setSystemConfig('chat_visible_models', JSON.stringify(validated.data));
    res.json({ data: validated.data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.get("/users/trend", requireSuperAdmin, async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY date ORDER BY date
    `);
    res.json({ data: result.rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.get("/users/recent", requireSuperAdmin, async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT id, display_name, email, auth_provider, role, created_at
      FROM users ORDER BY created_at DESC LIMIT 20
    `);
    res.json({ data: result.rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.get("/orgs/list", requireSuperAdmin, async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT 
        o.id, o.name, o.created_at, o.token_budget_usd,
        (SELECT COUNT(*) FROM org_memberships om WHERE om.org_id = o.id) as member_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.org_id = o.id) as task_count,
        (SELECT COUNT(*) FROM kb_documents kd WHERE kd.org_id = o.id) as kb_doc_count,
        (SELECT COALESCE(SUM(tu.total_tokens), 0) FROM token_usage tu WHERE tu.org_id = o.id AND tu.created_at >= DATE_TRUNC('month', CURRENT_DATE)) as tokens_this_month,
        (SELECT COALESCE(SUM(CAST(tu.cost_usd AS NUMERIC)), 0) FROM token_usage tu WHERE tu.org_id = o.id AND tu.created_at >= DATE_TRUNC('month', CURRENT_DATE)) as cost_this_month
      FROM organizations o
      ORDER BY o.created_at DESC
    `);
    res.json({ data: result.rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.get("/kb/stats", async (req: any, res) => {
  try {
    if (!req.isSuperAdmin && !req.orgId) {
      return res.status(403).json({ error: '无法确定组织' });
    }
    const orgFilter = req.isSuperAdmin ? sql`` : sql` WHERE org_id = ${req.orgId}`;
    const orgFilterAnd = req.isSuperAdmin ? sql`` : sql` AND org_id = ${req.orgId}`;

    const overview = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM kb_documents${orgFilter}) as total_docs,
        (SELECT COUNT(*) FROM kb_documents WHERE status = 'ready'${orgFilterAnd}) as ready_docs,
        (SELECT COUNT(*) FROM kb_documents WHERE status = 'processing'${orgFilterAnd}) as processing_docs,
        (SELECT COUNT(*) FROM kb_documents WHERE status = 'error'${orgFilterAnd}) as error_docs,
        (SELECT COUNT(*) FROM kb_chunks${req.isSuperAdmin ? sql`` : sql` WHERE doc_id IN (SELECT id FROM kb_documents WHERE org_id = ${req.orgId})`}) as total_chunks,
        (SELECT COALESCE(SUM(file_size), 0) FROM kb_documents${orgFilter}) as total_size_bytes
    `);

    const byCategory = await db.execute(req.isSuperAdmin ? sql`
      SELECT category, COUNT(*) as count FROM kb_documents WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC
    ` : sql`
      SELECT category, COUNT(*) as count FROM kb_documents WHERE category IS NOT NULL AND org_id = ${req.orgId} GROUP BY category ORDER BY count DESC
    `);

    const byType = await db.execute(req.isSuperAdmin ? sql`
      SELECT file_type, COUNT(*) as count FROM kb_documents WHERE file_type IS NOT NULL GROUP BY file_type ORDER BY count DESC
    ` : sql`
      SELECT file_type, COUNT(*) as count FROM kb_documents WHERE file_type IS NOT NULL AND org_id = ${req.orgId} GROUP BY file_type ORDER BY count DESC
    `);

    const errors = await db.execute(req.isSuperAdmin ? sql`
      SELECT id, title, file_name, org_id, created_at FROM kb_documents WHERE status = 'error' ORDER BY created_at DESC LIMIT 20
    ` : sql`
      SELECT id, title, file_name, org_id, created_at FROM kb_documents WHERE status = 'error' AND org_id = ${req.orgId} ORDER BY created_at DESC LIMIT 20
    `);

    res.json({ data: { overview: overview.rows[0], byCategory: byCategory.rows, byType: byType.rows, errors: errors.rows } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.get("/security/logs", async (req: any, res) => {
  try {
    if (!req.isSuperAdmin && !req.orgId) {
      return res.status(403).json({ error: '无法确定组织' });
    }
    const limit = parseInt(req.query.limit as string) || 50;
    const orgFilter = req.isSuperAdmin ? sql`` : sql` AND al.org_id = ${req.orgId}`;
    const result = await db.execute(sql`
      SELECT al.*, u.display_name as user_name, u.email as user_email, o.name as org_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN organizations o ON al.org_id = o.id
      WHERE al.action IN ('delete', 'update_role', 'smart_setup', 'claim', 'assign_department_role', 'purchase_tokens', 'scrape_url', 'delete_task', 'delete_project', 'update_user')${orgFilter}
      ORDER BY al.created_at DESC
      LIMIT ${limit}
    `);
    res.json({ data: result.rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.get("/ai-workforce", requireSuperAdmin, async (req, res) => {
  try {
    const period = (req.query.period as string) || 'month';
    let dateCondition: string;
    switch (period) {
      case 'week': dateCondition = ">= CURRENT_DATE - INTERVAL '7 days'"; break;
      default: dateCondition = ">= DATE_TRUNC('month', CURRENT_DATE)";
    }

    const userData = await db.execute(sql.raw(`
      SELECT 
        u.id as user_id,
        u.display_name,
        u.email,
        (SELECT COUNT(*) FROM token_usage tu WHERE tu.user_id = u.id AND tu.created_at ${dateCondition}) as ai_conversations,
        (SELECT COALESCE(SUM(tu.total_tokens), 0) FROM token_usage tu WHERE tu.user_id = u.id AND tu.created_at ${dateCondition}) as ai_tokens,
        (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status = 'done' AND t.updated_at ${dateCondition}) as tasks_completed,
        (SELECT COUNT(*) FROM task_deliverables td 
         JOIN tasks t ON td.task_id = t.id 
         WHERE t.assignee_id = u.id AND td.created_at ${dateCondition}) as total_deliverables,
        (SELECT COUNT(*) FROM task_deliverables td 
         JOIN tasks t ON td.task_id = t.id 
         WHERE t.assignee_id = u.id AND td.created_at ${dateCondition}
         AND td.description LIKE '%AI%') as ai_deliverables
      FROM users u
      WHERE EXISTS (SELECT 1 FROM org_memberships om WHERE om.user_id = u.id)
      ORDER BY ai_tokens DESC
    `));

    const results = userData.rows.map((row: any) => {
      const aiConversations = parseInt(row.ai_conversations) || 0;
      const aiTokens = parseInt(row.ai_tokens) || 0;
      const tasksCompleted = parseInt(row.tasks_completed) || 0;
      const totalDeliverables = parseInt(row.total_deliverables) || 0;
      const aiDeliverables = parseInt(row.ai_deliverables) || 0;

      const deliveryScore = totalDeliverables > 0 ? (aiDeliverables / totalDeliverables) * 100 : 0;
      const convRatio = tasksCompleted > 0 ? aiConversations / tasksCompleted : 0;
      const convScore = Math.min(100, convRatio * 10);
      const tokenScore = Math.min(100, aiTokens / 5000);

      const index = Math.round(deliveryScore * 0.45 + convScore * 0.35 + tokenScore * 0.20);

      let riskLevel: string;
      if (index >= 70) riskLevel = 'critical';
      else if (index >= 50) riskLevel = 'high';
      else if (index >= 20) riskLevel = 'medium';
      else riskLevel = 'low';

      return {
        userId: row.user_id,
        name: row.display_name,
        email: row.email,
        aiDependencyIndex: Math.min(100, index),
        riskLevel,
        aiConversations,
        aiTokens,
        tasksCompleted,
        totalDeliverables,
        aiDeliverables,
        aiDeliveryRatio: totalDeliverables > 0 ? Math.round(aiDeliverables / totalDeliverables * 100) : 0,
      };
    });

    results.sort((a: any, b: any) => b.aiDependencyIndex - a.aiDependencyIndex);

    const validResults = results.filter((r: any) => r.aiConversations > 0 || r.tasksCompleted > 0);
    const teamIndex = validResults.length > 0
      ? Math.round(validResults.reduce((sum: number, r: any) => sum + r.aiDependencyIndex, 0) / validResults.length)
      : 0;

    const distribution = {
      low: results.filter((r: any) => r.riskLevel === 'low').length,
      medium: results.filter((r: any) => r.riskLevel === 'medium').length,
      high: results.filter((r: any) => r.riskLevel === 'high').length,
      critical: results.filter((r: any) => r.riskLevel === 'critical').length,
    };

    res.json({ data: { teamIndex, distribution, members: results } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

adminRouter.get("/ai-workforce/:userId", requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const trend = await db.execute(sql`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
        COUNT(*) as ai_calls,
        COALESCE(SUM(total_tokens), 0) as tokens
      FROM token_usage
      WHERE user_id = ${userId}
        AND created_at >= CURRENT_DATE - INTERVAL '3 months'
      GROUP BY month
      ORDER BY month
    `);

    const recentChats = await db.execute(sql`
      SELECT purpose, model, total_tokens, created_at
      FROM token_usage
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 20
    `);

    const byPurpose = await db.execute(sql`
      SELECT purpose, COUNT(*) as calls, COALESCE(SUM(total_tokens), 0) as tokens
      FROM token_usage
      WHERE user_id = ${userId}
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY purpose
    `);

    res.json({ data: { trend: trend.rows, recentChats: recentChats.rows, byPurpose: byPurpose.rows } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default adminRouter;
