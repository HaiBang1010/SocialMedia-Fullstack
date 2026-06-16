import { useEffect, useRef } from 'react';

// Phase 6 — play a looping ringtone while `active` (an incoming call is on screen). Handles the
// Chrome autoplay policy gracefully: if play() is blocked (no prior user gesture) we swallow the
// rejection and fall back to a visual-only ring. The <audio> asset lives at public/sounds/.
export function useRingtone(active: boolean) {
  const ref = useRef<HTMLAudioElement | null>(null);
  if (ref.current === null) {
    const audio = new Audio('/sounds/ringtone.mp3');
    audio.loop = true;
    audio.preload = 'auto';
    ref.current = audio;
  }

  useEffect(() => {
    const audio = ref.current!;
    if (active) {
      audio.currentTime = 0;
      void audio.play().catch(() => {
        /* autoplay blocked → visual-only ring */
      });
    } else {
      audio.pause();
    }
    return () => audio.pause();
  }, [active]);
}
