import { readFile } from '@tauri-apps/plugin-fs';

// Helper to get MIME type from file extension
export const getMimeType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const mimeTypes: Record<string, string> = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'svg': 'image/svg+xml',
    // Vector formats (rasterized server-side via Ghostscript)
    'ai': 'application/postscript',
    'eps': 'application/postscript',
    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'flv': 'video/x-flv',
    'wmv': 'video/x-ms-wmv',
    'm4v': 'video/x-m4v',
    '3gp': 'video/3gpp',
    'ogv': 'video/ogg',
    'mts': 'video/mp2t',
    'm2ts': 'video/mp2t',
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

// Convert a file path to a File object with proper MIME type
export const fileFromPath = async (path: string): Promise<File> => {
  const data = await readFile(path);
  // Handle both forward and backward slashes for cross-platform compatibility
  const name = path.split(/[/\\]/).pop() ?? "file";
  const mimeType = getMimeType(name);
  console.log(`🔍 fileFromPath: ${name} -> MIME type: ${mimeType}`);
  return new File([data], name, { type: mimeType });
};

// Configuration for virtualization
export const VIRTUALIZATION_CONFIG = {
  // Show this many items on each side of visible area
  BUFFER_SIZE: 20,
  // Thumbnail width including margins (approx)
  ITEM_WIDTH: 200,
  // Throttle scroll events (ms)
  SCROLL_THROTTLE: 100,
  // Start virtualizing when items exceed this count
  VIRTUALIZATION_THRESHOLD: 500,
  // Visible buffer for large lists
  VISIBLE_BUFFER: 100,
};
