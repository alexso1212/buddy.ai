import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './prompts';
import { ACTION_SCHEMAS } from './actionSchemas';
import { storage } from '../../storage';

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

interface ChatResponse {
  type: 'text' | 'confirm' | 'multi_confirm';
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
}

function formatTeamMembers(users: { id: number; displayName: string; role: string; email: string }[]): string {
  return users.map(u => `- ID:${u.id} ${u.displayName}（${u.role}）${u.email}`).join('\n');
}

function formatProjectList(projects: { id: number; name: string; status: string; description?: string | null }[]): string {
  return projects.map(p => `- ID:${p.id} ${p.name}（${p.status}）${p.description || ''}`).join('\n');
}

export async function chat(
  message: string,
  conversationHistory: { role: string; content: string }[],
  context: { currentUserId: number; currentUserName: string }
): Promise<ChatResponse> {
  const allUsers = await storage.getUsers();
  const allProjects = await storage.getProjects();

  const systemPrompt = SYSTEM_PROMPT
    .replace('{{currentUserId}}', String(context.currentUserId))
    .replace('{{currentUserName}}', context.currentUserName)
    .replace('{{currentTime}}', new Date().toISOString())
    .replace('{{teamMembers}}', formatTeamMembers(allUsers))
    .replace('{{projectList}}', formatProjectList(allProjects));

  const response = await client.chat.completions.create({
    model: 'anthropic/claude-haiku-4-5-20241022',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ],
  });

  const aiText = response.choices[0]?.message?.content || '';

  try {
    const parsed = JSON.parse(aiText);

    if (parsed.type === 'confirm' && parsed.action) {
      const schema = ACTION_SCHEMAS[parsed.action.actionType];
      if (schema) {
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
