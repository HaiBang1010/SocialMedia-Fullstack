import { create } from 'zustand';
import type { CallIncomingPayload, CallJoinInput, CallType } from '@/types/api';

// Phase 6 — global call state (one active call per user). A single <IncomingCallDialog/> +
// <InCallView/> in AppLayout read this. Mirrors the mediaLightboxStore convention.

// The call this client is currently in (initiator OR accepted recipient). token/url drive the
// <LiveKitRoom>; isInitiator gates the "End for all" control + the missed-call timeout.
export interface CurrentCall {
  callId: string;
  conversationId: string;
  type: CallType;
  isGroup: boolean;
  isInitiator: boolean;
  token: string;
  url: string;
}

type CallStatus = 'idle' | 'connecting' | 'connected' | 'ended';

interface CallState {
  incomingCall: CallIncomingPayload | null;
  currentCall: CurrentCall | null;
  status: CallStatus;
  // Phase 6 — set when a start attempt is blocked by an active call (409) → "Join it?" prompt.
  joinPrompt: CallJoinInput | null;
  setIncoming: (call: CallIncomingPayload) => void;
  clearIncoming: () => void;
  startCall: (call: CurrentCall) => void; // initiator or accepted recipient → connecting
  setConnected: () => void;
  setJoinPrompt: (prompt: CallJoinInput) => void;
  clearJoinPrompt: () => void;
  reset: () => void;
}

export const useCallStore = create<CallState>()((set) => ({
  incomingCall: null,
  currentCall: null,
  status: 'idle',
  joinPrompt: null,
  setIncoming: (incomingCall) => set({ incomingCall }),
  clearIncoming: () => set({ incomingCall: null }),
  startCall: (currentCall) =>
    set({ currentCall, status: 'connecting', incomingCall: null, joinPrompt: null }),
  setConnected: () => set({ status: 'connected' }),
  setJoinPrompt: (joinPrompt) => set({ joinPrompt }),
  clearJoinPrompt: () => set({ joinPrompt: null }),
  reset: () => set({ currentCall: null, incomingCall: null, joinPrompt: null, status: 'idle' }),
}));
