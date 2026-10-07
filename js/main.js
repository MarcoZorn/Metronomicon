// Screens, input, render loop. Gameplay timing reads ctx.currentTime only;
// requestAnimationFrame just redraws.
import { initAudio, now, click, schedule, ctx } from './audio.js';
import { judge, nearestBeat, timeToBeat, median } from './timing.js';
import { game } from './game.js';

const cv = document.getElementById('c');
export const g = cv.getContext('2d');
export const W = cv.width, H = cv.height;
const ui = document.getElementById('ui');

export const store = {
  get offsetMs() { try { return +localStorage.getItem('metronomicon.offset') || 0; } catch { return 0; } },
  set offsetMs(v) { try { localStorage.setItem('metronomicon.offset', String(Math.round(v))); } catch {} },
};

let scene = null;
export function go(s) {
  scene?.leave?.();
  ui.innerHTML = '';
  scene = s;
  s.enter?.();
}
export function panel(html) {
  ui.innerHTML = `<div class="panel">${html}</div>`;
  return ui.firstChild;
}
export const COLORS = { Perfect: '#4dfff0', Good: '#ffcc4d', Miss: '#ff4d6d' };

// ---------- start / menu ----------
const CONTROLS = `<table>
  <tr><td><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> / <kbd>WASD</kbd></td><td>move / attack, on the beat</td></tr>
  <tr><td><kbd>Space</kbd></td><td>tap (beat test, calibration)</td></tr>
  <tr><td><kbd>Esc</kbd></td><td>back to menu</td></tr></table>`;

const start = {
  enter() {
    panel(`<h1>METRONOMICON</h1><p class="dim">a rhythm dungeon crawler</p>${CONTROLS}
      <p>Move only on the beat. Off-beat = you stumble.</p>
      <button id="go">▶ Click to play</button>
      <p class="dim">(sound on: browsers need a click before audio starts)</p>`)
      .querySelector('#go').onclick = async () => { await initAudio(); go(menu); };
  },
  draw() { drawTitleBg(); },
};

export const menu = {
  enter() {
    const el = panel(`<h1>METRONOMICON</h1>
      <p class="dim">input offset: ${store.offsetMs} ms${store.offsetMs ? '' : ' (not calibrated)'}</p>
      <div><button data-s="play">Play</button></div>
      <div><button class="alt" data-s="cal">Calibrate</button><button class="alt" data-s="test">Beat test</button></div>
      ${CONTROLS}`);
    el.querySelectorAll('button').forEach(b => b.onclick = () => go(screens[b.dataset.s]()));
    el.querySelector('button').focus();
  },
  draw() { drawTitleBg(); },
};

// Title backdrop: visual only, driven by a frame counter (no audio yet).
let tf = 0;
const embers = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), v: 0.3 + Math.random(), s: 2 + Math.random() * 3, p: Math.random() * 6.28 }));
function drawTitleBg() {
  const f = ++tf / 60, beat = Math.exp(-((f * 2) % 1) * 4); // fake 120 bpm throb
  g.fillStyle = '#0d0a14';
  g.fillRect(0, 0, W, H);
  // faint grid scrolling toward the viewer
  g.strokeStyle = 'rgba(179,107,255,0.08)';
  g.lineWidth = 1;
  const off = (f * 20) % 40;
  g.beginPath();
  for (let x = -off; x < W; x += 40) { g.moveTo(x, 0); g.lineTo(x, H); }
  for (let y = off; y < H; y += 40) { g.moveTo(0, y); g.lineTo(W, y); }
  g.stroke();
  // purple/gold pulsing glows
  for (const [cx, cy, r, c] of [[W * 0.3, H * 0.4, 0.6, '179,107,255'], [W * 0.72, H * 0.62, 0.45, '255,204,77']]) {
    const rad = W * r * (0.9 + beat * 0.1 + Math.sin(f + cx) * 0.05);
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    gr.addColorStop(0, `rgba(${c},${0.22 + beat * 0.12})`);
    gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  // drifting embers
  for (const e of embers) {
    const y = ((e.y - f * e.v * 0.05) % 1 + 1) % 1 * H, x = e.x * W + Math.sin(f * 1.3 + e.p) * 14;
    g.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(f * 2 + e.p)) * (y / H);
    g.fillStyle = e.v > 0.9 ? '#ffcc4d' : '#ff7a4d';
    g.fillRect(x, y, e.s, e.s);
  }
  g.globalAlpha = 1;
  vignette(0.75);
}

let vig = null;
export function vignette(a) {
  if (!vig) {
    vig = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) / 2);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,1)');
  }
  g.globalAlpha = a;
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
}

