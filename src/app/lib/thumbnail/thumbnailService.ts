/**
 * Thumbnail Service — public API orchestrator.
 *
 * Coordinates the Rust-backed pipeline (preferred, asset:// URLs) and the
 * browser Canvas fallback (used when no file path is available or the Rust
 * path fails). The bounded LRU cache is shared by every path.
 */

import { invoke } from '@tauri-apps/api/core';

import type { GeneratedPreviewResult } from './types';
import { BATCH_CONFIG, AI_IMAGE_CONFIG, PREVIEW_CONFIG, getCacheKey } from './config';
import { thumbnailCache } from './lruCache';
import { assetUrlToDataUrl, generateImageViaCanvas, resizeViaCanvas } from './imageCanvas';
import { resolveImageUrl, generateThumbnailRust, generateVideoThumbnailRust, generateVideoPreviewRust } from './rustBridge';
import { generateVideoThumbnail } from './videoThumbnail';
import { isVectorFile } from './vectorSupport';

// ---------------------------------------------------------------------------
// AI vision path (base64 data-URLs for remote providers)
// ---------------------------------------------------------------------------

/**
 * Generate an image for AI vision API consumption.
 *
 * The result is always a base64 `data:image/jpeg;base64,...` string because
 * remote AI providers (OpenAI, Google Gemini, OpenRouter) require inline
 * image data.  For display purposes you should use `generateImageThumbnail` /
 * `generatePreviewImage` instead — those return lighter `asset://` URLs.
 *
 * We obtain the thumbnail via the same Rust/LRU path (avoiding redundant
 * FFmpeg invocations) and then materialise the base64 data transiently via
 * `assetUrlToDataUrl`.  The large string is NOT stored in any cache.
 */
export async function generateAIImage(file: File, filePath?: string): Promise<string> {
  if (file.type.startsWith('video/') && filePath) {
    const videoThumb = await generateVideoThumbnailRust(filePath, AI_IMAGE_CONFIG.MAX_SIZE);
    if (videoThumb) {
      // The thumbnail is an asset:// URL — convert to base64 for the AI API.
      // This is transient: the result is used immediately and not cached.
      return assetUrlToDataUrl(videoThumb);
    }
    return generateVideoThumbnail(file);
  }
  // Vector formats (.ai/.eps) cannot be decoded by the browser — rasterize
  // through the Rust/Ghostscript backend and convert the asset:// URL to base64.
  if (isVectorFile(file)) {
    if (filePath) {
      const vectorThumb = await generateThumbnailRust(filePath, AI_IMAGE_CONFIG.MAX_SIZE);
      if (vectorThumb) {
        return assetUrlToDataUrl(vectorThumb);
      }
    }
    throw new Error(
      `Cannot rasterize vector file "${file.name}". ` +
      `Ensure Ghostscript is installed and the file was added via a file path.`
    );
  }
  // Canvas path already returns a data-URL.
  return generateImageViaCanvas(file, AI_IMAGE_CONFIG.MAX_SIZE, AI_IMAGE_CONFIG.JPEG_QUALITY);
}

// ---------------------------------------------------------------------------
// Preview path (larger display image)
// ---------------------------------------------------------------------------

export async function generatePreviewImage(file: File, filePath?: string, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) {
    throw new Error('Aborted');
  }

  if (filePath) {
    if (file.type.startsWith('video/')) {
      const preview = await generateVideoPreviewRust(filePath, PREVIEW_CONFIG.MAX_SIZE, signal);
      if (preview) return preview;
    } else {
      try {
        if (signal?.aborted) {
          throw new Error('Aborted');
        }

        const cacheKey = `preview_${filePath}_${PREVIEW_CONFIG.MAX_SIZE}`;
        if (thumbnailCache.has(cacheKey)) {
          return thumbnailCache.get(cacheKey) ?? '';
        }

        const result = await invoke<GeneratedPreviewResult>('generate_preview_command', {
          filePath,
          size: PREVIEW_CONFIG.MAX_SIZE
        });

        if (signal?.aborted) {
          throw new Error('Aborted');
        }

        const preview = resolveImageUrl(result.preview_base64, result.cache_path);
        if (preview) {
          thumbnailCache.set(cacheKey, preview);
          return preview;
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }
        console.warn('Preview generation failed:', error);
      }
    }
  }

  if (signal?.aborted) {
    throw new Error('Aborted');
  }

  if (file.type.startsWith('video/')) {
    return generateVideoThumbnail(file);
  }

  return generateImageViaCanvas(file, PREVIEW_CONFIG.MAX_SIZE, PREVIEW_CONFIG.JPEG_QUALITY);
}

// ---------------------------------------------------------------------------
// Image thumbnail path (browser Canvas)
// ---------------------------------------------------------------------------

