/**
 * Batch Processor Service
 * Orchestrates batch processing of images across multiple folders
 * Handles AI metadata generation, embedding, and export
 * Supports cancellation and resume capabilities
 */

import { invoke } from '@tauri-apps/api/core';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import {
  startBatchProcess,
  updateFolderStatus,
  updateImageStatus,
  setCurrentStage,
  setCurrentFolderIndex,
  updateImageProgress,
  markFolderExported,
  completeBatchProcess,
  failBatchProcess,
  updateFilePath,
  pauseBatchProcess,
  resumeBatchProcess,
  resetBatchProcess,
  type FolderProcessingState,
  type BatchProcessState,
} from '@/store/batchProcessStore';
import { useBatchProcessStore } from '@/store/batchProcessStore';
import { updateFolder } from '@/store/batchStore';
import type { FolderInfo } from '@/app/_component/batch/FolderInfoCard';
import { generateMetadata, type GeneratedMetadata } from './ai';
import { getTemplateById } from './templateUtils';
import type { FileMetadata, CategorySelection } from './exportUtils';
import { toast } from 'sonner';

/**
 * Zustand migration adapter: Zustand actions execute immediately when called,
 * so there is no dispatch step. This no-op keeps the existing
 * `dispatch(action(payload))` call style in this file working unchanged — the
 * inner action call performs the state update and `dispatch` discards the
 * (void) result. Gradually replace `dispatch(action(...))` with a direct
 * `action(...)` call and remove this adapter.
 */
export type DispatchFn = (action: void) => void;
const dispatch: DispatchFn = () => {};


// Cancellation flag
let isCancelled = false;

// Configuration type for batch processing
interface BatchConfig {
  provider: string;
  model: string;
  apiKey: string;
  limits: { titleLimit: number; descriptionLimit: number; keywordLimit: number };
  includePlaceName: boolean;
  avoidWords: {
    titleAvoidWords: string[];
    keywordsAvoidWords: string[];
    descriptionAvoidWords: string[];
  };
  requestDelay: number;
  embedEnabled: boolean;
  embedFields: { title: boolean; description: boolean; keywords: boolean };
  processingMode: 'sequential' | 'parallel';
  parallelWorkers: number;
}

// Delay function for sequential processing that checks cancellation
const delay = (ms: number) => new Promise<void>((resolve) => {
  const startTime = Date.now();
  const checkInterval = setInterval(() => {
    if (isCancelled || Date.now() - startTime >= ms) {
      clearInterval(checkInterval);
      resolve();
    }
  }, 100);
});

// Check if processing should continue
function shouldContinue(): boolean {
  return !isCancelled;
}

