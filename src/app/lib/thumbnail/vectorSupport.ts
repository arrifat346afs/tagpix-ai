/**
 * Vector format support (.ai / .eps).
 *
 * These formats cannot be decoded by the browser or by the `image` crate on
 * the Rust side — they are rasterized via Ghostscript in the Tauri backend
 * (see `src-tauri/src/services/vector.rs`). The frontend only needs to accept
 * the formats and route them through the Rust thumbnail path instead of the
 * browser Canvas fallback.
 */

/** File extensions handled by the Ghostscript rasterization backend. */
export const VECTOR_EXTENSIONS = ['ai', 'eps'] as const;

/** Shared MIME type for AI/EPS files (PostScript family). */
export const VECTOR_MIME_TYPE = 'application/postscript';

/** Returns the lowercase vector extension of `filename`, or null. */
export function getVectorExtension(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return (VECTOR_EXTENSIONS as readonly string[]).includes(ext) ? ext : null;
}

/** Returns true when `filename` is an .ai or .eps file. */
export function isVectorFilename(filename: string): boolean {
  return getVectorExtension(filename) !== null;
}

/** Returns true when `file` is an .ai or .eps file (by MIME type or extension). */
export function isVectorFile(file: File): boolean {
  return file.type === VECTOR_MIME_TYPE || isVectorFilename(file.name);
}
