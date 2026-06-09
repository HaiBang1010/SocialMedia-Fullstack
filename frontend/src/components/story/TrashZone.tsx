import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrashZoneProps {
  visible: boolean; // shown only while an overlay is being dragged
  isNear: boolean; // highlighted when the dragged overlay is close enough to delete
}

// Bottom-center delete target in the editor. Purely a visual indicator
// (pointer-events-none) — useOverlayDrag does the hit-testing in normalized coords.
export default function TrashZone({ visible, isNear }: TrashZoneProps) {
  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-8 z-40 flex justify-center">
      <div
        className={cn(
          'grid size-16 place-items-center rounded-full text-white transition-all duration-150',
          isNear ? 'scale-125 bg-red-500' : 'bg-black/50',
        )}
      >
        <Trash2 className="size-6" />
      </div>
    </div>
  );
}
