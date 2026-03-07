import { db } from '../storage';
import { aiProviders } from '@shared/schema';

export async function seedAiProviders() {
  const existing = await db.select().from(aiProviders);
  if (existing.length > 0) {
    console.log(`Migration: ai_providers already seeded (${existing.length} providers)`);
    return;
  }

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
