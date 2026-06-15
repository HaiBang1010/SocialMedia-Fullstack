import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useMediaLightboxStore } from '@/stores/mediaLightboxStore';

// Full-screen viewer for a message's media (Phase 5.4a). A single instance is mounted in
// AppLayout, driven by mediaLightboxStore. Hand-rolled fixed overlay (mirrors StoryViewer) —
// locks body scroll, ESC closes, ←/→ + swipe navigate the carousel. Images use object-contain;
// videos get native <video controls>.
export default function MediaLightbox() {
  const { isOpen, media, index, setIndex, close } = useMediaLightboxStore();
  const touchStartX = useRef<number | null>(null);

  const count = media.length;
  const current = media[index];

  // Body-scroll lock + ESC / arrow-key navigation while open.
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') setIndex(Math.max(0, index - 1));
      else if (e.key === 'ArrowRight') setIndex(Math.min(count - 1, index + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, index, count, setIndex, close]);

  if (!isOpen || !current) return null;

  const goPrev = () => setIndex(Math.max(0, index - 1));
  const goNext = () => setIndex(Math.min(count - 1, index + 1));

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (dx > 50) goPrev();
    else if (dx < -50) goNext();
    touchStartX.current = null;
  };

  return (
    // Backdrop click closes; the media + controls stopPropagation.
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95"
      onClick={close}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="size-5" />
      </button>

      {count > 1 && (
        <span className="absolute left-3 top-4 z-10 text-sm font-medium text-white/80">
          {index + 1} / {count}
        </span>
      )}

      {count > 1 && index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Previous"
          className="absolute left-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <ChevronLeft className="size-6" />
        </button>
      )}
      {count > 1 && index < count - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Next"
          className="absolute right-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <ChevronRight className="size-6" />
        </button>
      )}

      <div className="flex max-h-full max-w-full items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        {current.type === 'VIDEO' ? (
          <video
            key={current.id}
            src={current.url}
            controls
            autoPlay
            className="max-h-[90vh] max-w-[92vw] rounded"
          />
        ) : (
          <img
            key={current.id}
            src={current.url}
            alt=""
            className="max-h-[90vh] max-w-[92vw] rounded object-contain"
          />
        )}
      </div>
    </div>
  );
}
