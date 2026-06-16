import { useMutation } from '@tanstack/react-query';
import { callsApi } from '@/api';
import { useCallStore } from '@/stores/callStore';
import type { CallJoinInput, CallTokenResponse } from '@/types/api';

// Phase 6 — join a call: fetch a LiveKit token then move into the call (the initiator learns we
// joined via LiveKit's ParticipantConnected event — no accept event needed). Used both for
// accepting an incoming call AND for "Join" on a 409 CallInProgress prompt (CallJoinInput is the
// shared shape; CallIncomingPayload is a superset). A 409 (CallFull) / 410 (CallEnded) surfaces
// via the mutation error so the caller can show it.
export function useAcceptCall() {
  const startCall = useCallStore((s) => s.startCall);

  return useMutation<CallTokenResponse, Error, CallJoinInput>({
    mutationFn: (join) => callsApi.getToken(join.callId),
    onSuccess: (res, join) => {
      startCall({
        callId: join.callId,
        conversationId: join.conversationId,
        type: join.type,
        isGroup: join.isGroup,
        isInitiator: false,
        token: res.token,
        url: res.url,
      });
    },
  });
}
