// The village and forest: terrain, buildings and props drawn once into a world-sized canvas,
// plus the positions everything else needs (windows, lanterns, spots where people and animals go).
// Colours here are daylight colours; the renderer relights them for the time of day.
import { W, H, WORLD_W, GROUND, BANK, rng, canvas, rect, px, disc, ellipse, line, fbm1, noise1, noise2 } from './util.js';

export const hillY = (x) => GROUND - 78 * Math.exp(-(((x - 200) / 125) ** 6));
export const forestY = (x) => GROUND - 2 + Math.round(2 * Math.sin(x * 0.031));
export function groundY(x) {
  if (x < 360) return Math.round(hillY(x));
  if (x > 930) return forestY(x);
  return GROUND;
}

// ---------------------------------------------------------------- layout (world coordinates)
export const HOUSES = [{ x: 384, w: 50 }, { x: 442, w: 44 }, { x: 494, w: 50 }, { x: 650, w: 52 }];
export const TEMPLE = { hall: 140, pagoda: 222, bell: 282 };
export const BELL = { x: TEMPLE.bell, y: Math.round(hillY(TEMPLE.bell)) - 15 };
export const TORII_X = 364;
export const TORO = [[110, 186], [176, 186], [258, 187], [342, 256], [546, 262]];
export const YAGURA = { x: 604, top: 218 };
export const FIRE = { x: 568, y: 266 };
export const STALL = { x: 528 };
export const SACRED_TREE = { x: 724, top: 130 };
export const PADDY = { x0: 752, x1: 934, upper: [268, 279], lower: [283, 291] };
export const SHISHI = { x: 432, pivotY: 282, rockX: 443 };
export const WELL = { x: 1270 };
export const HUT = { x: 1340 };
export const SHRINE = { x: 1478 };
export const DOG_SPOT = { x: 474, y: 266 };
export const CAT_SPOT = { x: 520, y: 262 };
export const OWL = { x: 1528, y: 186 };
export const ZONES = { temple: 0, village: 250, fields: 420, forest: 960 };
export const LANTERN_STRINGS = (() => {
  const pts = [];
  for (const [x0, y0, x1, y1] of [[YAGURA.x, 222, 520, 238], [YAGURA.x, 222, 690, 238], [YAGURA.x, 222, YAGURA.x - 46, 254], [YAGURA.x, 222, YAGURA.x + 44, 254]]) {
    const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 9);
    for (let i = 1; i < n; i++) { const t = i / n; pts.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 7, ph: Math.random() * 6 }); }
  }
  return pts;
})();
// bamboo stalks are animated (they sway), so only their layout lives here
export const BAMBOO = (() => {
  const r = rng(77), list = [];
  for (let i = 0; i < 64; i++) {
    const x = 944 + r() * 270;
    if (x > 1226) continue;
    list.push({ x, top: 12 + r() * 70, back: r() < 0.45, w: r() < 0.3 ? 3 : 2, ph: r() * 6.28, leaves: Array.from({ length: 7 }, () => ({ t: 0.05 + r() * 0.55, dir: r() < 0.5 ? -1 : 1, len: 4 + r() * 6 })) });
  }
  return list.sort((a, b) => Number(b.back) - Number(a.back));
})();

// ---------------------------------------------------------------- palette (daylight)
const C = {
  grass: '#6c9a4a', grassDark: '#577f3c', grassLight: '#86b25f', blade: '#a2c873',
  forest: '#4a6a3c', forestDark: '#3c5932', forestLight: '#5d8048',
  dirt: '#b69871', dirtDark: '#9a7c5a', dirtLight: '#cbb08a',
  stone: '#9b978d', stoneDark: '#77736a', stoneLight: '#bbb6aa', moss: '#7c9a56',
  thatch: '#b0905c', thatchDark: '#8c6d42', thatchLight: '#cdae76', thatchShade: '#8f7650',
  wood: '#5a3f2c', woodLight: '#7a573a', woodDark: '#432e20', plank: '#4b3424',
  shoji: '#ece4d2', shojiFrame: '#8a7658',
  tile: '#3c3e4c', tileLight: '#5a5d70', tileDark: '#2a2b36',
  red: '#c8463a', redLight: '#de6852', redDark: '#963026',
  white: '#efe7d6', whiteShade: '#cfc5b0', gold: '#d2ac54', goldDark: '#a8843a',
  cedar: '#2e5843', cedarDark: '#233f32', cedarLight: '#3f7458',
  leaf: '#3f6c45', leafDark: '#30563a', leafLight: '#5a8c58', leafHi: '#7aa86a',
  bronze: '#5d6b5e', bronzeLight: '#869480',
};

