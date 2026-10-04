// Animated parts of the world: paddies and rice, bamboo, the bamboo pump, bell, smoke,
// festival lanterns, the creek (with reflections of the lit village) and the reeds in front.
import { W, H, WATER, BANK, GROUND, canvas, rect, px, line, ellipse, mix, rgb, light, clamp, lerp, rng, noise1 } from './util.js';
import { PADDY, HOUSES, BELL, SHISHI, BAMBOO, LANTERN_STRINGS, forestY } from './world.js';

const r = rng(5150);
const REEDS = Array.from({ length: 240 }, () => ({ x: r() * 1600, h: 4 + r() * 9, ph: r() * 6.28, flower: r() < 0.18, kind: r() < 0.5 }));
const refl = canvas(W, 96);

// ---------------------------------------------------------------- paddies: sky-coloured water + rice in the wind
export function drawPaddies(g, ctx) {
  const { t, env, camX, pointer, wind } = ctx;
  const X = (x) => Math.round(x - camX);
  if (PADDY.x1 < camX - 10 || PADDY.x0 > camX + W + 10) return null;
  const water = mix(env.horizon, [255, 255, 255], 0.25);
  let rustle = false;
  for (const [y0, y1, x0, x1] of [[PADDY.upper[0], PADDY.upper[1], PADDY.x0, PADDY.x1], [PADDY.lower[0], PADDY.lower[1], PADDY.x0 - 6, PADDY.x1 + 6]]) {
    for (let y = y0; y < y1; y++) rect(g, X(x0), y, x1 - x0, 1, rgb(mix(water, env.top, (y - y0) / (y1 - y0) * 0.6)));
    for (let x = x0 + 1; x < x1; x += 2) {
      const sx = X(x);
      if (sx < -4 || sx > W + 4) continue;
      let sway = Math.sin(x * 0.08 - t * 2.3) * wind + Math.sin(x * 0.021 - t * 0.7) * wind * 0.6;
      if (pointer && pointer.active) {
        const dx = x - pointer.wx, dy = (y1 - 4) - pointer.wy;
        const d = Math.hypot(dx, dy * 2);
        if (d < 14) { sway += Math.sign(dx || 1) * (14 - d) * 0.35; if (Math.abs(pointer.dx) > 0.5) rustle = true; }
      }
      const base = y1 - 1;
      rect(g, sx, base - 3, 1, 3, '#4f8a38');
      px(g, sx + Math.round(sway * 0.4), base - 4, '#6aa444');
      px(g, sx + Math.round(sway * 0.7), base - 5, '#86bd56');
      px(g, sx + Math.round(sway), base - 6, (x % 6 === 1) ? '#c8d878' : '#a2cf68');
    }
  }
  return rustle;
}

// ---------------------------------------------------------------- bamboo grove (sways; reacts to the pointer)
const bambooPush = new Map();
export function drawBamboo(g, ctx, layer) {
  const { t, camX, pointer, wind, dt } = ctx;
  let touched = false;
  for (const b of BAMBOO) {
    if (b.back !== (layer === 'back')) continue;
    const sx = Math.round(b.x - camX);
    if (sx < -30 || sx > W + 30) continue;
    const ground = forestY(b.x) + 1, height = ground - b.top;
    let push = bambooPush.get(b) || 0;
    if (pointer && pointer.active && Math.abs(pointer.wx - b.x) < 4 && pointer.wy < ground && pointer.wy > b.top && Math.abs(pointer.dx) > 0.4) { push += pointer.dx * 0.6; touched = true; }
    push *= Math.pow(0.4, dt);
    bambooPush.set(b, push);
    const amp = (wind * 3 + 2) * (b.back ? 0.7 : 1);
    const c1 = b.back ? '#5a8448' : '#8fbf62', c2 = b.back ? '#45683a' : '#5f8a42', c3 = b.back ? '#6a9454' : '#b4dc86', leaf = b.back ? '#4e7a3c' : '#6da04c', leaf2 = b.back ? '#3f6631' : '#88bb5f';
    const at = (y) => { const k = (ground - y) / height; return sx + (Math.sin(t * 0.7 + b.ph) * amp + push) * k * k; };
    for (let y = ground; y > b.top; y -= 2) {
      const x = Math.round(at(y));
      rect(g, x, y - 2, b.w, 2, c1);
      px(g, x, y - 2, c3);
      if (b.w > 2) px(g, x + b.w - 1, y - 2, c2);
      if (((ground - y) | 0) % 11 < 2) rect(g, x, y - 1, b.w, 1, c2);
    }
    for (const lf of b.leaves) {
      const y = Math.round(b.top + height * lf.t), x = Math.round(at(y));
      const flutter = Math.sin(t * 3 + lf.t * 20 + b.ph) * 1.2;
      line(g, x + 1, y, x + 1 + lf.dir * lf.len, y + 3 + flutter, leaf);
      line(g, x + 1, y + 1, x + 1 + lf.dir * (lf.len - 2), y + 5 + flutter, leaf2);
    }
  }
  return touched;
}

