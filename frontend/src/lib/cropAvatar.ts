import type { Area } from 'react-easy-crop';

// Square output size for avatars (px). 512 is plenty for a profile photo and keeps uploads small.
const OUTPUT_SIZE = 512;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

// Crop the region react-easy-crop selected (croppedAreaPixels) and scale it onto a 512×512 canvas,
// returning a JPEG blob (q≈0.9). The source is a same-origin object URL (a local File) → the canvas
// is not tainted, so toBlob succeeds.
export async function getCroppedAvatarBlob(imageSrc: string, area: Area): Promise<Blob> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not crop image'))),
      'image/jpeg',
      0.9,
    );
  });
}
