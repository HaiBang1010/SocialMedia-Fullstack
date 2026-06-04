// Client-side media validation + dimension probing for the post composer.
// Validation mirrors the backend contract EXACTLY (backend/.../media.schema.ts):
// 5 MIME types, 10MB cap. We reject before requesting a presigned URL so an
// invalid file never costs an API round-trip.

// Accepted upload MIME types — must stay in sync with the backend enum.
export const ACCEPTED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

export type AcceptedMime = (typeof ACCEPTED_MIME)[number];

// `accept` attribute value for the file <input> (extensions + MIME).
export const ACCEPT_ATTR = ACCEPTED_MIME.join(',');

// Types we re-encode through a <canvas> when cropping (lossy is acceptable).
export const CROPPABLE_MIME = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

// Types we must upload untouched: a canvas re-encode would drop GIF animation
// and is unreliable for AVIF. We still measure their dimensions.
export const PASSTHROUGH_MIME = new Set<string>(['image/gif', 'image/avif']);

// 10 MB, matching the backend `size` cap.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ACCEPTED_SET = new Set<string>(ACCEPTED_MIME);

// Returns an English error message when the file is not a valid upload, or null
// when it passes. Run this in the picker BEFORE any presign call.
export function validateMediaFile(file: File): string | null {
  if (!ACCEPTED_SET.has(file.type)) {
    return 'Unsupported file type. Use JPEG, PNG, WebP, GIF, or AVIF.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'File is too large (max 10MB).';
  }
  return null;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

// Measure a raster image's intrinsic size. Prefers createImageBitmap (fast, no
// DOM), falling back to an <img> + object URL when it is unavailable or the
// format (e.g. some AVIF) cannot be decoded by createImageBitmap.
export async function getImageDimensions(file: File): Promise<ImageDimensions> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const dims = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dims;
    } catch {
      // fall through to the <img> path
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<ImageDimensions>((resolve, reject) => {
      const img = new Image();
      img.onload = () =>
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Could not read image dimensions'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
