# Call ringtone (Phase 6)

Place a looping ringtone here as **`ringtone.mp3`** — referenced by `useRingtone` as
`/sounds/ringtone.mp3` and played by `IncomingCallDialog` on an incoming call.

Use a license-safe sound (Decision Q5): e.g. a CC0 clip from https://freesound.org.
If the file is missing, the incoming call still works — the ring is silently visual-only
(autoplay rejection is caught and ignored).
