/**
 * AI API Client Module
 * Handles raw API calls and HTTP requests to AI providers directly via fetch
 * Removes dependency on Vercel AI SDK for more control over payload and tokens
 */
import { toast } from "sonner";
import { fetch } from "@tauri-apps/plugin-http";
import { normalizeLocalBaseUrl } from "../models/modelFetcher";
import { stripThinkBlocks } from "./response-parser";

export type MessageContent = {
  type: 'text' | 'image_url'; // OpenAI/OpenRouter standard
  text?: string;
  image_url?: {
    url: string;
  };
};

export type AIUsage = {
  promptTokens: number;
  completionTokens: number;
  /** Exact billed cost in USD when the provider reports it (e.g. OpenRouter total_cost) */
  totalCost?: number;
};

export type AIResponse = {
  text: string;
  finishReason?: string;
  usage?: AIUsage;
};

export type GenerateTextOptions = {
  provider: string;
  apiKey: string;
  model: string;
  messages: any[];
  /** Max output tokens for this call (defaults to 2048) */
  maxTokens?: number;
  /** Abort signal so in-flight requests can be cancelled */
  signal?: AbortSignal;
};

/** Local servers can be slow (prompt processing, cold loads) — generous ceiling */
const LOCAL_REQUEST_TIMEOUT_MS = 180_000;
const REMOTE_REQUEST_TIMEOUT_MS = 120_000;

export const CANCELLED_MESSAGE = 'Request cancelled';

/**
 * POSTs JSON with a hard timeout and optional external abort signal.
 * Distinguishes timeout from cancellation with distinct error messages so
 * callers never hang forever waiting on a stuck server.
 */
async function postJsonWithTimeout(
  url: string,
  body: string,
  headers: Record<string, string>,
  options: { timeoutMs: number; signal?: AbortSignal }
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs);

  const forwardAbort = () => controller.abort();
  const external = options.signal;
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', forwardAbort);
  }

  try {
    return await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(
        timedOut
          ? `AI request timed out after ${Math.round(options.timeoutMs / 1000)}s. The server may be busy or the model may not support this request.`
          : CANCELLED_MESSAGE
      );
    }
    // Tauri's HTTP plugin may surface aborts under a different error name
    if (external?.aborted) {
      throw new Error(CANCELLED_MESSAGE);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (external) external.removeEventListener('abort', forwardAbort);
  }
}

/**
 * Calls the AI API with the provided options using direct fetch
 */
export const callAIApi = async (options: GenerateTextOptions): Promise<AIResponse> => {
  const { provider, apiKey, model, messages, maxTokens, signal } = options;
  console.log('🚀 Sending to AI (Direct Fetch)...', { provider, model });

  try {
    if (provider === 'google') {
      return await callGoogleGemini(apiKey, model, messages, maxTokens, signal);
    } else {
      // OpenAI and OpenRouter share similar chat completions API structure
      const baseUrl = provider === 'openrouter'
        ? 'https://openrouter.ai/api/v1'
        : 'https://api.openai.com/v1';

      return await callOpenAICompatible(baseUrl, apiKey, model, messages, provider === 'openrouter', maxTokens, signal);
    }
  } catch (error: any) {
    console.error('❌ AI API call failed:', error);
    // Preserve cancellation/timeout messages so callers can recognize them
    if (error instanceof Error && (error.message === CANCELLED_MESSAGE || error.message.startsWith('AI request timed out'))) {
      throw error;
    }
    throw new Error(`AI API call failed: ${error.message || error}`);
  }
};

/**
 * Handles OpenAI and OpenRouter API calls
 */
