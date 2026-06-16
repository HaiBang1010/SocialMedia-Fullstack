import { useMutation } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { callsApi } from '@/api';
import { useCallStore } from '@/stores/callStore';
import type { CallJoinInput, CallStartResponse, CallType } from '@/types/api';

interface StartCallVars {
  conversationId: string;
  type: CallType;
  isGroup: boolean;
}

// Phase 6 — initiate a call. The backend creates the Call + CALL message (which reaches our own
// thread via the message:new echo) and returns our LiveKit token. We move the call store into
// 'connecting'; <InCallView> mounts (currentCall != null) and connects to the room.
//
// If the conversation/user already has a genuinely-active call, the backend replies 409
// CallInProgress with the existing call in `data` (stale ghosts are auto-reaped server-side). We
// surface a "Join it?" prompt (callStore.joinPrompt) instead of failing silently.
export function useStartCall() {
  const startCall = useCallStore((s) => s.startCall);
  const setJoinPrompt = useCallStore((s) => s.setJoinPrompt);

  return useMutation<CallStartResponse, Error, StartCallVars>({
    mutationFn: ({ conversationId, type }) => callsApi.start(conversationId, type),
    onSuccess: (res, vars) => {
      const callId = res.message.call?.id;
      if (!callId) return;
      startCall({
        callId,
        conversationId: vars.conversationId,
        type: vars.type,
        isGroup: vars.isGroup,
        isInitiator: true,
        token: res.token,
        url: res.url,
      });
    },
    onError: (error) => {
      if (!isAxiosError(error)) return;
      const body = error.response?.data as { error?: string; data?: CallJoinInput } | undefined;
      if (body?.error === 'CallInProgress' && body.data) {
        setJoinPrompt(body.data);
      }
    },
  });
}
