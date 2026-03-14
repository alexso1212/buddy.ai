const MODEL_PRICING: Record<string, { promptPer1k: number; completionPer1k: number }> = {
  'claude-sonnet-4-6': { promptPer1k: 0.003, completionPer1k: 0.015 },
  'claude-opus-4-6': { promptPer1k: 0.005, completionPer1k: 0.025 },
  'claude-haiku-4-5': { promptPer1k: 0.001, completionPer1k: 0.005 },
  'claude-haiku-4-5-20251001': { promptPer1k: 0.001, completionPer1k: 0.005 },
  'claude-sonnet-4-5': { promptPer1k: 0.003, completionPer1k: 0.015 },
  'claude-opus-4-5': { promptPer1k: 0.005, completionPer1k: 0.025 },
  'claude-sonnet-4': { promptPer1k: 0.003, completionPer1k: 0.015 },
  'claude-sonnet-4-20250514': { promptPer1k: 0.003, completionPer1k: 0.015 },
  'claude-opus-4': { promptPer1k: 0.015, completionPer1k: 0.075 },
  'claude-opus-4-1': { promptPer1k: 0.015, completionPer1k: 0.075 },
  'claude-3-5-sonnet-20241022': { promptPer1k: 0.003, completionPer1k: 0.015 },
  'claude-3-haiku-20240307': { promptPer1k: 0.00025, completionPer1k: 0.00125 },

  'gpt-5.4': { promptPer1k: 0.0025, completionPer1k: 0.015 },
  'gpt-5.4-pro': { promptPer1k: 0.03, completionPer1k: 0.18 },
  'gpt-5.2': { promptPer1k: 0.00175, completionPer1k: 0.014 },
  'gpt-5.2-pro': { promptPer1k: 0.03, completionPer1k: 0.18 },
  'gpt-5.1': { promptPer1k: 0.00125, completionPer1k: 0.01 },
  'gpt-4o': { promptPer1k: 0.005, completionPer1k: 0.015 },
  'gpt-4o-mini': { promptPer1k: 0.00015, completionPer1k: 0.0006 },

  'deepseek-chat': { promptPer1k: 0.00028, completionPer1k: 0.00042 },
  'deepseek-reasoner': { promptPer1k: 0.00028, completionPer1k: 0.00042 },

  'anthropic/claude-sonnet-4.6': { promptPer1k: 0.003, completionPer1k: 0.015 },
  'anthropic/claude-opus-4.6': { promptPer1k: 0.005, completionPer1k: 0.025 },
  'anthropic/claude-haiku-4.5': { promptPer1k: 0.001, completionPer1k: 0.005 },
  'openai/gpt-5.4': { promptPer1k: 0.0025, completionPer1k: 0.015 },
  'openai/gpt-5.4-pro': { promptPer1k: 0.03, completionPer1k: 0.18 },
  'google/gemini-3-flash-preview': { promptPer1k: 0.001, completionPer1k: 0.004 },
  'google/gemini-2.5-pro-preview': { promptPer1k: 0.00125, completionPer1k: 0.01 },
  'deepseek/deepseek-v3.2': { promptPer1k: 0.00025, completionPer1k: 0.00038 },
};

const DEFAULT_PRICING = { promptPer1k: 0.003, completionPer1k: 0.015 };

function normalizeModelName(model: string): string {
  return model.replace(/^(anthropic|openai|google|deepseek)\//, '').replace(/\./g, '-');
}

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): string {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[normalizeModelName(model)] || DEFAULT_PRICING;
  const cost =
    (promptTokens / 1000) * pricing.promptPer1k +
    (completionTokens / 1000) * pricing.completionPer1k;
  return cost.toFixed(6);
}
