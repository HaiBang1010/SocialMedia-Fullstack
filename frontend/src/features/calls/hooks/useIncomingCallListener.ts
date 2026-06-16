import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketStore } from '@/stores/socketStore';
import { useCallStore } from '@/stores/callStore';
import { getSocket } from '@/lib/socket';
import { patchCallEnded } from '@/lib/messageCache';
import { queryKeys } from '@/lib/queryKeys';
import type { CallDeclinedPayload, CallEndedPayload, CallIncomingPayload } from '@/types/api';

// Phase 6 — app-wide call socket listeners (mounted once in AppLayout, alongside
// useGlobalSocketEvents). The CALL *message* itself rides the existing message:new handler; these
// three drive the call UI. Re-binds on `status` so a reconnected socket instance gets fresh
// handlers (same pattern as useGlobalSocketEvents).
export function useIncomingCallListener() {
  const qc = useQueryClient();
  const status = useSocketStore((s) => s.status);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const store = useCallStore.getState;

    const onIncoming = (p: CallIncomingPayload) => {
      // Refresh the conversation so its "Call in progress · Join" banner appears (even after the
      // ring is declined / times out, or for a late opener of the thread).
      qc.invalidateQueries({ queryKey: queryKeys.conversation(p.conversationId) });
      // Busy (already in a call) → don't ring; the initiator's timeout marks it missed.
      if (store().currentCall) return;
      store().setIncoming(p);
    };
    const onDeclined = (p: CallDeclinedPayload) => {
      const cur = store().currentCall;
      // DIRECT decline ends our outgoing call; a GROUP decline is informational (call continues).
      if (cur && cur.callId === p.callId && !cur.isGroup) store().reset();
    };
    const onEnded = (p: CallEndedPayload) => {
      patchCallEnded(qc, p.conversationId, p.callId, p.endedAt, p.endedReason);
      // The conversation-list preview (lastMessage) is a separate cache — refetch so it shows the
      // final "📞 Audio call · 5:23" / "Missed call" (mirrors the recall message:deleted handler).
      qc.invalidateQueries({ queryKey: queryKeys.conversations() });
      const s = store();
      if (s.incomingCall?.callId === p.callId) s.clearIncoming(); // ringing → caller hung up
      if (s.currentCall?.callId === p.callId) s.reset(); // we were in it → it ended for all
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:declined', onDeclined);
    socket.on('call:ended', onEnded);
    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:declined', onDeclined);
      socket.off('call:ended', onEnded);
    };
  }, [qc, status]);
}
