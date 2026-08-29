/**
 * Browser-side video frame capture (fallback when no file path is available
 * or the Rust FFmpeg path fails).
 */

import { BATCH_CONFIG } from './config';

export function generateVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = false;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(file);

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      video.src = '';
      reject(new Error(`Timeout: ${file.name}`));
    }, 4000);

    video.onloadeddata = () => {
      video.currentTime = 0;
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const maxSize = BATCH_CONFIG.MAX_THUMBNAIL_SIZE;
        let width = video.videoWidth;
        let height = video.videoHeight;
        const scale = Math.min(maxSize / width, maxSize / height, 1);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });

        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          video.src = '';
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(video, 0, 0, width, height);
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.5);

        URL.revokeObjectURL(objectUrl);
        video.src = '';
        resolve(thumbnailUrl);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        video.src = '';
        reject(error);
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      video.src = '';
      reject(new Error('Failed to load video'));
    };

    video.src = objectUrl;
  });
}
