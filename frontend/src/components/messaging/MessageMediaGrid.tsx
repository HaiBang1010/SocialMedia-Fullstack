import { cn } from '@/lib/utils';
import type { MessageMedia } from '@/types/api';
import MediaCell from './MediaCell';

interface MessageMediaGridProps {
  media: MessageMedia[];
  onOpen: (index: number) => void;
}

// Single-image aspect ratio, clamped so a very tall/wide photo doesn't make a giant bubble.
function singleAspect(m: MessageMedia): number {
  if (!m.width || !m.height) return 1;
  return Math.min(1.91, Math.max(0.6, m.width / m.height));
}

// IG-style adaptive layout for a message's 1..10 attachments (Phase 5.4a, D1):
//   1 → single (aspect-preserving)   2 → two squares   3 → one tall + two stacked
//   4 → 2×2   5+ → 2×2 of the first four, "+N" overlay on the 4th.
// gap-0.5 lets the page background show as thin seams between tiles.
export default function MessageMediaGrid({ media, onOpen }: MessageMediaGridProps) {
  const n = media.length;
  if (n === 0) return null;

  if (n === 1) {
    return (
      <div
        className="w-72 max-w-full overflow-hidden rounded-2xl"
        style={{ aspectRatio: String(singleAspect(media[0]!)) }}
      >
        <MediaCell media={media[0]!} onOpen={() => onOpen(0)} />
      </div>
    );
  }

  if (n === 2) {
    return (
      <div className="grid aspect-[2/1] w-72 max-w-full grid-cols-2 gap-0.5 overflow-hidden rounded-2xl">
        {media.map((m, i) => (
          <MediaCell key={m.id} media={m} onOpen={() => onOpen(i)} />
        ))}
      </div>
    );
  }

  if (n === 3) {
    return (
      <div className="grid aspect-square w-72 max-w-full grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl">
        <MediaCell media={media[0]!} onOpen={() => onOpen(0)} className="row-span-2" />
        <MediaCell media={media[1]!} onOpen={() => onOpen(1)} />
        <MediaCell media={media[2]!} onOpen={() => onOpen(2)} />
      </div>
    );
  }

  // 4+ → 2×2 of the first four; the 4th carries a "+N" overlay when there are more.
  const remaining = n - 4;
  return (
    <div className="grid aspect-square w-72 max-w-full grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl">
      {media.slice(0, 4).map((m, i) => (
        <div key={m.id} className="relative">
          <MediaCell media={m} onOpen={() => onOpen(i)} />
          {i === 3 && remaining > 0 && (
            <span
              className={cn(
                'pointer-events-none absolute inset-0 flex items-center justify-center',
                'bg-black/55 text-2xl font-semibold text-white',
              )}
            >
              +{remaining}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
