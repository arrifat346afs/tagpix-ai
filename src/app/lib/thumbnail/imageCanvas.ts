/**
 * Browser-based image decoding helpers.
 *
 * All display-facing thumbnails go through Canvas → data-URL here; the AI
 * path additionally materialises base64 data transiently (never cached).
 */

// Draw the (already-resized) bitmap onto a small canvas and encode to WebP.
// The bitmap arrives pre-scaled via createImageBitmap resizeWidth/resizeHeight
// hints, so the canvas is tiny (e.g. 120×80 px) and this step is very cheap.
// Note: OffscreenCanvas cannot produce a synchronous data-URL (only async
// convertToBlob), so we use the regular HTMLCanvasElement here.
export function resizeViaCanvas(bitmap: ImageBitmap, quality: number): string {
  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  (canvas.getContext('2d') as CanvasRenderingContext2D).drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL('image/webp', quality);
}

/**
 * Convert any URL (asset:// or data:) to a base64 data-URL suitable for
 * sending to a remote AI vision API.  This is the *only* place where image
 * data is materialised as a large JS string, and it is done transiently —
 * the result is used immediately and not stored in any cache.
 */
export async function assetUrlToDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function generateImageViaCanvas(file: File, maxSize: number, quality: number): Promise<string> {
  if (file.type === 'image/svg+xml') {
    return generateImageFallback(file, maxSize, quality);
  }

  try {
    const bitmap = await createImageBitmap(file, {
      resizeWidth: maxSize,
      resizeHeight: maxSize,
      resizeQuality: 'medium',
    });

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });

    if (!ctx) {
      bitmap.close();
      throw new Error('Failed to get canvas context');
    }

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return generateImageFallback(file, maxSize, quality);
  }
}

export function generateImageFallback(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      img.src = '';
      reject(new Error(`Timeout: ${file.name}`));
    }, 10000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });

        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        URL.revokeObjectURL(objectUrl);
        img.src = '';
        resolve(dataUrl);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        img.src = '';
        reject(error);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      img.src = '';
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}
