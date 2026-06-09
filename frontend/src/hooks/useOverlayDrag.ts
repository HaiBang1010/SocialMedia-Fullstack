import { useRef, useState } from 'react';
import type { StoryItem } from '@/types/api';

// Trash target position (content-zone normalized) + how close a drop counts as a delete.
const TRASH_CENTER = { x: 0.5, y: 0.9 };
const TRASH_RADIUS = 0.12;
const TAP_THRESHOLD = 5; // px below which a press is a tap (toggle select), not a drag

interface UseOverlayDragOptions {
  contentRef: React.RefObject<HTMLDivElement>;
  onDrag: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number, inTrash: boolean) => void;
  onSelect: (id: string) => void;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Drag overlays inside the editor. ONE hook owns the active drag (a single pointer at a
// time), so it's called once and hands each overlay its handlers via getHandlers(item) —
// calling a hook per item in a map would violate the rules of hooks. Reuses CropStage's
// setPointerCapture idiom; px deltas are normalized against the content-zone rect. The
// trash hit is recomputed from the final position (ref, not state) to avoid a stale read.
export function useOverlayDrag({ contentRef, onDrag, onDragEnd, onSelect }: UseOverlayDragOptions) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isNearTrash, setIsNearTrash] = useState(false);
  const active = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    moved: boolean;
  } | null>(null);

  const inTrash = (x: number, y: number) =>
    Math.hypot(x - TRASH_CENTER.x, y - TRASH_CENTER.y) < TRASH_RADIUS;

  const getHandlers = (item: StoryItem) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation(); // don't bubble to the content-zone deselect
      (e.target as Element).setPointerCapture?.(e.pointerId);
      active.current = {
        id: item.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: item.x,
        startY: item.y,
        curX: item.x,
        curY: item.y,
        moved: false,
      };
      setDraggingId(item.id);
      setIsNearTrash(false);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const a = active.current;
      const rect = contentRef.current?.getBoundingClientRect();
      if (!a || !rect) return;
      const dx = e.clientX - a.startClientX;
      const dy = e.clientY - a.startClientY;
      if (!a.moved && Math.hypot(dx, dy) > TAP_THRESHOLD) a.moved = true;
      a.curX = clamp01(a.startX + dx / rect.width);
      a.curY = clamp01(a.startY + dy / rect.height);
      onDrag(a.id, a.curX, a.curY);
      setIsNearTrash(inTrash(a.curX, a.curY));
    },
    onPointerUp: (e: React.PointerEvent) => {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      const a = active.current;
      active.current = null;
      setDraggingId(null);
      setIsNearTrash(false);
      if (!a) return;
      if (!a.moved) {
        onSelect(a.id); // clean tap → toggle selection
        return;
      }
      onDragEnd(a.id, a.curX, a.curY, inTrash(a.curX, a.curY));
    },
    onPointerCancel: (e: React.PointerEvent) => {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      active.current = null;
      setDraggingId(null);
      setIsNearTrash(false);
    },
  });

  return { draggingId, isNearTrash, getHandlers };
}
