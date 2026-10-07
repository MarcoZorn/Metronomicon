// Screens, input, render loop. Gameplay timing reads ctx.currentTime only;
// requestAnimationFrame just redraws.
import { initAudio, now, click, schedule, ctx } from './audio.js';
import { judge, nearestBeat, timeToBeat } from './timing.js';

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

function drawTitleBg() {
  g.fillStyle = '#0d0a14';
  g.fillRect(0, 0, W, H);
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

const screens = { test: beatTest, cal: () => menu, play: () => menu };
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
