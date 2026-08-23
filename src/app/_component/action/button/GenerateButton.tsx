import { useEffect, useRef } from 'react';
import React from 'react';
import { Button } from "@/components/ui/button";
import { useSettings } from '@/app/contexts/SettingsContext';
import { generateMetadata } from '@/app/lib/ai';
import { beginGeneration, endGeneration } from '@/app/lib/generationControl';
import { CANCELLED_MESSAGE } from '@/app/lib/ai/api-client';
import { getActiveTemplate } from '@/app/lib/templateUtils';
import { embedMetadata } from '@/app/lib/tauri-commands';
import { matchCategories } from '@/app/lib/categoryMatcher';
import { TextShimmer } from '@/components/motion-primitives/text-shimmer';
import { Sparkle } from 'lucide-react';

const GenerateButtonComponent = () => {
  const { 
    files, 
    thumbnails, 
    api, 
    metadataLimits, 
    metadataOptions, 
    templateSettings,
    embedSettings,
    generated, 
    setHasAttemptedGeneration, 
    setSelectedFile, 
    generationProgress, 
    setGenerationProgress,
    getFilePath 
  } = useSettings();

  // Get active template
  const activeTemplate = getActiveTemplate(
    templateSettings.activeTemplateId,
    templateSettings.userTemplates,
    undefined,
    templateSettings.editedDefaultTemplates
  );
  const lastAutoSelectedIndexRef = useRef(-1);
  const cancelRequestedRef = useRef(false);
  const pendingSelectionRef = useRef<File | null>(null);
  const selectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isGenerating = generationProgress.isGenerating;
  
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

    try {
      // Get custom instruction for this specific file
      const customInstruction = generated.getCustomInstruction(item.file);
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
      generated.setMetadata(item.file, {
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
        generated.setFileCategories(item.file, categories);
      } catch (error) {
        console.error(`❌ Failed to generate categories for ${item.file.name}:`, error);
      }

      console.log(`✓ Generated metadata for ${item.file.name} (index ${index})`);
      console.log(`📊 Total generated items now:`, generated.items.length);

      // Embed metadata into file if enabled (skip SVG — use CSV export)
      if (item.file.type === 'image/svg+xml') {
        console.log(`ℹ️ Skipping metadata embedding for SVG file: ${item.file.name} (use CSV export)`);
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

  // Process items sequentially (current behavior)
  const processItemsSequential = async (items: any[], provider: any, model: string | undefined, apiKey: string, useLocalModel: boolean, localModelName: string | undefined, localApiUrl: string | undefined, signal?: AbortSignal) => {
    for (let i = 0; i < items.length; i++) {
      // Check if cancellation was requested
      if (signal?.aborted || cancelRequestedRef.current) {
        console.log('🛑 Generation cancelled by user');
        break;
      }

      await processSingleItem(items[i], i, items.length, provider, model, apiKey, useLocalModel, localModelName, localApiUrl, signal);

      // Apply delay before next request (except for last item)
      if (i < items.length - 1 && api.requestDelay > 0) {
        console.log(`⏱️ Waiting ${api.requestDelay}ms before next request...`);
        await new Promise(resolve => setTimeout(resolve, api.requestDelay));
      }
    }
  };

  // Process items in parallel (similar to batchFolder system)
  const processItemsParallel = async (items: any[], workers: number, provider: any, model: string | undefined, apiKey: string, useLocalModel: boolean, localModelName: string | undefined, localApiUrl: string | undefined, signal?: AbortSignal) => {
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
      
      await Promise.all(batchPromises);
      
      // Update progress to show batch completion
      setGenerationProgress({
        currentIndex: Math.min(i + workers, items.length),
        currentFileName: `Batch ${Math.floor(i / workers) + 1} completed`,
      });
      
      // Apply delay after each batch (except for last batch)
      if (i + workers < items.length && api.requestDelay > 0) {
        console.log(`⏱️ Waiting ${api.requestDelay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, api.requestDelay));
      }
    }
  };

  const handleGenerate = async () => {
    console.log('=== Generate Button Clicked ===');
    console.log('Files in context:', files.length);
    console.log('Thumbnails context:', thumbnails);
    console.log('Thumbnails.items length:', thumbnails.items?.length);
    console.log('Is generating thumbnails:', thumbnails.isGenerating);

    // Mark that user has attempted to generate metadata
    setHasAttemptedGeneration(true);

    if (thumbnails.isGenerating) {
      alert('Please wait for thumbnails to finish generating...');
      return;
    }

    if (isGenerating) {
      alert('Already generating metadata...');
      return;
    }

    if (!thumbnails.items || thumbnails.items.length === 0) {
      // nothing to generate from
      console.error('❌ No thumbnails to generate metadata for');
      console.log('Thumbnails.items:', thumbnails.items);
      alert('No thumbnails found. Please upload images/videos first.');
      return;
    }

    // Sort thumbnails by original file order
    // This ensures we process files in same order they appear in the UI
    const sortedItems = files
      .map(file => thumbnails.items.find(item => item.file === file))
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

  const buttonText = thumbnails.isGenerating
    ? 'Generate'
    : isGenerating
    ? <TextShimmer>Generating...</TextShimmer>
    : 'Generate';

  return (
    <Button
      onClick={handleGenerate}
      variant={"ghost"}
      disabled={thumbnails.isGenerating || isGenerating}
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