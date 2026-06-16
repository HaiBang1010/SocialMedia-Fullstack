import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCallStore } from '@/stores/callStore';
import { useAcceptCall } from '@/features/calls/hooks/useAcceptCall';

// Phase 6 — shown when a start attempt is blocked by an already-active call (409 CallInProgress).
// "Join" connects to the existing call instead of failing silently (Issue 1, Fix C). Mounted in
// AppLayout; reads callStore.joinPrompt.
export default function JoinCallDialog() {
  const joinPrompt = useCallStore((s) => s.joinPrompt);
  const clearJoinPrompt = useCallStore((s) => s.clearJoinPrompt);
  const accept = useAcceptCall();

  if (!joinPrompt) return null;

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !accept.isPending) clearJoinPrompt();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Call in progress</DialogTitle>
          <DialogDescription>
            There's already an active call. Would you like to join it?
          </DialogDescription>
        </DialogHeader>
        {accept.isError && (
          <p className="text-sm text-destructive">Couldn't join — the call may have ended or be full.</p>
        )}
        <DialogFooter>
          <button
            type="button"
            onClick={() => clearJoinPrompt()}
            disabled={accept.isPending}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => accept.mutate(joinPrompt, { onSuccess: () => clearJoinPrompt() })}
            disabled={accept.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {accept.isPending ? 'Joining…' : 'Join call'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
