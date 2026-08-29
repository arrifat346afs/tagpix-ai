/**
 * IPC result shapes (must mirror src-tauri/src/services/thumbnail.rs)
 */

export interface GeneratedThumbnailResult {
  /** Populated only when the thumbnail could not be saved to disk. Prefer cache_path. */
  thumbnail_base64: string | null;
  /** Absolute path to the JPEG inside the app's on-disk thumbnail cache. */
  cache_path: string | null;
  width: number | null;
  height: number | null;
  file_size: string | null;
  from_cache: boolean;
}

export interface GeneratedPreviewResult {
  /** Populated only when the preview could not be saved to disk. Prefer cache_path. */
  preview_base64: string | null;
  /** Absolute path to the JPEG inside the app's on-disk thumbnail cache. */
  cache_path: string | null;
  width: number | null;
  height: number | null;
  from_cache: boolean;
}
