// Voice-message audio helpers (Phase 5.4b). No audio decoding — the "waveform" is decorative
// (Q3 HYBRID): deterministic bars from the message id, filled progressively by playback %.

export const VOICE_MAX_DURATION = 300; // seconds (5 min, Q4)

// Recording MIME candidates in preference order (Plan C). Chrome/Firefox support WebM/Opus
// (smaller); iOS Safari supports ONLY audio/mp4 (AAC). We pick the first the browser can record.
export const VOICE_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
] as const;

// First candidate this browser can record, or null if none (→ "unsupported" → toast).
export function pickSupportedVoiceMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return VOICE_MIME_CANDIDATES.find((c) => MediaRecorder.isTypeSupported(c)) ?? null;
}

// Container MIME for the Blob type + presign contentType — strips any `;codecs=…` param, so
// 'audio/webm;codecs=opus' → 'audio/webm'. Always one of the two presign-whitelisted audio MIMEs.
export function baseVoiceMime(mime: string): 'audio/webm' | 'audio/mp4' {
  return mime.split(';')[0] === 'audio/mp4' ? 'audio/mp4' : 'audio/webm';
}

// m:ss — shared by VoicePlayer (and reused by the video duration badge).
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Deterministic decorative bar heights (percent, 30–90) derived from a seed (the message id),
// so the same message always renders the same "waveform". A small xorshift-ish hash walk gives
// a varied, non-monotonic profile without decoding the audio.
export function generateWaveformBars(seed: string, count = 30): number[] {
  let h = 2166136261 >>> 0; // FNV-1a basis
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    bars.push(30 + (h % 61)); // 30..90
  }
  return bars;
}
