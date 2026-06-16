import { apiClient } from './client';
import type { CallEndReason, CallStartResponse, CallTokenResponse, CallType, Message } from '@/types/api';

// Phase 6 — call lifecycle. LiveKit handles WebRTC; these endpoints mint tokens + track state.
// "Accept" is getToken + connect (no accept route); the initiator sees the join via LiveKit events.
export const callsApi = {
  // POST /calls/start → 201 { message (CALL), token, url }.
  start: async (conversationId: string, type: CallType): Promise<CallStartResponse> => {
    const { data } = await apiClient.post<CallStartResponse>('/calls/start', { conversationId, type });
    return data;
  },

  // POST /calls/:id/token → 200 { token, url } (join an existing call). 409 when full, 410 when ended.
  getToken: async (callId: string): Promise<CallTokenResponse> => {
    const { data } = await apiClient.post<CallTokenResponse>(`/calls/${callId}/token`, {});
    return data;
  },

  // POST /calls/:id/decline → 200, the CALL message.
  decline: async (callId: string): Promise<Message> => {
    const { data } = await apiClient.post<Message>(`/calls/${callId}/decline`, {});
    return data;
  },

  // POST /calls/:id/end → 200, the (possibly updated) CALL message.
  end: async (
    callId: string,
    action: 'leave' | 'end_for_all',
    reason?: CallEndReason,
  ): Promise<Message> => {
    const { data } = await apiClient.post<Message>(`/calls/${callId}/end`, { action, reason });
    return data;
  },
};
