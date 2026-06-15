// Client-side image thumbnail generation for message attachments (Phase 5.4a, Q6).
// Each message image is uploaded as TWO objects: the original (untouched) for the lightbox,
// and a small JPEG thumbnail for the in-bubble grid. This mirrors how lib/video.ts extracts a
// poster for videos — same <canvas> approach, no extra dependency.

// Longest-edge ceiling for the thumbnail. Q6 targets a small (~40–70KB) thumbnail; 512 keeps
// grid cells crisp on retina while staying tiny. Tweak here if needed.
const THUMB_MAX_EDGE = 512;
const THUMB_QUALITY = 0.72;

// Draw `file` onto an offscreen canvas scaled so its longest edge ≤ THUMB_MAX_EDGE, then encode
// a JPEG Blob. Drawn from a local object URL (no CORS). Returns null when the image can't be
// decoded by an <img> (e.g. some AVIF) — the caller falls back to using the original as its own
// thumbnail. Up-scaling is avoided (small images keep their size).
export async function makeImageThumbnail(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) return null;

    const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(w, h));
    const outW = Math.max(1, Math.round(w * scale));
    const outH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, outW, outH);

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', THUMB_QUALITY),
    );
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = url;
  });
}
