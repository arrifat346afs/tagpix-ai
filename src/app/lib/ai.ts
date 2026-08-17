/**
 * AI Module - Main Orchestrator
 * Coordinates AI providers, prompts, API calls, and response parsing
 */

import { generateMetadataPrompt } from './ai/prompts';
import { parseMetadataResponse } from './ai/response-parser';
import { ensureBase64, callAIApi, createVisionMessageContent, callLocalOpenAICompatible, createLocalMessageContent, type AIResponse, type AIUsage } from './ai/api-client';
import { generateAIImage } from './thumbnailGenerator';
import { apiCostTracker } from './apiCostTracker';
// Provider-specific configs can be kept if they have useful constants, but factory functions are no longer needed
import { DEFAULT_OPENAI_MODEL } from './ai/providers/openai';
import { DEFAULT_OPENROUTER_MODEL } from './ai/providers/openrouter';

export type GeneratedMetadata = {
  title: string;
  description: string;
  keywords: string; // comma separated
};

export type GenerateMetadataOptions = {
  /** @deprecated Use `file` instead for better AI quality */
  thumbnailUrls?: string[];
  /** The file to generate metadata for - will create HQ image on-demand */
  file?: File;
  /** The file path for backend processing (used for videos) */
  filePath?: string;
  fileNames: string[];
  provider?: string;
  model?: string;
  apiKey?: string;
  /** Use local OpenAI-compatible model instead of remote API */
  useLocalModel?: boolean;
  /** Local model name (when useLocalModel is true) */
  localModelName?: string;
  /** Base URL of the local OpenAI-compatible server (when useLocalModel is true) */
  localApiUrl?: string;
  limits?: { titleLimit?: number; descriptionLimit?: number; keywordLimit?: number };
  includePlaceName?: boolean;
  customTemplate?: string;
  customInstruction?: string;
  avoidWords?: {
    titleAvoidWords?: string[];
    keywordsAvoidWords?: string[];
    descriptionAvoidWords?: string[];
  };
};

const MAX_ATTEMPTS = 2;
const DEFAULT_MAX_TOKENS = 2048;
const RETRY_MAX_TOKENS = 4096;

// Short corrective instruction appended on retries so the follow-up
// request is not identical to the one that produced invalid output.
const CORRECTIVE_INSTRUCTION = `\n\nPrevious response was invalid.\nReturn ONLY the required JSON object.\nDo not use Markdown.\nDo not include reasoning or explanation.`;

/**
 * Generates metadata for images using AI vision models
 * Uses direct API calls for maximum control over tokens and payload
 * Retries truncated responses separately from malformed/schema failures:
 *  - truncation retry requests more output (higher maxTokens)
 *  - malformed/schema retry appends a corrective instruction
 */
