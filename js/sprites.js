// Procedural pixel-art sprites. Everything is drawn on a 16x16 virtual grid
// scaled to the tile size, using only fillRect.

const G = 16;

// Pixel painter: maps grid coords to canvas pixels, snapped to whole pixels.
function painter(g, ox, oy, s) {
  const u = s / G;
  return (x, y, w, h, c) => {
    g.fillStyle = c;
    const x0 = Math.round(ox + x * u), y0 = Math.round(oy + y * u);
    g.fillRect(x0, y0, Math.round(ox + (x + w) * u) - x0, Math.round(oy + (y + h) * u) - y0);
  };
}

const flashOn = () => ((performance.now() / 70) | 0) % 2 === 0;

// ---------- tiles ----------

function floor(p, pulse, checker) {
  p(0, 0, G, G, checker ? '#2b2340' : '#241d36');
  p(0, 0, G, 1, checker ? '#342a4c' : '#2d2542');
  p(0, 0, 1, G, checker ? '#342a4c' : '#2d2542');
  p(15, 0, 1, G, '#1a1428');
  p(0, 15, G, 1, '#1a1428');
  p(4, 5, 1, 1, '#1d172c');
  p(11, 10, 2, 1, '#1d172c');
  if (pulse > 0) {
    const a = (checker ? 0.16 : 0.08) * pulse;
    p(1, 1, 14, 14, checker ? `rgba(255,70,200,${a})` : `rgba(80,220,255,${a})`);
  }
}

function wall(p) {
  p(0, 0, G, G, '#4a4458');
  p(0, 0, G, 2, '#6d6580');
  for (let r = 0; r < 4; r++) {
    const y = 2 + r * 3.5;
    p(0, y, G, 0.75, '#2e2a3a');
    const off = r % 2 ? 0 : 4;
    p(off + 3.5, y, 0.75, 3.5, '#2e2a3a');
    p(off + 11.5, y, 0.75, 3.5, '#2e2a3a');
    p(off, y + 0.75, 3, 0.5, '#5a536a');
  }
  p(0, 15, G, 1, '#16121e');
}

function stairs(p, pulse, open) {
  floor(p, 0, false);
  if (open) p(1, 1, 14, 14, `rgba(255,190,60,${0.25 + 0.45 * pulse})`);
  const steps = open ? ['#7a5420', '#5c3d16', '#40290e', '#241606'] : ['#3a3448', '#2c2738', '#1f1b2a', '#130f1a'];
  steps.forEach((c, i) => p(2 + i, 2 + i * 3, 12 - i * 2, 3, c));
  p(6, 14, 4, 1, open ? '#120a02' : '#0a080e');
  if (open) {
    const glow = `rgba(255,214,110,${0.5 + 0.5 * pulse})`;
    p(2, 2, 12, 0.75, glow);
    p(2, 2, 0.75, 12, glow);
    p(13.25, 2, 0.75, 12, glow);
  } else {
    // sealed rune
    p(6, 5, 4, 1, '#8a6fc0');
    p(7.5, 5, 1, 6, '#8a6fc0');
    p(6, 8, 4, 1, '#8a6fc0');
    p(5, 10, 6, 1, '#5c4a86');
  }
}

function spikes(p, pulse, checker, up) {
  floor(p, pulse, checker);
  for (const [x, y] of [[3, 3], [10, 3], [3, 10], [10, 10]]) {
    if (up) {
      p(x + 1, y - 1, 1, 1, '#e8eef4');
      p(x + 0.5, y, 2, 1, '#b8c2cc');
      p(x, y + 1, 3, 2, '#8a96a2');
      p(x, y + 3, 3, 0.5, '#4a5260');
    } else {
      p(x, y + 1, 3, 2, '#0e0a16');
      p(x, y + 1, 3, 0.5, '#3a3248');
    }
  }
}