// Helper to process a single image with cancellation check
async function processSingleImage(
  file: File,
  filePath: string,
  folderState: FolderProcessingState,
  config: BatchConfig,
  onProgress: (status: 'processing' | 'completed' | 'error', metadata?: GeneratedMetadata, error?: string) => void
): Promise<void> {
  // Check cancellation before starting
  if (!shouldContinue()) {
    return;
  }
  
  try {
    onProgress('processing');
    
    // Check cancellation after starting
    if (!shouldContinue()) {
      return;
    }
    
    // Step 1: Get template content
    let templateContent: string | undefined;
    if (folderState.assignedTemplateId) {
      const template = getTemplateById(folderState.assignedTemplateId);
      if (template) {
        templateContent = template.template;
      }
    }
    
    // Step 2: Generate metadata using AI
    console.log(`🤖 Processing ${file.name} with ${config.provider}...`);
    
    const metadata = await generateMetadata({
      file,
      filePath: filePath,
      fileNames: [file.name],
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      limits: config.limits,
      includePlaceName: config.includePlaceName,
      customTemplate: templateContent,
      avoidWords: config.avoidWords,
    });
    
    console.log(`✅ Metadata generated for ${file.name}:`, metadata);
    
    // Check cancellation before embedding
    if (!shouldContinue()) {
      return;
    }
    
    // Step 3: Embed metadata using Tauri/ExifTool (if enabled, skip SVG)
    if (config.embedEnabled && file.type !== 'image/svg+xml') {
      console.log(`💾 Embedding metadata for ${file.name}...`);
      
      const embedResult = await invoke('embed_metadata', {
        request: {
          file_path: filePath,
          title: config.embedFields.title ? metadata.title : undefined,
          description: config.embedFields.description ? metadata.description : undefined,
          keywords: config.embedFields.keywords ? metadata.keywords : undefined,
        },
      });
      
      const result = embedResult as { success: boolean; message: string };
      if (!result.success) {
        console.warn(`⚠️ Failed to embed metadata for ${file.name}:`, result.message);
      } else {
        console.log(`✅ Metadata embedded for ${file.name}`);
      }
    } else if (config.embedEnabled && file.type === 'image/svg+xml') {
      console.log(`ℹ️ Skipping metadata embedding for SVG file: ${file.name} (use CSV export)`);
    }
    
    // Step 4: Apply delay before next request (with cancellation check)
    if (config.requestDelay > 0 && shouldContinue()) {
      await delay(config.requestDelay);
    }
    
    if (shouldContinue()) {
      onProgress('completed', metadata);
    }
    
  } catch (error) {
    if (!shouldContinue()) {
      return;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error processing ${file.name}:`, errorMessage);
    onProgress('error', undefined, errorMessage);
  }
}

// Process folder in sequential mode with resume support
async function processFolderSequential(
  folderState: FolderProcessingState,
  folderInfo: FolderInfo,
  filePathMap: Map<File, string>,
  config: BatchConfig,
  dispatch: DispatchFn,
  startFromIndex: number = 0
): Promise<void> {
  console.log('🎯 ENTER processFolderSequential - FIRST LINE');
  console.log(`📂 Processing folder: ${folderInfo?.folderPath}`);
  console.log(`📁 folderInfo exists: ${!!folderInfo}`);
  console.log(`📁 folderInfo.files exists: ${!!folderInfo?.files}`);
  console.log(`📁 Total files in folder: ${folderInfo?.files?.length || 0}`);
  
  if (!folderInfo || !folderInfo.files) {
    console.error('❌ folderInfo or folderInfo.files is undefined!');
    return;
  }
  
  console.log(`📄 All files:`, folderInfo.files.map(f => ({ name: f.name, type: f.type, size: f.size })));
  
  const imageFiles = folderInfo.files.filter(f => f.type?.startsWith('image/')) || [];
  
  console.log(`🖼️ Filtered image files: ${imageFiles.length}`);
  console.log(`📋 Image files details:`, imageFiles.map(f => ({ name: f.name, type: f.type })));
  
  if (imageFiles.length === 0) {
    console.warn('⚠️ No image files found to process! Check file types above.');
    return;
  }
  
  for (let i = startFromIndex; i < imageFiles.length; i++) {
    if (!shouldContinue()) {
      console.log('⏸️ Sequential processing paused');
      return;
    }
    
    const file = imageFiles[i];
    
    // Check if already completed (for resume)
    const existingImage = folderState.images.find(img => img.fileName === file.name);
    if (existingImage?.status === 'completed') {
      console.log(`⏭️ Skipping already completed: ${file.name}`);
      continue;
    }
    
    const filePath = filePathMap.get(file);
    if (!filePath) {
      console.warn(`⚠️ No file path found for ${file.name}`);
      dispatch(updateImageStatus({
        folderId: folderState.folderId,
        fileName: file.name,
        status: 'error',
        error: 'File path not found',
      }));
      continue;
    }
    
    // Update file path in state
    dispatch(updateFilePath({
      folderId: folderState.folderId,
      fileName: file.name,
      filePath,
    }));
    
    // Process the image
    await processSingleImage(
      file,
      filePath,
      folderState,
      config,
      (status, metadata, error) => {
        if (!shouldContinue()) return;
        
        dispatch(updateImageStatus({
          folderId: folderState.folderId,
          fileName: file.name,
          status,
          metadata,
          error,
        }));
        
        dispatch(updateImageProgress({
          folderId: folderState.folderId,
          currentImageIndex: i + 1,
        }));
      }
    );
  }
}

// Process folder in parallel mode with resume support
async function processFolderParallel(
  folderState: FolderProcessingState,
  folderInfo: FolderInfo,
  filePathMap: Map<File, string>,
  config: BatchConfig,
  parallelWorkers: number,
  dispatch: DispatchFn,
  startFromIndex: number = 0
): Promise<void> {
  const imageFiles = folderInfo.files.filter(f => f.type.startsWith('image/'));
  
  // Process images in batches starting from resume point
  for (let i = startFromIndex; i < imageFiles.length; i += parallelWorkers) {
    if (!shouldContinue()) {
      console.log('⏸️ Parallel processing paused');
      return;
    }
    
    const batch = imageFiles.slice(i, i + parallelWorkers);
    
    // Filter out already completed images
    const batchToProcess = batch.filter(file => {
      const existingImage = folderState.images.find(img => img.fileName === file.name);
      return existingImage?.status !== 'completed';
    });
    
    if (batchToProcess.length === 0) {
      // Update progress for skipped batch
      dispatch(updateImageProgress({
        folderId: folderState.folderId,
        currentImageIndex: Math.min(i + parallelWorkers, imageFiles.length),
      }));
      continue;
    }
    
    // Process batch concurrently
    const batchPromises = batchToProcess.map(async (file) => {
      if (!shouldContinue()) return;
      
      const filePath = filePathMap.get(file);
      if (!filePath) {
        dispatch(updateImageStatus({
          folderId: folderState.folderId,
          fileName: file.name,
          status: 'error',
          error: 'File path not found',
        }));
        return;
      }
      
      // Update file path in state
      dispatch(updateFilePath({
        folderId: folderState.folderId,
        fileName: file.name,
        filePath,
      }));
      
      // Process the image
      await processSingleImage(
        file,
        filePath,
        folderState,
        config,
        (status, metadata, error) => {
          if (!shouldContinue()) return;
          
          dispatch(updateImageStatus({
            folderId: folderState.folderId,
            fileName: file.name,
            status,
            metadata,
            error,
          }));
        }
      );
    });
    
    await Promise.all(batchPromises);
    
    if (!shouldContinue()) {
      return;
    }
    
    // Update progress
    dispatch(updateImageProgress({
      folderId: folderState.folderId,
      currentImageIndex: Math.min(i + parallelWorkers, imageFiles.length),
    }));
    
    // Apply delay after each batch
    if (config.requestDelay > 0 && i + parallelWorkers < imageFiles.length && shouldContinue()) {
      await delay(config.requestDelay);
    }
  }
}

// Export a single folder's metadata to CSV
async function exportFolder(
  folderState: FolderProcessingState,
  categories: CategorySelection,
  platform: 'adobeStock' | 'shutterStock',
  savedExportPath: string | null
): Promise<string | null> {
  // Prepare export items
  const exportItems: FileMetadata[] = folderState.images
    .filter(img => img.status === 'completed' && img.metadata)
    .map(img => ({
      file: new File([], img.fileName), // Create a dummy File object for export
      metadata: img.metadata!,
      categories,
    }));
  
  if (exportItems.length === 0) {
    console.warn(`⚠️ No completed images to export for ${folderState.folderName}`);
    return null;
  }
  
  // Generate CSV content
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const platformName = platform === 'adobeStock' ? 'Adobe_Stock' : 'shutterstock';
  const defaultFilename = `${folderState.folderName}_${platformName}_Export_${timestamp}.csv`;
  
  try {
    let filePath: string;
    
    if (savedExportPath) {
      // Use the saved path directly
      const separator = savedExportPath.includes('\\') ? '\\' : '/';
      filePath = `${savedExportPath}${separator}${defaultFilename}`;
    } else {
      // No saved path - this shouldn't happen as we check before calling
      console.error('❌ No export path configured');
      return null;
    }
    
    // Generate CSV content
    const csvContent = platform === 'adobeStock'
      ? generateAdobeStockCSV(exportItems, categories)
      : generateShutterstockCSV(exportItems, categories);
    
    // Write the file
    await writeTextFile(filePath, csvContent);
    
    console.log(`✅ Exported ${folderState.folderName} to: ${filePath}`);
    return filePath;
    
  } catch (error) {
    console.error(`❌ Export failed for ${folderState.folderName}:`, error);
    return null;
  }
}

// Helper functions for CSV generation
function escapeCSVField(field: string): string {
  if (!field) return '';
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function generateAdobeStockCSV(items: FileMetadata[], fallbackCategories: CategorySelection): string {
  const headers = ['Filename', 'Title', 'Description', 'Keywords', 'Category'];
  const rows: string[] = [headers.join(',')];
  
  for (const item of items) {
    const filename = escapeCSVField(item.file.name);
    const title = escapeCSVField(item.metadata.title);
    const description = escapeCSVField(item.metadata.description);
    const keywords = escapeCSVField(item.metadata.keywords);
    const category = escapeCSVField(fallbackCategories.adobeStock || '');
    
    rows.push([filename, title, description, keywords, category].join(','));
  }
  
  return rows.join('\n');
}

function generateShutterstockCSV(items: FileMetadata[], fallbackCategories: CategorySelection): string {
  const headers = ['Filename', 'Title', 'Description', 'Keywords', 'Category 1', 'Category 2'];
  const rows: string[] = [headers.join(',')];
  
  for (const item of items) {
    const filename = escapeCSVField(item.file.name);
    const title = escapeCSVField(item.metadata.title);
    const description = escapeCSVField(item.metadata.description);
    const keywords = escapeCSVField(item.metadata.keywords);
    const category1 = escapeCSVField(fallbackCategories.shutterStock1 || '');
    const category2 = escapeCSVField(fallbackCategories.shutterStock2 || '');
    
    rows.push([filename, title, description, keywords, category1, category2].join(','));
  }
  
  return rows.join('\n');
}

// Save batch progress to localStorage for resume capability
function saveBatchProgress(state: BatchProcessState): void {
  try {
    // Only save serializable data
    const progressData = {
      folders: state.folders.map(f => ({
        folderId: f.folderId,
        folderPath: f.folderPath,
        folderName: f.folderName,
        status: f.status,
        images: f.images.map(img => ({
          fileName: img.fileName,
          filePath: img.filePath,
          status: img.status,
          metadata: img.metadata,
          error: img.error,
        })),
        currentImageIndex: f.currentImageIndex,
        assignedTemplateId: f.assignedTemplateId,
        exportedFilePath: f.exportedFilePath,
      })),
      currentFolderIndex: state.currentFolderIndex,
      totalFolders: state.totalFolders,
      totalImages: state.totalImages,
      completedImages: state.completedImages,
      failedImages: state.failedImages,
      processingMode: state.processingMode,
      savedAt: Date.now(),
    };
    
    localStorage.setItem('batchProgress', JSON.stringify(progressData));
    console.log('💾 Batch progress saved');
  } catch (error) {
    console.error('❌ Failed to save batch progress:', error);
  }
}

// Load batch progress from localStorage
export function loadBatchProgress(): any | null {
  try {
    const saved = localStorage.getItem('batchProgress');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('❌ Failed to load batch progress:', error);
  }
  return null;
}

// Clear saved batch progress
export function clearBatchProgress(): void {
  localStorage.removeItem('batchProgress');
  console.log('🗑️ Batch progress cleared');
}

// Main batch processing function with resume support
export async function startBatchProcessing(
  folders: FolderInfo[],
  config: BatchConfig,
  filePathMap: Map<File, string>,
  categories: CategorySelection,
  exportPlatform: 'adobeStock' | 'shutterStock',
  savedExportPath: string | null,
  resumeFromState?: BatchProcessState
): Promise<void> {

  
  // Reset cancellation flag
  isCancelled = false;
  
  // Check for saved progress if not resuming from explicit state
  if (!resumeFromState) {
    const savedProgress = loadBatchProgress();
    if (savedProgress && savedProgress.status !== 'completed') {
      const hoursSinceSave = (Date.now() - savedProgress.savedAt) / (1000 * 60 * 60);
      if (hoursSinceSave < 24) { // Only resume if saved within last 24 hours
        toast.info(`Found incomplete batch from ${Math.round(hoursSinceSave * 10) / 10} hours ago`);
        // TODO: Show dialog to ask user if they want to resume
      }
    }
  }
  
  // Only process folders with 'ready' status
  const readyFolders = folders.filter(f => f.batchProcessingState === 'ready');
  
  console.log('📋 Ready folders:', readyFolders.map(f => ({ 
    id: f.id, 
    path: f.folderPath, 
    fileCount: f.files?.length || 0,
    imageCount: f.imageCount,
    status: f.batchProcessingState 
  })));
  
  if (readyFolders.length === 0) {
    toast.error('No folders ready for processing');
    return;
  }
  
  // Initialize batch process state
  if (resumeFromState) {
    dispatch(resumeBatchProcess());
  } else {
    dispatch(startBatchProcess({ 
      folders: readyFolders, 
      processingMode: config.processingMode 
    }));
  }
  
  toast.success(`Starting batch processing of ${readyFolders.length} folders...`);
  
  console.log('🚀 Batch processing started with config:', {
    provider: config.provider,
    model: config.model,
    processingMode: config.processingMode,
    parallelWorkers: config.parallelWorkers,
    requestDelay: config.requestDelay,
    totalFolders: readyFolders.length,
  });
  
  try {
    // Process each folder
    const startFolderIndex = resumeFromState?.currentFolderIndex || 0;
    
    console.log(`📂 Starting from folder index: ${startFolderIndex}`);
    
    for (let folderIndex = startFolderIndex; folderIndex < readyFolders.length; folderIndex++) {
      if (!shouldContinue()) {
        console.log('⏸️ Batch processing paused by user');
        dispatch(pauseBatchProcess());
        saveBatchProgress(useBatchProcessStore.getState());
        toast.info('Batch processing paused. You can resume later.');
        return;
      }
      
      const folderInfo = readyFolders[folderIndex];
      const batchProcessState = useBatchProcessStore.getState();
      const folderState = batchProcessState.folders[folderIndex];
      
      if (!folderState) {
        console.error(`❌ Folder state not found for ${folderInfo.folderPath}`);
        continue;
      }
      
      // Update current folder index
      dispatch(setCurrentFolderIndex(folderIndex));
      dispatch(updateFolderStatus({ 
        folderId: folderInfo.id, 
        status: 'processing' 
      }));
      
      console.log(`📁 Processing folder ${folderIndex + 1}/${readyFolders.length}: ${folderInfo.folderPath}`);
      console.log(`📂 FolderInfo files count: ${folderInfo.files?.length || 0}`);
      console.log(`📂 folderState images count: ${folderState.images?.length || 0}`);
      
      // Stage 1: AI Generation
      dispatch(setCurrentStage('ai_generation'));
      
      // Calculate resume point for this folder
      const resumeImageIndex = resumeFromState?.folders[folderIndex]?.currentImageIndex || 0;
      
      console.log(`🔄 About to call processFolderSequential with resumeIndex: ${resumeImageIndex}`);
      
      try {
        console.log(`🎯 Starting ${config.processingMode} processing for folder...`);
        console.log(`📂 folderInfo.files count: ${folderInfo.files?.length || 0}`);
        console.log(`⚙️ Processing mode: ${config.processingMode}`);
        if (config.processingMode === 'parallel') {
          console.log(`🔧 Parallel workers: ${config.parallelWorkers}`);
        }
        
        // Use the appropriate processing function based on configuration
        if (config.processingMode === 'parallel') {
          console.log(`🚀 Using parallel processing with ${config.parallelWorkers} workers`);
          await processFolderParallel(
            folderState, 
            folderInfo, 
            filePathMap, 
            config, 
            config.parallelWorkers, 
            dispatch, 
            resumeImageIndex
          );
        } else {
          console.log(`🐌 Using sequential processing`);
          await processFolderSequential(
            folderState, 
            folderInfo, 
            filePathMap, 
            config, 
            dispatch, 
            resumeImageIndex
          );
        }
        
        console.log('✅ Folder processing completed');
      } catch (error) {
        console.error('❌ Error in folder processing:', error);
        throw error;
      }
      
      console.log(`✅ Finished processing folder: ${folderInfo.folderPath}`);
      
      // Check if we were cancelled during processing
      if (!shouldContinue()) {
        console.log('⏸️ Batch processing paused during folder processing');
        dispatch(pauseBatchProcess());
        saveBatchProgress(useBatchProcessStore.getState());
        toast.info('Batch processing paused. You can resume later.');
        return;
      }
      
      // Stage 2: Export
      if (savedExportPath) {
        dispatch(setCurrentStage('exporting'));
        
        const exportPath = await exportFolder(folderState, categories, exportPlatform, savedExportPath);
        
        if (exportPath) {
          dispatch(markFolderExported({
            folderId: folderInfo.id,
            exportedFilePath: exportPath,
          }));
        }
      }
      
      // Update folder status to completed
      dispatch(updateFolderStatus({ 
        folderId: folderInfo.id, 
        status: 'completed' 
      }));
      
      // Update the batchSlice folder status
      dispatch(updateFolder({
        id: folderInfo.id,
        updates: { batchProcessingState: 'completed' }
      }));
      
      console.log(`✅ Completed folder: ${folderInfo.folderPath}`);
      
      // Save progress after each folder
      saveBatchProgress(useBatchProcessStore.getState());
    }
    
    // Complete the batch process
    dispatch(completeBatchProcess());
    clearBatchProgress(); // Clear saved progress on successful completion
    
    const finalState = useBatchProcessStore.getState();
    toast.success(
      `Batch processing complete! ${finalState.completedImages} images processed, ${finalState.failedImages} failed.`
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Batch processing failed:', errorMessage);
    dispatch(failBatchProcess(errorMessage));
    saveBatchProgress(useBatchProcessStore.getState()); // Save progress even on error
    toast.error(`Batch processing failed: ${errorMessage}`);
  }
}

// Cancel ongoing batch processing
export function cancelBatchProcessing(): void {
  isCancelled = true;
  dispatch(pauseBatchProcess());
  saveBatchProgress(useBatchProcessStore.getState());
  toast.info('Batch processing cancelled. Progress saved.');
}

// Resume batch processing from saved state
export async function resumeBatchProcessing(
  folders: FolderInfo[],
  config: BatchConfig,
  filePathMap: Map<File, string>,
  categories: CategorySelection,
  exportPlatform: 'adobeStock' | 'shutterStock',
  savedExportPath: string | null
): Promise<void> {
  const savedProgress = loadBatchProgress();
  
  if (!savedProgress) {
    toast.error('No saved batch progress found to resume');
    return;
  }
  
  // Convert saved progress back to batch process state
  const restoredState: BatchProcessState = {
    isProcessing: true,
    overallStatus: 'paused',
    folders: savedProgress.folders,
    currentFolderIndex: savedProgress.currentFolderIndex,
    totalFolders: savedProgress.totalFolders,
    totalImages: savedProgress.totalImages,
    completedImages: savedProgress.completedImages,
    failedImages: savedProgress.failedImages,
    processingMode: savedProgress.processingMode,
    currentStage: null,
  };
  
  toast.success('Resuming batch processing from saved progress...');
  
  // Start processing with restored state
  await startBatchProcessing(
    folders,
    config,
    filePathMap,
    categories,
    exportPlatform,
    savedExportPath,
    restoredState
  );
}

// Reset and clear batch processing
export function resetBatchProcessing(): void {
  isCancelled = false;
  clearBatchProgress();
  dispatch(resetBatchProcess());
  toast.info('Batch processing reset');
}
