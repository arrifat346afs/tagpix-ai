/**
 * API Cost Module
 * Pure logic for computing and formatting the cost of AI API requests.
 * Providers that report exact billed cost (OpenRouter's usage.total_cost)
 * take precedence; otherwise cost is derived from token counts and a
 * static pricing table.
 */

import type { AIUsage } from './ai/api-client';

/** USD per 1M tokens for providers that don't report exact cost. */
const PRICING_TABLE: Record<string, { prompt: number; completion: number }> = {
  'gemini-2.5-flash-lite': { prompt: 0.075, completion: 0.30 },
  'gemini-2.0-flash-lite': { prompt: 0.075, completion: 0.30 },
  'gemini-2.5-flash': { prompt: 0.30, completion: 2.50 },
  'gemini-2.0-flash': { prompt: 0.10, completion: 0.40 },
  'gemini-1.5-flash': { prompt: 0.075, completion: 0.30 },
  'gemini-1.5-flash-8b': { prompt: 0.0375, completion: 0.15 },
  'gemini-1.5-pro': { prompt: 1.25, completion: 5.00 },
  'gemini-2.5-pro': { prompt: 1.25, completion: 10.00 },
  'gpt-4o': { prompt: 2.50, completion: 10.00 },
  'gpt-4o-mini': { prompt: 0.15, completion: 0.60 },
  'gpt-4-turbo': { prompt: 10.00, completion: 30.00 },
  'gpt-4-vision-preview': { prompt: 10.00, completion: 30.00 },
};

/** Models known to run on a free tier even without an explicit `:free` suffix. */
const KNOWN_FREE_MODELS = new Set([
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
]);

/**
 * Determines whether a model is free to use.
 */
export const isFreeModel = (provider: string | undefined, model: string | undefined): boolean => {
  if (!model) return false;
  if (provider === 'local') return true;
  if (model.includes(':free')) return true;
  if (model.toLowerCase().startsWith('openrouter/')) return false;
  return KNOWN_FREE_MODELS.has(model);
};

export type CostBreakdown = {
  totalCost: number;
  free: boolean;
};

/**
 * Computes the cost in USD of a single API request.
 * - Uses the exact billed cost when the provider reports it.
 * - Free models always cost $0.
 * - Otherwise derives cost from prompt/completion tokens via the pricing table.
 *   Falls back to $0 when no pricing is known.
 */
export const computeCost = (
  provider: string | undefined,
  model: string | undefined,
  usage?: AIUsage
): CostBreakdown => {
  if (!usage) return { totalCost: 0, free: isFreeModel(provider, model) };

  const free = isFreeModel(provider, model);
  if (free) return { totalCost: 0, free: true };

  // Exact billed cost reported by the provider (e.g. OpenRouter total_cost).
  if (typeof usage.totalCost === 'number' && Number.isFinite(usage.totalCost)) {
    return { totalCost: usage.totalCost, free: false };
  }

  const pricing = model ? PRICING_TABLE[model] : undefined;
  if (!pricing) return { totalCost: 0, free: false };

  const promptTokens = Number.isFinite(usage.promptTokens) ? usage.promptTokens : 0;
  const completionTokens = Number.isFinite(usage.completionTokens) ? usage.completionTokens : 0;

  const totalCost =
    (promptTokens / 1_000_000) * pricing.prompt +
    (completionTokens / 1_000_000) * pricing.completion;

  return { totalCost, free: false };
};

/**
 * Formats a cost for display:
 * - "Free" when the model was free (or cost rounds to zero on a free model).
 * - "$0.0012" (4 decimals) for small costs.
 * - "$1.23" (2 decimals) for larger costs.
 */
export const formatCost = (breakdown: CostBreakdown): string => {
  if (breakdown.free || breakdown.totalCost <= 0) return 'Free';
  if (breakdown.totalCost < 0.01) {
    return `$${breakdown.totalCost.toFixed(4)}`;
  }
  return `$${breakdown.totalCost.toFixed(2)}`;
};