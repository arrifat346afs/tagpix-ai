import { fetch } from "@tauri-apps/plugin-http";

/**
 * Model Fetcher Module
 * Handles dynamic fetching of available models from different AI providers
 */

export type ModelPricing = {
  /** USD per 1M prompt tokens */
  prompt: number;
  /** USD per 1M completion tokens */
  completion: number;
};

export type ModelInfo = {
  value: string;
  label: string;
  supportsVision?: boolean;
  provider?: string;
  description?: string;
  contextWindow?: number;
  inputTypes?: string[];
  supportsReasoning?: boolean;
  /** Per-token pricing metadata (USD per 1M tokens) when known. */
  pricing?: ModelPricing;
  /** Explicitly free (e.g. OpenRouter `:free` models). */
  isFree?: boolean;
};

/**
 * Module-level cache of model metadata keyed by full model id.
 * Populated whenever models are fetched (e.g. in Settings). Lets the cost
 * logic resolve a model's pricing/free status without an extra network call.
 */
export type ModelMetadata = {
  label?: string;
  pricing?: ModelPricing;
  isFree?: boolean;
};

const modelMetadataCache = new Map<string, ModelMetadata>();

/** Registers metadata for a batch of models. */
export function registerModelMetadata(models: ModelInfo[]): void {
  for (const model of models) {
    if (!model.value) continue;
    const entry: ModelMetadata = { label: model.label };
    if (model.pricing) entry.pricing = model.pricing;
    if (model.isFree !== undefined) entry.isFree = model.isFree;
    modelMetadataCache.set(model.value, entry);
  }
}

/** Looks up cached metadata for a model id. */
export function getCachedModelMetadata(model: string): ModelMetadata | undefined {
  return modelMetadataCache.get(model);
}

/**
 * Fetches the model list for the given provider and registers its pricing
 * metadata into the cache. Called on startup so the cost badge can show the
 * exact price of the previously selected model without opening Settings.
 * Returns the fetched models (or [] on failure).
 */
export async function refreshModelPricing(
  provider?: string,
  apiKey?: string,
  useLocalModel?: boolean,
  localApiUrl?: string
): Promise<ModelInfo[]> {
  try {
    if (useLocalModel) {
      const localModels = await fetchLocalModels(localApiUrl);
      registerModelMetadata(localModels);
      return localModels;
    }
    if (provider === 'openrouter') {
      const models = await fetchOpenRouterModels(apiKey);
      return models; // registerModelMetadata already called inside
    }
    if (provider === 'gemini') {
      const models = await fetchGeminiModels(apiKey);
      registerModelMetadata(models);
      return models;
    }
    return [];
  } catch (error) {
    console.error('Error refreshing model pricing:', error);
    return [];
  }
}

type OpenRouterModel = {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt: string;
    completion: string;
    image?: string;
  };
  architecture?: {
    modality?: string;
    input_modalities?: string[]; // e.g., ["text", "image", "file"]
    output_modalities?: string[];
  };
  supported_parameters?: string[];
  reasoning?: object;
};

/**
 * Fetches available models from OpenRouter API
 * Filters to only show models that support image input (via architecture.input_modalities)
 */