async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: any[],
  isOpenRouter: boolean,
  maxTokens: number = 2048,
  signal?: AbortSignal
): Promise<AIResponse> {
  // Transform messages if needed (Vercel SDK format to OpenAI format)
  // Our internal format is already close, but let's ensure image format is correct
  // OpenAI expects content: [{type: "text", text: "..."}, {type: "image_url", image_url: {url: "..."}}]

  const payload = {
    model: model,
    messages: messages,
    max_tokens: maxTokens,
    temperature: 0.7,
  };

  // Log payload size for inspection
  const payloadString = JSON.stringify(payload);
  console.log(`📦 Payload size: ${(payloadString.length / 1024).toFixed(2)} KB`);
  
  // Extract and analyze image portion of payload
  const imageMatch = payloadString.match(/"image_url":\s*{\s*"url":\s*"[^"]*"/);
  if (imageMatch) {
    const base64Match = payloadString.match(/base64,([^"]*)/);
    const imageBase64Size = base64Match ? base64Match[1].length : 0;
    const imageKB = imageBase64Size / 1024;
    
    console.log(`🖼️ Image Analysis:`);
    console.log(`  Image base64 size: ${imageKB.toFixed(2)} KB`);
    console.log(`  Image base64 chars: ${imageBase64Size}`);
    console.log(`  Expected 480p JPEG: ~50-100 KB before base64`);
    console.log(`  Your image: ${(imageKB * 0.75).toFixed(2)} KB before base64`);
    
    // More realistic token estimation for vision models
    // Vision models count images differently than text
    // Rough estimate: ~1 token per 1000 pixels for base64 images
    const estimatedImagePixels = 480 * 480; // Should be 480p
    const estimatedImageTokens = Math.ceil(estimatedImagePixels / 1000); // ~230 tokens for 480p
    
    // Text tokens in payload (excluding image data)
    const textPortion = payloadString.replace(/"url":\s*"[^"]*"/, '"url": "[IMAGE_DATA]"');
    const textTokens = Math.ceil(textPortion.length / 4);
    
    const totalEstimatedTokens = textTokens + estimatedImageTokens;
    
    console.log(`🔢 Token Estimation (Vision Model):`);
    console.log(`  Text tokens: ~${textTokens}`);
    console.log(`  Image tokens: ~${estimatedImageTokens} (for ${480}p)`);
    console.log(`  Total estimated: ~${totalEstimatedTokens}`);
    console.log(`  Old wrong calculation: ~${Math.ceil(payloadString.length / 4)}`);
    
    if (imageKB > 150) {
      console.warn(`❌ IMAGE TOO LARGE: ${(imageKB * 0.75).toFixed(2)} KB (should be 50-100 KB)`);
    }
    
    // Warning threshold adjusted for vision models
    if (totalEstimatedTokens > 1000) {
      console.warn(`⚠️ High token usage detected: ~${totalEstimatedTokens} tokens (vision model)`);
    }
  } else {
    console.log(`🔢 Est. Input Tokens (char/4): ~${Math.ceil(payloadString.length / 4)}`);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  if (isOpenRouter) {
    headers['HTTP-Referer'] = 'https://descify.app'; // Optional: for OpenRouter rankings
    headers['X-Title'] = 'Descify'; // Optional
  }

  const response = await postJsonWithTimeout(
    `${baseUrl}/chat/completions`,
    payloadString,
    headers,
    { timeoutMs: REMOTE_REQUEST_TIMEOUT_MS, signal }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    
    // Check for model capability errors
    const isModelCapabilityError = 
      errorBody.includes('does not support image input') ||
      errorBody.includes('model does not support') ||
      errorBody.includes('vision') ||
      errorBody.includes('image modality') ||
      errorBody.includes('media type') ||
      response.status === 400;
    
    if (isModelCapabilityError) {
      const errorMessage = "The selected model does not support image input. Please select a vision-capable model from Settings.";
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Failed-but-billed requests can still incur cost. Best-effort capture usage
    // from the error body so the session tracker can include it.
    throw attachUsageToError(new Error(`API Error ${response.status}: ${errorBody}`), parseOpenAIUsage(errorBody, isOpenRouter));
  }

  const data = await response.json();

  const choice = data.choices?.[0];
  return {
    text: choice?.message?.content || '',
    finishReason: choice?.finish_reason,
    usage: parseOpenAIUsage(data, isOpenRouter),
  };
}

/**
 * Handles Google Gemini API calls
 */
async function callGoogleGemini(apiKey: string, model: string, messages: any[], maxTokens: number = 2048, signal?: AbortSignal): Promise<AIResponse> {
  // Transform messages to Gemini format
  // Gemini expects: { parts: [{ text: "..." }, { inline_data: { mime_type: "...", data: "..." } }] }

  const contents = messages.map(msg => {
    const parts = [];

    if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'text') {
          parts.push({ text: part.text });
        } else if (part.type === 'image_url') {
          // Extract base64 and mime type from data URL
          const matches = part.image_url.url.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
          if (matches) {
            parts.push({
              inline_data: {
                mime_type: matches[1],
                data: matches[2]
              }
            });
          }
        }
      }
    } else {
      parts.push({ text: msg.content });
    }

    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts
    };
  });

  const payload = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    }
  };

  // Log payload size
  const payloadString = JSON.stringify(payload);
  console.log(`📦 Gemini Payload size: ${(payloadString.length / 1024).toFixed(2)} KB`);
  
  // Add warning for high token usage in Gemini
  if (payloadString.length > 6000) { // ~1500 tokens
    console.warn(`⚠️ High Gemini token usage detected: ${Math.ceil(payloadString.length / 4)} tokens (image may be larger than 480p)`);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await postJsonWithTimeout(
    url,
    payloadString,
    { 'Content-Type': 'application/json' },
    { timeoutMs: REMOTE_REQUEST_TIMEOUT_MS, signal }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    
    // Check for model capability errors
    const isModelCapabilityError = 
      errorBody.includes('does not support image input') ||
      errorBody.includes('model does not support') ||
      errorBody.includes('vision') ||
      errorBody.includes('image modality') ||
      errorBody.includes('media type') ||
      response.status === 400;
    
    if (isModelCapabilityError) {
      const errorMessage = "The selected model does not support image input. Please select a vision-capable model from Settings.";
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    throw attachUsageToError(new Error(`Gemini API Error ${response.status}: ${errorBody}`), parseGeminiUsage(errorBody));
  }

  const data = await response.json();

  // Extract text from Gemini response structure
  const candidate = data.candidates?.[0];
  const finishReason = candidate?.finishReason;

  return {
    text: candidate?.content?.parts?.[0]?.text || '',
    // Normalize Gemini's MAX_TOKENS to the OpenAI-style 'length' so callers can treat it uniformly
    finishReason: finishReason === 'MAX_TOKENS' ? 'length' : finishReason,
    usage: parseGeminiUsage(data),
  };
}

/**
 * Creates a message content array for vision-based metadata generation
 * Compatible with OpenAI/OpenRouter structure
 */
export const createVisionMessageContent = (
  prompt: string,
  imageDataUrl: string
): MessageContent[] => {
  return [
    {
      type: 'text',
      text: prompt,
    },
    {
      type: 'image_url', // Standard name
      image_url: {
        url: imageDataUrl,
      },
    },
  ];
};

/**
 * Extracts token usage from an OpenAI/OpenRouter-compatible response or error body.
 * OpenRouter reports the exact billed cost in usage.cost (USD); total_cost is
 * also accepted as a fallback.
 */
function parseOpenAIUsage(data: any, isOpenRouter = false): AIUsage | undefined {
  let parsed = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      return undefined;
    }
  }

  const usage = parsed?.usage;
  if (!usage) return undefined;

  const promptTokens = Number(usage.prompt_tokens ?? usage.promptTokens ?? NaN);
  const completionTokens = Number(usage.completion_tokens ?? usage.completionTokens ?? NaN);
  if (Number.isNaN(promptTokens) && Number.isNaN(completionTokens)) return undefined;

  // OpenRouter returns the exact billed cost in usage.cost (and usage.total_cost).
  const rawCost = isOpenRouter
    ? (usage.cost ?? usage.total_cost)
    : (usage.total_cost ?? usage.cost);
  const totalCost = rawCost != null ? Number(rawCost) : undefined;

  return {
    promptTokens: Number.isNaN(promptTokens) ? 0 : promptTokens,
    completionTokens: Number.isNaN(completionTokens) ? 0 : completionTokens,
    totalCost: totalCost != null && !Number.isNaN(totalCost) ? totalCost : undefined,
  };
}

