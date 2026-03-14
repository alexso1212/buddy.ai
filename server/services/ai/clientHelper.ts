import OpenAI from 'openai';
import { loadProviders } from './index';
import { AI_BASE_URL, AI_API_KEY, AI_DEFAULT_TIMEOUT } from './config';

export async function getAiClient(model: string): Promise<OpenAI> {
  const providers = await loadProviders();
  for (const p of providers) {
    if (!p.isActive || !p.models.includes(model)) continue;
    const key = process.env[p.apiKeyEnvVar];
    if (key) return new OpenAI({ baseURL: p.baseUrl, apiKey: key, timeout: p.timeout });
  }
  return new OpenAI({ baseURL: AI_BASE_URL, apiKey: AI_API_KEY, timeout: AI_DEFAULT_TIMEOUT });
}
