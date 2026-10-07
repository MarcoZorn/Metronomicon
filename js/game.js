// The dungeon. Player input is judged against the audio clock; the world
// (enemies, spikes, gates) advances once per beat, right after each beat's
// Good window closes, so the player always acts first on a beat.
import { now, ctx } from './audio.js';
import { beatToTime, timeToBeat, nearestBeat, judge, GOOD } from './timing.js';
import { startSong } from './music.js';
import { drawTile, drawPlayer, drawEnemy, drawHeart } from './sprites.js';
import { LEVEL } from './level.js';
import { g, W, H, go, panel, menu, store, text, COLORS, vignette } from './main.js';

const S = 48, OY = 64; // tile size, map top
const DIRS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
const FACING = { '0,-1': 'up', '0,1': 'down', '-1,0': 'left', '1,0': 'right' };
const ENEMY = { bat: { hp: 1, pts: 100 }, skeleton: { hp: 2, pts: 250 }, slime: { hp: 1, pts: 150 } };
const MAX_HP = 5;
const MILESTONES = { 10: ['ON BEAT!', '#ffcc4d'], 25: ['GROOVING!', '#4dfff0'], 50: ['NECRO-MAESTRO!', '#ff4dff'] };
const AUTO = new URLSearchParams(location.search).has('auto');

