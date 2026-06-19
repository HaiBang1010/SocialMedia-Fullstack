import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface LeaveGroupConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  // Warn that leaving as the last member deletes the group + its messages (no zombie groups).
  isLastMember: boolean;
}

// Group management — confirm before leaving a group (mirrors RecallConfirmDialog).
export default function LeaveGroupConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  isLastMember,
}: LeaveGroupConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Leave group?</DialogTitle>
          <DialogDescription>
            {isLastMember
              ? "You're the last member — the group and its messages will be deleted."
              : "You won't receive messages from this group anymore."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? 'Leaving…' : 'Leave'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
