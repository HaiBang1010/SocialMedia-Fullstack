import { useEffect, useRef } from 'react';
import '@livekit/components-styles';
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  useRemoteParticipants,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores/authStore';
import { useEndCall } from '@/features/calls/hooks/useEndCall';
import CallHeader from './CallHeader';
import CallControls from './CallControls';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const MISSED_TIMEOUT_MS = 30_000; // Decision Q4 — caller cancels as MISSED if nobody joins in 30s
const ALONE_GRACE_MS = 5_000; // once everyone else leaves, end the call after a short grace

// Phase 6 — fullscreen call overlay. Mounted in AppLayout when callStore.currentCall != null (so
// the initiator sees the ringing UI immediately). Uses LiveKit's prebuilt GridLayout + its own CSS
// (Decision 7 — visual mismatch with the Beng theme accepted this phase).
export default function InCallView() {
  const currentCall = useCallStore((s) => s.currentCall);
  const setConnected = useCallStore((s) => s.setConnected);
  const reset = useCallStore((s) => s.reset);

  // Tab close / refresh: end the call best-effort so it doesn't hang until stale-lock. `keepalive`
  // lets the request outlive the page AND carry the JWT header (navigator.sendBeacon can't set
  // headers). Covers the "everyone closes at once" gap that in-call last-participant detection
  // can't (no remaining client to detect it). Reads fresh state at fire time. Fire-and-forget.
  useEffect(() => {
    const onPageHide = () => {
      const call = useCallStore.getState().currentCall;
      const token = useAuthStore.getState().accessToken;
      if (!call || !token) return;
      fetch(`${API_BASE}/calls/${call.callId}/end`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'leave' }),
      }).catch(() => {});
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  if (!currentCall) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      <LiveKitRoom
        serverUrl={currentCall.url}
        token={currentCall.token}
        connect
        video={currentCall.type === 'VIDEO'}
        audio
        onConnected={setConnected}
        onDisconnected={reset}
        onError={(err) => {
          // Permission denied / connect failure → close the overlay (the call row stays open
          // until the caller's timeout or the room's emptyTimeout; webhook polish makes it exact).
          console.error('[call] LiveKit error:', err);
          reset();
        }}
        className="flex h-full flex-col"
      >
        <CallHeader />
        <div className="relative min-h-0 flex-1">
          <CallStage />
        </div>
        <CallControls />
        <RoomAudioRenderer />
        <CallLifecycle />
      </LiveKitRoom>
    </div>
  );
}

// One tile per participant (camera track, or an avatar placeholder for audio-only / camera-off).
function CallStage() {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: false,
  });
  return (
    <GridLayout tracks={tracks} className="h-full">
      <ParticipantTile />
    </GridLayout>
  );
}

// Call lifecycle watchdogs (no UI). Webhook is deferred, so the client drives end-of-call:
//  1. MISSED — initiator, nobody ever joined within 30s → end the call.
//  2. Last-participant — everyone who joined has since left (e.g. they closed their tab without an
//     explicit end). After a short grace (debounces reconnect blips) the remaining client ends the
//     call (DIRECT leave = end; GROUP leave drains to ≤1 → auto-end). finalizeCall tears the room
//     down, so even the both-closed-at-once case is reaped by createCall's stale-lock next time.
function CallLifecycle() {
  const currentCall = useCallStore((s) => s.currentCall);
  const remote = useRemoteParticipants();
  const endCall = useEndCall();
  const remoteCount = remote.length;
  const hadRemote = useRef(false);
  if (remoteCount > 0) hadRemote.current = true;

  useEffect(() => {
    if (!currentCall?.isInitiator) return;
    const callId = currentCall.callId;
    const t = setTimeout(() => {
      if (!hadRemote.current) {
        endCall.mutate({ callId, action: 'end_for_all', reason: 'MISSED' });
      }
    }, MISSED_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCall?.callId]);

  useEffect(() => {
    // Only after at least one remote had joined — otherwise this is the initiator's ring (handled
    // by MISSED above), not "everyone left".
    if (!currentCall || remoteCount > 0 || !hadRemote.current) return;
    const callId = currentCall.callId;
    const t = setTimeout(() => endCall.mutate({ callId, action: 'leave' }), ALONE_GRACE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteCount, currentCall?.callId]);

  return null;
}