/**
 * Extracts token usage from a Gemini response or error body.
 */
function parseGeminiUsage(data: any): AIUsage | undefined {
  let parsed = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      return undefined;
    }
  }

  const usage = parsed?.usageMetadata;
  if (!usage) return undefined;

  const promptTokens = Number(usage.promptTokenCount ?? NaN);
  const completionTokens = Number(usage.candidatesTokenCount ?? NaN);
  if (Number.isNaN(promptTokens) && Number.isNaN(completionTokens)) return undefined;

  return {
    promptTokens: Number.isNaN(promptTokens) ? 0 : promptTokens,
    completionTokens: Number.isNaN(completionTokens) ? 0 : completionTokens,
  };
}

/**
 * Attaches usage info to an error so failed-but-billed requests can still be
 * counted by the session cost tracker.
 */
function attachUsageToError(error: Error, usage?: AIUsage): Error {
  if (usage) {
    (error as Error & { usage?: AIUsage }).usage = usage;
  }
  return error;
}

/**
 * Helper to validate/fix base64 strings if needed
 */
export const ensureBase64 = (url: string): string => {
  if (url.startsWith('data:')) return url;
  throw new Error('Expected data URL');
};

interface LocalOpenAICompatibleOptions {
  model: string;
  messages: any[];
  /** Base URL of the OpenAI-compatible local server (e.g. http://localhost:1234/v1) */
  baseUrl?: string;
  /** Max output tokens for this call (defaults to 2048) */
  maxTokens?: number;
  /** Abort signal so in-flight requests can be cancelled */
  signal?: AbortSignal;
}

