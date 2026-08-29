/**
 * Shared configuration for the thumbnail generation pipelines.
 */

export const BATCH_CONFIG = {
  // Raised from 6 → 12: createImageBitmap is mostly I/O + GPU decode so more
  // concurrent tasks keep the pipeline saturated without starving the main thread.
  CONCURRENCY: 12,
  MAX_THUMBNAIL_SIZE: 120,
  JPEG_QUALITY: 0.82,
};

export const AI_IMAGE_CONFIG = {
  MAX_SIZE: 480,
  JPEG_QUALITY: 0.6,
};

export const PREVIEW_CONFIG = {
  MAX_SIZE: 600,
  JPEG_QUALITY: 0.8,
};

export function getCacheKey(filePath: string, size: number): string {
  return `${filePath}_${size}`;
}