// ---------------------------------------------------------------- distant ridges (drawn per frame)
export const RIDGES = [
  { p: 0.08, base: 154, amp: [24, 12, 5], freq: [0.0055, 0.016, 0.05], color: [150, 166, 202], haze: 0.62, canopy: 0 },
  { p: 0.2, base: 176, amp: [18, 9, 4], freq: [0.008, 0.023, 0.07], color: [116, 140, 178], haze: 0.45, canopy: 0 },
  { p: 0.36, base: 200, amp: [13, 7, 3], freq: [0.011, 0.03, 0.09], color: [84, 116, 110], haze: 0.27, canopy: 2 },
  { p: 0.56, base: 226, amp: [9, 5, 3], freq: [0.015, 0.04, 0.11], color: [64, 100, 72], haze: 0.13, canopy: 4 },
].map((R, idx) => {
  const width = W + Math.ceil((WORLD_W - W) * R.p) + 4;
  const top = new Int16Array(width), hi = new Uint8Array(width);
  for (let x = 0; x < width; x++) {
    let y = R.base;
    R.amp.forEach((a, i) => { y -= a * Math.sin(x * R.freq[i] + idx * 1.7 + i); });
    if (R.canopy) y -= Math.round(fbm1(x * 0.35, idx, 3) * R.canopy * 2);
    top[x] = Math.round(y);
  }
  for (let x = 1; x < width; x++) hi[x] = top[x] < top[x - 1] ? 1 : 0; // slopes facing the light
  return { ...R, width, top, hi };
});

// ---------------------------------------------------------------- build the static world
let WORLD = null;
export function buildWorld() {
  if (WORLD) return WORLD;
  const { c, g } = canvas(WORLD_W, H);
  const r = rng(2024);
  terrain(g, r);
  sacredCedar(g, r, 84);
  temple(g, r);
  stairs(g);
  torii(g, TORII_X);
  for (const [x, y] of TORO) toro(g, x, y);
  for (const hs of HOUSES) house(g, hs, r);
  woodpile(g, 708, 262);
  barrel(g, 438, 262);
  yagura(g, YAGURA.x);
  firePit(g, FIRE.x);
  camphor(g, r, SACRED_TREE.x);
  paddies(g, r);
  scarecrow(g, 858, 268);
  shishiFrame(g);
  forestBack(g, r);
  cedars(g, r);
  well(g, WELL.x);
  toadHut(g, HUT.x);
  jizo(g, 1386); jizo(g, 1395);
  shrine(g, SHRINE.x);
  steppingStones(g, r);
  bankStones(g, r);
  WORLD = { canvas: c };
  return WORLD;
}

function terrain(g, r) {
  for (let x = 0; x < WORLD_W; x++) {
    const y = groundY(x);
    const inForest = x > 930;
    const base = inForest ? C.forest : C.grass;
    // the hill's far (east) slope is in shade: a smooth, dithered falloff rather than hard columns
    const shade = x > 200 && x < 360 ? Math.max(0, Math.min(1, (x - 250) / 60)) * (1 - Math.max(0, (x - 330) / 30)) : 0;
    rect(g, x, y, 1, BANK - y + 1, base);
    for (let yy = y + 1; yy < BANK; yy++) {
      const n = noise2(x * 0.45, yy * 0.6, 3) + noise2(x * 0.09, yy * 0.14, 9) * 0.6;
      const dither = ((x * 7 + yy * 13) % 16) / 16;
      if (shade > 0 && yy < y + 60 && dither < shade * 0.6) px(g, x, yy, C.grassDark);
      else if (n > 1.12) px(g, x, yy, inForest ? C.forestLight : C.grassLight);
      else if (n < 0.46) px(g, x, yy, inForest ? C.forestDark : C.grassDark);
    }
    // grass blades along the top edge
    px(g, x, y, inForest ? C.forestLight : C.grassLight);
    if (r() < 0.45) px(g, x, y - 1, inForest ? C.forestLight : C.blade);
    if (r() < 0.12) px(g, x, y - 2, inForest ? C.forestLight : C.blade);
    // small flowers in the village meadow
    if (!inForest && x > 340 && r() < 0.025) { const fy = y + 10 + r() * 20; px(g, x, fy, r() < 0.5 ? '#f2e6f2' : '#f0c84a'); }
  }
  // the village path
  for (let x = 350; x < 762; x++) {
    for (let y = 263; y < 271; y++) {
      const n = noise2(x * 0.6, y * 0.9, 5);
      px(g, x, y, y === 263 ? C.dirtLight : n > 0.74 ? C.dirtLight : n < 0.26 ? C.dirtDark : C.dirt);
    }
    if (r() < 0.06) px(g, x, 264 + r() * 6, C.stoneDark);
  }
  // forest path to the clearing
  for (let x = 1228; x < 1410; x++) for (let y = 262; y < 268; y++) if (noise2(x * 0.3, y * 0.5, 4) > 0.35) px(g, x, y, noise2(x * 0.8, y * 0.8, 7) > 0.6 ? '#8a7656' : '#76664a');
}

