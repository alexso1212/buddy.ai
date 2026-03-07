import { db } from '../storage';
import { aiProviders, aiModelProviders } from '@shared/schema';

export async function seedAiProviders() {
  const existing = await db.select().from(aiProviders);
  if (existing.length > 0) {
    console.log(`Migration: ai_providers already seeded (${existing.length} providers)`);
  } else {
    const defaults = [
      {
        name: 'Claude Simple (Haiku/Sonnet)',
        type: 'proxy',
        baseUrl: 'https://vip.aipro.love/v1',
        apiKeyEnvVar: 'CLAUDE_SIMPLE_API_KEY',
        models: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
        timeout: 90000,
        priority: 0,
        isActive: true,
      },
      {
        name: 'Claude Complex (Opus)',
        type: 'proxy',
        baseUrl: 'https://vip.aipro.love/v1',
        apiKeyEnvVar: 'CLAUDE_COMPLEX_API_KEY',
        models: ['claude-opus-4-6'],
        timeout: 180000,
        priority: 1,
        isActive: true,
      },
      {
        name: 'OpenRouter (Fallback)',
        type: 'direct',
        baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
        apiKeyEnvVar: 'AI_API_KEY',
        models: ['gpt-4o', 'deepseek-chat'],
        timeout: 30000,
        priority: 2,
        isActive: true,
      },
    ];
    await db.insert(aiProviders).values(defaults);
    console.log(`Migration: ai_providers seeded with ${defaults.length} default providers`);
  }

  const existingModelProviders = await db.select().from(aiModelProviders);
  if (existingModelProviders.length > 0) {
    console.log(`Migration: ai_model_providers already seeded (${existingModelProviders.length} entries)`);
    return;
  }

  const oldProviders = await db.select().from(aiProviders);
  if (oldProviders.length > 0) {
    const newEntries: Array<{
      modelId: string;
      providerName: string;
      baseUrl: string | null;
      apiKeyEnvVar: string;
      timeout: number;
      priority: number;
      isActive: boolean;
    }> = [];

    const priorityCounters: Record<string, number> = {};

    for (const p of oldProviders) {
      for (const model of p.models) {
        const pri = priorityCounters[model] ?? 0;
        priorityCounters[model] = pri + 1;
        newEntries.push({
          modelId: model,
          providerName: p.name,
          baseUrl: p.baseUrl || null,
          apiKeyEnvVar: p.apiKeyEnvVar,
          timeout: p.timeout,
          priority: pri,
          isActive: p.isActive,
        });
      }
    }

    if (newEntries.length > 0) {
      await db.insert(aiModelProviders).values(newEntries);
      console.log(`Migration: ai_model_providers seeded with ${newEntries.length} entries from ${oldProviders.length} old providers`);
    }
  } else {
    const defaults = [
      { modelId: 'claude-sonnet-4-6', providerName: 'Claude 代理', baseUrl: 'https://vip.aipro.love/v1', apiKeyEnvVar: 'CLAUDE_SIMPLE_API_KEY', timeout: 90000, priority: 0, isActive: true },
      { modelId: 'claude-haiku-4-5-20251001', providerName: 'Claude 代理', baseUrl: 'https://vip.aipro.love/v1', apiKeyEnvVar: 'CLAUDE_SIMPLE_API_KEY', timeout: 90000, priority: 0, isActive: true },
      { modelId: 'claude-opus-4-6', providerName: 'Claude 代理', baseUrl: 'https://vip.aipro.love/v1', apiKeyEnvVar: 'CLAUDE_COMPLEX_API_KEY', timeout: 180000, priority: 0, isActive: true },
      { modelId: 'gpt-4o', providerName: 'OpenRouter', baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1', apiKeyEnvVar: 'AI_API_KEY', timeout: 30000, priority: 0, isActive: true },
      { modelId: 'deepseek-chat', providerName: 'OpenRouter', baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1', apiKeyEnvVar: 'AI_API_KEY', timeout: 30000, priority: 0, isActive: true },
    ];
    await db.insert(aiModelProviders).values(defaults);
    console.log(`Migration: ai_model_providers seeded with ${defaults.length} default entries`);
  }
}