function gate(p, pulse, checker, open) {
  floor(p, pulse, checker);
  const len = open ? 2 : 14;
  for (let x = 2; x < 15; x += 3) {
    p(x, 1, 1.5, len, '#6b7280');
    p(x, 1, 0.5, len, '#9aa3ad');
    if (!open) p(x - 0.25, len, 2, 1.5, '#4b525c');
  }
  p(1, 0, 14, 1.5, '#3a3f48');
  if (!open) p(1, 7, 14, 1.25, '#4b525c');
}

export function drawTile(g, kind, px, py, s, pulse = 0, checker = false) {
  const p = painter(g, px, py, s);
  switch (kind) {
    case 'wall': return wall(p);
    case 'stairs': return stairs(p, pulse, false);
    case 'stairsOpen': return stairs(p, pulse, true);
    case 'spikesUp': return spikes(p, pulse, checker, true);
    case 'spikesDown': return spikes(p, pulse, checker, false);
    case 'gateClosed': return gate(p, pulse, checker, false);
    case 'gateOpen': return gate(p, pulse, checker, true);
    default: return floor(p, pulse, checker);
  }
}

// ---------- actors ----------

// Run draw(p) in a local grid where (0,0) is the tile's bottom-center,
// scaled by (sx, sy) around that point; flip mirrors horizontally.
function actor(g, px, py, s, sx, sy, flip, draw) {
  g.save();
  g.translate(px + s / 2, py + s - s / G);
  g.scale(flip ? -sx : sx, sy);
  draw(painter(g, 0, 0, s));
  g.restore();
}

function shadow(g, px, py, s, w) {
  painter(g, px, py, s)(8 - w / 2, 14.5, w, 1.5, 'rgba(0,0,0,0.35)');
}

export function drawPlayer(g, px, py, s, pulse = 0, facing = 'down', hurt = false) {
  shadow(g, px, py, s, 9);
  const k = 0.12 * pulse;
  const f = hurt ? (flashOn() ? '#ffffff' : '#ff3344') : null;
  const c = (col) => f || col;
  const back = facing === 'up';
  actor(g, px, py, s, 1 + k, 1 - k, facing === 'left', (p) => {
    // legs
    p(-3, -2, 2, 2, c('#2a1e14'));
    p(1, -2, 2, 2, c('#2a1e14'));
    // robe
    p(-4, -9, 8, 7, c('#2f4f9a'));
    p(-4, -9, 1, 7, c('#4a6cc0'));
    p(3, -9, 1, 7, c('#1e3470'));
    p(-4, -3, 8, 1, c('#e8b13a'));
    p(-4, -6, 8, 1, c('#c48a1e'));
    // hood
    p(-3, -14, 6, 5, c('#2f4f9a'));
    p(-2, -15, 4, 1, c('#4a6cc0'));
    p(-1, -16, 2, 1, c('#e8b13a'));
    if (!back) {
      p(-1, -12, 4, 3, c('#f1c9a0'));
      p(0, -11, 1, 1, c('#1a1020'));
      p(2, -11, 1, 1, c('#1a1020'));
      // lute
      p(3, -8, 3, 3, c('#e8b13a'));
      p(4, -7, 1, 1, c('#5a3a10'));
      p(5, -11, 1, 3, c('#c48a1e'));
    } else {
      p(-3, -14, 6, 1, c('#1e3470'));
      p(-1, -8, 2, 4, c('#c48a1e'));
    }
  });
}

function bat(p, pulse, c, st) {
  const flap = pulse > 0.5 ? -3 : 0;
  const y = -9 - Math.round(pulse);
  p(-6, y - 1 + flap, 4, 2, c('#5a2a88'));
  p(-7, y + 1 + flap / 2, 3, 2, c('#4b2270'));
  p(2, y - 1 + flap, 4, 2, c('#5a2a88'));
  p(4, y + 1 + flap / 2, 3, 2, c('#4b2270'));
  p(-2, y - 2, 4, 5, c('#7a3fb0'));
  p(-2, y - 3, 1, 1, c('#7a3fb0'));
  p(1, y - 3, 1, 1, c('#7a3fb0'));
  p(-1, y - 1, 1, 1, c(st.windup ? '#ffff60' : '#ff4040'));
  p(1, y - 1, 1, 1, c(st.windup ? '#ffff60' : '#ff4040'));
  p(-1, y + 2, 2, 1, c('#f0e0f0'));
}