function bankStones(g, r) {
  for (let x = 0; x < WORLD_W; x++) {
    if (x > PADDY.x0 - 4 && x < PADDY.x1 + 4) { rect(g, x, 294, 1, 6, '#6f7a58'); continue; }
    rect(g, x, 294, 1, 6, x > 930 ? '#5a6a48' : '#6f8052');
  }
  for (let i = 0; i < 520; i++) {
    const x = r() * WORLD_W, y = 293 + r() * 7, w = 2 + r() * 5, h = 1 + r() * 2.5;
    ellipse(g, x, y, Math.round(w / 2), Math.max(1, Math.round(h / 2)), r() < 0.5 ? C.stone : C.stoneDark);
    px(g, x - 1, y - 1, C.stoneLight);
    if (r() < 0.3) px(g, x + 1, y - 1, C.moss);
  }
}

// Tiled temple roof: rows of tiles with seams, upturned corners, dark eave line.
function tileRoof(g, cx, eaveY, eaveW, ridgeW, height, flare = 2) {
  for (let i = 0; i <= height; i++) {
    const y = eaveY - i, k = i / height;
    const hw = Math.round((eaveW / 2) * (1 - k) + (ridgeW / 2) * k - (i < 3 ? 0 : Math.sin(k * Math.PI) * 1.5));
    for (let x = cx - hw; x <= cx + hw; x++) {
      let col = i % 3 === 0 ? C.tileDark : (x - cx + i * 2) % 3 === 0 ? C.tile : C.tileLight;
      if (x > cx + hw * 0.35) col = i % 3 === 0 ? '#22232c' : '#34364a';
      px(g, x, y, col);
    }
    if (i === 0) { rect(g, cx - hw, y + 1, hw * 2 + 1, 1, '#1d1e26'); }
  }
  for (let f = 0; f < flare; f++) { px(g, cx - eaveW / 2 - 1 - f, eaveY - 1 - f, C.tile); px(g, cx + eaveW / 2 + 1 + f, eaveY - 1 - f, C.tileDark); }
  rect(g, cx - ridgeW / 2 - 1, eaveY - height - 2, ridgeW + 3, 2, '#22232c');
}

