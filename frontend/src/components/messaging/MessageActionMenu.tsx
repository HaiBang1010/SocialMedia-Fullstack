import { CornerUpLeft, SmilePlus, Trash2 } from 'lucide-react';

interface MessageActionMenuProps {
  isOwn: boolean;
  withinWindow: boolean; // own + within recall window → show Delete
  onReply: () => void;
  onReact: () => void; // switch the popover to the reaction picker
  onDelete: () => void; // open the bubble-level recall confirm dialog
}

// Phase Polish — the MOBILE long-press action sheet (rendered inside the bubble's Popover when
// menu === 'actions'). Replaces the old behaviour of long-press opening the reaction picker
// directly. Reply is available on every message; React switches to the picker; Delete shows only
// on your own messages still inside the recall window. All items are dumb callbacks — the bubble
// owns the recall flow + confirm dialog.
export default function MessageActionMenu({
  isOwn,
  withinWindow,
  onReply,
  onReact,
  onDelete,
}: MessageActionMenuProps) {
  return (
    <div className="flex w-40 flex-col">
      <button
        type="button"
        onClick={onReply}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
      >
        <CornerUpLeft className="size-4" />
        Reply
      </button>
      <button
        type="button"
        onClick={onReact}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
      >
        <SmilePlus className="size-4" />
        React
      </button>
      {isOwn && (
        <button
          type="button"
          disabled={!withinWindow}
          title={withinWindow ? undefined : 'Cannot delete after 15 minutes'}
          onClick={onDelete}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
        >
          <Trash2 className="size-4" />
          Delete
        </button>
      )}
    </div>
  );
}
