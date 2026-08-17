/**
 * AI Prompts Module
 * Contains prompt templates and prompt-related utilities for AI metadata generation
 */

export type MetadataLimits = {
  titleLimit?: number;
  descriptionLimit?: number;
  keywordLimit?: number;
};

import { interpolateTemplate, TemplateVariables } from '../templateUtils';

/**
 * Generates a metadata generation prompt based on the provided limits
 * @param limits - The character/keyword limits for title, description, and keywords
 * @param includePlaceName - Whether to include location/place names in the metadata
 * @param customTemplate - Optional custom template to use instead of default
 * @param customInstruction - Optional custom instruction specific to this image
 * @returns The formatted prompt string
 */
export const generateMetadataPrompt = (
  limits?: MetadataLimits,
  includePlaceName?: boolean,
  customTemplate?: string,
  customInstruction?: string,
  avoidWords?: {
    titleAvoidWords?: string[];
    keywordsAvoidWords?: string[];
    descriptionAvoidWords?: string[];
  }
): string => {
  const titleLimit = limits?.titleLimit || 200;
  const descriptionLimit = limits?.descriptionLimit || 200;
  const keywordLimit = limits?.keywordLimit || 50;

  const placeNameRule = includePlaceName
    ? "Include location names if visible."
    : "Use generic terms, no location names.";

  // Build avoid words sections if provided
  const titleAvoidWordsSection = avoidWords?.titleAvoidWords && avoidWords.titleAvoidWords.length > 0
    ? `\nSTRICTLY FORBIDDEN in title: ${avoidWords.titleAvoidWords.join(', ')}.`
    : '';
  
  const descriptionAvoidWordsSection = avoidWords?.descriptionAvoidWords && avoidWords.descriptionAvoidWords.length > 0
    ? `\nSTRICTLY FORBIDDEN in description: ${avoidWords.descriptionAvoidWords.join(', ')}.`
    : '';
  
  const keywordsAvoidWordsSection = avoidWords?.keywordsAvoidWords && avoidWords.keywordsAvoidWords.length > 0
    ? `\nSTRICTLY FORBIDDEN in keywords: ${avoidWords.keywordsAvoidWords.join(', ')}.`
    : '';

  // Build custom instruction section if provided
  const customInstructionSection = customInstruction
    ? `\n\nADDITIONAL INSTRUCTIONS FOR THIS IMAGE:\n${customInstruction}\n`
    : '';

  // If custom template is provided, use it with variable interpolation
  if (customTemplate) {
    const variables: TemplateVariables = {
      titleLimit,
      descriptionLimit,
      keywordLimit,
      currentDate: new Date().toISOString().split('T')[0],
    };

    const interpolatedTemplate = interpolateTemplate(customTemplate, variables);

    // Build avoid words replacements for custom template
    let processedTemplate = interpolatedTemplate;
    
    if (processedTemplate.includes('${placeNameRule}')) {
      processedTemplate = processedTemplate.replace(/\$\{placeNameRule\}/g, placeNameRule);
    }
    
    if (processedTemplate.includes('${titleAvoidWords}')) {
      processedTemplate = processedTemplate.replace(/\$\{titleAvoidWords\}/g, titleAvoidWordsSection);
    }
    
    if (processedTemplate.includes('${descriptionAvoidWords}')) {
      processedTemplate = processedTemplate.replace(/\$\{descriptionAvoidWords\}/g, descriptionAvoidWordsSection);
    }
    
    if (processedTemplate.includes('${keywordsAvoidWords}')) {
      processedTemplate = processedTemplate.replace(/\$\{keywordsAvoidWords\}/g, keywordsAvoidWordsSection);
    }

    // Always append avoid words as global constraints at the end.
    // This ensures avoid words are enforced even in templates that don't
    // have explicit ${titleAvoidWords} / ${descriptionAvoidWords} / ${keywordsAvoidWords} placeholders.
    const hadPlaceholders =
      customTemplate.includes('${titleAvoidWords}') ||
      customTemplate.includes('${descriptionAvoidWords}') ||
      customTemplate.includes('${keywordsAvoidWords}');

    if (!hadPlaceholders) {
      const globalAvoidSection = [titleAvoidWordsSection, descriptionAvoidWordsSection, keywordsAvoidWordsSection]
        .filter(s => s.length > 0)
        .join('\n');
      if (globalAvoidSection) {
        processedTemplate += '\n' + globalAvoidSection;
      }
    }

    return processedTemplate + customInstructionSection;
  }

  // Use existing default logic when no custom template is provided
  return `Analyze the provided image and return stock photo metadata.${customInstructionSection}

Return ONLY one JSON object with these required fields:
- title: string (approximately ${titleLimit} characters, complete descriptive title, no colons or special characters, end at a complete word, ${placeNameRule})
- description: string (under ${descriptionLimit} characters, complete detailed description, no colons or special characters, end at a complete word, ${placeNameRule})
- keywords: string (approximately ${keywordLimit} comma-separated keywords, no colons or special characters)
${titleAvoidWordsSection}${descriptionAvoidWordsSection}${keywordsAvoidWordsSection}

Do not use Markdown.
Do not use \`\`\`json.
Do not explain your answer.
Do not include reasoning.
Do not include any text before or after the JSON.

Example:
{
  "title": "Example title",
  "description": "Example description",
  "keywords": "keyword one, keyword two, keyword three"
}`;
};