function temple(g, r) {
  const hx = TEMPLE.hall, hb = Math.round(hillY(hx));
  // stone platform
  rect(g, hx - 44, hb - 3, 88, 4, C.stone);
  for (let x = hx - 44; x < hx + 44; x += 6) rect(g, x, hb - 3, 1, 4, C.stoneDark);
  rect(g, hx - 44, hb - 3, 88, 1, C.stoneLight);
  // walls and pillars
  rect(g, hx - 32, hb - 22, 64, 19, C.white);
  rect(g, hx + 10, hb - 22, 22, 19, C.whiteShade);
  for (let x = hx - 32; x <= hx + 30; x += 8) { rect(g, x, hb - 22, 2, 19, C.red); px(g, x, hb - 22, C.redLight); rect(g, x + 1, hb - 21, 1, 18, C.redDark); }
  rect(g, hx - 32, hb - 22, 64, 2, C.redDark);
  // lattice doors
  rect(g, hx - 10, hb - 18, 20, 15, '#3a2a22');
  for (let x = hx - 9; x < hx + 10; x += 3) rect(g, x, hb - 18, 1, 15, '#6a4a32');
  for (let y = hb - 17; y < hb - 3; y += 3) rect(g, hx - 10, y, 20, 1, '#6a4a32');
  rect(g, hx - 44, hb - 4, 88, 1, C.woodDark); // veranda edge
  tileRoof(g, hx, hb - 23, 104, 40, 22, 3);
  rect(g, hx - 22, hb - 47, 3, 3, C.gold); rect(g, hx + 19, hb - 47, 3, 3, C.gold);
  rect(g, hx - 4, hb - 32, 8, 5, C.gold); // name plaque under the gable

  // three-storey pagoda
  const pxC = TEMPLE.pagoda;
  let y = Math.round(hillY(pxC));
  rect(g, pxC - 12, y - 3, 24, 3, C.stone); rect(g, pxC - 12, y - 3, 24, 1, C.stoneLight);
  y -= 3;
  for (const [rw, bw, bh] of [[40, 16, 11], [34, 14, 10], [28, 12, 9]]) {
    rect(g, pxC - bw / 2, y - bh, bw, bh, C.red);
    rect(g, pxC + 1, y - bh, bw / 2 - 1, bh, C.redDark);
    rect(g, pxC - bw / 2 + 2, y - bh + 3, bw - 4, 3, C.white);
    rect(g, pxC - 1, y - bh + 3, 2, 3, '#3a2a22');
    y -= bh;
    tileRoof(g, pxC, y - 1, rw, Math.round(rw * 0.4), 5, 2);
    y -= 7;
  }
  rect(g, pxC, y - 22, 1, 22, C.gold); rect(g, pxC + 1, y - 22, 1, 22, C.goldDark);
  for (let i = 0; i < 7; i++) rect(g, pxC - 1, y - 18 + i * 2, 4, 1, C.goldDark);
  disc(g, pxC + 0.5, y - 24, 1, C.gold);

  // bell house (shōrō)
  const bx = TEMPLE.bell, bb = Math.round(hillY(bx));
  rect(g, bx - 16, bb - 3, 32, 3, C.stone); rect(g, bx - 16, bb - 3, 32, 1, C.stoneLight);
  for (const ox of [-12, 10]) { rect(g, bx + ox, bb - 24, 3, 21, C.woodLight); rect(g, bx + ox + 2, bb - 24, 1, 21, C.woodDark); }
  rect(g, bx - 14, bb - 25, 28, 2, C.wood);
  tileRoof(g, bx, bb - 26, 40, 14, 8, 2);
  // striker log on ropes
  line(g, bx - 9, bb - 23, bx - 9, bb - 15, '#c9b68a'); line(g, bx - 3, bb - 23, bx - 3, bb - 15, '#c9b68a');
  rect(g, bx - 11, bb - 15, 9, 2, '#8a6a4a');
}

function stairs(g) {
  for (let x = 292; x < 358; x += 4) {
    const y = Math.round(hillY(x));
    rect(g, x, y - 1, 5, 1, C.stoneLight);
    rect(g, x, y, 5, 2, C.stone);
    rect(g, x, y + 2, 5, 1, C.stoneDark);
  }
}

function torii(g, x) {
  const b = GROUND;
  for (const ox of [-10, 8]) { rect(g, x + ox, b - 30, 3, 30, C.red); px(g, x + ox, b - 30, C.redLight); rect(g, x + ox + 2, b - 30, 1, 30, C.redDark); rect(g, x + ox - 1, b - 3, 5, 3, '#2c2a2e'); }
  rect(g, x - 13, b - 25, 27, 2, C.red); rect(g, x - 13, b - 24, 27, 1, C.redDark);
  rect(g, x - 16, b - 33, 33, 3, '#2c2a2e'); rect(g, x - 15, b - 30, 31, 1, C.red);
  px(g, x - 17, b - 34, '#2c2a2e'); px(g, x + 17, b - 34, '#2c2a2e');
  rect(g, x - 2, b - 30, 4, 5, '#2c2a2e'); rect(g, x - 1, b - 29, 2, 3, C.gold);
}

