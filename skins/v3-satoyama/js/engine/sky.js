// Sky: dithered gradient with sun glow, Milky Way, stars, moon, light rays, lit clouds, rain deck.
import { W, rng, canvas, mix, rgb, BAYER, fbm1, noise2, disc } from './util.js';

const SKY_H = 210;
const skyCache = { key: '', img: null, c: null, g: null };
const r = rng(31);

const STARS = Array.from({ length: 240 }, () => ({
  x: r() * W | 0, y: r() * 190 | 0, b: Math.pow(r(), 3), p: r() * 6.28, s: 0.5 + r() * 2,
  col: r() < 0.2 ? [200, 215, 255] : r() < 0.35 ? [255, 236, 200] : [255, 252, 245],
}));

// Milky Way: a soft diagonal band of faint noise (a mask in white, drawn additively at night)
const milky = (() => {
  const { c, g } = canvas(W, SKY_H);
  const img = g.createImageData(W, SKY_H);
  for (let y = 0; y < SKY_H; y++) for (let x = 0; x < W; x++) {
    const d = Math.abs((y - 30) - (x * 0.22) + fbm1(x * 0.02, 4) * 24) / 34;
    if (d > 1) continue;
    const n = noise2(x * 0.05, y * 0.09, 7) * 0.55 + noise2(x * 0.16, y * 0.24, 9) * 0.3 + noise2(x * 0.6, y * 0.7, 11) * 0.15;
    const a = Math.max(0, (1 - d) * (n - 0.35) * 1.8);
    const i = (y * W + x) * 4;
    img.data[i] = 210; img.data[i + 1] = 214; img.data[i + 2] = 255; img.data[i + 3] = Math.min(255, a * 120);
  }
  g.putImageData(img, 0, 0);
  return c;
})();

// Cloud shapes: puffs merged into a mask, then classified into highlight / body / shadow pixels.
function makeCloud(seed, wide = false) {
  const rr = rng(seed);
  const w = wide ? 150 : 60 + rr() * 60, h = wide ? 46 : 22 + rr() * 14;
  const cw = Math.ceil(w), ch = Math.ceil(h);
  const mask = new Uint8Array(cw * ch);
  const n = wide ? 22 : 6 + (rr() * 6 | 0);
  for (let i = 0; i < n; i++) {
    const px0 = 8 + rr() * (cw - 16), py0 = ch * 0.45 + rr() * ch * 0.35, rad = (wide ? 9 : 5) + rr() * (wide ? 14 : 9);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const dx = x - px0, dy = (y - py0) * 1.25;
      if (dx * dx + dy * dy < rad * rad && y < ch - 2) mask[y * cw + x] = 1;
    }
  }
  const tone = new Uint8Array(cw * ch); // 0 none, 1 shadow, 2 body, 3 highlight
  for (let x = 0; x < cw; x++) {
    let top = -1, bottom = -1;
    for (let y = 0; y < ch; y++) if (mask[y * cw + x]) { if (top < 0) top = y; bottom = y; }
    if (top < 0) continue;
    for (let y = top; y <= bottom; y++) {
      if (!mask[y * cw + x]) continue;
      const fromTop = y - top, fromBottom = bottom - y;
      tone[y * cw + x] = fromTop <= 1 ? 3 : fromBottom <= 2 ? 1 : 2;
    }
  }
  return { w: cw, h: ch, tone, colored: null, key: '' };
}

const CLOUDS = Array.from({ length: 9 }, (_, i) => ({
  shape: makeCloud(100 + i), x: i * 82 + r() * 50, y: 18 + r() * 96, v: 1.2 + r() * 2.4, vx: 0, depth: 0.03 + r() * 0.06,
}));
const DECK = Array.from({ length: 8 }, (_, i) => ({ shape: makeCloud(300 + i, true), x: i * 100 - 60, y: -14 + r() * 40, v: 5 + r() * 4 }));

