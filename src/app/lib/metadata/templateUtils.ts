

export interface TemplateVariables {
  titleLimit: number;
  descriptionLimit: number;
  keywordLimit: number;
  fileName?: string;
  currentDate?: string;
}

export const DEFAULT_TEMPLATES = [
  {
    id: 'stock-photo',
    name: 'Stock Photo',
    template: `Generate stock photo metadata for this image.

IMPORTANT: Write complete, natural text. End at complete words, never cut words in half.
Make titles descriptive and marketable for stock photography platforms.

Requirements:
1. Title:
   - Target approximately \${titleLimit} characters
   - Write a complete, descriptive title
   - End at a complete word (can be slightly over or under the target)
   - No colons (:) or special characters
   - Focus on visual elements and potential use cases

2. Description:
   - Target under \${descriptionLimit} characters
   - Write a complete, detailed description
   - End at a complete word (can be slightly over or under the target)
   - No colons (:) or special characters
   - Describe composition, mood, and potential applications

3. Keywords:
   - Provide approximately \${keywordLimit} keywords
   - Comma-separated
   - No colons (:) or special characters
   - Include style, mood, subject, and technical terms

Return ONLY JSON:
{"title": "...", "description": "...", "keywords": "..."}`,
    isPreset: true,
  },
  {
    id: 'product-catalog',
    name: 'Product Catalog',
    template: `Generate e-commerce product metadata for this image.

IMPORTANT: Write complete, natural text. End at complete words, never cut words in half.
Focus on product features, benefits, and selling points.

Requirements:
1. Title:
   - Target approximately \${titleLimit} characters
   - Write a complete, descriptive product title
   - End at a complete word (can be slightly over or under the target)
   - No colons (:) or special characters
   - Include brand, product type, and key features

2. Description:
   - Target under \${descriptionLimit} characters
   - Write a complete product description
   - End at a complete word (can be slightly over or under the target)
   - No colons (:) or special characters
   - Highlight features, benefits, and use cases

3. Keywords:
   - Provide approximately \${keywordLimit} keywords
   - Comma-separated
   - No colons (:) or special characters
   - Include product attributes, categories, and search terms

Return ONLY JSON:
{"title": "...", "description": "...", "keywords": "..."}`,
    isPreset: true,
  },
  {
    id: 'social-media',
    name: 'Social Media',
    template: `Generate social media metadata for this image.

IMPORTANT: Write complete, natural text. End at complete words, never cut words in half.
Create engaging content for social media platforms.

Requirements:
1. Title:
   - Target approximately \${titleLimit} characters
   - Write an engaging, attention-grabbing title
   - End at a complete word (can be slightly over or under the target)
   - No colons (:) or special characters
   - Use conversational, engaging language

2. Description:
   - Target under \${descriptionLimit} characters
   - Write a compelling social media description
   - End at a complete word (can be slightly over or under the target)
   - No colons (:) or special characters
   - Include relevant hashtags and calls to action

3. Keywords:
   - Provide approximately \${keywordLimit} keywords
   - Comma-separated
   - No colons (:) or special characters
   - Include trending topics, hashtags, and relevant tags

Return ONLY JSON:
{"title": "...", "description": "...", "keywords": "..."}`,
    isPreset: true,
  },
];

export const interpolateTemplate = (
  template: string,
  variables: TemplateVariables
): string => {
  return template
    .replace(/\$\{titleLimit\}/g, variables.titleLimit.toString())
    .replace(/\$\{descriptionLimit\}/g, variables.descriptionLimit.toString())
    .replace(/\$\{keywordLimit\}/g, variables.keywordLimit.toString())
    .replace(/\$\{fileName\}/g, variables.fileName || '')
    .replace(/\$\{currentDate\}/g, variables.currentDate || new Date().toISOString().split('T')[0]);
};

export const validateTemplate = (template: string): {
  isValid: boolean;
  missingVariables: string[];
} => {
  const requiredVariables = ['${titleLimit}', '${descriptionLimit}', '${keywordLimit}'];
  const missingVariables: string[] = [];

  requiredVariables.forEach(variable => {
    if (!template.includes(variable)) {
      missingVariables.push(variable);
    }
  });

  return {
    isValid: missingVariables.length === 0,
    missingVariables,
  };
};

export const getTemplateVariables = (): string[] => {
  return [
    '${titleLimit}',
    '${descriptionLimit}', 
    '${keywordLimit}',
    '${fileName} (optional)',
    '${currentDate} (optional)',
  ];
};

export const getActiveTemplate = (
  activeTemplateId: string | null,
  userTemplates: Array<{ id: string; name: string; template: string }>,
  customTemplate?: string,
  editedDefaultTemplates?: Array<{ id: string; template: string }>
): string | null => {
  if (customTemplate) {
    return customTemplate;
  }
  
  if (activeTemplateId) {
    const userTemplate = userTemplates.find(t => t.id === activeTemplateId);
    if (userTemplate) {
      return userTemplate.template;
    }
    
    // Check for edited default template first
    if (editedDefaultTemplates) {
      const editedDefault = editedDefaultTemplates.find(t => t.id === activeTemplateId);
      if (editedDefault) {
        return editedDefault.template;
      }
    }
    
    const presetTemplate = DEFAULT_TEMPLATES.find(t => t.id === activeTemplateId);
    if (presetTemplate) {
      return presetTemplate.template;
    }
  }
  
  return null;
};

export const getTemplateById = (
  templateId: string, 
  editedDefaultTemplates?: Array<{ id: string; template: string }>
): { id: string; name: string; template: string } | null => {
  // Check for edited default template first
  if (editedDefaultTemplates) {
    const editedDefault = editedDefaultTemplates.find(t => t.id === templateId);
    if (editedDefault) {
      const originalTemplate = DEFAULT_TEMPLATES.find(t => t.id === templateId);
      if (originalTemplate) {
        return {
          ...originalTemplate,
          template: editedDefault.template,
        };
      }
    }
  }
  
  // Check preset templates
  const presetTemplate = DEFAULT_TEMPLATES.find(t => t.id === templateId);
  if (presetTemplate) {
    return presetTemplate;
  }
  
  // Return null if not found - user templates are handled separately
  return null;
};

export const getEditedDefaultTemplates = (): typeof DEFAULT_TEMPLATES => {
  return DEFAULT_TEMPLATES;
};

export const isDefaultTemplateEdited = (
  templateId: string,
  editedDefaultTemplates: Array<{ id: string }>
): boolean => {
  const isDefault = DEFAULT_TEMPLATES.some(t => t.id === templateId);
  return isDefault && editedDefaultTemplates.some(t => t.id === templateId);
};