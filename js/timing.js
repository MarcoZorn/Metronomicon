// Pure timing math. Everything is in seconds on the AudioContext clock.
// Charts are written in beats; this is the only place beats become seconds.

export const PERFECT = 0.040;
export const GOOD = 0.100;

export const beatToTime = (beat, bpm, offset = 0) => offset + beat * 60 / bpm;
export const timeToBeat = (t, bpm, offset = 0) => (t - offset) * bpm / 60;

// delta = press time - beat time (seconds). Negative = early.
export function judge(delta) {
  const a = Math.abs(delta);
  if (a <= PERFECT) return 'Perfect';
  if (a <= GOOD) return 'Good';
  return 'Miss';
}

// Closest beat to time t, and how far off t is from it.
export function nearestBeat(t, bpm, offset = 0) {
  const beat = Math.round(timeToBeat(t, bpm, offset));
  return { beat, delta: t - beatToTime(beat, bpm, offset) };
}

export function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
