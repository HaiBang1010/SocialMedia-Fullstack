import { useMutation } from '@tanstack/react-query';
import { callsApi } from '@/api';
import { useCallStore } from '@/stores/callStore';
import type { Message } from '@/types/api';

// Phase 6 — decline an incoming call. Closes the ringing dialog regardless of outcome. For a
// DIRECT call the backend ends it (DECLINED → call:ended patches the thread); for GROUP the room
// stays open and only the initiator is notified (call:declined).
export function useDeclineCall() {
  const clearIncoming = useCallStore((s) => s.clearIncoming);

  return useMutation<Message, Error, string>({
    mutationFn: (callId) => callsApi.decline(callId),
    onSettled: () => clearIncoming(),
  });
}
