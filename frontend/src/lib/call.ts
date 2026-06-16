import { formatDuration } from '@/lib/audio';
import type { CallInfo } from '@/types/api';

// Phase 6 — shared call-label helpers (CallEntry in the thread + the conversation-list preview).

/** Duration of a completed call in seconds (startedAt → endedAt). 0 while ringing/ongoing. */
export function callDurationSeconds(call: CallInfo): number {
  if (!call.endedAt) return 0;
  const ms = new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime();
  return Math.max(0, Math.round(ms / 1000));
}

/**
 * Status label for a call. `missed` is true for a missed call (CallEntry renders it red).
 * - ringing/ongoing (endedAt null) → "Audio/Video call"
 * - COMPLETED → "Audio/Video call · M:SS"
 * - MISSED → "Missed call" (missed) · DECLINED → "Call declined" · FAILED → "Call failed"
 */
export function callStatusLabel(call: CallInfo): { text: string; missed: boolean } {
  const noun = call.type === 'VIDEO' ? 'Video call' : 'Audio call';
  if (!call.endedAt) return { text: noun, missed: false };
  switch (call.endedReason) {
    case 'MISSED':
      return { text: 'Missed call', missed: true };
    case 'DECLINED':
      return { text: 'Call declined', missed: false };
    case 'FAILED':
      return { text: 'Call failed', missed: false };
    case 'COMPLETED':
    default:
      return { text: `${noun} · ${formatDuration(callDurationSeconds(call))}`, missed: false };
  }
}