function toro(g, x, b) {
  rect(g, x - 3, b - 3, 7, 3, C.stone); rect(g, x - 3, b - 3, 7, 1, C.stoneLight);
  rect(g, x - 1, b - 9, 3, 6, C.stone); px(g, x + 1, b - 8, C.stoneDark);
  rect(g, x - 3, b - 10, 7, 1, C.stoneDark);
  rect(g, x - 2, b - 14, 5, 4, C.stoneLight); rect(g, x, b - 13, 1, 2, '#2c2620');
  rect(g, x - 4, b - 16, 9, 2, C.stone); rect(g, x - 3, b - 17, 7, 1, C.stoneLight);
  px(g, x, b - 18, C.stone);
}

// Thatched farmhouse (kayabuki): stone footing, plank walls, shoji, engawa, steep thatch with moss.
function house(g, hs, r) {
  const { x, w } = hs, b = GROUND;
  rect(g, x - 2, b - 3, w + 4, 3, C.stone); rect(g, x - 2, b - 3, w + 4, 1, C.stoneLight);
  rect(g, x, b - 21, w, 18, C.wood);
  for (let px2 = x + 2; px2 < x + w; px2 += 3) rect(g, px2, b - 21, 1, 18, C.plank);
  rect(g, x + w - 6, b - 21, 6, 18, C.woodDark);
  rect(g, x - 3, b - 5, w + 6, 2, '#8a6a4a'); rect(g, x - 3, b - 5, w + 6, 1, '#a07c56'); // engawa
  hs.windows = [[x + 5, b - 18, 11, 9], [x + w - 16, b - 18, 11, 9]];
  for (const [wx, wy, ww, wh] of hs.windows) {
    rect(g, wx - 1, wy - 1, ww + 2, wh + 2, C.shojiFrame);
    rect(g, wx, wy, ww, wh, C.shoji);
    for (let i = 3; i < ww; i += 3) rect(g, wx + i, wy, 1, wh, '#b8a888');
    for (let j = 3; j < wh; j += 3) rect(g, wx, wy + j, ww, 1, '#b8a888');
  }
  const dx = x + Math.round(w / 2) - 4;
  rect(g, dx, b - 18, 8, 13, '#2a1e16');
  rect(g, dx, b - 18, 8, 5, '#3e4f7a'); rect(g, dx + 3, b - 18, 1, 5, '#2e3b5e'); // noren curtain
  // roof
  const eave = b - 22, top = b - 54, cx = x + w / 2;
  for (let y = eave; y >= top; y--) {
    const k = (eave - y) / (eave - top);
    const hw = (w / 2 + 8) * (1 - k * 0.76);
    for (let xx = Math.round(cx - hw); xx <= Math.round(cx + hw); xx++) {
      const strand = noise2(xx * 1.1, y * 0.18, 21) + (r() - 0.5) * 0.3;
      const shaded = xx > cx + hw * 0.15;
      let col = strand > 0.72 ? C.thatchLight : strand < 0.28 ? C.thatchDark : C.thatch;
      if (shaded) col = strand > 0.72 ? C.thatch : strand < 0.28 ? '#76593a' : C.thatchShade;
      if (y > eave - 5 && noise1(xx * 0.4, 21) > 0.62) col = shaded ? '#5f7246' : C.moss; // moss on the lower thatch
      px(g, xx, y, col);
    }
  }
  rect(g, cx - (w / 2 + 8), eave + 1, w + 17, 1, '#4e3a24'); // eave shadow
  rect(g, cx - 9, top - 3, 18, 4, '#5a4630'); rect(g, cx - 9, top - 3, 18, 1, '#7a6040'); // ridge cap
  for (let i = -8; i < 9; i += 4) rect(g, cx + i, top - 4, 2, 1, '#5a4630');
  rect(g, cx - 3, top + 3, 6, 4, '#2c2116'); // smoke vent under the ridge
  hs.vent = [cx, top + 4];
  hs.ridge = top - 3;
  hs.cx = cx;
}