export async function callLocalOpenAICompatible(options: LocalOpenAICompatibleOptions): Promise<AIResponse> {
  const { model, messages, baseUrl, maxTokens = 2048, signal } = options;
  const url = normalizeLocalBaseUrl(baseUrl);

  if (!url) {
    throw new Error('No local AI server URL configured. Please set it in Settings.');
  }

  console.log('🏠 Calling local OpenAI-compatible API...', { model, url });

  let data: any;

  try {
    const payload = {
      model: model,
      messages: messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    };

    const payloadString = JSON.stringify(payload);
    console.log(`📦 Local AI Payload size: ${(payloadString.length / 1024).toFixed(2)} KB`);

    const response = await postJsonWithTimeout(`${url}/chat/completions`, payloadString, {
      'Content-Type': 'application/json',
    }, { timeoutMs: LOCAL_REQUEST_TIMEOUT_MS, signal });

    if (!response.ok) {
      const errorBody = await response.text();
      throw attachUsageToError(
        new Error(`Local AI API Error ${response.status}: ${errorBody}`),
        parseOpenAIUsage(errorBody)
      );
    }

    data = await response.json();
  } catch (error: any) {
    if (error instanceof Error && (error.message === CANCELLED_MESSAGE || error.message.startsWith('AI request timed out'))) {
      console.error('❌ Local AI request aborted:', error.message);
    } else {
      console.error('❌ Local AI API call failed:', error);
    }
    throw error;
  }

  const choice = data.choices?.[0];
  const rawContent: string = choice?.message?.content || '';
  const text = stripThinkBlocks(rawContent);

  // Some servers return the answer only in a separate reasoning field
  const reasoningOnly =
    !text.trim() &&
    (Boolean(choice?.message?.reasoning_content) || Boolean(rawContent.trim()));

  if (reasoningOnly) {
    throw new Error(
      'The local model produced only reasoning tokens and no final answer. ' +
      'Disable "thinking" mode for this model in your local server, or select a non-reasoning vision model.'
    );
  }

  return {
    text,
    finishReason: choice?.finish_reason,
    usage: parseOpenAIUsage(data),
  };
}

/**
 * Creates a message content array for local OpenAI-compatible APIs
 * Uses base64 data URLs - supported by most local vision servers
 */
export function createLocalMessageContent(
  prompt: string,
  imageUrl: string
): MessageContent[] {
  return [
    {
      type: 'text',
      text: prompt,
    },
    {
      type: 'image_url',
      image_url: {
        url: imageUrl,
      },
    },
  ];
}
