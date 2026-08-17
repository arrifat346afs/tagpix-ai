import { fetch } from "@tauri-apps/plugin-http";

/**
 * Model Fetcher Module
 * Handles dynamic fetching of available models from different AI providers
 */

export type ModelInfo = {
  value: string;
  label: string;
  supportsVision?: boolean;
  provider?: string;
  description?: string;
  contextWindow?: number;
  inputTypes?: string[];
  supportsReasoning?: boolean;
};

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
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    console.log(`OpenRouter: Filtered ${models.length} -> ${imageToTextModels.length} image-to-text models.`);
    console.log('First 10 image-to-text models:', imageToTextModels.slice(0, 10).map(m => m.label));

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
  return [
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

export function normalizeLocalBaseUrl(url?: string): string {
  return (url || '').trim().replace(/\/+$/, '');
}

type LMStudioModel = {
  id: string;
  display_name?: string;
  filename?: string;
};

/**
 * Fetches available models from an OpenAI-compatible local server
 * Returns models that support vision (image input) based on capabilities
 */
export async function fetchLocalModels(baseUrl?: string): Promise<ModelInfo[]> {
  const url = normalizeLocalBaseUrl(baseUrl);

  if (!url) {
    console.warn('Local AI: No server URL provided');
    return [];
  }

  try {
    const response = await fetch(`${url}/models`);

    if (!response.ok) {
      throw new Error(`Local AI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const models: LMStudioModel[] = data.data || [];

    console.log(`Local AI: Total models fetched: ${models.length}`);

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
  } catch (error) {
    console.error('Error fetching local AI models:', error);
    return getFallbackLocalModels();
  }
}

/**
 * Fallback models for local AI (used when API fails or no server)
 */
function getFallbackLocalModels(): ModelInfo[] {
  return [
    { value: 'llama3-vision', label: 'Llama 3 Vision', supportsVision: true, provider: 'Local AI', inputTypes: ['text', 'image'] },
    { value: 'qwen2-vl', label: 'Qwen2 VL', supportsVision: true, provider: 'Local AI', inputTypes: ['text', 'image'] },
    { value: 'phi3-vision', label: 'Phi-3 Vision', supportsVision: true, provider: 'Local AI', inputTypes: ['text', 'image'] },
  ];
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