function woodpile(g, x, b) {
  for (let row = 0; row < 3; row++) for (let i = 0; i < 6 - row; i++) { disc(g, x + i * 3 + row * 1.5, b - 2 - row * 3, 1, '#8a6a4a'); px(g, x + i * 3 + row * 1.5, b - 2 - row * 3, '#c9a878'); }
}
function barrel(g, x, b) { rect(g, x, b - 7, 6, 7, '#6a4a30'); rect(g, x, b - 6, 6, 1, '#3a3a3a'); rect(g, x, b - 2, 6, 1, '#3a3a3a'); rect(g, x + 1, b - 7, 4, 1, '#5a8aa8'); }

function yagura(g, x) {
  const b = GROUND;
  for (const ox of [-15, 13]) { rect(g, x + ox, b - 30, 3, 30, C.woodLight); rect(g, x + ox + 2, b - 30, 1, 30, C.woodDark); }
  for (const ox of [-6, 5]) rect(g, x + ox, b - 30, 2, 30, C.wood);
  line(g, x - 14, b - 2, x + 13, b - 18, C.woodDark); line(g, x + 13, b - 2, x - 14, b - 18, C.woodDark);
  rect(g, x - 18, b - 33, 36, 3, '#8a5a3a'); rect(g, x - 18, b - 33, 36, 1, '#a87048');
  for (let i = 0; i < 36; i += 3) rect(g, x - 18 + i, b - 30, 3, 3, (i / 3) % 2 ? '#f0e8dc' : C.red); // kōhaku bunting
  for (const ox of [-12, 11]) rect(g, x + ox, b - 46, 2, 13, C.wood);
  tileRoof(g, x, b - 47, 32, 12, 5, 2);
  // taiko drum on the platform
  ellipse(g, x, b - 38, 5, 4, '#8a3a2a'); rect(g, x - 5, b - 39, 11, 1, '#e8d8b0'); rect(g, x - 1, b - 42, 2, 1, '#2a2a2a');
}
function firePit(g, x) { for (let i = -6; i <= 6; i += 3) { ellipse(g, x + i, 266, 2, 1, C.stone); px(g, x + i - 1, 265, C.stoneLight); } }

function canopy(g, r, cx, cy, rx, ry, n, cols) {
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    const s = 3 + r() * 5;
    const upper = y < cy - ry * 0.2, left = x < cx;
    disc(g, x, y, Math.round(s), upper && left ? cols[2] : upper || left ? cols[1] : cols[0]);
  }
  for (let i = 0; i < n * 2; i++) { // highlight speckles on the lit side
    const a = Math.PI * (1.0 + r() * 0.8), d = 0.4 + r() * 0.6;
    px(g, cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, cols[3]);
  }
}

function sacredCedar(g, r, x) {
  const b = Math.round(hillY(x)) + 2;
  rect(g, x - 3, b - 70, 6, 70, '#5a4030'); rect(g, x + 1, b - 70, 2, 70, '#43301f');
  for (let y = b - 150; y < b - 40; y++) {
    const k = (y - (b - 150)) / 110, hw = Math.round(3 + k * 24 + (y % 7 < 3 ? 2 : 0) + noise1(y * 0.3, 2) * 3);
    rect(g, x - hw, y, hw * 2 + 1, 1, y % 7 < 3 ? C.cedar : C.cedarDark);
    rect(g, x - hw, y, Math.max(1, hw * 0.5), 1, C.cedarLight);
  }
}

function camphor(g, r, x) {
  const b = GROUND;
  rect(g, x - 7, b - 60, 14, 60, '#5a4535');
  for (let y = b - 60; y < b; y += 2) { px(g, x - 7 + (r() * 14 | 0), y, '#45352a'); px(g, x - 6, y, '#6e5844'); }
  line(g, x - 6, b - 40, x - 24, b - 62, '#5a4535'); line(g, x + 6, b - 44, x + 26, b - 66, '#5a4535');
  canopy(g, r, x, b - 92, 46, 32, 160, [C.leafDark, C.leaf, C.leafLight, C.leafHi]);
  rect(g, x - 8, b - 34, 16, 3, '#e8d9a8'); rect(g, x - 8, b - 34, 16, 1, '#f6ecc4');
  for (let i = -6; i < 7; i += 4) { px(g, x + i, b - 31, '#ffffff'); px(g, x + i + 1, b - 30, '#ffffff'); px(g, x + i, b - 29, '#ffffff'); px(g, x + i + 1, b - 28, '#ffffff'); }
}

