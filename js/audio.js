// Web Audio: the clock, a few synth voices, and a lookahead scheduler.
// Notes are scheduled at exact AudioContext times; setInterval only decides
// *when to queue* them, never when they sound.
import { beatToTime } from './timing.js';

export let ctx = null;
let master, noise;

export async function initAudio() {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  await ctx.resume();
  return ctx;
}

export const now = () => ctx.currentTime;

export function bus(vol = 1) {
  const g = ctx.createGain();
  g.gain.value = vol;
  g.connect(master);
  return g;
}

function env(t, peak, attack, decay, out) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  return g;
}

function osc(type, freq, t, dur, out) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

export function click(t, accent = false, out = master) {
  osc('square', accent ? 1760 : 1100, t, 0.03, env(t, 0.35, 0.001, 0.03, out));
}

export function kick(t, out = master) {
  const o = osc('sine', 150, t, 0.3, env(t, 1, 0.002, 0.28, out));
  o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
}

function noiseHit(t, dur, peak, type, freq, out) {
  const s = ctx.createBufferSource();
  s.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  s.connect(f).connect(env(t, peak, 0.001, dur, out));
  s.start(t);
  s.stop(t + dur + 0.05);
}

export function snare(t, out = master) {
  noiseHit(t, 0.16, 0.5, 'highpass', 1500, out);
  osc('triangle', 190, t, 0.08, env(t, 0.4, 0.001, 0.08, out));
}

export function hat(t, open = false, out = master) {
  noiseHit(t, open ? 0.18 : 0.04, 0.22, 'highpass', 7000, out);
}

export const midi = n => 440 * 2 ** ((n - 69) / 12);

export function bass(t, note, dur, out = master) {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(200, t + dur);
  f.connect(env(t, 0.55, 0.005, dur, out));
  osc('sawtooth', midi(note), t, dur, f);
}

export function lead(t, note, dur, out = master) {
  const e = env(t, 0.22, 0.01, dur, out);
  osc('square', midi(note), t, dur, e);
  osc('triangle', midi(note + 12), t, dur, e);
}

export function pad(t, notes, dur, out = master) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.3);
  g.gain.setValueAtTime(0.06, t + dur - 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1200;
  f.connect(g).connect(out);
  for (const n of notes) {
    osc('sawtooth', midi(n), t, dur, f).detune.value = 7;
    osc('sawtooth', midi(n), t, dur, f).detune.value = -7;
  }
}

// Calls onStep(step, time) for every 16th note from beat 0 at song start t0.
// Returns a stop function.
export function schedule(bpm, t0, onStep, stepsPerBeat = 4) {
  let step = 0;
  const tick = () => {
    const horizon = ctx.currentTime + 0.15;
    for (;;) {
      const t = beatToTime(step / stepsPerBeat, bpm, t0);
      if (t > horizon) break;
      if (t >= ctx.currentTime - 0.005) onStep(step, t);
      step++;
    }
  };
  tick();
  const id = setInterval(tick, 25);
  return () => clearInterval(id);
}