function colorize(shape, cols) {
  const key = cols.map((c) => c.map((v) => v >> 3).join(',')).join('|');
  if (shape.key === key && shape.colored) return shape.colored;
  const { c, g } = shape.colored ? { c: shape.colored, g: shape.colored.getContext('2d') } : canvas(shape.w, shape.h);
  const img = g.createImageData(shape.w, shape.h);
  for (let i = 0; i < shape.tone.length; i++) {
    const t = shape.tone[i];
    if (!t) continue;
    const col = cols[t - 1];
    img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  shape.colored = c; shape.key = key;
  return c;
}

function buildGradient(env) {
  const key = `${env.top.map((v) => v | 0)}|${env.mid.map((v) => v | 0)}|${env.horizon.map((v) => v | 0)}|${env.sun.x | 0},${env.sun.y | 0}|${(env.warm * 20) | 0}|${(env.moon.vis * 10) | 0}`;
  if (key === skyCache.key) return skyCache.c;
  if (!skyCache.c) { const o = canvas(W, SKY_H); skyCache.c = o.c; skyCache.g = o.g; skyCache.img = o.g.createImageData(W, SKY_H); }
  const d = skyCache.img.data;
  const { sun, moon, glow } = env;
  const sunA = sun.vis * (0.35 + env.warm * 0.65), moonA = moon.vis * 0.35;
  for (let y = 0; y < SKY_H; y++) {
    const t = y / (SKY_H - 1);
    const base = t < 0.55 ? mix(env.top, env.mid, t / 0.55) : mix(env.mid, env.horizon, (t - 0.55) / 0.45);
    for (let x = 0; x < W; x++) {
      let c0 = base[0], c1 = base[1], c2 = base[2];
      if (sunA > 0.01) {
        const dx = (x - sun.x) / 260, dy = (y - sun.y) / 150, k = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
        const a = k * k * sunA;
        c0 += (glow[0] - c0) * a; c1 += (glow[1] - c1) * a; c2 += (glow[2] - c2) * a;
      }
      if (moonA > 0.01) {
        const dx = (x - moon.x) / 90, dy = (y - moon.y) / 90, k = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
        const a = k * k * moonA;
        c0 += (190 - c0) * a; c1 += (200 - c1) * a; c2 += (235 - c2) * a;
      }
      const b = BAYER[(y & 3) * 4 + (x & 3)];
      const i = (y * W + x) * 4;
      d[i] = Math.min(255, Math.floor(c0 / 5 + b) * 5);
      d[i + 1] = Math.min(255, Math.floor(c1 / 5 + b) * 5);
      d[i + 2] = Math.min(255, Math.floor(c2 / 5 + b) * 5);
      d[i + 3] = 255;
    }
  }
  skyCache.g.putImageData(skyCache.img, 0, 0);
  skyCache.key = key;
  return skyCache.c;
}

export function drawSky(g, env, t, camX, pointer, dt) {
  g.drawImage(buildGradient(env), 0, 0);
  g.fillStyle = rgb(env.horizon);
  g.fillRect(0, SKY_H, W, 400);

  // stars and the Milky Way
  if (env.stars > 0.02) {
    g.globalAlpha = env.stars * 0.75;
    g.globalCompositeOperation = 'lighter';
    g.drawImage(milky, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    for (const s of STARS) {
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * s.s + s.p));
      const a = env.stars * (0.25 + s.b * 0.75) * tw;
      g.fillStyle = rgb(s.col, a);
      g.fillRect(s.x, s.y, 1, 1);
      if (s.b > 0.75) { g.fillStyle = rgb(s.col, a * 0.35); g.fillRect(s.x - 1, s.y, 3, 1); g.fillRect(s.x, s.y - 1, 1, 3); }
    }
  }

  // moon: shaded disc with craters
  if (env.moon.vis > 0.02) {
    const { x, y } = env.moon, a = env.moon.vis;
    g.globalAlpha = a;
    disc(g, x, y, 10, '#f3efdc');
    g.fillStyle = 'rgba(150,150,170,0.45)';
    for (let dy = -10; dy <= 10; dy++) { const hw = Math.floor(Math.sqrt(100 - dy * dy)); g.fillRect(Math.round(x + hw * 0.35), Math.round(y + dy), Math.max(0, Math.round(hw * 0.65)) + 1, 1); }
    g.fillStyle = 'rgba(190,186,170,0.8)';
    for (const [dx, dy, rr] of [[-4, -3, 2], [3, 4, 1], [-1, 5, 1], [4, -5, 1]]) disc(g, x + dx, y + dy, rr, null);
    g.globalAlpha = 1;
  }

  // sun disc, and long warm rays at dawn and dusk
  if (env.sun.vis > 0.02 && env.sun.y < 230) {
    const { x, y } = env.sun;
    disc(g, x, y, 11, rgb(mix(env.glow, [255, 255, 240], 0.5), 0.35 * env.sun.vis));
    disc(g, x, y, 8, rgb(mix(env.glow, [255, 255, 245], 0.75), env.sun.vis));
    if (env.warm > 0.15) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const ang = Math.PI * (0.05 + i * 0.13) + Math.sin(t * 0.05 + i) * 0.02 + (x > W / 2 ? Math.PI * 0.12 : -Math.PI * 0.05);
        const len = 520, spread = 0.025 + (i % 3) * 0.01;
        const gr = g.createLinearGradient(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
        gr.addColorStop(0, rgb(env.glow, 0.12 * env.warm * env.sun.vis));
        gr.addColorStop(1, rgb(env.glow, 0));
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(x, y);
        g.lineTo(x + Math.cos(ang - spread) * len, y + Math.sin(ang - spread) * len);
        g.lineTo(x + Math.cos(ang + spread) * len, y + Math.sin(ang + spread) * len);
        g.fill();
      }
      g.restore();
    }
  }

  // clouds lit for the time of day; the pointer can push them
  const bright = 1 - env.dark * 0.92;
  const body = mix(env.horizon, [255, 255, 255], 0.55).map((v) => v * bright);
  const high = mix(body, env.sun.vis > 0.1 ? env.glow : [230, 236, 255], 0.35 + env.warm * 0.3).map((v) => Math.min(255, v * 1.08));
  const shade = mix(body, env.top, 0.42).map((v) => v * 0.86);
  const rainy = env.rain;
  for (const cl of CLOUDS) {
    if (pointer && pointer.inSky) {
      const cx = cl.x + cl.shape.w / 2, cy = cl.y + cl.shape.h / 2;
      if (Math.abs(pointer.sx - cx) < cl.shape.w / 2 && Math.abs(pointer.sy - cy) < cl.shape.h / 2) cl.vx += pointer.dx * 0.25;
    }
    cl.vx *= 0.96;
    cl.x += (cl.v * (1 + rainy * 1.5) + cl.vx) * dt;
    const span = W + cl.shape.w + 40;
    if (cl.x > W + 20) cl.x -= span;
    if (cl.x < -cl.shape.w - 20) cl.x += span;
    g.globalAlpha = 0.92 * (1 - rainy * 0.2);
    g.drawImage(colorize(cl.shape, [shade, body, high]), Math.round(cl.x - camX * cl.depth), Math.round(cl.y));
  }
  g.globalAlpha = 1;
  if (rainy > 0.02) {
    const deckBody = mix(env.mid, [120, 126, 140], 0.5).map((v) => v * (1 - env.dark * 0.6));
    const cols = [deckBody.map((v) => v * 0.8), deckBody, deckBody.map((v) => Math.min(255, v * 1.12))];
    g.globalAlpha = rainy;
    for (const d of DECK) {
      d.x += d.v * dt;
      if (d.x > W + 20) d.x -= W + d.shape.w + 120;
      g.drawImage(colorize(d.shape, cols), Math.round(d.x), Math.round(d.y));
    }
    g.globalAlpha = 1;
  }
}

export const SKY_HEIGHT = SKY_H;
export { CLOUDS };
