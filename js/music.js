// "Crypt of Clocks": D minor dungeon loop, 64 bars, layered for combo-driven mixing.
// Base bus (kick + pad) is always on; drums/bass/melody buses fade in with combo.
import { bus, schedule, kick, snare, hat, bass, lead, pad, click } from './audio.js';

export const SONG_TITLE = 'Crypt of Clocks';
export const SONG_BEATS = 256;
export const SECTIONS = [
  { name: 'intro', startBeat: 0 },
  { name: 'A', startBeat: 32 },
  { name: 'B', startBeat: 96 },
  { name: 'breakdown', startBeat: 160 },
  { name: "A'", startBeat: 192 },
  { name: 'outro', startBeat: 240 },
];

// chords: [bass root, pad voicing]
const Dm = [38, [50, 53, 57]], Bb = [34, [46, 50, 53]], F = [41, [48, 53, 57]];
const C = [36, [48, 52, 55]], Am = [33, [45, 48, 52]];
const PROG_A = [Dm, Bb, F, C], PROG_B = [Bb, C, Am, Dm];

// melody: 8 eighths per bar; number = midi note, '-' = hold, 0 = rest
const _ = '-';
const MOTIF = [
  [69, 74, 77, 76, 74, _, 69, _],
  [70, 74, 77, 74, 70, 72, 74, _],
  [72, 77, 76, 77, 72, _, 69, _],
  [67, _, 72, _, 76, 74, 72, _],
];
const MOTIF_END = [76, 77, 79, _, 81, _, 0, 0];
const MOTIF_B = [
  [77, _, _, 74, 77, _, 79, _],
  [79, _, 76, _, 72, _, 0, 0],
  [76, _, 72, _, 69, 72, 76, _],
  [74, _, _, _, 0, 77, 76, 74],
];
const FILL_BARS = [7, 23, 39, 47, 59];

const sectionAt = bar => {
  let s = SECTIONS[0];
  for (const x of SECTIONS) if (x.startBeat <= bar * 4) s = x;
  return s;
};

export function startSong(bpm, t0) {
  const base = bus(0.9), soft = bus(0.35);
  const layers = { drums: bus(0), bass: bus(0), melody: bus(0) };
  const spb = 60 / bpm, e8 = spb / 2;

  let stop = null;
  stop = schedule(bpm, t0, (step, t) => {
    if (step >= SONG_BEATS * 4) return stop?.();
    const bar = step >> 4, s = step & 15;
    const sec = sectionAt(bar), name = sec.name;
    const rel = bar - sec.startBeat / 4;
    const [root, voicing] = (name === 'B' ? PROG_B : PROG_A)[rel % 4];

    if (bar === 63) {
      // final hit on beat 252, then silence until 256
      if (s !== 0) return;
      kick(t, base); pad(t, [38, ...Dm[1]], spb * 3.5, base);
      snare(t, layers.drums); hat(t, true, layers.drums);
      bass(t, 38, spb * 3, layers.bass);
      lead(t, 74, spb * 2, layers.melody); lead(t, 62, spb * 2, layers.melody);
      return;
    }

    // base layer: kick every beat (half-time + click in breakdown), pad per bar
    if (s % 4 === 0) {
      if (name !== 'breakdown' || s % 8 === 0) kick(t, base);
      if (name === 'breakdown') click(t, s === 0, soft);
    }
    if (s === 0) pad(t, voicing, spb * 4, base);

    // drums layer
    const d = layers.drums;
    if (FILL_BARS.includes(bar) && s >= 8) {
      snare(t, d);
      if (s === 15) hat(t, true, d);
    } else if (name === 'breakdown') {
      if (s === 12) snare(t, d);
      if (s % 4 === 2) hat(t, false, d);
    } else {
      if ((s === 4 || s === 12) && (name !== 'intro' || bar >= 4)) snare(t, d);
      const sixteenths = name === 'B' || name === "A'";
      if (sixteenths || s % 2 === 0) hat(t, name === "A'" && s === 14, d);
    }

    // bass layer
    const b = layers.bass;
    if (name === 'breakdown') {
      if (s === 0) bass(t, root, spb * 3.8, b);
    } else if (name === 'intro') {
      if (bar >= 4 && s % 4 === 0) bass(t, root, spb * 0.8, b);
    } else if (s % 2 === 0) {
      const off = [0, 0, 12, 0, 0, 12, 0, 7][s / 2];
      bass(t, root + off, e8 * 0.85, b);
    }

    // melody layer
    if (s % 2) return;
    const i = s / 2;
    let row;
    if (name === 'B') row = MOTIF_B[rel % 4];
    else if (name === 'intro') row = bar >= 4 ? MOTIF[rel % 4] : null;
    else row = (rel % 8 === 7 && name !== 'breakdown') ? MOTIF_END : MOTIF[rel % 4];
    if (!row) return;
    const thin = name === 'intro' || name === 'breakdown';
    if (thin && i % 2) return;
    const n = row[i];
    if (!n || n === _) return;
    let len = 1;
    while (i + len < 8 && row[i + len] === _) len++;
    if (thin) len = Math.max(len, 2);
    const dur = len * e8 * 0.9;
    lead(t, n, dur, layers.melody);
    if (name === "A'") lead(t, n - 12, dur, layers.melody);
  });

  return { layers, stop };
}
