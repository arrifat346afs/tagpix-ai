import { useEffect, useRef } from 'react';
import {
  useFileStore,
  setIsGeneratingThumbnails,
  upsertThumbnails,
} from '@/store/fileStore';
import { BATCH_CONFIG } from '@/app/lib/thumbnailGenerator';

/**
 * Automatically generates thumbnails for any loaded media files that don't
 * have one yet. Runs for the lifetime of the component it is mounted in
 * (call it once, in `Home`).
 *
 * This used to be a side effect inside the removed SettingsContext provider.
 */
export function useThumbnailAutoGeneration() {
  // Tracks how many concurrent thumbnail batches are still in flight.
  // isGenerating stays true until this reaches 0.
  const activeGenerationsRef = useRef(0);
  const isGeneratingRef = useRef(false);

  // Track files being processed to avoid duplicates
  const processingFilesRef = useRef<Set<File>>(new Set());

  const files = useFileStore((state) => state.files);

  useEffect(() => {
    // Read thumbnails/filePaths from the store directly to avoid stale closures
    const thumbnails = useFileStore.getState().thumbnails;
    const filePaths = useFileStore.getState().filePaths;

    if (!files || files.length === 0) {
      if (isGeneratingRef.current) {
        isGeneratingRef.current = false;
        setIsGeneratingThumbnails(false);
      }
      return;
    }

    // Filter files that don't have thumbnails AND are not currently being processed
    const existingThumbnailFiles = new Set(thumbnails.map((t) => t.file));

    const filesToGenerate = files.filter((file) => {
      const isMedia =
        file.type.startsWith('image/') || file.type.startsWith('video/');
      return (
        isMedia &&
        !existingThumbnailFiles.has(file) &&
        !processingFilesRef.current.has(file)
      );
    });

    if (filesToGenerate.length === 0) {
      return;
    }

    // Mark files as being processed IMMEDIATELY
    filesToGenerate.forEach((f) => processingFilesRef.current.add(f));

    // Increment active-batch counter. isGenerating stays true until it returns to 0.
    activeGenerationsRef.current += 1;
    const batchId = activeGenerationsRef.current;

    if (!isGeneratingRef.current) {
      isGeneratingRef.current = true;
      setIsGeneratingThumbnails(true);
    }

    console.log(
      `🚀 Starting generation of ${filesToGenerate.length} thumbnails (batch #${batchId})...`
    );

    // Don't await - run in background to keep UI responsive
    (async () => {
      try {
        const { generateThumbnailsBatch } = await import(
          '@/app/lib/thumbnailGenerator'
        );

        generateThumbnailsBatch(
          filesToGenerate,
          () => {}, // Progress callback
          (file, thumbnailUrl) => {
            // Upsert directly - thumbnails appear as they finish (no batching)
            upsertThumbnails([{ file, thumbnailUrl, previewUrl: null }]);
            processingFilesRef.current.delete(file);
          },
          BATCH_CONFIG.CONCURRENCY,
          filePaths
        );

        console.log(`✅ Completed batch #${batchId}`);
      } catch (error) {
        console.error('❌ Batch thumbnail generation failed:', error);
        filesToGenerate.forEach((f) => processingFilesRef.current.delete(f));
      } finally {
        // Decrement counter; only clear the loading flag when ALL batches are done
        activeGenerationsRef.current -= 1;
        if (activeGenerationsRef.current === 0) {
          isGeneratingRef.current = false;
          setIsGeneratingThumbnails(false);
        }
      }
    })();
  }, [files]); // Only depend on files
}
