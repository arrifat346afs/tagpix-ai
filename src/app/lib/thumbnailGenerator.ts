/**
 * Background Thumbnail Generator — backward-compatible facade.
 *
 * The implementation lives in `./thumbnail/`:
 * - `thumbnail/config.ts`      — shared configuration constants
 * - `thumbnail/lruCache.ts`    — bounded LRU cache + shared singleton
 * - `thumbnail/types.ts`       — Rust IPC result shapes (mirror thumbnail.rs)
 * - `thumbnail/imageCanvas.ts` — browser Canvas decode/resize helpers
 * - `thumbnail/rustBridge.ts`  — Rust IPC wrappers (asset:// display path)
 * - `thumbnail/videoThumbnail.ts` — browser <video> frame capture fallback
 * - `thumbnail/thumbnailService.ts` — public API orchestrator
 *
 * This file only re-exports the public API so existing imports of
 * `@/app/lib/thumbnailGenerator` keep working unchanged.
 */

export { BATCH_CONFIG } from './thumbnail/config';
export { generateVideoThumbnail } from './thumbnail/videoThumbnail';

export {
  generateAIImage,
  generateImageThumbnail,
  generatePreviewImage,
  generateThumbnailsBatch,
  getCachedThumbnail,
  hasCachedThumbnail,
  preloadThumbnails,
} from './thumbnail/thumbnailService';
