const MODEL_PRICING: Record<string, { promptPer1k: number; completionPer1k: number }> = {
  'claude-sonnet-4-20250514': { promptPer1k: 0.003, completionPer1k: 0.015 },
  'claude-3-5-sonnet-20241022': { promptPer1k: 0.003, completionPer1k: 0.015 },
  'claude-3-haiku-20240307': { promptPer1k: 0.00025, completionPer1k: 0.00125 },
  'gpt-4o': { promptPer1k: 0.005, completionPer1k: 0.015 },
  'gpt-4o-mini': { promptPer1k: 0.00015, completionPer1k: 0.0006 },
};

const DEFAULT_PRICING = { promptPer1k: 0.003, completionPer1k: 0.015 };

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): string {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
  const cost =
    (promptTokens / 1000) * pricing.promptPer1k +
    (completionTokens / 1000) * pricing.completionPer1k;
  return cost.toFixed(6);
}
