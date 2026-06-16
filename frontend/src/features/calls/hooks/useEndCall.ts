import { useMutation } from '@tanstack/react-query';
import { callsApi } from '@/api';
import { useCallStore } from '@/stores/callStore';
import type { CallEndReason, Message } from '@/types/api';

interface EndCallVars {
  callId: string;
  action: 'leave' | 'end_for_all';
  reason?: CallEndReason;
}

// Phase 6 — leave / end a call. We always reset our own call store (we've left the room); for
// `end_for_all` (or a DIRECT leave, or a group that drained) the backend also broadcasts
// call:ended so the others reset too.
export function useEndCall() {
  const reset = useCallStore((s) => s.reset);

  return useMutation<Message, Error, EndCallVars>({
    mutationFn: ({ callId, action, reason }) => callsApi.end(callId, action, reason),
    onSettled: () => reset(),
  });
}
