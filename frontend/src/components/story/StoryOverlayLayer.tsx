import { cn } from '@/lib/utils';
import StoryOverlay from './StoryOverlay';
import type { StoryItem } from '@/types/api';

interface StoryOverlayLayerProps {
  items?: StoryItem[];
  className?: string;
}

// Read-only overlay layer for the viewer. pointer-events-none so taps / holds / swipes
// fall straight through to the gesture layer below it. Renders nothing for 4.1/4.2 stories
// (no items) — keeps the viewer backward-compatible.
export default function StoryOverlayLayer({ items, className }: StoryOverlayLayerProps) {
  if (!items || items.length === 0) return null;
  return (
    <div className={cn('pointer-events-none absolute inset-0', className)}>
      {items.map((item) => (
        <StoryOverlay key={item.id} item={item} editable={false} />
      ))}
    </div>
  );
}