function skeleton(p, pulse, c, st) {
  const bone = c('#e8e2d0'), dim = c('#a8a090');
  p(-2, -3, 1, 3, dim);
  p(1, -3, 1, 3, dim);
  p(-2, -4, 4, 1, bone);
  p(-0.5, -9, 1, 5, bone);
  for (let i = 0; i < 3; i++) p(-3, -9 + i * 1.5, 6, 0.75, i ? dim : bone);
  if (st.windup) {
    p(-5, -14, 1, 5, bone);
    p(4, -14, 1, 5, bone);
    p(-6, -15, 2, 1, dim);
    p(4, -15, 2, 1, dim);
  } else {
    p(-4, -9, 1, 5, bone);
    p(3, -9, 1, 5, bone);
  }
  p(-3, -15, 6, 5, bone);
  p(-2, -11, 4, 1, dim);
  p(-1, -10, 2, 1, c('#1a1020'));
  if (st.windup && !st.hurt) p(-3, -14, 6, 2, 'rgba(255,40,40,0.45)');
  const eye = c(st.windup ? '#ff6a3a' : '#c01818');
  p(-2, -13, 1.5, 1.5, eye);
  p(0.5, -13, 1.5, 1.5, eye);
}

function slime(p, pulse, c, st) {
  p(-6, -4, 12, 4, c('#2d8a3a'));
  p(-5, -7, 10, 3, c('#4fc05a'));
  p(-3, -9, 6, 2, c('#4fc05a'));
  p(-4, -7, 2, 1, c('#a8f0a0'));
  p(-2, -8, 1, 1, c('#a8f0a0'));
  p(-6, -1, 12, 1, c('#1d5a25'));
  const eye = c(st.windup ? '#fff04a' : '#0e2a12');
  p(-3, -5, 1.5, 2, eye);
  p(1.5, -5, 1.5, 2, eye);
}

const ENEMIES = { bat, skeleton, slime };

export function drawEnemy(g, type, px, py, s, pulse = 0, state = {}) {
  const st = { windup: false, hp: 1, maxHp: 1, hurt: false, ...state };
  const draw = ENEMIES[type] || slime;
  shadow(g, px, py, s, type === 'bat' ? 5 : 9);
  let sx = 1, sy = 1;
  if (type === 'slime') {
    sx = st.windup ? 0.8 : 1 + 0.2 * pulse;
    sy = st.windup ? 1.35 : 1 - 0.2 * pulse;
  } else if (type === 'skeleton') {
    sy = 1 - 0.06 * pulse;
  }
  const c = st.hurt ? () => '#ffffff' : (col) => col;
  actor(g, px, py, s, sx, sy, false, (p) => draw(p, pulse, c, st));
  if (st.maxHp > 1) {
    const p = painter(g, px, py, s);
    const x0 = 8 - st.maxHp;
    for (let i = 0; i < st.maxHp; i++) {
      p(x0 + i * 2, 0, 1.5, 1.5, '#100810');
      p(x0 + i * 2 + 0.25, 0.25, 1, 1, i < st.hp ? '#ff3a4a' : '#3a2030');
    }
  }
}

// ---------- HUD ----------

const HEART = [
  '.##.##.',
  '#######',
  '#######',
  '.#####.',
  '..###..',
  '...#...',
];

export function drawHeart(g, x, y, size, full) {
  const p = painter(g, x, y, size);
  const at = (cx, cy) => HEART[cy]?.[cx] === '#';
  HEART.forEach((row, cy) => [...row].forEach((ch, cx) => {
    if (ch !== '#') return;
    const inner = at(cx - 1, cy) && at(cx + 1, cy) && at(cx, cy - 1) && at(cx, cy + 1);
    const col = full ? '#e0303a' : inner ? '#1a0e14' : '#6a2a34';
    p(cx * G / 7, (cy + 0.5) * G / 7, G / 7, G / 7, col);
  }));
  if (full) p(G / 7, 1.5 * G / 7, G / 7, G / 7, '#ff9aa0');
}