function paddies(g, r) {
  // stone retaining walls (ishigaki) in front of each terrace; the water and rice are animated
  const wall = (x0, x1, y0, y1) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const brick = ((Math.floor((x + (y % 4 < 2 ? 0 : 3)) / 6)) * 7 + Math.floor(y / 2) * 3) % 5;
      px(g, x, y, (y % 2 === 0 || (x + (y % 4 < 2 ? 0 : 3)) % 6 === 0) ? C.stoneDark : brick < 2 ? C.stone : C.stoneLight);
    }
  };
  wall(PADDY.x0, PADDY.x1, 279, 283);
  wall(PADDY.x0 - 6, PADDY.x1 + 6, 291, 294);
  rect(g, PADDY.x0, 267, PADDY.x1 - PADDY.x0, 1, '#7a8f4a');
  rect(g, PADDY.x0 - 6, 282, PADDY.x1 - PADDY.x0 + 12, 1, '#7a8f4a');
}

function scarecrow(g, x, b) {
  rect(g, x, b - 18, 1, 18, '#6a4a30');
  rect(g, x - 7, b - 13, 15, 1, '#6a4a30');
  rect(g, x - 3, b - 13, 7, 7, '#3e4f7a'); rect(g, x - 3, b - 9, 7, 1, '#c9a860');
  disc(g, x, b - 15, 2, '#e8dcc0'); px(g, x - 1, b - 15, '#2a2a2a'); px(g, x + 1, b - 15, '#2a2a2a');
  rect(g, x - 4, b - 18, 9, 1, '#c9a860'); rect(g, x - 2, b - 19, 5, 1, '#c9a860'); rect(g, x - 1, b - 20, 3, 1, '#b8964e');
}

function shishiFrame(g) {
  const { x } = SHISHI, b = 296;
  rect(g, x - 7, b - 16, 2, 16, '#7a9a4a'); rect(g, x + 6, b - 16, 2, 16, '#7a9a4a');
  rect(g, x - 7, b - 15, 15, 1, '#5f7f3a');
  ellipse(g, SHISHI.rockX, b - 2, 4, 2, C.stone); px(g, SHISHI.rockX - 2, b - 4, C.stoneLight);
  rect(g, x - 22, b - 7, 12, 6, C.stone); rect(g, x - 22, b - 7, 12, 1, C.stoneLight); rect(g, x - 21, b - 6, 10, 2, '#5a86a6'); // basin
  line(g, x - 40, b - 20, x - 18, b - 15, '#8fb35a'); line(g, x - 40, b - 19, x - 18, b - 14, '#6f9442'); // feed pipe
  rect(g, x - 41, b - 21, 2, 21, '#7a9a4a');
}

function forestBack(g, r) {
  // a layered tree line behind the bamboo and cedars: far conifer tips, then a darker, nearer canopy
  for (const [shade, base, tall, step] of [['#3a5a46', 196, 46, 7], ['#2f4c3a', 214, 38, 6]]) {
    for (let x = 920; x < 1600; x += step + r() * step) {
      const top = base - tall * (0.5 + r() * 0.5), hw0 = 5 + r() * 5;
      for (let y = Math.round(top); y < GROUND; y++) {
        const k = Math.min(1, (y - top) / (tall * 0.8));
        const hw = Math.round(1 + k * hw0 + ((y % 5) < 2 ? 1 : 0));
        rect(g, x - hw, y, hw * 2 + 1, 1, shade);
      }
    }
  }
  for (let i = 0; i < 40; i++) { const x = 930 + r() * 670; rect(g, x, 230, 1, forestY(x) - 230, '#2a3a28'); }
  for (let i = 0; i < 90; i++) { // ferns and undergrowth
    const x = 930 + r() * 670, y = forestY(x) + 1 + r() * 26;
    for (let k = -2; k <= 2; k++) line(g, x, y, x + k * 2, y - 3 - Math.abs(k), k % 2 ? '#5f8a48' : '#4e7a3c');
  }
  for (let i = 0; i < 26; i++) { // mushrooms
    const x = 1180 + r() * 400, y = forestY(x) + 2 + r() * 8;
    rect(g, x, y - 2, 1, 2, '#e8dcc0'); rect(g, x - 1, y - 3, 3, 1, r() < 0.5 ? '#c8463a' : '#c8a060');
  }
}

