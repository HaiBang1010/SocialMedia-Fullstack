import { Phone, Video } from 'lucide-react';
import { useStartCall } from '@/features/calls/hooks/useStartCall';
import { useCallStore } from '@/stores/callStore';
import type { CallType } from '@/types/api';

interface CallButtonsProps {
  conversationId: string;
  isGroup: boolean;
}

// Phase 6 — Audio + Video call buttons in the conversation header. Disabled while a call is
// already in progress (one call at a time). Shown for both DIRECT and GROUP (Q2).
export default function CallButtons({ conversationId, isGroup }: CallButtonsProps) {
  const startCall = useStartCall();
  const busy = useCallStore((s) => s.status !== 'idle');
  const disabled = busy || startCall.isPending;

  const start = (type: CallType) => {
    // Ask for notification permission on the first call attempt (best-effort; backgrounded tabs).
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
    startCall.mutate({ conversationId, type, isGroup });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Audio call"
        disabled={disabled}
        onClick={() => start('AUDIO')}
        className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted disabled:opacity-40"
      >
        <Phone className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Video call"
        disabled={disabled}
        onClick={() => start('VIDEO')}
        className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted disabled:opacity-40"
      >
        <Video className="size-5" />
      </button>
    </div>
  );
}
