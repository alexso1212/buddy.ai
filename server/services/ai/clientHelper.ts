import OpenAI from 'openai';
import { storage } from '../../storage';
import type { AiProvider } from '@shared/schema';

let _cached: AiProvider[] | null = null;
let _cacheTime = 0;

export async function getAiClient(model: string): Promise<OpenAI> {
  const now = Date.now();
  if (!_cached || now - _cacheTime > 60000) {
    try {
      _cached = await storage.getAiProviders();
      _cacheTime = now;
    } catch {
      if (!_cached) {
        const apiKey = process.env.CLAUDE_SIMPLE_API_KEY || process.env.AI_API_KEY || '';
        return new OpenAI({ baseURL: 'https://vip.aipro.love/v1', apiKey, timeout: 90000 });
      }
    }
  }
  for (const p of _cached!) {
    if (!p.isActive || !p.models.includes(model)) continue;
    const key = process.env[p.apiKeyEnvVar];
    if (key) return new OpenAI({ baseURL: p.baseUrl, apiKey: key, timeout: p.timeout });
  }
  const apiKey = process.env.CLAUDE_SIMPLE_API_KEY || process.env.AI_API_KEY || '';
  return new OpenAI({ baseURL: 'https://vip.aipro.love/v1', apiKey, timeout: 90000 });
}
