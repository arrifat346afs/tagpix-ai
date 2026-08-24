/**
 * API Cost Module
 * Pure logic for computing and formatting the cost of AI API requests.
 * Providers that report exact billed cost (OpenRouter's usage.total_cost)
 * take precedence; otherwise cost is derived from token counts and the
 * model's pricing metadata (fetched from the provider) or a static table.
 */

import type { AIUsage } from './ai/api-client';
import { getCachedModelMetadata, type ModelPricing } from './modelFetcher';

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

/**
 * Determines whether a model is free to use.
 * Free is decided from the model itself and its fetched metadata
 * (e.g. OpenRouter `:free` suffix or zero pricing), never assumed.
 * A paid model is never treated as free.
 */
export const isFreeModel = (provider: string | undefined, model: string | undefined): boolean => {
  if (!model) return false;
  if (provider === 'local') return true;
  if (model.includes(':free')) return true;

  const metadata = getCachedModelMetadata(model);
  if (metadata?.isFree === true) return true;
  if (metadata?.pricing) {
    return metadata.pricing.prompt === 0 && metadata.pricing.completion === 0;
  }

  return false;
};

export type CostBreakdown = {
  totalCost: number;
  free: boolean;
};

/**
 * Computes the cost in USD of a single API request.
 * - Free models always cost $0.
 * - Uses the exact billed cost when the provider reports it (OpenRouter total_cost).
 * - Otherwise derives cost from prompt/completion tokens via the model's
 *   pricing metadata or the pricing table.
 *   Falls back to $0 (not free) when no pricing is known.
 */
export const computeCost = (
  provider: string | undefined,
  model: string | undefined,
  usage?: AIUsage
): CostBreakdown => {
  const free = isFreeModel(provider, model);
  if (free) return { totalCost: 0, free: true };

  // Exact billed cost reported by the provider (e.g. OpenRouter total_cost).
  if (usage && typeof usage.totalCost === 'number' && Number.isFinite(usage.totalCost)) {
    return { totalCost: usage.totalCost, free: false };
  }

  const metadata = model ? getCachedModelMetadata(model) : undefined;
  const pricing = metadata?.pricing ?? (model ? PRICING_TABLE[model] : undefined);
  if (!pricing || !usage) return { totalCost: 0, free: false };

  const promptTokens = Number.isFinite(usage.promptTokens) ? usage.promptTokens : 0;
  const completionTokens = Number.isFinite(usage.completionTokens) ? usage.completionTokens : 0;

  const totalCost =
    (promptTokens / 1_000_000) * pricing.prompt +
    (completionTokens / 1_000_000) * pricing.completion;

  return { totalCost, free: false };
};

/**
 * Formats a cost for display:
 * - "Free" only when the model is genuinely free.
 * - "$0.0012" (4 decimals) for small costs.
 * - "$1.23" (2 decimals) for larger costs.
 * A paid model with zero/unknown cost still shows a dollar figure,
 * never "Free".
 */
export const formatCost = (breakdown: CostBreakdown): string => {
  if (breakdown.free) return 'Free';
  if (breakdown.totalCost < 0.01) {
    return `$${breakdown.totalCost.toFixed(4)}`;
  }
  return `$${breakdown.totalCost.toFixed(2)}`;
};

export type ModelPriceInfo = {
  label: string;
  pricing: ModelPricing | null;
  free: boolean;
};

/**
 * Resolves the pricing info for a selected model without making a request.
 * Used to display the cost of the currently selected model at startup.
 * - Uses the model's fetched metadata (pricing / isFree) when available.
 * - Falls back to the static pricing table.
 * - Free detection mirrors isFreeModel.
 */
export const getModelPriceInfo = (
  provider: string | undefined,
  model: string | undefined
): ModelPriceInfo | null => {
  if (!model) return null;

  const metadata = getCachedModelMetadata(model);
  const label = metadata?.label || model;

  if (provider === 'local') {
    return { label, pricing: null, free: true };
  }
  if (model.includes(':free')) {
    return { label, pricing: null, free: true };
  }
  if (metadata?.isFree === true) {
    return { label, pricing: null, free: true };
  }
  if (metadata?.pricing) {
    return { label, pricing: metadata.pricing, free: false };
  }
  const pricing = PRICING_TABLE[model];
  if (pricing) {
    return { label, pricing, free: false };
  }
  return { label, pricing: null, free: false };
};

/**
 * Formats a model's per-1M-token pricing for display:
 * - "Free" for free models.
 * - "$0.075 / $0.30" for prompt / completion when known.
 * - "Unknown" when no pricing info is available.
 */
export const formatModelPrice = (info: ModelPriceInfo): string => {
  if (info.free) return 'Free';
  if (!info.pricing) return 'Unknown';
  const { prompt, completion } = info.pricing;
  const fmt = (n: number) => (n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);
  return `${fmt(prompt)} / ${fmt(completion)}`;
};