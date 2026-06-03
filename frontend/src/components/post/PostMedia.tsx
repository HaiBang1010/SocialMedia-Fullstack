import type { PostMedia as PostMediaItem } from '@/types/api';
import { clampAspectRatio } from '@/lib/format';
import { cn } from '@/lib/utils';

interface PostMediaProps {
  media: PostMediaItem[];
  alt?: string;
  className?: string;
}

// Renders a post's image. Phase 2 only produces a single image, so we show the
// first item. Aspect ratio is clamped (portrait 4:5 → landscape 1.91:1); when
// dimensions are missing we fall back to a square.
export default function PostMedia({ media, alt, className }: PostMediaProps) {
  const first = media[0];
  if (!first) return null;

  const ratio = clampAspectRatio(first.width, first.height);

  return (
    <div
      className={cn(
        'w-full overflow-hidden bg-muted',
        ratio == null && 'aspect-square',
        className,
      )}
      style={ratio != null ? { aspectRatio: ratio } : undefined}
    >
      <img
        src={first.url}
        alt={alt ?? ''}
        loading="lazy"
        className="size-full object-cover"
      />
    </div>
  );
}