export const generateMetadata = async (opts: GenerateMetadataOptions): Promise<GeneratedMetadata> => {
  const { file, filePath, thumbnailUrls, provider = 'openai', model, apiKey, useLocalModel, localModelName, localApiUrl, limits, includePlaceName, customTemplate, customInstruction, avoidWords } = opts;

  // Track the provider/model actually billed for the most recent attempt so a
  // failed-but-billed HTTP error can still be recorded in the outer catch.
  let billedProvider = useLocalModel ? 'local' : provider;
  let billedModel = '';

  try {
    console.log('🎯 Starting metadata generation with:', {
      provider,
      model,
      useLocalModel,
      localModelName,
      hasApiKey: !!apiKey,
      hasFile: !!file,
      hasFilePath: !!filePath,
    });

    // Generate the prompt
    const textPrompt = generateMetadataPrompt(limits, includePlaceName, customTemplate, customInstruction, avoidWords);

    // Generate high-quality image for AI analysis
    let imageDataUrl: string;

    if (file) {
      console.log('🖼️ Generating optimized image for AI analysis...');
      console.log(`📁 File details: ${file.name}, ${(file.size / 1024).toFixed(2)} KB`);

      // Pass filePath for video support
      imageDataUrl = await generateAIImage(file, filePath);

      console.log(`✅ Image generated: ${(imageDataUrl.length / 1024).toFixed(2)} KB`);
    } else if (thumbnailUrls && thumbnailUrls.length > 0) {
      console.log('⚠️ Using thumbnail (lower quality) - consider using file parameter');
      console.log(`📏 Thumbnail URL length: ${thumbnailUrls[0].length} chars`);
      imageDataUrl = ensureBase64(thumbnailUrls[0]);
    } else {
      throw new Error('No image provided for metadata generation');
    }

    // Build the message list once; retries append corrective messages to it
    const messages: any[] = useLocalModel
      ? [{ role: 'user', content: createLocalMessageContent(textPrompt, imageDataUrl) }]
      : [{ role: 'user', content: createVisionMessageContent(textPrompt, imageDataUrl) }];

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let maxTokens = DEFAULT_MAX_TOKENS;

      // On a truncation retry, request more output so the model has room to finish
      if (attempt > 1 && lastError?.message === 'AI response was truncated') {
        maxTokens = RETRY_MAX_TOKENS;
        console.warn(`✂️ AI response truncated on attempt ${attempt - 1}, retrying with maxTokens=${maxTokens}...`);
      }

      let response: AIResponse;

      if (useLocalModel) {
        // Use local OpenAI-compatible model - no API key needed
        if (!localModelName) {
          throw new Error('No local model selected. Please select a model from Settings.');
        }

        if (!localApiUrl) {
          throw new Error('No local AI server URL configured. Please set it in Settings.');
        }

        console.log('🏠 Using local model:', localModelName);

        billedProvider = 'local';
        billedModel = localModelName;

        response = await callLocalOpenAICompatible({
          model: localModelName,
          baseUrl: localApiUrl,
          messages,
          maxTokens,
        });
      } else {
        // Use remote API model
        if (!apiKey) {
          throw new Error(`No API key provided for ${provider}`);
        }

        // Determine default model if not provided
        let targetModel = model;
        if (!targetModel) {
          if (provider === 'openai') targetModel = DEFAULT_OPENAI_MODEL;
          else if (provider === 'openrouter') targetModel = DEFAULT_OPENROUTER_MODEL;
          else if (provider === 'google') targetModel = 'gemini-1.5-flash';
        }

        console.log('🤖 Calling AI API...');

        billedProvider = provider;
        billedModel = targetModel || 'gpt-4-vision-preview';

        response = await callAIApi({
          provider,
          apiKey,
          model: billedModel,
          messages,
          maxTokens,
        });
      }

      // Record this request's cost into the session tracker. Even requests that
      // fail to parse (or finish truncated) were billed, so record before parsing.
      apiCostTracker.recordCall(billedProvider, billedModel, response.usage);

      console.log('✅ AI responded. Parsing metadata...');

      // finish_reason === 'length' is checked BEFORE parsing so truncation
      // is never misclassified as a JSON/schema failure
      if (response.finishReason === 'length') {
        lastError = new Error('AI response was truncated');
        if (attempt < MAX_ATTEMPTS) {
          continue;
        }
        throw new Error('AI response remained truncated after retries');
      }

      try {
        return parseMetadataResponse(response.text, response.finishReason, limits);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(`❌ Attempt ${attempt} failed to parse metadata:`, error.message);

        // On the final attempt, surface the real parse/schema error
        if (attempt >= MAX_ATTEMPTS) {
          throw error;
        }

        // Retry malformed/schema failures with a corrective instruction
        lastError = error;
        messages.push({ role: 'user', content: CORRECTIVE_INSTRUCTION });
        console.warn(`⚠️ Retrying attempt ${attempt + 1}/${MAX_ATTEMPTS} with corrective instruction...`);
      }
    }

    throw new Error('AI generation failed after multiple attempts');
  } catch (err: any) {
    // Requests that were sent and billed but failed at the HTTP layer still cost
    // money. When the error carries usage info, record it so the session tracker
    // reflects the true cost.
    const errorUsage: AIUsage | undefined = err?.usage;
    if (errorUsage) {
      apiCostTracker.recordCall(billedProvider, billedModel || undefined, errorUsage);
    }
    console.error('❌ generateMetadata error:', err);
    throw err;
  }
};