// ---------- beat test (metronome + pulsing square) ----------
function beatTest() {
  const bpm = 120;
  let t0, stop, last = null, hits = [];
  return {
    enter() {
      t0 = now() + 0.3;
      stop = schedule(bpm, t0, (step, t) => step % 4 === 0 && click(t, step % 16 === 0));
    },
    leave() { stop(); },
    key(code, t) {
      if (code !== 'Space') return;
      const pt = t - store.offsetMs / 1000;
      const { delta } = nearestBeat(pt, bpm, t0);
      last = { r: judge(delta), ms: Math.round(delta * 1000), at: t };
      hits.push(last);
    },
    draw(t) {
      const b = timeToBeat(t, bpm, t0);
      const pulse = b < 0 ? 0 : Math.exp(-(b - Math.floor(b)) * 6);
      g.fillStyle = '#0d0a14';
      g.fillRect(0, 0, W, H);
      const s = 120 + pulse * 60;
      g.fillStyle = `rgb(${255 * pulse | 0}, ${120 + 80 * pulse | 0}, 255)`;
      g.fillRect(W / 2 - s / 2, H / 2 - s / 2 - 40, s, s);
      text('BEAT TEST — press SPACE on the click', W / 2, 60, 22, '#efe6ff');
      text(`120 bpm · offset ${store.offsetMs} ms · Esc for menu`, W / 2, 92, 14, '#8a7fa3');
      if (last) {
        const age = t - last.at;
        text(last.r + '!', W / 2, H - 150 - age * 30, 40, COLORS[last.r], Math.max(0, 1 - age));
        text(`${last.ms > 0 ? '+' : ''}${last.ms} ms (${last.ms < 0 ? 'early' : 'late'})`, W / 2, H - 100, 20, '#efe6ff');
      }
      const recent = hits.slice(-12);
      recent.forEach((h, i) => text(String(h.ms), W / 2 + (i - recent.length / 2) * 52 + 26, H - 50, 14, COLORS[h.r]));
    },
  };
}

export function text(s, x, y, size, color, alpha = 1) {
  g.globalAlpha = alpha;
  g.font = `${size}px Silkscreen, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#000';
  g.fillText(s, x + 2, y + 2);
  g.fillStyle = color;
  g.fillText(s, x, y);
  g.globalAlpha = 1;
}

// ---------- calibration ----------
// Tap along to a click. Median of (tap - beat) = how late input+audio arrive.
function calibrate() {
  const bpm = 100, need = 16;
  let t0, stop, deltas = [], done = false;
  return {
    enter() {
      t0 = now() + 0.5;
      stop = schedule(bpm, t0, (step, t) => step % 4 === 0 && click(t, step % 16 === 0));
    },
    leave() { stop(); },
    key(code, t) {
      if (code !== 'Space' || done) return;
      const { beat, delta } = nearestBeat(t, bpm, t0);
      if (beat < 4 || Math.abs(delta) > 0.25) return; // skip count-in and wild taps
      deltas.push(delta);
      if (deltas.length >= need) finish();
    },
    draw(t) {
      const b = timeToBeat(t, bpm, t0);
      const pulse = b < 0 ? 0 : Math.exp(-(b - Math.floor(b)) * 6);
      g.fillStyle = '#0d0a14';
      g.fillRect(0, 0, W, H);
      g.fillStyle = `rgba(255,204,77,${0.2 + pulse * 0.8})`;
      g.beginPath(); g.arc(W / 2, H / 2 - 20, 60 + pulse * 30, 0, 7); g.fill();
      text('CALIBRATION', W / 2, 60, 28, '#ffcc4d');
      text(b < 4 ? `listen... ${4 - Math.floor(Math.max(0, b))}` : 'tap SPACE on every click',
        W / 2, 100, 18, '#efe6ff');
      text(`${deltas.length} / ${need} taps`, W / 2, H - 120, 20, '#8a7fa3');
      if (deltas.length) text(`current estimate: ${Math.round(median(deltas) * 1000)} ms`, W / 2, H - 80, 20, '#4dfff0');
    },
  };
  function finish() {
    done = true;
    let ms = Math.round(median(deltas) * 1000);
    const el = panel(`<h2>Calibrated</h2><p>Your input/audio offset:</p><p class="big" id="ms">${ms} ms</p>
      <p class="dim">positive = you hear/press late; it gets subtracted from every press.<br>
      Fine-tune with <kbd>-</kbd> <kbd>+</kbd>.</p>
      <button id="save">Save</button><button class="alt" id="retry">Retry</button>`);
    const show = () => (el.querySelector('#ms').textContent = `${ms} ms`);
    el.querySelector('#save').onclick = () => { store.offsetMs = ms; go(menu); };
    el.querySelector('#retry').onclick = () => go(calibrate());
    el.querySelector('#save').focus();
    el.onkeydown = e => {
      if (e.key === '-') { ms -= 5; show(); }
      if (e.key === '+' || e.key === '=') { ms += 5; show(); }
    };
  }
}

const screens = { test: beatTest, cal: calibrate, play: () => game() };
export function addScreen(name, factory) { screens[name] = factory; }

// ---------- input + loop ----------
addEventListener('keydown', e => {
  if (e.repeat) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape' && scene !== start) return go(menu);
  // Press time = audio clock at the moment the event is handled.
  if (scene?.key && ctx) scene.key(e.code, now());
});

function frame() {
  const t = ctx ? now() : 0;
  scene?.update?.(t);
  scene?.draw?.(t);
  requestAnimationFrame(frame);
}
go(start);
requestAnimationFrame(frame);