function rng(seed) { // mulberry32: same level, same bat flights
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function game(L = LEVEL) {
  const bpm = L.bpm;
  const grid = L.map.map(r => [...r]);
  let player, exit;
  grid.forEach((row, y) => row.forEach((c, x) => {
    if (c === 'P') { player = { x, y }; row[x] = '.'; }
    if (c === 'E') { exit = { x, y }; }
  }));
  Object.assign(player, { px: player.x, py: player.y, mt: -9, hp: MAX_HP, facing: 'right', hurtAt: -9 });

  const rand = rng(1234);
  const enemies = [], floats = [], parts = [];
  const counts = { Perfect: 0, Good: 0, Miss: 0 };
  let song, songStart, base, nextTick = 0, beat = -1, lastActed = -1, started = false;
  let combo = 0, maxCombo = 0, score = 0, kills = 0, shakeAt = -9, shakeAmt = 0, over = false, layerOn = {};
  let banner = null, stairsAt = -9;

  const offset = () => (AUTO ? 0 : store.offsetMs / 1000);
  const spikesUp = () => (beat + 1) % 2 === 0;          // state for the coming beat
  const gateOpen = () => (beat + 1) % 4 < 2;
  const exitOpen = () => beat + 1 >= L.exitBeat;
  const enemyAt = (x, y) => enemies.find(e => e.x === x && e.y === y);
  const tile = (x, y) => grid[y]?.[x] ?? '#';
  const solid = (x, y) => tile(x, y) === '#' || (tile(x, y) === '|' && !gateOpen());
  const mult = () => 1 + Math.min(3, Math.floor(combo / 8));

  function float(s, x, y, color, size = 20, j = false, t = now()) {
    if (j) floats.splice(0, floats.length, ...floats.filter(f => !f.j)); // one judgement on screen at a time
    floats.push({ s, x, y, color, size, j, t });
  }
  function burst(x, y, color, n = 14, t = now()) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, v = 60 + Math.random() * 180;
      parts.push({ x: x * S + S / 2, y: OY + y * S + S / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color, t });
    }
  }
  function shake(amt) { shakeAt = now(); shakeAmt = amt; }

  function hurt(why) {
    player.hp--;
    player.hurtAt = now();
    combo = 0;
    shake(12);
    burst(player.x, player.y, '#ff4d6d', 18);
    float(why, player.x, player.y - 0.6, '#ff4d6d', 16);
    if (player.hp <= 0) end(false, 'You were slain');
  }

  function setLayers() {
    for (const [name, need] of Object.entries(L.layers)) {
      const on = combo >= need;
      if (on === layerOn[name]) continue;
      layerOn[name] = on;
      song.layers[name].gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, on ? 0.05 : 0.25);
      if (on) float(`+${name.toUpperCase()}`, player.x, player.y - 1.2, '#4dfff0', 14);
    }
  }

  // ---- player: called on keypress with the offset-corrected press time ----
  function act([dx, dy], gt) {
    if (over) return;
    const { beat: b, delta } = nearestBeat(gt, bpm, base);
    if (b < 0) return; // count-in
    started = true;
    let r = judge(delta);
    if (b <= lastActed) r = 'Miss'; // one move per beat
    counts[r]++;
    player.facing = FACING[`${dx},${dy}`];
    const ms = Math.round(delta * 1000);
    if (r === 'Miss') {
      float('Miss', player.x, player.y - 0.4, COLORS.Miss, 22, true);
      return hurt('stumble!');
    }
    lastActed = b;
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    if (MILESTONES[combo]) banner = { s: MILESTONES[combo][0], color: MILESTONES[combo][1], t: now() };
    score += (r === 'Perfect' ? 100 : 50) * mult();
    float(r === 'Perfect' ? 'Perfect!' : `Good ${ms > 0 ? '+' : ''}${ms}`, player.x, player.y - 0.4, COLORS[r], r === 'Perfect' ? 22 : 18, true);
    const nx = player.x + dx, ny = player.y + dy;
    const e = enemyAt(nx, ny);
    if (e) {
      e.hp--; e.hurtAt = now();
      burst(nx, ny, '#ffcc4d', 10);
      shake(4);
      if (e.hp <= 0) {
        enemies.splice(enemies.indexOf(e), 1);
        kills++;
        score += ENEMY[e.type].pts * mult();
        burst(nx, ny, '#efe6ff', 24);
        float(`+${ENEMY[e.type].pts * mult()}`, nx, ny - 0.3, '#ffcc4d', 16);
      }
    } else if (!solid(nx, ny)) {
      Object.assign(player, { px: player.x, py: player.y, mt: now(), x: nx, y: ny });
      if (tile(nx, ny) === '^' && spikesUp()) hurt('spikes!');
      if (nx === exit.x && ny === exit.y && exitOpen() && player.hp > 0) end(true, 'You escaped the crypt!');
    }
    setLayers();
  }

  // ---- world: one tick per beat ----
  function moveEnemy(e, dx, dy) {
    const nx = e.x + dx, ny = e.y + dy;
    if (nx === player.x && ny === player.y) { e.lunge = now(); e.ldx = dx; e.ldy = dy; return hurt(`${e.type}!`); }
    if (solid(nx, ny) || enemyAt(nx, ny) || (nx === exit.x && ny === exit.y)) return;
    Object.assign(e, { px: e.x, py: e.y, mt: now(), x: nx, y: ny });
  }

  function tick(n) {
    beat = n;
    if (started && lastActed < n && combo > 0) {
      combo = 0;
      float('beat skipped', player.x, player.y - 0.4, '#8a7fa3', 12);
    }
    for (const s of L.spawns) {
      if (s.beat !== n || tile(s.x, s.y) !== '.' || enemyAt(s.x, s.y) || (player.x === s.x && player.y === s.y)) continue;
      enemies.push({ type: s.type, x: s.x, y: s.y, px: s.x, py: s.y, mt: -9, hp: ENEMY[s.type].hp,
        born: n, home: { x: s.x, y: s.y }, hurtAt: -9 });
      burst(s.x, s.y, '#b36bff', 16);
    }
    for (const e of [...enemies]) {
      const age = n - e.born;
      if (age === 0 || over) continue;
      if (e.type === 'bat') {
        const [dx, dy] = Object.values(DIRS)[Math.floor(rand() * 4) * 2];
        moveEnemy(e, dx, dy);
      } else if (e.type === 'skeleton' && age % 2 === 0) {
        const ddx = player.x - e.x, ddy = player.y - e.y;
        const tryX = Math.abs(ddx) >= Math.abs(ddy);
        const [dx, dy] = tryX ? [Math.sign(ddx), 0] : [0, Math.sign(ddy)];
        if (solid(e.x + dx, e.y + dy) && !(e.x + dx === player.x && e.y + dy === player.y))
          moveEnemy(e, tryX ? 0 : Math.sign(ddx), tryX ? Math.sign(ddy) : 0);
        else moveEnemy(e, dx, dy);
      } else if (e.type === 'slime' && age % 2 === 0) {
        const up = e.y === e.home.y;
        moveEnemy(e, 0, up ? -1 : 1);
      }
    }
    if (tile(player.x, player.y) === '^' && spikesUp() && !over) hurt('spikes!');
    if (n + 1 === L.exitBeat) { stairsAt = now(); float('STAIRS OPEN!', exit.x, exit.y - 0.6, '#ffcc4d', 20); burst(exit.x, exit.y, '#ffcc4d', 30); }
  }

  const windup = (e, n) => (e.type === 'skeleton' || e.type === 'slime') && (n + 1 - e.born) % 2 === 0;

  function end(won, msg) {
    if (over) return;
    over = true;
    if (won) score += 2000 + player.hp * 500;
    for (const l of Object.values(song.layers)) l.gain.setTargetAtTime(won ? 1 : 0, ctx.currentTime, 0.2);
    if (!won) song.stop();
    let best = 0;
    try { best = +localStorage.getItem('metronomicon.best') || 0; } catch {}
    const isBest = score > best;
    if (isBest) try { localStorage.setItem('metronomicon.best', String(score)); } catch {}
    setTimeout(() => {
      const el = panel(`<h1>${won ? 'ESCAPED' : 'DEFEATED'}</h1><p>${msg}</p>
        <p class="big">${score.toLocaleString()}</p><p class="dim">${isBest ? 'NEW HIGH SCORE!' : `high score ${best.toLocaleString()}`}</p>
        <table><tr><td style="color:${COLORS.Perfect}">Perfect</td><td>${counts.Perfect}</td><td style="color:${COLORS.Good}">Good</td><td>${counts.Good}</td>
        <td style="color:${COLORS.Miss}">Miss</td><td>${counts.Miss}</td></tr>
        <tr><td>max combo</td><td>${maxCombo}</td><td>kills</td><td>${kills}</td><td>hearts</td><td>${Math.max(0, player.hp)}</td></tr></table>
        <button id="again">Play again</button><button class="alt" id="menu">Menu</button>`);
      el.querySelector('#again').onclick = () => go(game(L));
      el.querySelector('#menu').onclick = () => go(menu);
      el.querySelector('#again').focus();
    }, 900);
  }

  // auto-play bot for demos / screenshots (?auto)
  function botDir() {
    const opts = Object.values(DIRS).filter((_, i) => i % 2 === 0);
    const adj = opts.find(([dx, dy]) => enemyAt(player.x + dx, player.y + dy));
    if (adj) return adj;
    const goal = exitOpen() ? exit : enemies.reduce((a, e) =>
      !a || Math.abs(e.x - player.x) + Math.abs(e.y - player.y) < Math.abs(a.x - player.x) + Math.abs(a.y - player.y) ? e : a, null);
    const ok = ([dx, dy]) => !solid(player.x + dx, player.y + dy) && tile(player.x + dx, player.y + dy) !== '^';
    if (goal) {
      const best = opts.filter(ok).sort((a, b) =>
        Math.abs(goal.x - player.x - a[0]) + Math.abs(goal.y - player.y - a[1]) -
        (Math.abs(goal.x - player.x - b[0]) + Math.abs(goal.y - player.y - b[1])))[0];
      if (best && rand() < 0.85) return best;
    }
    const free = opts.filter(ok);
    return free[Math.floor(rand() * free.length)] || opts[0];
  }

  return {
    enter() {
      songStart = now() + 0.6;
      song = startSong(bpm, songStart);
      base = songStart + L.offset;
      setLayers();
      window.__game = { get state() { return { beat, combo, score, hp: player.hp, enemies: enemies.length, over }; } };
    },
    leave() { song.stop(); for (const l of Object.values(song.layers)) l.gain.value = 0; },
    key(code, t) { if (DIRS[code]) act(DIRS[code], t - offset()); },
    update(t) {
      const gt = t - offset();
      while (!over && gt >= beatToTime(nextTick, bpm, base) + GOOD) tick(nextTick++);
      if (!over && timeToBeat(gt, bpm, base) >= L.beats) end(false, 'The song ended. You are trapped forever.');
      if (AUTO && !over) {
        const b = Math.round(timeToBeat(gt, bpm, base));
        if (b >= 0 && b > lastActed && gt >= beatToTime(b, bpm, base) - 0.01) act(botDir(), gt);
      }
    },
    draw(t) {
      const gt = t - offset();
      const bf = timeToBeat(gt, bpm, base);
      const pulse = bf < 0 ? 0 : Math.exp(-(bf - Math.floor(bf)) * 5);
      g.fillStyle = '#0d0a14';
      g.fillRect(0, 0, W, H);
      const sk = Math.max(0, 1 - (t - shakeAt) / 0.3) * shakeAmt;
      g.save();
      g.translate((Math.random() - 0.5) * sk, (Math.random() - 0.5) * sk);

      // map
      grid.forEach((row, y) => row.forEach((c, x) => {
        let kind = 'floor';
        if (c === '#') kind = 'wall';
        else if (c === '^') kind = spikesUp() ? 'spikesUp' : 'spikesDown';
        else if (c === '|') kind = gateOpen() ? 'gateOpen' : 'gateClosed';
        else if (c === 'E') kind = exitOpen() ? 'stairsOpen' : 'stairs';
        drawTile(g, kind, x * S, OY + y * S, S, pulse, (x + y + Math.max(0, Math.floor(bf))) % 2 === 0);
      }));

      const lerp = (o) => {
        const k = Math.min(1, (t - o.mt) / 0.09);
        return [(o.px + (o.x - o.px) * k) * S, OY + (o.py + (o.y - o.py) * k) * S - Math.sin(k * Math.PI) * 10];
      };
      for (const e of enemies) {
        let [ex, ey] = lerp(e);
        const lk = e.lunge ? Math.max(0, 1 - (t - e.lunge) / 0.15) : 0;
        ex += (e.ldx || 0) * lk * S * 0.4; ey += (e.ldy || 0) * lk * S * 0.4;
        drawEnemy(g, e.type, ex, ey, S, pulse, { windup: windup(e, beat), hp: e.hp, maxHp: ENEMY[e.type].hp, hurt: t - e.hurtAt < 0.12 });
      }
      const [ppx, ppy] = lerp(player);
      drawPlayer(g, ppx, ppy, S, pulse, player.facing, t - player.hurtAt < 0.3 && Math.floor(t * 20) % 2 === 0);

      // particles + floating text
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i], a = t - p.t;
        if (a > 0.5) { parts.splice(i, 1); continue; }
        g.globalAlpha = 1 - a / 0.5;
        g.fillStyle = p.color;
        g.fillRect(p.x + p.vx * a, p.y + p.vy * a + 200 * a * a, 5, 5);
      }
      g.globalAlpha = 1;
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i], a = t - f.t;
        if (a > 0.8) { floats.splice(i, 1); continue; }
        const pop = 1 + Math.max(0, 0.4 - a * 3);
        text(f.s, f.x * S + S / 2, OY + f.y * S - a * 40, f.size * pop, f.color, Math.min(1, 2 - a * 2.5));
      }
      g.restore();

      // screen fx: vignette, beat-pulsed edge glow (colour by combo), hurt / stairs flashes
      vignette(0.6);
      const heat = Math.min(1, combo / 30);
      const edge = combo >= 24 ? `hsla(${(t * 300) % 360},100%,60%,` : combo >= 12 ? 'rgba(77,255,240,' : 'rgba(255,204,77,';
      const ga = pulse * (0.12 + heat * 0.45);
      if (ga > 0.01) {
        const eg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * (0.45 - heat * 0.1), W / 2, H / 2, Math.hypot(W, H) / 2);
        eg.addColorStop(0, edge + '0)');
        eg.addColorStop(1, edge + ga + ')');
        g.fillStyle = eg;
        g.fillRect(0, 0, W, H);
      }
      for (const [at, c, dur] of [[player.hurtAt, '255,40,70', 0.35], [stairsAt, '255,204,77', 0.6]]) {
        const k = 1 - (t - at) / dur;
        if (k > 0) { g.fillStyle = `rgba(${c},${k * 0.35})`; g.fillRect(0, 0, W, H); }
      }

      // HUD
      g.fillStyle = '#0d0a14';
      g.fillRect(0, 0, W, OY);
      for (let i = 0; i < MAX_HP; i++) drawHeart(g, 16 + i * 34, 18, 28, i < player.hp);
      // beat bar: ticks slide into the centre heart
      const cx = W / 2, cy = 32;
      for (let k = Math.ceil(bf - 0.2); k < bf + 3; k++) {
        if (k < 0) continue;
        const d = beatToTime(k, bpm, base) - gt;
        for (const side of [-1, 1]) {
          const x = cx + side * d * 120;
          g.fillStyle = Math.abs(d) < GOOD ? '#4dfff0' : '#ffcc4d';
          g.fillRect(x - 3, cy - 14, 6, 28);
        }
      }
      g.fillStyle = `rgba(255,77,109,${0.5 + pulse * 0.5})`;
      const hs = 18 + pulse * 10;
      g.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);

      text(score.toLocaleString(), W - 90, 22, 20, '#efe6ff');
      if (combo >= 2) {
        const hot = Math.min(1, combo / 40);
        const wob = combo >= 16 ? Math.sin(t * 20) * hot * 3 : 0;
        const col = combo >= 24 ? `hsl(${(t * 300) % 360},100%,65%)` : combo >= 12 ? '#4dfff0' : '#ffcc4d';
        text(`${combo} COMBO x${mult()}`, W - 110 + wob, 48, 14 + hot * 8 + pulse * 3, col);
      }
      if (bf < 8) text(bf < 0 ? 'GET READY' : `${L.name.toUpperCase()} · move on the beat!`, W / 2, OY + 280, 24, '#ffcc4d', Math.min(1, (8 - bf) / 2));
      if (AUTO) text('AUTO', 220, 32, 12, '#8a7fa3');
      if (banner) {
        const a = t - banner.t;
        if (a > 1.4) banner = null;
        else {
          const sc = a < 0.15 ? 0.4 + a / 0.15 * 0.8 : 1.2 - Math.min(0.2, (a - 0.15) * 0.6);
          const col = banner.s === 'NECRO-MAESTRO!' ? `hsl(${(t * 300) % 360},100%,65%)` : banner.color;
          text(banner.s, W / 2, H / 2 - 40, 44 * sc, col, Math.min(1, (1.4 - a) * 2.5));
        }
      }
    },
  };
}
