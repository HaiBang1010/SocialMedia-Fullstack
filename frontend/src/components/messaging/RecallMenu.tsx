import { useState } from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface RecallMenuProps {
  // Whether the message is still inside the recall window (the bubble computes it via useRecallFlow).
  withinWindow: boolean;
  // Open the bubble-level recall confirm dialog (owned by MessageBubble so it survives this popover).
  onDelete: () => void;
}

// Phase 5.5 / Polish — the desktop "…" menu on your own messages (a single Delete action). A DUMB
// trigger now: it owns no recall state or dialog — the bubble owns useRecallFlow + the confirm
// dialog (shared with the mobile action menu). Separate trigger from the reaction button so the
// two never collide.
export default function RecallMenu({ withinWindow, onDelete }: RecallMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Message options"
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100',
            menuOpen && 'opacity-100',
          )}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-44 p-1">
        <button
          type="button"
          disabled={!withinWindow}
          title={withinWindow ? undefined : 'Cannot delete after 15 minutes'}
          onClick={() => {
            setMenuOpen(false);
            onDelete();
          }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
        >
          <Trash2 className="size-4" />
          Delete
        </button>
      </PopoverContent>
    </Popover>
  );
}