// ---------------------------------------------------------------- bamboo pump (shishi-odoshi)
const pump = { phase: 0, knock: false, period: 10 };
export function triggerPump() { if (pump.phase < 0.78) pump.phase = 0.78; }
export function drawShishi(g, ctx) {
  const { dt, camX } = ctx;
  pump.phase += dt / pump.period;
  let knocked = false;
  if (pump.phase >= 1) { pump.phase -= 1; }
  const ph = pump.phase;
  let ang = 0.45 + Math.sin(ctx.t * 6) * 0.008 * (ph < 0.8 ? ph / 0.8 : 0);
  if (ph > 0.8 && ph < 0.85) ang = lerp(0.45, -0.62, (ph - 0.8) / 0.05);
  else if (ph >= 0.85 && ph < 0.9) ang = -0.62;
  else if (ph >= 0.9 && ph < 0.925) ang = lerp(-0.62, 0.45, (ph - 0.9) / 0.025);
  if (ph >= 0.925 && !pump.knock) { pump.knock = true; knocked = true; }
  if (ph < 0.9) pump.knock = false;
  const sx = Math.round(SHISHI.x - camX), sy = SHISHI.pivotY;
  if (sx < -60 || sx > W + 60) return knocked;
  const ex = sx - Math.cos(ang) * 16, ey = sy - Math.sin(ang) * 16, cx = sx + Math.cos(ang) * 10, cy = sy + Math.sin(ang) * 10;
  line(g, ex, ey, cx, cy, '#a8c45a'); line(g, ex, ey + 1, cx, cy + 1, '#7a9a42'); line(g, ex, ey + 2, cx, cy + 2, '#5f7f34');
  px(g, ex, ey, '#3a4a22'); px(g, ex, ey + 1, '#3a4a22');
  rect(g, sx - 1, sy, 3, 2, '#5f7f34');
  // water: a thin stream from the feed pipe into the open end, then a pour into the basin
  if (ph < 0.8) for (let i = 0; i < 4; i++) px(g, sx - 18, sy - 10 + ((ctx.t * 40 + i * 3) % 9), '#cfe6f2');
  if (ph >= 0.82 && ph < 0.9) for (let i = 0; i < 6; i++) px(g, ex - 1 + (i % 2), ey + 2 + ((ctx.t * 70 + i * 3) % 10), '#d8eef8');
  return knocked;
}

// ---------------------------------------------------------------- temple bell (swings after it is struck)
export function drawBell(g, ctx, since) {
  const sx = Math.round(BELL.x - ctx.camX);
  if (sx < -30 || sx > W + 30) return;
  const swing = since < 3500 ? Math.sin(since / 120) * 1.6 * (1 - since / 3500) : 0;
  const bx = sx + Math.round(swing);
  rect(g, bx - 4, BELL.y - 1, 9, 12, '#5d6b5e');
  rect(g, bx - 4, BELL.y - 1, 2, 12, '#869480');
  rect(g, bx + 3, BELL.y - 1, 2, 12, '#46524a');
  for (let y = BELL.y + 1; y < BELL.y + 9; y += 3) rect(g, bx - 3, y, 7, 1, '#4d5a4e');
  rect(g, bx - 5, BELL.y + 10, 11, 2, '#4d5a4e');
  rect(g, bx - 1, BELL.y - 3, 3, 2, '#3a3a3a');
  // the striker log swings in just before the strike
  const strike = since < 500 ? Math.sin((since / 500) * Math.PI) * 4 : 0;
  rect(g, sx - 15 + Math.round(strike), BELL.y + 5, 9, 2, '#8a6a4a');
}

// ---------------------------------------------------------------- chimney smoke
export function drawSmoke(g, ctx) {
  const { t, hour, camX, wind } = ctx;
  const amount = (hour >= 5.5 && hour < 9) || (hour >= 16.5 && hour < 20) ? 1 : hour >= 20 && hour < 23 ? 0.5 : 0.18;
  for (const hs of HOUSES) {
    if (!hs.vent) continue;
    const sx0 = hs.vent[0] - camX;
    if (sx0 < -40 || sx0 > W + 60) continue;
    for (let i = 0; i < 12; i++) {
      const age = (t * 0.08 + i / 12 + hs.x * 0.013) % 1;
      const x = sx0 + age * age * (22 + wind * 14) + Math.sin(age * 7 + i) * 2, y = hs.vent[1] - age * 52;
      const a = (1 - age) * 0.5 * amount;
      g.fillStyle = `rgba(222,222,226,${a.toFixed(3)})`;
      const s = age > 0.55 ? 4 : age > 0.25 ? 3 : 2;
      g.fillRect(Math.round(x), Math.round(y), s, s - 1);
    }
  }
}

// ---------------------------------------------------------------- festival lantern strings
export function drawLanterns(g, ctx, pointerSway) {
  const { t, camX } = ctx;
  for (const L of LANTERN_STRINGS) {
    const sx = L.x - camX;
    if (sx < -10 || sx > W + 10) continue;
    const sway = Math.sin(t * 1.4 + L.ph) * 0.6 + (pointerSway(L) || 0);
    const x = Math.round(sx + sway), y = Math.round(L.y);
    px(g, x, y - 2, '#2a2a2a');
    rect(g, x - 1, y - 1, 3, 4, '#d8503a'); rect(g, x - 1, y - 1, 3, 1, '#2a2a2a'); rect(g, x - 1, y + 3, 3, 1, '#2a2a2a');
  }
}