export async function generateImageThumbnail(file: File, filePath?: string): Promise<string> {
  // Vector formats (.ai/.eps) must be rasterized by the Rust/Ghostscript backend.
  if (isVectorFile(file)) {
    if (!filePath) {
      throw new Error(`Vector file "${file.name}" cannot be rasterized without a file path.`);
    }
    const thumbnail = await generateThumbnailRust(filePath, BATCH_CONFIG.MAX_THUMBNAIL_SIZE);
    if (!thumbnail) {
      throw new Error(
        `Ghostscript rasterization failed for "${file.name}". Is Ghostscript installed?`
      );
    }
    return thumbnail;
  }

  // Fast path: pass the File (which IS a Blob) directly to createImageBitmap.
  // Using resizeWidth/resizeHeight hints lets the browser decode at the target
  // size — far cheaper than decoding full-resolution then scaling in JS.
  // This matches exactly what the bulk_image_processor HTML demo does.
  try {
    const size = BATCH_CONFIG.MAX_THUMBNAIL_SIZE;
    const bitmap = await createImageBitmap(file, {
      resizeWidth: size,
      resizeHeight: size,
      resizeQuality: 'pixelated', // fastest decode hint; quality is fine at 120 px
    });
    const thumbnail = resizeViaCanvas(bitmap, BATCH_CONFIG.JPEG_QUALITY);
    bitmap.close();
    return thumbnail;
  } catch (error) {
    console.warn(`Browser thumbnail failed for ${file.name}, falling back to Image+Canvas:`, error);
    return generateImageViaCanvas(file, BATCH_CONFIG.MAX_THUMBNAIL_SIZE, BATCH_CONFIG.JPEG_QUALITY);
  }
}

// ---------------------------------------------------------------------------
// Batch orchestration (bounded concurrency pool)
// ---------------------------------------------------------------------------

export async function generateThumbnailsBatch(
  files: File[],
  onProgress: (completed: number, total: number, fileName: string) => void = () => {},
  onThumbnailReady: (file: File, thumbnailUrl: string) => void = () => {},
  _concurrency: number = BATCH_CONFIG.CONCURRENCY,
  filePaths?: Map<File, string>
): Promise<Map<File, string>> {
  const results = new Map<File, string>();
  const total = files.length;
  let completed = 0;

  const CONCURRENCY = BATCH_CONFIG.CONCURRENCY;

  console.log(`📦 Starting thumbnail generation: ${files.length} files, concurrency=${CONCURRENCY}`);

  // Promise-based pool: no setInterval polling.
  // Each "slot" is a looping worker that pulls from the shared index until done.
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const idx = nextIndex++;
      if (idx >= files.length) break;

      const file = files[idx];
      const filePath = filePaths?.get(file);

      try {
        let thumbnail: string | null = null;

        if (file.type.startsWith('image/') || isVectorFile(file)) {
          thumbnail = await generateImageThumbnail(file, filePath);
        } else if (file.type.startsWith('video/')) {
          if (filePath) {
            try {
              thumbnail = await generateVideoThumbnailRust(filePath);
            } catch {
              thumbnail = await generateVideoThumbnail(file);
            }
          } else {
            thumbnail = await generateVideoThumbnail(file);
          }
        }

        if (thumbnail) {
          results.set(file, thumbnail);
          onThumbnailReady(file, thumbnail);
        }
      } catch (error) {
        console.error(`Failed thumbnail for ${file.name}:`, error);
      }

      completed++;
      onProgress(completed, total, file.name);
    }
  };

  // Spin up CONCURRENCY workers and await all of them.
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));

  console.log(`✅ Completed ${results.size}/${total} thumbnails`);
  return results;
}

// ---------------------------------------------------------------------------
// Cache accessors / preloading
// ---------------------------------------------------------------------------

export function getCachedThumbnail(filePath: string, size: number = BATCH_CONFIG.MAX_THUMBNAIL_SIZE): string | null {
  const cacheKey = getCacheKey(filePath, size);
  return thumbnailCache.get(cacheKey) ?? null;
}

export function hasCachedThumbnail(filePath: string, size: number = BATCH_CONFIG.MAX_THUMBNAIL_SIZE): boolean {
  const cacheKey = getCacheKey(filePath, size);
  const cached = thumbnailCache.get(cacheKey);
  return cached !== undefined && cached !== null;
}

export function preloadThumbnails(filePaths: string[]): void {
  for (const filePath of filePaths) {
    const cacheKey = getCacheKey(filePath, BATCH_CONFIG.MAX_THUMBNAIL_SIZE);
    if (!thumbnailCache.has(cacheKey)) {
      generateThumbnailRust(filePath, BATCH_CONFIG.MAX_THUMBNAIL_SIZE);
    }
  }
}
