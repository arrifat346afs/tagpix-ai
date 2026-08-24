/**
 * AI Response Parser Module
 * Handles extraction and parsing of JSON format from AI API responses
 */

import { extractKeywordsFromTitle } from '../keywordUtils';

export type ParsedMetadata = {
  title: string;
  description: string;
  keywords: string;
};

export type MetadataLimits = {
  titleLimit?: number;
  descriptionLimit?: number;
  keywordLimit?: number;
};

/**
 * Extracts text content from various AI response formats
 * @param response - The raw response from the AI API
 * @returns The extracted text string
 */
export const extractTextFromResponse = (response: any): string => {
  if (typeof response === 'string') {
    return response;
  } else if (response?.text) {
    return response.text;
  } else {
    return JSON.stringify(response);
  }
};

/**
 * Removes reasoning ("thinking") blocks that local models such as DeepSeek-R1
 * or Qwen3 emit around (or instead of) their final answer.
 * Handles unclosed blocks too — a `<think>` run that consumed the whole token
 * budget leaves no closing tag behind.
 * @param text - The raw AI response text
 * @returns The text without think blocks
 */
export const stripThinkBlocks = (text: string): string =>
  text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/i, '');

/**
 * Normalizes a raw AI response by stripping markdown code fences,
 * reasoning (<think>) blocks and surrounding whitespace so the JSON object
 * can be located reliably.
 * @param text - The raw AI response text
 * @returns The cleaned text
 */
export const cleanAIResponse = (text: string): string => {
  let cleaned = stripThinkBlocks(text).trim();

  // Remove leading ```json / ``` fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  // Remove trailing ``` fence
  cleaned = cleaned.replace(/\s*```$/i, '');

  return cleaned.trim();
};

/**
 * Extracts JSON from a text string that may contain additional content
 * @param text - The text containing JSON
 * @returns The extracted JSON string or null if not found
 */
export const extractJsonFromText = (text: string): string | null => {
  const cleaned = cleanAIResponse(text);
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');

  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    return cleaned.slice(jsonStart, jsonEnd + 1);
  }

  return null;
};

/**
 * Validates that the parsed metadata matches the expected schema
 * @param metadata - The parsed metadata object
 * @throws Error if validation fails
 */
export const validateMetadata = (metadata: any): void => {
  if (!metadata || typeof metadata !== 'object') {
    console.error('❌ Parsed value is not an object:', metadata);
    throw new Error('AI returned invalid metadata (not an object)');
  }

  const title = String(metadata.title ?? '').trim();
  const description = String(metadata.description ?? '').trim();
  const keywords = String(metadata.keywords ?? '').trim();

  if (!title || title.length < 5) {
    console.error('❌ Title too short or empty:', title);
    throw new Error('AI returned invalid title (too short)');
  }

  if (!description || description.length < 10) {
    console.error('❌ Description too short or empty:', description);
    throw new Error('AI returned invalid description (too short)');
  }

  if (!keywords) {
    console.error('❌ Keywords empty or missing:', keywords);
    throw new Error('AI returned invalid keywords (missing or empty)');
  }
};

/**
 * Applies keyword limits to the parsed metadata
 * Note: Title and description limits are just guides for the AI, not enforced
 * @param metadata - The raw parsed metadata
 * @param limits - The limits to apply (only keywordLimit is enforced)
 * @returns The metadata with keyword limit applied
 */
export const applyLimits = (
  metadata: any,
  limits?: MetadataLimits
): ParsedMetadata => {
  const keywordLimit = limits?.keywordLimit || 80;

  const title = String(metadata.title || '').trim();
  const description = String(metadata.description || '').trim();
  let keywords = String(metadata.keywords || '').trim();

  // Extract keywords from title
  const titleKeywords = extractKeywordsFromTitle(title);

  // Parse existing keywords
  const existingKeywords = keywords
    .split(',')
    .map((k: string) => k.trim())
    .filter(Boolean);

  // Merge title keywords with existing keywords (title keywords first)
  // Use a Set to remove duplicates
  const mergedKeywords = Array.from(new Set([...titleKeywords, ...existingKeywords]));

  // Log the actual lengths for debugging
  console.log(`📏 Title length: ${title.length} characters`);
  console.log(`📏 Description length: ${description.length} characters`);
  console.log(`🔑 Title keywords added: ${titleKeywords.join(', ')}`);

  return {
    title: title,
    description: description,
    keywords: mergedKeywords
      .slice(0, keywordLimit)
      .join(', '),
  };
};

/**
 * Parses AI response text and extracts validated metadata
 * Checks finish reason BEFORE attempting any JSON parsing so truncated
 * responses are never misreported as malformed JSON.
 * @param text - The raw AI response text
 * @param finishReason - Optional finish reason from the API (e.g. 'length', 'stop')
 * @param limits - Optional limits to apply to the metadata
 * @returns The parsed and validated metadata
 * @throws Error with a distinct message for truncation, empty, malformed, or schema failure
 */
export const parseMetadataResponse = (
  text: string,
  finishReason?: string,
  limits?: MetadataLimits
): ParsedMetadata => {
  // 1. Truncation is a first-class condition, checked before parsing
  if (finishReason === 'length') {
    console.warn('✂️ AI response was truncated (finish_reason: length)');
    throw new Error('AI response was truncated');
  }

  // 2. Empty response
  if (!text || !text.trim()) {
    console.error('❌ AI returned an empty response');
    throw new Error('AI returned an empty response');
  }

  console.log('AI Response text:', text);

  // 3. Locate the JSON object within the response
  const jsonStr = extractJsonFromText(text);

  if (!jsonStr) {
    console.error('❌ No JSON object found in AI response');
    console.error('📄 Full response text (first 500 chars):', text.substring(0, 500));

    // Check if it's an HTML error response
    if (text.trim().startsWith('<')) {
      console.error('⚠️ Response appears to be HTML - this usually means:');
      console.error('   1. Invalid or expired API key');
      console.error('   2. API rate limiting');
      console.error('   3. Network/CORS error');
      console.error('   4. API endpoint issue');
      throw new Error('AI returned HTML instead of JSON - check API key and rate limits');
    }

    throw new Error('AI did not return a JSON object');
  }

  // 4. JSON parsing (separate from schema validation)
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
    console.log('Parsed JSON:', parsed);
  } catch (err) {
    console.error('❌ Failed to parse JSON from AI response:', err);
    console.error('📄 Raw response (first 500 chars):', text.substring(0, 500));
    console.error('🔍 Extracted JSON string:', jsonStr);
    throw new Error('AI returned malformed JSON');
  }

  // 5. Schema validation (separate from JSON parsing)
  validateMetadata(parsed);

  // 6. Apply limits and return
  return applyLimits(parsed, limits);
};

// /**
//  * Creates fallback metadata when AI generation fails
//  * @param fileNames - The file names to use for fallback
//  * @param limits - Optional limits to apply
//  * @returns Fallback metadata based on file names
//  */
// export const createFallbackMetadata = (
//   fileNames: string[],
//   limits?: MetadataLimits
// ): ParsedMetadata => {
//   const descriptionLimit = limits?.descriptionLimit ?? 300;
//   const keywordLimit = limits?.keywordLimit ?? 5;

//   return {
//     title: fileNames[0] || 'Untitled',
//     description: `Auto-generated description for ${fileNames.join(', ')}`.slice(
//       0,
//       descriptionLimit
//     ),
//     keywords: fileNames
//       .slice(0, keywordLimit)
//       .map((f) => f.replace(/\.[^.]+$/, ''))
//       .join(', '),
//   };
// };

