import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  computeCropRect,
  cropToBlob,
  coverScale,
  maxOffset,
  outputTypeFor,
  type CropOffset,
  type CroppedImage,
} from '@/lib/cropImage';
import type { ImageDimensions } from '@/lib/image';

// Stories are full-bleed 9:16. The ratio is LOCKED — no picker (unlike the post
// CropStage). Reuses all the pure crop geometry from lib/cropImage.
const STORY_RATIO = 9 / 16; // 0.5625 (width / height)
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

interface StoryCropStageProps {
  file: File;
  dimensions: ImageDimensions;
  onBack: () => void;
  onComplete: (prepared: CroppedImage) => void;
}

// Step 2 (image flow) — pan + zoom the photo inside a fixed 9:16 viewport, then
// crop to a canvas (≤1080×1920). Mirrors CropStage minus the ratio controls.
export default function StoryCropStage({
  file,
  dimensions,
  onBack,
  onComplete,
}: StoryCropStageProps) {
  const { width: natW, height: natH } = dimensions;

  const [previewUrl, setPreviewUrl] = useState('');
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [busy, setBusy] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setVp({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clampOffset = (next: CropOffset, z: number): CropOffset => {
    if (!vp.w || !vp.h) return next;
    const max = maxOffset(natW, natH, vp.w, vp.h, z);
    return {
      x: Math.min(Math.max(next.x, -max.x), max.x),
      y: Math.min(Math.max(next.y, -max.y), max.y),
    };
  };

  useEffect(() => {
    setOffset((o) => clampOffset(o, zoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, vp.w, vp.h]);

  // Non-passive wheel listener so preventDefault actually blocks page scroll.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.001)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => clampOffset({ x: o.x + dx, y: o.y + dy }, zoom));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const handleComplete = async () => {
    const img = imgRef.current;
    if (!img || !vp.w || !vp.h) return;
    setBusy(true);
    try {
      if (!img.complete) await img.decode().catch(() => undefined);
      const rect = computeCropRect({
        natW,
        natH,
        ratio: STORY_RATIO,
        zoom,
        offset,
        viewportW: vp.w,
        viewportH: vp.h,
      });
      const prepared = await cropToBlob(img, rect, STORY_RATIO, outputTypeFor(file.type));
      onComplete(prepared);
    } finally {
      setBusy(false);
    }
  };

  const base = vp.w && vp.h ? coverScale(natW, natH, vp.w, vp.h) : 0;
  const dispW = natW * base * zoom;
  const dispH = natH * base * zoom;

  return (
    <div className="flex flex-col">
      {/* 9:16 crop viewport (height-driven so the tall portrait fits) */}
      <div className="flex items-center justify-center bg-black p-4">
        <div
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative aspect-[9/16] h-[60vh] touch-none cursor-grab overflow-hidden bg-muted active:cursor-grabbing"
        >
          {previewUrl && (
            <img
              ref={imgRef}
              src={previewUrl}
              alt=""
              draggable={false}
              className="absolute top-1/2 left-1/2 select-none"
              style={{
                width: dispW || undefined,
                height: dispH || undefined,
                maxWidth: 'none',
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <p className="text-center text-xs text-muted-foreground">
          Stories are shown full-screen (9:16)
        </p>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom"
          className="w-full accent-primary"
        />
      </div>

      <div className="flex justify-between gap-3 border-t p-4">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button onClick={handleComplete} disabled={busy || !base}>
          Share to story
        </Button>
      </div>
    </div>
  );
}
