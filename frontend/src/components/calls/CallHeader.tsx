import { useEffect, useState } from 'react';
import { useRemoteParticipants } from '@livekit/components-react';
import { formatDuration } from '@/lib/audio';
import { useCallStore } from '@/stores/callStore';

// Phase 6 — top overlay of the in-call view: call type + a duration timer (or "Calling…" while
// nobody else has joined). Must render inside <LiveKitRoom> (useRemoteParticipants).
export default function CallHeader() {
  const currentCall = useCallStore((s) => s.currentCall);
  const remote = useRemoteParticipants();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!currentCall) return null;
  const alone = remote.length === 0;

  return (
    <div className="flex shrink-0 items-center justify-between px-4 py-3 text-white">
      <span className="text-sm font-medium">
        {currentCall.type === 'VIDEO' ? 'Video call' : 'Audio call'}
      </span>
      <span className="text-xs text-white/70">
        {alone
          ? currentCall.isInitiator
            ? 'Calling…'
            : 'Connecting…'
          : formatDuration(seconds)}
      </span>
    </div>
  );
}
