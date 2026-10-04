// Shared constants and pixel helpers for the Satoyama renderer.
// The scene is drawn at W×H "art pixels" and scaled 3× to cover the desktop.
export const W = 640;
export const H = 348;
export const WORLD_W = 1600;
export const GROUND = 262;   // village ground line
export const BANK = 294;     // top of the creek bank
export const WATER = 300;    // creek surface

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
export const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
export const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
export const rgb = (c, a = 1) => (a >= 1
  ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
  : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, a).toFixed(3)})`);
// Light a daylight ("albedo") colour by the ambient light colour.
export const light = (c, amb) => [c[0] * amb[0] / 255, c[1] * amb[1] / 255, c[2] * amb[2] / 255];
export const inRange = (h, a, b) => (a <= b ? h >= a && h < b : h >= a || h < b);

// Deterministic random numbers, so the village looks the same every launch.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Cheap 1D value noise in [0,1].
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const h = (n) => { const s = Math.sin((n + seed * 57.13) * 127.1) * 43758.5453; return s - Math.floor(s); };
  return lerp(h(i), h(i + 1), smooth(f));
}
// 2D value noise in [0,1] (use this for textures; 1D noise on x+y makes diagonal stripes).
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), u = smooth(x - xi), v = smooth(y - yi);
  const h = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
export function fbm1(x, seed = 0, oct = 4) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += noise1(x * f, seed + i * 13) * a; a *= 0.5; f *= 2; }
  return v / (1 - Math.pow(0.5, oct));
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c, g };
}

// ---- drawing primitives (integer pixels only, no anti-aliasing)
export function px(g, x, y, col) { if (col) g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
export function rect(g, x, y, w, h, col) {
  if (col) g.fillStyle = col;
  g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}
export function disc(g, cx, cy, r, col) {
  if (col) g.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw * 2 + 1, 1);
  }
}
export function ellipse(g, cx, cy, rx, ry, col) {
  if (col) g.fillStyle = col;
  for (let dy = -ry; dy <= ry; dy++) {
    const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
    g.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw * 2 + 1, 1);
  }
}
export function line(g, x0, y0, x1, y1, col) {
  if (col) g.fillStyle = col;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 2000; i++) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// Sprites as text: each character maps to a colour in `pal` ('.' or missing = transparent).
// Drawn with the bottom-left at (x, y); flip mirrors horizontally.
export function sprite(g, rows, pal, x, y, flip = false) {
  const h = rows.length, w = rows[0].length;
  for (let r = 0; r < h; r++) {
    const row = rows[r];
    for (let i = 0; i < w; i++) {
      const col = pal[row[i]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(Math.round(x + (flip ? w - 1 - i : i)), Math.round(y - h + r), 1, 1);
    }
  }
}

// 4×4 Bayer matrix for ordered dithering (values 0..1).
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
