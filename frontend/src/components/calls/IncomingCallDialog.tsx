import { useEffect } from 'react';
import { Phone, Video } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Avatar from '@/components/common/Avatar';
import { useCallStore } from '@/stores/callStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { useAcceptCall } from '@/features/calls/hooks/useAcceptCall';
import { useDeclineCall } from '@/features/calls/hooks/useDeclineCall';
import { useRingtone } from '@/features/calls/hooks/useRingtone';

const RING_TIMEOUT_MS = 30_000; // Decision Q4 — auto-dismiss after 30s (caller marks it MISSED)

// Phase 6 — global incoming-call dialog (mounted in AppLayout). Rings while open; Accept fetches a
// token + joins (a 409/410 surfaces as "no longer available"); Decline (or ESC/timeout) dismisses.
export default function IncomingCallDialog() {
  const incoming = useCallStore((s) => s.incomingCall);
  const clearIncoming = useCallStore((s) => s.clearIncoming);
  const accept = useAcceptCall();
  const decline = useDeclineCall();
  const initiatorOnline = usePresenceStore((s) => (incoming ? !!s.online[incoming.initiator.id] : false));

  useRingtone(incoming != null);

  // 30s ring timeout → dismiss locally (the caller's own timeout ends the call as MISSED).
  useEffect(() => {
    if (!incoming) return;
    const t = setTimeout(() => clearIncoming(), RING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [incoming, clearIncoming]);

  if (!incoming) return null;

  const isVideo = incoming.type === 'VIDEO';
  const Icon = isVideo ? Video : Phone;
  const subtitle = incoming.isGroup
    ? `Incoming ${isVideo ? 'video' : 'audio'} call · ${incoming.conversationName ?? 'Group'}`
    : `Incoming ${isVideo ? 'video' : 'audio'} call`;

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) decline.mutate(incoming.callId); // ESC / overlay click → decline
      }}
    >
      <DialogContent showClose={false} className="max-w-xs">
        <DialogTitle className="sr-only">Incoming call</DialogTitle>
        <div className="flex flex-col items-center gap-3 py-2">
          <span className="relative inline-flex">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
            <Avatar user={incoming.initiator} size="lg" online={initiatorOnline} />
          </span>
          <div className="text-center">
            <p className="font-medium">{incoming.initiator.name}</p>
            <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Icon className="size-3.5" /> {subtitle}
            </p>
          </div>
          {accept.isError && (
            <p className="text-xs text-destructive">This call is no longer available.</p>
          )}
          <div className="mt-2 flex w-full gap-2">
            <Button
              variant="destructive"
              className="flex-1"
              disabled={decline.isPending}
              onClick={() => decline.mutate(incoming.callId)}
            >
              Decline
            </Button>
            <Button
              className="flex-1"
              disabled={accept.isPending}
              onClick={() => accept.mutate(incoming)}
            >
              Accept
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
