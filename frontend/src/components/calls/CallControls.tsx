import { useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { useLocalParticipant } from '@livekit/components-react';
import { cn } from '@/lib/utils';
import { useCallStore } from '@/stores/callStore';
import { useEndCall } from '@/features/calls/hooks/useEndCall';

const CONTROL = 'flex size-12 items-center justify-center rounded-full text-white transition-colors';

// Phase 6 — in-call controls (mute, camera, end). Renders inside <LiveKitRoom> (useLocalParticipant).
// The End control is dynamic (Decision Q1): DIRECT / GROUP non-initiator → single "leave" (DIRECT
// leave ends the call); GROUP initiator → a menu with "Leave call" vs "End call for all" (confirmed).
//
// IMPORTANT: the dropdown + confirm are rendered INLINE (not via Radix Popover/Dialog). Those
// portal to <body> at z-50, which sits BEHIND the z-[70] InCallView overlay — so they'd be hidden
// and unclickable. Inline elements live in InCallView's stacking context and paint above the call.
export default function CallControls() {
  const currentCall = useCallStore((s) => s.currentCall);
  const endCall = useEndCall();
  const { localParticipant } = useLocalParticipant();
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(currentCall?.type === 'VIDEO');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmEndAll, setConfirmEndAll] = useState(false);

  if (!currentCall) return null;

  const toggleMic = async () => {
    const next = !micOn;
    await localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  };
  const toggleCam = async () => {
    const next = !camOn;
    await localParticipant.setCameraEnabled(next);
    setCamOn(next);
  };
  const leave = () => endCall.mutate({ callId: currentCall.callId, action: 'leave' });
  const endForAll = () => endCall.mutate({ callId: currentCall.callId, action: 'end_for_all' });

  const showInitiatorMenu = currentCall.isGroup && currentCall.isInitiator;

  return (
    <>
      <div className="flex shrink-0 items-center justify-center gap-4 bg-black/40 px-4 py-5">
        <button
          type="button"
          aria-label={micOn ? 'Mute' : 'Unmute'}
          onClick={toggleMic}
          className={cn(CONTROL, micOn ? 'bg-white/15 hover:bg-white/25' : 'bg-white text-black')}
        >
          {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
        </button>

        {currentCall.type === 'VIDEO' && (
          <button
            type="button"
            aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
            onClick={toggleCam}
            className={cn(CONTROL, camOn ? 'bg-white/15 hover:bg-white/25' : 'bg-white text-black')}
          >
            {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
          </button>
        )}

        {showInitiatorMenu ? (
          <div className="relative">
            <button
              type="button"
              aria-label="End call"
              onClick={() => setMenuOpen((o) => !o)}
              className={cn(CONTROL, 'bg-destructive hover:bg-destructive/90')}
            >
              <PhoneOff className="size-5" />
            </button>
            {menuOpen && (
              <>
                {/* transparent click-catcher closes the menu (inside InCallView's context) */}
                <div className="fixed inset-0 z-[75]" onClick={() => setMenuOpen(false)} />
                <div className="absolute bottom-full right-0 z-[80] mb-2 w-44 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      leave();
                    }}
                    className="flex w-full items-center rounded-md px-3 py-2 text-sm hover:bg-muted"
                  >
                    Leave call
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmEndAll(true);
                    }}
                    className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                  >
                    End call for all
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            type="button"
            aria-label={currentCall.isGroup ? 'Leave call' : 'End call'}
            onClick={leave}
            disabled={endCall.isPending}
            className={cn(CONTROL, 'bg-destructive hover:bg-destructive/90 disabled:opacity-60')}
          >
            <PhoneOff className="size-5" />
          </button>
        )}
      </div>

      {/* Inline confirm overlay (z-[80] within InCallView) — "End for everyone" (Decision Q1). */}
      {confirmEndAll && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 text-foreground shadow-lg ring-1 ring-foreground/10">
            <h2 className="font-heading text-lg font-semibold">End call for everyone?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This will disconnect everyone from the call.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmEndAll(false)}
                disabled={endCall.isPending}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={endForAll}
                disabled={endCall.isPending}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {endCall.isPending ? 'Ending…' : 'End call'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
