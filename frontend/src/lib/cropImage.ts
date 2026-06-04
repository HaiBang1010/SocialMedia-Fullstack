// Pure crop geometry + canvas export for the post composer. No React here.
//
// Display model: the source image is laid over a fixed-aspect viewport using a
// "cover" base scale (fills the viewport with no gaps at zoom 1), then scaled by
// `zoom` and translated by `offset` (in viewport px). Cropping inverts that map:
// the visible viewport corresponds to a rectangle in source-image pixels.

import type { AcceptedMime } from './image';

// Longest output WIDTH — keeps blobs small while staying sharp on feed/detail.
// For our 3 ratios this yields ≤1080×1350 (IG-equivalent) and never upscales.
const MAX_OUTPUT_WIDTH = 1080;

export interface CropOffset {
  x: number;
  y: number;
}

export interface CropViewport {
  natW: number; // source natural width
  natH: number; // source natural height
  ratio: number; // target aspect ratio (width / height)
  zoom: number; // >= 1
  offset: CropOffset; // image translation in viewport px
  viewportW: number; // measured viewport size in px
  viewportH: number;
}

export interface CropRect {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
}

export interface CroppedImage {
  blob: Blob;
  width: number;
  height: number;
  contentType: AcceptedMime;
}

// "Cover" base scale: the image fills the viewport at zoom 1 with no gaps.
export function coverScale(
  natW: number,
  natH: number,
  vpW: number,
  vpH: number,
): number {
  return Math.max(vpW / natW, vpH / natH);
}

// Largest |offset| (per axis) that still keeps the image covering the viewport.
// The component clamps dragging to this so no background ever shows through.
export function maxOffset(
  natW: number,
  natH: number,
  vpW: number,
  vpH: number,
  zoom: number,
): CropOffset {
  const scale = coverScale(natW, natH, vpW, vpH) * zoom;
  return {
    x: Math.max(0, (natW * scale - vpW) / 2),
    y: Math.max(0, (natH * scale - vpH) / 2),
  };
}

// Map the visible viewport back to a rectangle in source-image pixels.
export function computeCropRect(v: CropViewport): CropRect {
  const scale = coverScale(v.natW, v.natH, v.viewportW, v.viewportH) * v.zoom;
  const sWidth = v.viewportW / scale;
  const sHeight = v.viewportH / scale;

  let sx = (v.natW - sWidth) / 2 - v.offset.x / scale;
  let sy = (v.natH - sHeight) / 2 - v.offset.y / scale;

  // Guard against float drift pushing the rect past the image edges.
  sx = Math.min(Math.max(sx, 0), Math.max(0, v.natW - sWidth));
  sy = Math.min(Math.max(sy, 0), Math.max(0, v.natH - sHeight));

  return { sx, sy, sWidth, sHeight };
}

// Croppable source → output MIME. WebP stays WebP (good compression + alpha);
// everything else flattens to JPEG (PNG alpha is irrelevant for photo posts and
// JPEG is smaller). GIF/AVIF never reach here — they take the passthrough path.
export function outputTypeFor(sourceType: string): AcceptedMime {
  return sourceType === 'image/webp' ? 'image/webp' : 'image/jpeg';
}

// Draw the crop rect onto a canvas sized to the target ratio, then encode.
// Returns the encoded blob plus the final pixel dimensions — these are what we
// send as media[].width/height so the feed renders the right aspect ratio.
export async function cropToBlob(
  image: CanvasImageSource,
  rect: CropRect,
  ratio: number,
  outputType: AcceptedMime,
): Promise<CroppedImage> {
  const outWidth = Math.min(Math.round(rect.sWidth), MAX_OUTPUT_WIDTH);
  const outHeight = Math.max(1, Math.round(outWidth / ratio));

  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    rect.sx,
    rect.sy,
    rect.sWidth,
    rect.sHeight,
    0,
    0,
    outWidth,
    outHeight,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, outputType, 0.9),
  );
  if (!blob) throw new Error('Failed to encode cropped image');

  return { blob, width: outWidth, height: outHeight, contentType: outputType };
}