function cedars(g, r) {
  for (const cx of [1192, 1216, 1420, 1446, 1500, 1532, 1560, 1592]) {
    const b = forestY(cx), hgt = 120 + r() * 70;
    rect(g, cx - 2, b - 40, 5, 40, '#4a3528'); rect(g, cx + 1, b - 40, 2, 40, '#3a281e');
    for (let y = Math.round(b - hgt); y < b - 26; y++) {
      const k = (y - (b - hgt)) / hgt, hw = Math.round(2 + k * 18 + (y % 8 < 3 ? 2 : 0) + noise1(y * 0.4, cx) * 2);
      rect(g, cx - hw, y, hw * 2 + 1, 1, y % 8 < 4 ? C.cedar : C.cedarDark);
      rect(g, cx - hw, y, Math.max(1, Math.round(hw * 0.4)), 1, C.cedarLight);
    }
  }
}

function well(g, x) {
  const b = forestY(x) + 1;
  rect(g, x - 11, b - 13, 22, 13, C.stone);
  for (let yy = b - 13; yy < b; yy += 3) for (let xx = x - 11 + ((yy / 3) % 2) * 3; xx < x + 11; xx += 6) rect(g, xx, yy, 1, 3, C.stoneDark);
  rect(g, x - 12, b - 14, 24, 2, C.stoneLight);
  rect(g, x - 9, b - 34, 2, 20, '#6b4a32'); rect(g, x + 8, b - 34, 2, 20, '#6b4a32');
  for (let i = 0; i < 5; i++) rect(g, x - 14 + i, b - 35 - i, 28 - i * 2, 1, i ? '#5a3d29' : '#3e2a1c');
  rect(g, x - 2, b - 32, 4, 3, '#8a8a8a'); rect(g, x, b - 29, 1, 11, '#c9b68a'); rect(g, x - 3, b - 18, 6, 4, '#8a6a4a'); rect(g, x - 3, b - 18, 6, 1, '#a8885e');
}

function toadHut(g, x) {
  const b = forestY(x) + 1;
  rect(g, x - 11, b - 12, 22, 12, '#7a5a3a');
  for (let xx = x - 10; xx < x + 11; xx += 3) rect(g, xx, b - 12, 1, 12, '#664a2e');
  ellipse(g, x, b - 4, 4, 4, '#1e140c'); rect(g, x - 4, b - 4, 9, 4, '#1e140c');
  for (let i = 0; i < 12; i++) { const hw = 15 - i; rect(g, x - hw, b - 13 - i, hw * 2, 1, i % 3 ? C.thatch : C.thatchDark); }
  rect(g, x - 4, b - 26, 8, 2, '#7a6040');
  rect(g, x + 12, b - 16, 1, 4, '#5a4030');
  rect(g, x - 8, b - 1, 3, 1, '#8a6a4a'); // a tiny doorstep
}

function jizo(g, x) {
  const b = forestY(x) + 1;
  rect(g, x - 3, b - 10, 6, 10, '#9a968c'); rect(g, x + 1, b - 10, 2, 10, '#7f7b72');
  disc(g, x, b - 12, 3, '#a6a298');
  rect(g, x - 3, b - 9, 6, 3, '#c8463a'); px(g, x - 1, b - 7, '#a8362c');
}

function shrine(g, x) {
  const b = forestY(x) + 1;
  rect(g, x - 9, b - 3, 18, 3, C.stone);
  rect(g, x - 6, b - 13, 12, 10, C.woodLight); rect(g, x - 2, b - 11, 4, 6, '#2a1e16');
  tileRoof(g, x, b - 14, 20, 6, 4, 1);
  rect(g, x - 1, b - 9, 2, 1, C.gold);
  // tiny torii in front
  rect(g, x - 18, b - 12, 2, 12, C.red); rect(g, x - 9 - 16, b - 12, 2, 12, C.red); rect(g, x - 27, b - 13, 13, 1, '#2c2a2e'); rect(g, x - 26, b - 10, 11, 1, C.red);
}

function steppingStones(g, r) {
  for (let x = 1236; x < 1420; x += 9 + r() * 4) { const y = forestY(x) + 3; ellipse(g, x, y, 3, 1, C.stone); px(g, x - 1, y - 1, C.stoneLight); }
}
