/**
 * Export Utilities Module
 * Handles exporting metadata to CSV format for different stock platforms
 */

import { writeTextFile } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';
import { ADOBE_STOCK_CATEGORIES } from './categoryMatcher';

export type FileMetadata = {
  file: File;
  metadata: {
    title: string;
    description: string;
    keywords: string;
  };
  categories?: CategorySelection;
};

 export type CategorySelection = {
  adobeStock: string;
  shutterStock1: string;
  shutterStock2: string;
};

/**
 * Escapes CSV field values to handle commas, quotes, and newlines
 */
function escapeCSVField(field: string): string {
  if (!field) return '';
  
  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  
  return field;
}

/**
 * Gets the Adobe Stock category name from the category ID
 */
function getAdobeCategoryName(categoryId: string): string {
  return ADOBE_STOCK_CATEGORIES[categoryId as keyof typeof ADOBE_STOCK_CATEGORIES] || categoryId;
}

/**
 * Generates CSV content for Adobe Stock format
 * Format: Filename, Title, Description, Keywords, Category
 */
function generateAdobeStockCSV(items: FileMetadata[], fallbackCategories: CategorySelection): string {
  const headers = ['Filename', 'Title', 'Description', 'Keywords', 'Category'];
  const rows: string[] = [headers.join(',')];

  for (const item of items) {
    const filename = escapeCSVField(item.file.name);
    const title = escapeCSVField(item.metadata.title);
    const description = escapeCSVField(item.metadata.description);
    const keywords = escapeCSVField(item.metadata.keywords);

    // Use file-specific categories if available, otherwise use fallback
    const categoryId = item.categories?.adobeStock || fallbackCategories.adobeStock;
    const categoryName = escapeCSVField(getAdobeCategoryName(categoryId));

    rows.push([filename, title, description, keywords, categoryName].join(','));
  }

  return rows.join('\n');
}

/**
 * Generates CSV content for Shutterstock format
 * Format: Filename, Title, Description, Keywords, Category1, Category2
 */
function generateShutterstockCSV(items: FileMetadata[], fallbackCategories: CategorySelection): string {
  const headers = ['Filename', 'Title', 'Description', 'Keywords', 'Category 1', 'Category 2'];
  const rows: string[] = [headers.join(',')];

  for (const item of items) {
    const filename = escapeCSVField(item.file.name);
    const title = escapeCSVField(item.metadata.title);
    const description = escapeCSVField(item.metadata.description);
    const keywords = escapeCSVField(item.metadata.keywords);

    // Use file-specific categories if available, otherwise use fallback
    const category1 = escapeCSVField(item.categories?.shutterStock1 || fallbackCategories.shutterStock1);
    const category2 = escapeCSVField(item.categories?.shutterStock2 || fallbackCategories.shutterStock2);

    rows.push([filename, title, description, keywords, category1, category2].join(','));
  }

  return rows.join('\n');
}

/**
 * Writes a CSV file to disk with the given content and filename
 */
async function writeCSVFile(content: string, defaultFilename: string): Promise<string> {
  try {
    // Check if there's a saved export path in localStorage
    const savedPath = localStorage.getItem('exportPath');

    let filePath: string;

    if (savedPath) {
      // Use the saved path directly without showing dialog
      // Ensure path separator is correct
      const separator = savedPath.includes('\\') ? '\\' : '/';
      filePath = `${savedPath}${separator}${defaultFilename}`;
      console.log(`📁 Using saved export path: ${filePath}`);
    } else {
      // No saved path - show save dialog
      const dialogResult = await save({
        defaultPath: defaultFilename,
        filters: [{
          name: 'CSV',
          extensions: ['csv']
        }]
      });

      if (!dialogResult) {
        // User cancelled the dialog
        throw new Error('Export cancelled by user');
      }

      filePath = dialogResult;
      // Save the path for future exports
      const pathSeparator = filePath.includes('\\') ? '\\' : '/';
      const lastSeparator = filePath.lastIndexOf(pathSeparator);
      if (lastSeparator !== -1) {
        const directoryPath = filePath.substring(0, lastSeparator);
        localStorage.setItem('exportPath', directoryPath);
      }
    }

    // Write the CSV file
    await writeTextFile(filePath, content);

    console.log(`✓ Successfully exported to: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}

/**
 * Exports metadata to CSV file based on the selected platform
 * Uses the saved export path from settings, or shows a dialog if not configured
 */
export async function exportToCSV(
  items: FileMetadata[],
  categories: CategorySelection,
  platform: 'adobeStock' | 'shutterStock'
): Promise<void> {
  if (items.length === 0) {
    throw new Error('No items to export');
  }

  // Generate CSV content based on platform
  const csvContent = platform === 'adobeStock'
    ? generateAdobeStockCSV(items, categories)
    : generateShutterstockCSV(items, categories);

  // Get the default filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const platformName = platform === 'adobeStock' ? 'Adobe_Stock' : 'Shutterstock';
  const defaultFilename = `${platformName}_Export_${timestamp}.csv`;

  await writeCSVFile(csvContent, defaultFilename);
}

/**
 * Exports metadata to multiple CSV formats simultaneously
 * Creates separate files for each selected platform
 */
export async function exportToMultipleFormats(
  items: FileMetadata[],
  categories: CategorySelection,
  platforms: ('adobeStock' | 'shutterStock')[]
): Promise<void> {
  if (items.length === 0) {
    throw new Error('No items to export');
  }

  if (platforms.length === 0) {
    throw new Error('No export formats selected');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const exportPromises: Promise<string>[] = [];

  for (const platform of platforms) {
    const csvContent = platform === 'adobeStock'
      ? generateAdobeStockCSV(items, categories)
      : generateShutterstockCSV(items, categories);

    const platformName = platform === 'adobeStock' ? 'Adobe_Stock' : 'Shutterstock';
    const defaultFilename = `${platformName}_Export_${timestamp}.csv`;

    exportPromises.push(writeCSVFile(csvContent, defaultFilename));
  }

  try {
    const exportedFiles = await Promise.all(exportPromises);
    const platformNames = platforms.map(p => p === 'adobeStock' ? 'Adobe Stock' : 'Shutterstock').join(', ');
    console.log(`✓ Successfully exported ${items.length} items to ${platformNames}`);
    console.log(`Files: ${exportedFiles.join(', ')}`);
  } catch (error) {
    console.error('Multi-format export error:', error);
    throw error;
  }
}