export async function fetchOpenRouterModels(apiKey?: string): Promise<ModelInfo[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: apiKey
        ? { Authorization: `Bearer ${apiKey}` }
        : {},
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    const models: OpenRouterModel[] = data.data || [];

    console.log(`OpenRouter: Total models fetched: ${models.length}`);

    console.log(`OpenRouter API response matched ${models.length} raw models.`);

    // Filter for models that accept image input but only output text
    // Criteria: input_modalities includes 'image' AND output_modalities is exactly ['text']
    const imageToTextModels = models
      .filter((model) => {
        const inputs = model.architecture?.input_modalities || [];
        const outputs = model.architecture?.output_modalities || [];

        // Check for image input support
        const supportsImageInput = inputs.includes('image');

        // Check for text-only output (rejects image-generation models)
        const outputsOnlyText = outputs.length === 1 && outputs[0] === 'text';

        return supportsImageInput && outputsOnlyText;
      })
      .map((model) => {
        const isFree = model.id.includes(':free');
        const provider = model.id.split('/')[0] || 'OpenRouter';
        const pricing = model.pricing
          ? {
              prompt: (parseFloat(model.pricing.prompt) || 0) * 1_000_000,
              completion: (parseFloat(model.pricing.completion) || 0) * 1_000_000,
            }
          : undefined;
        return {
          value: model.id,
          label: isFree ? `${model.name} (Free)` : model.name,
          supportsVision: true,
          provider,
          description: model.description,
          contextWindow: model.context_length,
          inputTypes: model.architecture?.input_modalities,
          supportsReasoning:
            Boolean(model.reasoning) ||
            (model.supported_parameters?.includes('reasoning') ?? false) ||
            (model.supported_parameters?.includes('include_reasoning') ?? false),
          pricing,
          isFree,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    console.log(`OpenRouter: Filtered ${models.length} -> ${imageToTextModels.length} image-to-text models.`);
    console.log('First 10 image-to-text models:', imageToTextModels.slice(0, 10).map(m => m.label));

    registerModelMetadata(imageToTextModels);

    return imageToTextModels;
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    return getFallbackOpenRouterModels();
  }
}


/**
 * Fetches available models from OpenAI API
 */
export async function fetchOpenAIModels(apiKey?: string): Promise<ModelInfo[]> {
  if (!apiKey) {
    return getFallbackOpenAIModels();
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const models = data.data || [];

    // Filter for vision-capable models
    const visionModels = models
      .filter((model: any) =>
        model.id.includes('gpt-4') && model.id.includes('vision') ||
        model.id.includes('gpt-4o') ||
        model.id.includes('gpt-4-turbo')
      )
      .map((model: any) => ({
        value: model.id,
        label: model.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        supportsVision: true,
        provider: 'OpenAI',
      }))
      .sort((a: ModelInfo, b: ModelInfo) => a.label.localeCompare(b.label));

    return visionModels.length > 0 ? visionModels : getFallbackOpenAIModels();
  } catch (error) {
    console.error('Error fetching OpenAI models:', error);
    return getFallbackOpenAIModels();
  }
}

type GeminiModel = {
  name: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
};

/**
 * Fetches available models from Google Gemini API
 */
export async function fetchGeminiModels(apiKey?: string): Promise<ModelInfo[]> {
  // If no API key provided, return the fallback list immediately.
  if (!apiKey) {
    return getFallbackGeminiModels();
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const models: GeminiModel[] = data.models || [];

    console.log(`Gemini: Total models fetched: ${models.length}`);

    // Filter for models that support generateContent (vision-capable models)
    const visionModels = models
      .filter((model) => {
        const methods = model.supportedGenerationMethods || [];
        // Only include models that support generateContent
        return methods.includes('generateContent');
      })
      .map((model) => {
        // Extract the model ID from the full name (e.g., "models/gemini-1.5-pro" -> "gemini-1.5-pro")
        const modelId = model.name.replace('models/', '');
        const displayName = model.displayName || modelId;

        return {
          value: modelId,
          label: displayName,
          supportsVision: true,
          provider: 'Google',
          description: model.description,
          contextWindow: model.inputTokenLimit,
          inputTypes: ['text', 'image'],
          supportsReasoning:
            /(^|[.-])2\.5|gemini-3|thinking/i.test(modelId),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    console.log(`Gemini: Vision-capable models found: ${visionModels.length}`);
    console.log('Gemini models:', visionModels.map(m => m.label));

    return visionModels.length > 0 ? visionModels : getFallbackGeminiModels();
  } catch (error) {
    console.error('Error fetching Gemini models:', error);
    return getFallbackGeminiModels();
  }
}

/**
 * Fallback models for OpenRouter (used when API fails or no API key)
 */
function getFallbackOpenRouterModels(): ModelInfo[] {
  const free: Omit<ModelInfo, 'isFree' | 'pricing'>[] = [
    { value: 'openrouter/polaris-alpha', label: 'Polaris Alpha (Free)', supportsVision: true, provider: 'OpenRouter', contextWindow: 1_048_576, inputTypes: ['text', 'image'], supportsReasoning: true },
    { value: 'nvidia/nemotron-nano-12b-v2-vl:free', label: 'Nemotron Nano 12B VL (Free)', supportsVision: true, provider: 'NVIDIA', contextWindow: 131_072, inputTypes: ['text', 'image'] },
    { value: 'qwen/qwen2.5-vl-32b-instruct:free', label: 'Qwen 2.5 VL 32B Instruct (Free)', supportsVision: true, provider: 'Qwen', contextWindow: 32_768, inputTypes: ['text', 'image'] },
    { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash Exp (Free)', supportsVision: true, provider: 'Google', contextWindow: 1_048_576, inputTypes: ['text', 'image'], supportsReasoning: true },
    { value: 'mistralai/mistral-small-3.2-24b-instruct:free', label: 'Mistral Small 3.2 24B Instruct (Free)', supportsVision: true, provider: 'Mistral', contextWindow: 131_072, inputTypes: ['text', 'image'] },
    { value: 'meta-llama/llama-4-maverick:free', label: 'Llama 4 Maverick (Free)', supportsVision: true, provider: 'Meta Llama', contextWindow: 1_048_576, inputTypes: ['text', 'image'], supportsReasoning: true },
    { value: 'meta-llama/llama-4-scout:free', label: 'Llama 4 Scout (Free)', supportsVision: true, provider: 'Meta Llama', contextWindow: 10_000_000, inputTypes: ['text', 'image'], supportsReasoning: true },
    { value: 'mistralai/mistral-small-3.1-24b-instruct:free', label: 'Mistral Small 3.1 24B Instruct (Free)', supportsVision: true, provider: 'Mistral', contextWindow: 131_072, inputTypes: ['text', 'image'] },
    { value: 'google/gemma-3-4b-it:free', label: 'Gemma 3 4B IT (Free)', supportsVision: true, provider: 'Google', contextWindow: 131_072, inputTypes: ['text', 'image'], supportsReasoning: true },
    { value: 'google/gemma-3-12b-it:free', label: 'Gemma 3 12B IT (Free)', supportsVision: true, provider: 'Google', contextWindow: 131_072, inputTypes: ['text', 'image'], supportsReasoning: true },
    { value: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B IT (Free)', supportsVision: true, provider: 'Google', contextWindow: 131_072, inputTypes: ['text', 'image'], supportsReasoning: true },
  ];
  const models: ModelInfo[] = free.map((m) => ({
    ...m,
    isFree: true,
    pricing: { prompt: 0, completion: 0 },
  }));
  registerModelMetadata(models);
  return models;
}

/**
 * Fallback models for OpenAI
 */
function getFallbackOpenAIModels(): ModelInfo[] {
  return [
    { value: 'gpt-4o', label: 'GPT-4o', supportsVision: true, provider: 'OpenAI', contextWindow: 128_000, inputTypes: ['text', 'image'] },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', supportsVision: true, provider: 'OpenAI', contextWindow: 128_000, inputTypes: ['text', 'image'] },
    { value: 'gpt-4-vision-preview', label: 'GPT-4 Vision Preview', supportsVision: true, provider: 'OpenAI', contextWindow: 128_000, inputTypes: ['text', 'image'] },
  ];
}

/**
 * Fallback models for Google Gemini
 */
function getFallbackGeminiModels(): ModelInfo[] {
  return [
    { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', supportsVision: true, provider: 'Google', contextWindow: 1_048_576, inputTypes: ['text', 'image'] },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', supportsVision: true, provider: 'Google', contextWindow: 2_097_152, inputTypes: ['text', 'image'] },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash nai', supportsVision: true, provider: 'Google', contextWindow: 1_048_576, inputTypes: ['text', 'image'] },
  ];
}

/**
 * Normalizes the user-entered local server base URL:
 * - trims whitespace/trailing slashes
 * - strips a pasted full endpoint path (e.g. .../chat/completions)
 * - appends /v1 when no version segment is present
 */
export function normalizeLocalBaseUrl(url?: string): string {
  let cleaned = (url || '').trim().replace(/\/+$/, '');
  if (!cleaned) return '';
  cleaned = cleaned.replace(/\/chat\/completions$/i, '');
  // Skip appending when a version segment already exists anywhere in the path
  if (!/\/v\d+(\/|$)/.test(cleaned)) {
    cleaned = `${cleaned}/v1`;
  }
  return cleaned;
}

type LMStudioModel = {
  id: string;
  display_name?: string;
  filename?: string;
};

type LMStudioV0Model = {
  id: string;
  display_name?: string;
  type?: string;
  /** e.g. ["vision", "reasoning", "function_calling"] — only reported by LM Studio's /api/v0/models */
  capabilities?: string[];
};

/** Origin of a normalized base URL, or null when it cannot be parsed. */
function localServerOrigin(baseUrl: string): string | null {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return null;
  }
}

/**
 * Probes LM Studio's richer REST API (/api/v0/models) which reports per-model
 * capabilities ("vision", "reasoning"). Returns null when unavailable so the
 * caller can fall back to the standard OpenAI-compatible /models endpoint.
 */
async function fetchLMStudioV0Models(origin: string): Promise<ModelInfo[] | null> {
  try {
    const response = await fetch(`${origin}/api/v0/models`);
    if (!response.ok) return null;

    const data = await response.json();
    const models: LMStudioV0Model[] = data?.data || [];
    if (!Array.isArray(models) || models.length === 0) return null;

    return models
      .map((model) => {
        const caps = Array.isArray(model.capabilities) ? model.capabilities : [];
        const supportsVision = caps.includes('vision');
        return {
          value: model.id,
          label: model.display_name || model.id,
          supportsVision,
          provider: 'Local AI',
          inputTypes: supportsVision ? ['text', 'image'] : ['text'],
          supportsReasoning: caps.includes('reasoning') || undefined,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return null;
  }
}

/**
 * Fetches available models from an OpenAI-compatible local server.
 * Throws on failure (no silent fake fallback) so callers can surface the
 * real connection problem instead of showing phantom model entries.
 */
export async function fetchLocalModels(baseUrl?: string): Promise<ModelInfo[]> {
  const url = normalizeLocalBaseUrl(baseUrl);

  if (!url) {
    throw new Error('No local AI server URL provided');
  }

  // Prefer LM Studio's capability-aware endpoint when available
  const origin = localServerOrigin(url);
  if (origin) {
    const v0Models = await fetchLMStudioV0Models(origin);
    if (v0Models && v0Models.length > 0) {
      console.log(`Local AI: Models found via /api/v0/models: ${v0Models.length}`);
      console.log('Local AI models:', v0Models.map(m => `${m.label}${m.supportsVision ? '' : ' (no vision)'}`));
      return v0Models;
    }
  }

  try {
    const response = await fetch(`${url}/models`);

    if (!response.ok) {
      throw new Error(`Local AI server responded ${response.status} ${response.statusText} at ${url}/models`);
    }

    const data = await response.json();
    const models: LMStudioModel[] = data.data || [];

    if (!Array.isArray(models)) {
      throw new Error('Local AI server returned an unexpected response format');
    }

    console.log(`Local AI: Total models fetched: ${models.length}`);

    // Plain /models does not report capabilities — assume vision support
    // (the user picked the model; errors will surface clearly if wrong).
    const localModels = models
      .map((model) => ({
        value: model.id,
        label: model.display_name || model.filename || model.id,
        supportsVision: true,
        provider: 'Local AI',
        inputTypes: ['text', 'image'],
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    console.log(`Local AI: Models found: ${localModels.length}`);
    console.log('Local AI models:', localModels.map(m => m.label));

    return localModels;
  } catch (error: any) {
    console.error('Error fetching local AI models:', error);
    throw new Error(
      `Could not reach local AI server at ${url}. Verify it is running and that the URL includes the correct port.`
    );
  }
}

export async function checkLocalModelConnection(baseUrl?: string): Promise<boolean> {
  const url = normalizeLocalBaseUrl(baseUrl);

  if (!url) return false;

  try {
    const response = await fetch(`${url}/models`);
    return response.ok;
  } catch {
    return false;
  }
}