// ---------------------------------------------------------------- the creek
export function drawCreek(g, src, ctx, fx) {
  const { t, env, camX, rain } = ctx;
  // reflection: the strip of the finished frame above the bank, mirrored, squashed and rippled
  const R0 = WATER - 96;
  refl.g.clearRect(0, 0, W, 96);
  refl.g.drawImage(src, 0, R0, W, 96, 0, 0, W, 96);
  const deep = light([34, 66, 92], env.ambient), shallow = light([70, 110, 130], env.ambient);
  for (let y = WATER; y < H; y++) {
    const rr = y - WATER;
    const srcRow = Math.max(0, 95 - Math.floor(4 + rr * 1.8));
    const wob = Math.sin(rr * 0.9 + t * 2.2) * (0.6 + rr * 0.05) + Math.sin(rr * 2.3 - t * 3.1) * 0.5;
    g.globalAlpha = 0.62 - rr * 0.004;
    g.drawImage(refl.c, 0, srcRow, W, 1, Math.round(wob), y, W, 1);
    g.globalAlpha = 1;
    g.fillStyle = rgb(mix(shallow, deep, rr / (H - WATER)), 0.42 + rr * 0.006);
    g.fillRect(0, y, W, 1);
  }
  // shore line and soft foam
  g.fillStyle = rgb(light([30, 40, 34], env.ambient), 0.55); g.fillRect(0, WATER, W, 1);
  // flow sparkles (sky-coloured, brighter by day)
  const spark = rgb(mix(env.horizon, [255, 255, 255], 0.6), 0.55 + (1 - env.dark) * 0.35);
  g.fillStyle = spark;
  for (let x = 0; x < W; x++) {
    const wx = x + camX;
    for (const row of [303, 309, 316, 325, 336]) {
      const v = Math.sin(wx * 0.29 - t * 2.4 + row) + Math.sin(wx * 0.11 + t * 1.2 + row * 2);
      if (v > 1.62) g.fillRect(x, row + ((wx * 7) % 2), (v > 1.85 ? 2 : 1), 1);
    }
  }
  // sun or moon glint path on the water
  const glint = (cx, col, strength) => {
    if (strength < 0.02) return;
    for (let y = WATER + 2; y < H; y += 2) {
      const spread = 3 + (y - WATER) * 0.18;
      for (let k = 0; k < 3; k++) {
        const x = cx + Math.sin(y * 0.7 + t * 3 + k * 2.1) * spread;
        g.fillStyle = rgb(col, strength * (0.8 - (y - WATER) / (H - WATER) * 0.5));
        g.fillRect(Math.round(x), y, 1 + (k === 0 ? 1 : 0), 1);
      }
    }
  };
  if (env.moon.vis > 0.05) glint(env.moon.x, [240, 240, 220], env.moon.vis * 0.8);
  if (env.sun.vis > 0.05 && env.sun.y > 120) glint(env.sun.x, mix(env.glow, [255, 250, 230], 0.5), env.sun.vis * 0.9);
  // raindrop rings
  if (rain > 0.1) {
    g.fillStyle = 'rgba(220,232,245,0.5)';
    for (let i = 0; i < 26 * rain; i++) {
      const ph = (t * 1.5 + i * 0.37) % 1, x = (i * 53 + Math.floor(t * 1.5 + i * 0.37) * 97) % W, y = WATER + 4 + ((i * 29) % (H - WATER - 6));
      const rad = Math.round(ph * 5);
      g.fillRect(x - rad, y, rad * 2 + 1, 1);
    }
  }
  fx.drawRipples(g, camX);
}

// ---------------------------------------------------------------- reeds and irises in front of the creek
export function drawReeds(g, ctx) {
  const { t, env, camX, wind } = ctx;
  const stem = rgb(light([88, 128, 64], env.ambient)), stem2 = rgb(light([66, 102, 50], env.ambient));
  const iris = rgb(light([122, 92, 190], env.ambient)), iris2 = rgb(light([170, 140, 230], env.ambient));
  for (const rd of REEDS) {
    const sx = rd.x - camX;
    if (sx < -6 || sx > W + 6) continue;
    const base = WATER + 1, sway = Math.sin(t * 1.6 + rd.ph) * (0.8 + wind * 0.8);
    line(g, sx, base, sx + sway, base - rd.h, rd.kind ? stem : stem2);
    if (rd.kind) line(g, sx + 1, base, sx + 1 + sway * 0.6, base - rd.h * 0.7, stem2);
    if (rd.flower) { px(g, sx + sway, base - rd.h - 1, iris); px(g, sx + sway + 1, base - rd.h - 2, iris2); px(g, sx + sway - 1, base - rd.h, iris); }
  }
}
