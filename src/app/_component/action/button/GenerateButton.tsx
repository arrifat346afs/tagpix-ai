import { useEffect, useRef } from 'react';
import React from 'react';
import { Button } from "@/components/ui/button";
import { useFileStore, setSelectedFile, getFilePath } from '@/store/fileStore';
import { useUiStore, setGenerationProgress, setHasAttemptedGeneration } from '@/store/uiStore';
import { useConfigStore } from '@/store/configStore';
import { useTemplateStore } from '@/store/templateStore';
import {
  useMetadataStore,
  updateFileMetadata,
  updateFileCategories,
  getMetadata,
  getCustomInstruction,
} from '@/store/metadataStore';
import { generateMetadata } from '@/app/lib/ai';
import { beginGeneration, endGeneration } from '@/app/lib/generation/generationControl';
import { CANCELLED_MESSAGE } from '@/app/lib/ai/api-client';
import { getActiveTemplate } from '@/app/lib/metadata/templateUtils';
import { embedMetadata } from '@/app/lib/tauri/tauri-commands';
import { matchCategories } from '@/app/lib/metadata/categoryMatcher';
import { TextShimmer } from '@/components/motion-primitives/text-shimmer';
import { Sparkle } from 'lucide-react';

const GenerateButtonComponent = () => {
  // State (reactive zustand selectors)
  const files = useFileStore((state) => state.files);
  const thumbnails = useFileStore((state) => state.thumbnails);
  const isGeneratingThumbnails = useFileStore((state) => state.isGeneratingThumbnails);
  const api = useConfigStore((state) => state.api);
  const metadataLimits = useConfigStore((state) => state.metadataLimits);
  const metadataOptions = useConfigStore((state) => state.metadataOptions);
  const embedSettings = useConfigStore((state) => state.embedSettings);
  const activeTemplateId = useTemplateStore((state) => state.activeTemplateId);
  const userTemplates = useTemplateStore((state) => state.userTemplates);
  const editedDefaultTemplates = useTemplateStore((state) => state.editedDefaultTemplates);
  const generatedMetadata = useMetadataStore((state) => state.generatedMetadata);
  const generationProgress = useUiStore((state) => state.generationProgress);

  // Get active template
  const activeTemplate = getActiveTemplate(
    activeTemplateId,
    userTemplates,
    undefined,
    editedDefaultTemplates
  );
  const lastAutoSelectedIndexRef = useRef(-1);
  const cancelRequestedRef = useRef(false);
  const pendingSelectionRef = useRef<File | null>(null);
  const selectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isGenerating = generationProgress.isGenerating;
  
  // Helper to check if a file already has complete metadata (title, description AND keywords all non-empty)
  // Files with partial metadata are NOT skipped — generation produces all three fields together
  const hasCompleteMetadata = (file: File) => {
    const metadata = getMetadata(file);
    return (
      !!metadata &&
      !!metadata.title?.trim() &&
      !!metadata.description?.trim() &&
      !!metadata.keywords?.trim()
    );
  };

  // Helper function to debounce file selection to avoid blocking during metadata updates
  const scheduleFileSelection = (file: File) => {
    // Store file to select
    pendingSelectionRef.current = file;
    
    // Clear any pending selection timeout
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }
    
    // Schedule selection with minimal delay (10ms instead of 50ms) to be more responsive
    // This prevents selection animation from blocking metadata state updates
    selectionTimeoutRef.current = setTimeout(() => {
      if (pendingSelectionRef.current) {
        setSelectedFile(pendingSelectionRef.current);
        pendingSelectionRef.current = null;
      }
    }, 10);
  };

  // Reset auto-selection tracking and cancel flag when generation stops
  useEffect(() => {
    if (!isGenerating) {
      lastAutoSelectedIndexRef.current = -1;
      cancelRequestedRef.current = false;
      // Clean up pending selection on generation stop
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
        selectionTimeoutRef.current = null;
      }
    }
  }, [isGenerating]);

  // Sync the ref with state when cancelRequested changes
  useEffect(() => {
    if (generationProgress.cancelRequested) {
      cancelRequestedRef.current = true;
    }
  }, [generationProgress.cancelRequested]);

  // Process a single item with all logic (metadata generation, embedding, etc.)
  const processSingleItem = async (item: any, index: number, total: number, provider: any, model: string | undefined, apiKey: string, useLocalModel: boolean, localModelName: string | undefined, localApiUrl: string | undefined, signal?: AbortSignal) => {
    // Update progress for this item
    setGenerationProgress({
      currentIndex: index + 1,
      currentFileName: item.file.name,
    });
    console.log(`Generating metadata for file ${index + 1}/${total}: ${item.file.name}`);

    // Skip files that already have complete metadata (e.g. from a previous run or embedded EXIF)
    // No API call is made — processing moves straight to the next file
    if (hasCompleteMetadata(item.file)) {
      console.log(`⏭️ Skipping ${item.file.name} (index ${index}) — complete metadata already exists`);
      return { success: true, skipped: true };
    }

    try {
      // Get custom instruction for this specific file
      const customInstruction = getCustomInstruction(item.file);
      const filePath = getFilePath(item.file);

      const result = await generateMetadata({
        file: item.file,
        filePath: filePath,
        fileNames: [item.file.name],
        provider,
        model,
        apiKey,
        useLocalModel,
        localModelName,
        localApiUrl,
        signal,
        limits: {
          titleLimit: metadataLimits.titleLimit,
          descriptionLimit: metadataLimits.descriptionLimit,
          keywordLimit: metadataLimits.keywordLimit,
        },
        includePlaceName: metadataOptions.includePlaceName,
        customTemplate: activeTemplate || undefined,
        customInstruction: customInstruction,
        avoidWords: {
          titleAvoidWords: metadataOptions.titleAvoidWords,
          keywordsAvoidWords: metadataOptions.keywordsAvoidWords,
          descriptionAvoidWords: metadataOptions.descriptionAvoidWords,
        },
      });

      // Store metadata for this specific file
      console.log(`📝 Setting metadata for file at index ${index}:`, item.file.name);
      updateFileMetadata(item.file, {
        title: result.title,
        description: result.description,
        keywords: result.keywords,
      });

      // Auto-generate categories based on generated metadata (always enabled, independent of auto-select)
      try {
        console.log(`🏷️ Auto-generating categories for ${item.file.name}...`);
        const categories = matchCategories(
          result.title,
          result.keywords,
          result.description
        );
        
        console.log(`📊 Generated categories for ${item.file.name}:`, categories);
        updateFileCategories(item.file, categories);
      } catch (error) {
        console.error(`❌ Failed to generate categories for ${item.file.name}:`, error);
      }

      console.log(`✓ Generated metadata for ${item.file.name} (index ${index})`);
      console.log(`📊 Total generated items now:`, generatedMetadata.length);

      // Embed metadata into file if enabled (skip SVG & vector formats — use CSV export)
      const isVectorFile = item.file.type === 'application/postscript' || /\.(ai|eps)$/i.test(item.file.name);
      if (item.file.type === 'image/svg+xml') {
        console.log(`ℹ️ Skipping metadata embedding for SVG file: ${item.file.name} (use CSV export)`);
      } else if (isVectorFile) {
        console.log(`ℹ️ Skipping metadata embedding for vector file: ${item.file.name} (use CSV export)`);
      } else if (embedSettings.enabled) {
        const filePath = getFilePath(item.file);
        if (filePath) {
          try {
            console.log(`🔧 Embedding metadata for ${item.file.name}...`);
            
            const embedRequest = {
              file_path: filePath,
              title: embedSettings.fields.title ? result.title : undefined,
              description: embedSettings.fields.description ? result.description : undefined,
              keywords: embedSettings.fields.keywords ? result.keywords : undefined,
            };

            const embedResult = await embedMetadata(embedRequest);
            
            if (embedResult.success) {
              console.log(`✅ Successfully embedded metadata for ${item.file.name}: ${embedResult.message}`);
            } else {
              console.warn(`⚠️ Failed to embed metadata for ${item.file.name}: ${embedResult.message}`);
            }
          } catch (error) {
            console.error(`❌ Error embedding metadata for ${item.file.name}:`, error);
          }
        } else {
          console.warn(`⚠️ No file path found for ${item.file.name}, skipping metadata embedding`);
        }
      } else {
        console.log(`⏭️ Metadata embedding disabled, skipping for ${item.file.name}`);
      }

      // Auto-select this file (debounced to avoid blocking metadata updates)
      if (metadataOptions.autoSelectGenerated) {
        console.log(`🎯 Scheduling file selection at index ${index}:`, item.file.name);
        scheduleFileSelection(item.file);
        lastAutoSelectedIndexRef.current = index;
      }

      return { success: true, result };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message === CANCELLED_MESSAGE) {
        console.log(`🛑 Cancelled while generating ${item.file.name}`);
      } else {
        console.error(`❌ Failed to generate metadata for ${item.file.name}:`, error);
      }

      // Don't store error messages as metadata - just log the error
      // The thumbnail will show a red border indicating generation was attempted but failed

      // Auto-select this file even on error so user can see which file failed (debounced)
      if (metadataOptions.autoSelectGenerated) {
        console.log(`🎯 Scheduling file selection at index ${index} (error case):`, item.file.name);
        scheduleFileSelection(item.file);
        lastAutoSelectedIndexRef.current = index;
      }

      return { success: false, error };
    }
  };

  // Resolve early when the signal aborts so cancellation isn't stuck waiting out the delay
  const delayWithSignal = (ms: number, signal?: AbortSignal) =>
    new Promise<void>((resolve) => {
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort);
    });

  // Process items sequentially (current behavior)
  const processItemsSequential = async (items: any[], provider: any, model: string | undefined, apiKey: string, useLocalModel: boolean, localModelName: string | undefined, localApiUrl: string | undefined, signal?: AbortSignal) => {
    let skippedCount = 0;

    for (let i = 0; i < items.length; i++) {
      // Check if cancellation was requested
      if (signal?.aborted || cancelRequestedRef.current) {
        console.log('🛑 Generation cancelled by user');
        break;
      }

      const result = await processSingleItem(items[i], i, items.length, provider, model, apiKey, useLocalModel, localModelName, localApiUrl, signal);
      const wasSkipped = 'skipped' in result && result.skipped;
      if (wasSkipped) skippedCount++;

      // Apply delay before next request (except for last item, and skip it
      // entirely when the item was skipped since no API request was made)
      if (!wasSkipped && i < items.length - 1 && api.requestDelay > 0) {
        console.log(`⏱️ Waiting ${api.requestDelay}ms before next request...`);
        await delayWithSignal(api.requestDelay, signal);
      }
    }

    if (skippedCount > 0) {
      console.log(`⏭️ ${skippedCount} of ${items.length} files skipped (complete metadata already exists)`);
    }
  };

  // Process items in parallel (similar to batchFolder system)
  const processItemsParallel = async (items: any[], workers: number, provider: any, model: string | undefined, apiKey: string, useLocalModel: boolean, localModelName: string | undefined, localApiUrl: string | undefined, signal?: AbortSignal) => {
    let skippedCount = 0;

    // Process items in batches starting from the beginning
    for (let i = 0; i < items.length; i += workers) {
      // Check if cancellation was requested
      if (signal?.aborted || cancelRequestedRef.current) {
        console.log('🛑 Parallel processing cancelled by user');
        break;
      }

      const batch = items.slice(i, i + workers);
      
      // Process batch concurrently
      const batchPromises = batch.map(async (item) => {
        if (!signal?.aborted && !cancelRequestedRef.current) {
          const itemIndex = i + items.indexOf(item);
          return processSingleItem(item, itemIndex, items.length, provider, model, apiKey, useLocalModel, localModelName, localApiUrl, signal);
        }
        return { success: false, error: 'Cancelled' };
      });
      
      const batchResults = await Promise.all(batchPromises);
      skippedCount += batchResults.filter((r) => 'skipped' in r && r.skipped).length;
      
      // Update progress to show batch completion
      setGenerationProgress({
        currentIndex: Math.min(i + workers, items.length),
        currentFileName: `Batch ${Math.floor(i / workers) + 1} completed`,
      });
      
      // Apply delay after each batch (except for last batch)
      if (i + workers < items.length && api.requestDelay > 0) {
        console.log(`⏱️ Waiting ${api.requestDelay}ms before next batch...`);
        await delayWithSignal(api.requestDelay, signal);
      }
    }

    if (skippedCount > 0) {
      console.log(`⏭️ ${skippedCount} of ${items.length} files skipped (complete metadata already exists)`);
    }
  };

  const handleGenerate = async () => {
    console.log('=== Generate Button Clicked ===');
    console.log('Files in context:', files.length);
    console.log('Thumbnails context:', thumbnails);
    console.log('Thumbnails length:', thumbnails?.length);
    console.log('Is generating thumbnails:', isGeneratingThumbnails);

    // Mark that user has attempted to generate metadata
    setHasAttemptedGeneration(true);

    if (isGeneratingThumbnails) {
      alert('Please wait for thumbnails to finish generating...');
      return;
    }

    if (isGenerating) {
      alert('Already generating metadata...');
      return;
    }

    if (!thumbnails || thumbnails.length === 0) {
      // nothing to generate from
      console.error('❌ No thumbnails to generate metadata for');
      console.log('Thumbnails:', thumbnails);
      alert('No thumbnails found. Please upload images/videos first.');
      return;
    }

    // Sort thumbnails by original file order
    // This ensures we process files in same order they appear in the UI
    const sortedItems = files
      .map(file => thumbnails.find(item => item.file === file))
      .filter((item): item is NonNullable<typeof item> => item !== undefined);

    console.log('📋 Original files order:', files.map(f => f.name));
    console.log('📋 Sorted thumbnails order:', sortedItems.map(item => item.file.name));

    const items = sortedItems;
    const processingMode = api.processingMode;
    const parallelWorkers = api.parallelWorkers;

    console.log(`📋 Processing ${items.length} files in ${processingMode} mode`);
    if (processingMode === 'parallel') {
      console.log(`🔧 Using ${parallelWorkers} parallel workers`);
    }

    const model = api.selectedModel || undefined;
    const provider = api.selectedProvider || undefined;
    const apiKey = provider ? api.apiKeys[provider]! : undefined;
    const useLocalModel = api.useLocalModel;
    const localModelName = api.localModelName || undefined;
    const localApiUrl = api.localApiUrl || undefined;

    console.log('Provider:', provider);
    console.log('Model:', model);
    console.log('Use Local Model:', useLocalModel);
    console.log('Local Model Name:', localModelName);
    console.log('Local API URL:', localApiUrl);
    console.log('API Key exists:', !!apiKey);

    if (!useLocalModel && !apiKey) {
      console.error('No API key configured for provider:', provider);
      alert('Please configure your API key in Settings');
      return;
    }

    if (useLocalModel && !localModelName) {
      console.error('No local model selected');
      alert('Please select a local model in Settings');
      return;
    }

    if (useLocalModel && !localApiUrl) {
      console.error('No local API URL configured');
      alert('Please set your local AI server URL in Settings');
      return;
    }

    setGenerationProgress({
      isGenerating: true,
      currentIndex: 0,
      currentFileName: '',
      totalFiles: items.length,
      cancelRequested: false,
    });
    console.log(`✓ Starting metadata generation for ${items.length} files...`);
    console.log(`⏱️ Request delay: ${api.requestDelay}ms`);
    console.log(`🎯 Processing mode: ${processingMode}`);

    // Enable mid-request cancellation via the Cancel button
    const signal = beginGeneration();

    // Process items based on selected mode; always tear down generation state
    try {
      if (processingMode === 'parallel') {
        await processItemsParallel(items, parallelWorkers, provider, model, apiKey!, useLocalModel, localModelName, localApiUrl, signal);
      } else {
        await processItemsSequential(items, provider, model, apiKey!, useLocalModel, localModelName, localApiUrl, signal);
      }
    } finally {
      endGeneration();

      const wasCancelled = generationProgress.cancelRequested;
      console.log(wasCancelled ? '🛑 Metadata generation cancelled!' : '✅ Metadata generation complete for all files!');
      setGenerationProgress({
        isGenerating: false,
        currentIndex: 0,
        currentFileName: '',
        totalFiles: 0,
        cancelRequested: false,
      });
    }
  };

  const buttonText = isGeneratingThumbnails
    ? 'Generate'
    : isGenerating
    ? <TextShimmer>Generating...</TextShimmer>
    : 'Generate';

  return (
    <Button
      onClick={handleGenerate}
      variant={"ghost"}
      disabled={isGeneratingThumbnails || isGenerating}
      className="gap-2 group h-full max-h-10 min-h-8 2xl:w-30 2xl:max-h-13 2xl:text-sm"
    >
      <Sparkle
        className={`h-4 w-4 transition-all ${
          isGenerating
            ? 'animate-spin'
            : 'group-hover:scale-110 group-hover:rotate-12'
        }`}
      />
      {buttonText}
    </Button>
  );
};

export const GenerateButton = React.memo(GenerateButtonComponent);