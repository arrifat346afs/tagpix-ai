/**
 * Rust IPC wrappers (display path — return asset:// URLs).
 *
 * All wrappers share the module-level LRU cache; the heavy lifting (FFmpeg
 * decode + on-disk caching) happens on the Rust side.
 */

import { invoke, convertFileSrc } from '@tauri-apps/api/core';

import type { GeneratedPreviewResult, GeneratedThumbnailResult } from './types';
import { BATCH_CONFIG, PREVIEW_CONFIG, getCacheKey } from './config';
import { thumbnailCache } from './lruCache';

/**
 * Resolve a Rust IPC result to a displayable URL.
 *
 * Priority:
 *  1. `cache_path`  → convert to an `asset://` URL via `convertFileSrc`.
 *     WebKit loads the file directly from disk; the image data never enters
 *     the JS heap.
 *  2. `base64`      → construct a data-URL as a last resort (disk write
 *     failed on the Rust side).
 *  3. `null`        → generation failed entirely.
 */
export function resolveImageUrl(
  base64: string | null | undefined,
  cachePath: string | null | undefined,
  mimePrefix = 'data:image/jpeg;base64,',
): string | null {
  if (cachePath) {
    return convertFileSrc(cachePath);
  }
  if (base64) {
    return `${mimePrefix}${base64}`;
  }
  return null;
}

export async function generateVideoThumbnailRust(filePath: string, size: number = BATCH_CONFIG.MAX_THUMBNAIL_SIZE, signal?: AbortSignal): Promise<string | null> {
  if (signal?.aborted) return null;

  const cacheKey = `video_${filePath}_${size}`;
  if (thumbnailCache.has(cacheKey)) return thumbnailCache.get(cacheKey) ?? null;

  try {
    if (signal?.aborted) return null;

    const result = await invoke<GeneratedThumbnailResult>('generate_video_thumbnail_command', {
      filePath,
      size
    });

    if (signal?.aborted) return null;

    // Prefer the on-disk path; fall back to base64 only if the Rust side
    // could not persist the thumbnail (disk error).
    const thumbnail = resolveImageUrl(result.thumbnail_base64, result.cache_path);
    thumbnailCache.set(cacheKey, thumbnail);
    return thumbnail;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return null;
    console.warn('Video thumbnail generation failed:', error);
    thumbnailCache.set(cacheKey, null);
    return null;
  }
}

export async function generateVideoPreviewRust(filePath: string, size: number = PREVIEW_CONFIG.MAX_SIZE, signal?: AbortSignal): Promise<string | null> {
  if (signal?.aborted) return null;

  const cacheKey = `video_preview_${filePath}_${size}`;
  if (thumbnailCache.has(cacheKey)) return thumbnailCache.get(cacheKey) ?? null;

  try {
    if (signal?.aborted) return null;

    const result = await invoke<GeneratedPreviewResult>('generate_video_preview_command', {
      filePath,
      size
    });

    if (signal?.aborted) return null;

    const preview = resolveImageUrl(result.preview_base64, result.cache_path);
    thumbnailCache.set(cacheKey, preview);
    return preview;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return null;
    console.warn('Video preview generation failed:', error);
    thumbnailCache.set(cacheKey, null);
    return null;
  }
}

export async function generateThumbnailRust(filePath: string, size: number = 150): Promise<string | null> {
  const cacheKey = getCacheKey(filePath, size);
  if (thumbnailCache.has(cacheKey)) return thumbnailCache.get(cacheKey) ?? null;

  try {
    const result = await invoke<GeneratedThumbnailResult>('generate_thumbnail_command', {
      filePath,
      size
    });

    const thumbnail = resolveImageUrl(result.thumbnail_base64, result.cache_path);
    thumbnailCache.set(cacheKey, thumbnail);
    return thumbnail;
  } catch (error) {
    console.warn('Thumbnail generation failed:', error);
    thumbnailCache.set(cacheKey, null);
    return null;
  }
}
