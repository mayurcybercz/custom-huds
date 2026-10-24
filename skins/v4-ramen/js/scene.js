// v4 "Ramen": a roadside ramen stall on a rainy night, drawn entirely in code.
// Logical size is 480x270, rendered at 2x. Static art is cached on layers; rain, steam, people,
// light flicker, ripples and reflections are drawn every frame.
const W = 480, H = 270, S = 2;
const SANS = '"Zen Kaku Gothic New", "Yu Gothic UI", "Meiryo", "Noto Sans CJK JP", sans-serif';
const SERIF = '"Shippori Mincho B1", "Yu Mincho", "Noto Serif CJK JP", serif';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = (a, b) => a + Math.random() * (b - a);

function layer() {
  const c = document.createElement('canvas');
  c.width = W * S; c.height = H * S;
  const g = c.getContext('2d');
  g.scale(S, S);
  return [c, g];
}
const vgrad = (g, y0, y1, stops) => {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
};
function box(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }

// ---------------------------------------------------------------- sprites
const GLOWS = { warm: [255, 160, 70], red: [255, 60, 40], cyan: [150, 230, 255], pink: [255, 70, 170], yellow: [255, 226, 150], cool: [150, 170, 255] };
const glowSprites = {};
for (const [name, [r, gg, b]] of Object.entries(GLOWS)) {
  const [c, g] = layer();
  c.width = c.height = 128;
  g.setTransform(1, 0, 0, 1, 0, 0);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  gr.addColorStop(0.3, `rgba(${r},${gg},${b},0.4)`);
  gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  glowSprites[name] = c;
}
const puff = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
  gr.addColorStop(0, 'rgba(255,238,215,1)');
  gr.addColorStop(0.5, 'rgba(255,230,205,0.45)');
  gr.addColorStop(1, 'rgba(255,225,200,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
  return c;
})();

// ---------------------------------------------------------------- static layers
function buildFar() {
  const [c, g] = layer();
  const r = rng(11);
  g.fillStyle = vgrad(g, 0, 176, [[0, '#050816'], [0.45, '#14142c'], [0.78, '#2b2142'], [1, '#46304e']]);
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 16; i++) { // low cloud smudges lit by the city
    const x = r() * W, y = 10 + r() * 90, rad = 50 + r() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(70,58,100,0.22)'); gr.addColorStop(1, 'rgba(70,58,100,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // far skyline
  let x = -10;
  while (x < W + 10) {
    const w = 14 + r() * 26, top = 50 + r() * 46;
    box(g, x, top, w, 180 - top, '#161a35');
    for (let wy = top + 4; wy < 150; wy += 5) {
      for (let wx = x + 2; wx < x + w - 2; wx += 4) {
        if (r() < 0.15) box(g, wx, wy, 2, 2, r() < 0.8 ? 'rgba(255,214,140,0.36)' : 'rgba(150,220,255,0.34)');
      }
    }
    x += w + r() * 3;
  }
  box(g, 299, 18, 7, 170, '#1a1f3c'); box(g, 302, 6, 1, 14, '#1a1f3c'); // tower with a beacon on top
  for (let wy = 30; wy < 150; wy += 6) if (r() < 0.6) box(g, 301, wy, 3, 2, 'rgba(255,214,140,0.4)');
  // elevated railway
  box(g, 0, 78, W, 6, '#0d1022');
  box(g, 0, 78, W, 1, 'rgba(130,140,190,0.3)');
  for (let px = 6; px < W; px += 44) box(g, px, 84, 5, 90, '#0d1022');
  return c;
}

function buildMid() {
  const [c, g] = layer();
  const r = rng(23);
  const blocks = [[0, 46, 4], [46, 34, 96], [80, 38, 108], [118, 34, 124], [330, 30, 112], [360, 42, 96], [402, 78, 24]];
  for (const [bx, bw, top] of blocks) {
    g.fillStyle = vgrad(g, top, 190, [[0, '#0d1122'], [1, '#080a15']]);
    g.fillRect(bx, top, bw, 190 - top);
    box(g, bx + bw - 1, top, 1, 190 - top, 'rgba(130,150,210,0.14)');
    box(g, bx, top, bw, 1, 'rgba(130,150,210,0.18)');
    for (let wy = top + 8; wy < 160; wy += 11) {
      for (let wx = bx + 5; wx < bx + bw - 6; wx += 9) {
        const k = r();
        if (k < 0.34) {
          box(g, wx, wy, 5, 6, k < 0.27 ? 'rgba(255,206,120,0.62)' : 'rgba(150,225,255,0.55)');
          if (k < 0.08) box(g, wx, wy, 5, 2, 'rgba(10,10,20,0.55)'); // half-drawn blind
        } else box(g, wx, wy, 5, 6, 'rgba(20,26,48,0.8)');
      }
    }
    if (r() < 0.7) { box(g, bx + 5, top - 4, 10, 4, '#0a0d1a'); box(g, bx + 7, top - 6, 2, 2, '#0a0d1a'); } // rooftop unit
  }
  // low wall behind the stall
  box(g, 0, 166, W, 3, '#262d46');
  box(g, 0, 169, W, 22, '#121726');
  for (let wx = 0; wx < W; wx += 24) box(g, wx, 169, 1, 22, 'rgba(255,255,255,0.04)');
  // ground: sidewalk, curb, road
  g.fillStyle = vgrad(g, 190, 216, [[0, '#212738'], [1, '#161b2a']]);
  g.fillRect(0, 190, W, 26);
  for (let wx = -6; wx < W; wx += 24) box(g, wx, 190, 1, 26, 'rgba(0,0,0,0.3)');
  box(g, 0, 201, W, 1, 'rgba(0,0,0,0.25)');
  box(g, 0, 214, W, 2, '#323a52');
  box(g, 0, 216, W, 3, '#0b0e18');
  g.fillStyle = vgrad(g, 219, H, [[0, '#0f121d'], [1, '#07080f']]);
  g.fillRect(0, 219, W, H - 219);
  for (let dx = -10; dx < W; dx += 64) box(g, dx, 253, 34, 2, 'rgba(210,210,190,0.22)');
  const puddle = (px, py, rx, ry) => { // wet patches that mirror the sky
    const gr = g.createLinearGradient(0, py - ry, 0, py + ry);
    gr.addColorStop(0, 'rgba(70,58,100,0.55)'); gr.addColorStop(1, 'rgba(30,34,60,0.4)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2); g.fill();
  };
  [[112, 198, 26, 3.5], [345, 200, 32, 3.5], [60, 208, 20, 2.5], [200, 236, 54, 6], [392, 243, 44, 5], [90, 247, 40, 5], [300, 262, 60, 5]].forEach((p) => puddle(...p));

  // utility pole, transformer, street lamp and wires
  box(g, 56, 10, 5, 204, '#090b13');
  box(g, 40, 26, 38, 3, '#090b13'); box(g, 44, 42, 30, 3, '#090b13');
  for (const ix of [42, 50, 66, 74]) { box(g, ix, 22, 2, 4, '#3a4260'); }
  for (const ix of [46, 70]) { box(g, ix, 38, 2, 4, '#3a4260'); }
  g.fillStyle = '#12151f'; g.fillRect(62, 48, 11, 18); g.fillStyle = 'rgba(160,170,210,0.22)'; g.fillRect(62, 48, 2, 18);
  box(g, 60, 60, 26, 2, '#090b13'); box(g, 82, 60, 10, 4, '#1a1e2c'); box(g, 84, 64, 6, 1, 'rgba(255,214,150,0.9)');
  g.strokeStyle = 'rgba(8,10,18,0.9)'; g.lineWidth = 0.8;
  const wire = (x0, y0, x1, y1, sag) => { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + sag, x1, y1); g.stroke(); };
  wire(43, 24, 480, 34, 22); wire(51, 24, 480, 28, 16); wire(67, 24, 480, 40, 26); wire(75, 24, 480, 36, 20);
  wire(43, 24, 0, 40, 10); wire(75, 24, 0, 46, 10); wire(47, 40, 480, 56, 24); wire(71, 40, 0, 60, 8);
  return c;
}

function buildInterior() { // back wall of the stall, behind the cook
  const [c, g] = layer();
  const r = rng(5);
  g.fillStyle = vgrad(g, 112, 204, [[0, '#3a2112'], [0.6, '#52301a'], [1, '#2a170d']]);
  g.fillRect(152, 112, 176, 92);
  for (let px = 156; px < 328; px += 8) box(g, px, 112, 1, 92, 'rgba(0,0,0,0.28)');
  for (let k = 0; k < 40; k++) box(g, 154 + r() * 170, 114 + r() * 56, 1, 4 + r() * 8, 'rgba(255,200,130,0.05)');
  // shelf and what's on it
  box(g, 154, 152, 172, 3, '#6c4528'); box(g, 154, 155, 172, 1, 'rgba(0,0,0,0.4)');
  [['#2f5a3a', 164], ['#7a4a1a', 169], ['#c7d6dc', 174]].forEach(([col, bx]) => { box(g, bx, 142, 4, 10, col); box(g, bx + 1, 139, 2, 3, col); });
  box(g, 183, 140, 18, 12, '#2a2a30'); box(g, 185, 143, 7, 5, '#c97a2b'); box(g, 194, 143, 5, 2, '#777'); box(g, 195, 147, 3, 3, '#999'); // radio
  box(g, 242, 142, 9, 10, '#7d2c24'); box(g, 244, 140, 5, 2, '#ddd'); // tare jar
  for (let i = 0; i < 4; i++) { box(g, 296, 150 - i * 3, 15, 3, i % 2 ? '#e8e4dc' : '#cdd9e2'); box(g, 296, 150 - i * 3, 15, 1, '#3b5e9a'); } // stacked bowls
  box(g, 313, 144, 9, 8, '#d8d0bc'); box(g, 314, 142, 7, 2, '#8a2d22'); // tea tin
  g.fillStyle = '#e7dcc0'; g.fillRect(256, 132, 34, 17); // price board
  box(g, 256, 132, 34, 1, '#a08a60'); box(g, 256, 148, 34, 1, '#a08a60');
  g.fillStyle = '#5a1d18'; g.font = `700 6px ${SANS}`; g.textBaseline = 'middle';
  g.fillText('醤油  ¥700', 259, 138); g.fillText('塩    ¥700', 259, 144);
  return c;
}

function buildFront() { // roof, posts, counter, stools, crates, vending machine
  const [c, g] = layer();
  // beer crates for the cat
  [[104, 192, 30, '#8a2c22'], [106, 183, 26, '#a0742a']].forEach(([x, y, w, col]) => {
    box(g, x, y, w, 10, col); box(g, x, y, w, 1, 'rgba(255,255,255,0.18)'); box(g, x, y + 9, w, 1, 'rgba(0,0,0,0.35)');
    for (let k = 4; k < w; k += 7) box(g, x + k, y + 2, 4, 5, 'rgba(0,0,0,0.38)');
  });
  // vending machine
  box(g, 372, 150, 30, 58, '#12151f'); box(g, 372, 150, 30, 2, '#2b3250');
  g.fillStyle = vgrad(g, 154, 188, [[0, '#9fe9ff'], [1, '#d8f6ff']]); g.fillRect(375, 154, 24, 32);
  const cols = ['#d33', '#3a8', '#ec3', '#38d', '#d33', '#e93', '#3a8', '#38d'];
  for (let ry = 0; ry < 3; ry++) for (let cx = 0; cx < 4; cx++) box(g, 377 + cx * 5.6, 157 + ry * 9.5, 4, 7, cols[(ry * 4 + cx) % 8]);
  box(g, 375, 188, 24, 4, '#0b0d15'); for (let b = 0; b < 4; b++) box(g, 377 + b * 5.6, 189, 3, 2, '#e55');
  box(g, 377, 196, 20, 8, '#06070c'); box(g, 390, 193, 5, 2, '#b8bcc8');
  box(g, 372, 206, 30, 2, '#07080e');
  box(g, 406, 190, 12, 16, '#161a26'); box(g, 405, 188, 14, 3, '#20263a'); // bin
  // stools
  for (const sx of [190, 240, 290]) {
    box(g, sx - 8, 195, 16, 3, '#7c2a2d'); box(g, sx - 8, 195, 16, 1, '#b04a46');
    box(g, sx - 1, 198, 2, 8, '#1a1b24'); box(g, sx - 6, 205, 12, 1, '#1a1b24'); box(g, sx - 4, 201, 8, 1, '#1a1b24');
  }
  // counter
  box(g, 150, 174, 180, 28, '#3c2314'); box(g, 150, 174, 180, 1, 'rgba(0,0,0,0.5)');
  for (let px = 154; px < 330; px += 12) box(g, px, 175, 1, 27, 'rgba(0,0,0,0.25)');
  box(g, 150, 180, 180, 3, '#8a2b24'); box(g, 150, 180, 180, 1, '#b8453a');
  box(g, 150, 202, 180, 2, '#120a06');
  box(g, 148, 169, 184, 5, '#9a6a3c'); box(g, 148, 169, 184, 1, '#d8a468'); box(g, 148, 173, 184, 1, 'rgba(0,0,0,0.5)');
  box(g, 206, 164, 4, 5, '#8c2a2a'); box(g, 205, 163, 6, 2, '#ddd');   // condiments
  box(g, 236, 163, 6, 6, '#5d4a2b'); box(g, 236, 161, 6, 2, '#a08a60');
  box(g, 304, 164, 9, 5, '#e4ddc8'); box(g, 305, 162, 1, 3, '#c9a46a'); box(g, 308, 162, 1, 3, '#c9a46a'); box(g, 311, 162, 1, 3, '#c9a46a'); // chopstick box
  // posts
  box(g, 149, 112, 5, 92, '#2d1a10'); box(g, 326, 112, 5, 92, '#2d1a10');
  box(g, 149, 112, 1, 92, 'rgba(255,200,140,0.25)');
  // roof and fascia
  g.fillStyle = vgrad(g, 90, 112, [[0, '#4a3a38'], [1, '#2a1d1c']]);
  g.beginPath(); g.moveTo(136, 98); g.lineTo(150, 88); g.lineTo(330, 88); g.lineTo(344, 98); g.lineTo(344, 100); g.lineTo(136, 100); g.fill();
  for (let rx = 148; rx < 334; rx += 6) box(g, rx, 89, 1, 10, 'rgba(0,0,0,0.3)');
  box(g, 136, 98, 208, 2, 'rgba(255,230,200,0.22)');
  box(g, 140, 100, 200, 12, '#3a1e16'); box(g, 140, 100, 200, 1, 'rgba(0,0,0,0.5)'); box(g, 140, 111, 200, 1, 'rgba(0,0,0,0.6)');
  g.fillStyle = '#e8dcc0'; g.font = `800 10px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('屋 台   ラーメン', 240, 106.5);
  box(g, 144, 102, 4, 8, '#8a2b24'); box(g, 332, 102, 4, 8, '#8a2b24');
  return c;
}

// ---------------------------------------------------------------- the scene
export async function createScene(canvas, { thunder = () => {} } = {}) {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`700 10px "Zen Kaku Gothic New"`, '中華そば醤油塩ラーメン屋台麺旨酒場'),
        document.fonts.load(`800 10px "Shippori Mincho B1"`, '屋台ラーメン'),
      ]),
      new Promise((res) => setTimeout(res, 2500)),
    ]);
  } catch { /* fall back to system fonts */ }

  canvas.width = W * S; canvas.height = H * S;
  const g = canvas.getContext('2d');
  g.scale(S, S);
  const far = buildFar(), mid = buildMid(), interior = buildInterior(), front = buildFront();
  const vignette = (() => {
    const [c, v] = layer();
    const gr = v.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.62);
    gr.addColorStop(0, 'rgba(2,3,10,0)'); gr.addColorStop(1, 'rgba(2,3,10,0.62)');
    v.fillStyle = gr; v.fillRect(0, 0, W, H);
    return c;
  })();

  // ---- state
  let t = 0;
  let intensity = 0.7, wind = -22;
  const drops = Array.from({ length: 460 }, () => newDrop(true));
  const ripples = [], splashes = [], steam = [], drips = [];
  const lights = [[240, 150, 115, 1.0], [140, 126, 45, 0.8], [385, 170, 62, 0.6], [80, 120, 88, 0.9], [440, 90, 70, 0.5]];
  let flash = { t: 99, power: 0 }, nextFlash = rand(18, 40), pendingThunder = [];
  let nextCar = rand(10, 22), car = null, nextTrain = rand(30, 60), train = null;
  let cookCycle = 0, burst = 0;
  const cat = { startle: 0, blink: 0, nextBlink: 2 };

  function newDrop(initial) {
    const z = Math.random();
    return { x: rand(-30, W + 40), y: initial ? rand(-20, 250) : rand(-40, -2), z, land: 190 + z * 78 };
  }

  const LOOKS = [
    { coat: '#2a3858', pants: '#171a28', hair: '#14131b', umb: '#2c5a8a' },
    { coat: '#5a2a30', pants: '#1b1620', hair: '#1c1613', umb: '#c9c4b8' },
    { coat: '#3a4a3a', pants: '#1a1d1a', hair: '#2a2420', umb: '#8a2b3a' },
    { coat: '#52466a', pants: '#16151f', hair: '#0f0e14', umb: '#d8d3c4' },
    { coat: '#6a5a3a', pants: '#1a1814', hair: '#3a3028', umb: '#2a2f3c' },
  ];
  const makeSeat = (x, state, wait) => ({
    x, state, wait, look: LOOKS[0], dir: 1, wx: 0, phase: 0, fade: 0, timer: 0, eatOff: Math.random() * 4, umbK: 1,
  });
  const seats = [makeSeat(190, 'empty', 22), makeSeat(290, 'sitting', 0)];
  seats[1].look = LOOKS[1]; seats[1].fade = 1; seats[1].timer = rand(40, 75);

  // ---- helpers
  function lightAt(x, y) {
    let l = 0;
    for (const [lx, ly, lr, la] of lights) { const dx = (x - lx) / lr, dy = (y - ly) / lr; l += la * Math.exp(-(dx * dx + dy * dy) * 1.6); }
    return l;
  }
  function glow(name, x, y, r, a) {
    g.globalAlpha = clamp(a, 0, 1);
    g.drawImage(glowSprites[name], x - r, y - r, r * 2, r * 2);
  }
  function emitSteam(x, y, n, spread = 4, power = 1) {
    for (let i = 0; i < n && steam.length < 220; i++) {
      steam.push({ x: x + rand(-spread, spread), y, vx: rand(-3, 3) + wind * 0.04, vy: -rand(8, 15) * power, r: rand(3, 6), life: 0, max: rand(2.2, 3.8) });
    }
  }
  function ripple(x, y, power) { if (ripples.length < 70) ripples.push({ x, y, r: 0.5, max: rand(4, 8) * power, life: 0 }); }
  function reflect(x, y0, w, name, a, len, wob = 1) {
    const [r, gg, b] = GLOWS[name];
    for (let i = 0; i < len; i += 2) {
      const f = 1 - i / len;
      const dx = Math.sin(i * 0.5 + t * 2.1 + x * 0.1) * (0.8 + intensity * 1.6) * wob;
      g.fillStyle = `rgba(${r},${gg},${b},${(a * f * f).toFixed(3)})`;
      g.fillRect(x - w / 2 + dx - i * 0.05, y0 + i, w + i * 0.1, 1.4);
    }
  }
  const rim = 'rgba(255,186,110,0.6)';

  // ---- actors
  function drawCook() {
    const cx = 222, bob = Math.sin(t * 1.4) * 0.4;
    const p = cookCycle % 16;
    // arm that works the pot (the cook's left hand, on the viewer's right)
    let hx, hy, tool = 'ladle', lift = 0;
    if (p < 9.5) { hx = 252 + Math.cos(t * 2.4) * 4; hy = 160 + Math.sin(t * 2.4) * 1.5; }
    else if (p < 13) {
      const u = (p - 9.5) / 3.5;
      lift = u < 0.25 ? ease(u / 0.25) : u > 0.8 ? ease(1 - (u - 0.8) / 0.2) : 1;
      hx = 258 + (lift > 0.9 ? Math.sin(t * 22) * 1.1 : 0); hy = lerp(160, 139, lift); tool = 'tebo';
      if (lift > 0.9) burst = 1;
    } else { const u = (p - 13) / 3; const k = Math.sin(u * Math.PI); hx = lerp(252, 238, k); hy = lerp(160, 163, k); }

    g.save();
    g.translate(0, bob);
    // pot with lid askew
    box(g, 250, 158, 30, 14, '#7e8493'); box(g, 250, 158, 30, 2, '#b8bccb'); box(g, 250, 158, 3, 14, 'rgba(255,200,140,0.45)'); box(g, 277, 158, 3, 14, 'rgba(0,0,0,0.3)');
    box(g, 248, 156, 34, 3, '#9aa0b0'); box(g, 249, 155, 32, 1, '#d0d4e0');
    // torso
    g.fillStyle = '#cfc8b4'; g.beginPath(); g.moveTo(211, 172); g.lineTo(213, 156); g.quadraticCurveTo(222, 151, 231, 156); g.lineTo(233, 172); g.fill();
    box(g, 211, 164, 22, 8, '#26304a'); box(g, 213, 156, 3, 8, 'rgba(255,190,120,0.35)');           // apron + warm side light
    box(g, 219, 152, 6, 4, '#b5836a');                                                              // neck
    box(g, 225, 156, 7, 3, '#e6e1d2');                                                              // towel on the shoulder
    // idle arm
    g.strokeStyle = '#cfc8b4'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(214, 158); g.lineTo(211, 168); g.stroke();
    // working arm
    g.beginPath(); g.moveTo(230, 158); g.lineTo(lerp(230, hx, 0.55) + 1, lerp(158, hy, 0.5) + 4); g.lineTo(hx, hy); g.stroke();
    g.fillStyle = '#b5836a'; g.beginPath(); g.arc(hx, hy, 2.2, 0, 7); g.fill();
    if (tool === 'ladle') {
      g.strokeStyle = '#a0a6b4'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + 2, hy + 12); g.stroke();
    } else {
      g.strokeStyle = '#b0a080'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + 7, hy - 3 + (1 - lift) * 5); g.stroke();
      const bx = hx + 9, by = hy + (1 - lift) * 8;
      g.fillStyle = '#d8c690'; g.beginPath(); g.ellipse(bx, by, 6, 3.5, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,240,190,0.7)'; g.lineWidth = 0.6;
      for (let k = -3; k <= 3; k += 1.5) { g.beginPath(); g.moveTo(bx + k, by); g.lineTo(bx + k + Math.sin(t * 9 + k) * 0.7, by + 5 + lift * 3); g.stroke(); }
      g.strokeStyle = '#8c8f9c'; g.lineWidth = 0.9; g.beginPath(); g.ellipse(bx, by, 6.5, 3.8, 0, 0, 7); g.stroke();
    }
    // head
    const hy0 = 146;
    g.fillStyle = '#b5836a'; g.beginPath(); g.arc(cx, hy0, 6.3, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,170,100,0.35)'; g.beginPath(); g.arc(cx - 2.5, hy0 + 1, 4.5, 0, 7); g.fill();
    box(g, cx - 6.3, hy0 - 4.6, 12.6, 3.4, '#ece6d6'); box(g, cx - 6.3, hy0 - 4.6, 12.6, 0.8, '#fff6e0');       // hachimaki
    const flap = Math.sin(t * 3) * 0.8;
    box(g, cx + 6, hy0 - 4, 3, 1.2, '#ece6d6'); box(g, cx + 6.5, hy0 - 3 + flap, 2.5, 1.2, '#d7d0be');
    g.fillStyle = '#2a1a16'; g.beginPath(); g.arc(cx, hy0 - 4.6, 6.3, Math.PI, 0); g.fill();                      // hair above the band
    if (Math.sin(t * 0.9 + 1) < 0.96) { box(g, cx - 3.2, hy0 - 0.6, 1.4, 1.5, '#1c1210'); box(g, cx + 1.8, hy0 - 0.6, 1.4, 1.5, '#1c1210'); }
    else { box(g, cx - 3.2, hy0, 1.6, 0.6, '#1c1210'); box(g, cx + 1.8, hy0, 1.6, 0.6, '#1c1210'); }
    box(g, cx - 1.6, hy0 + 3, 3.2, 0.7, '#6a3a2c');
    g.restore();
  }

  function seated(s, alpha) {
    const { x, look } = s;
    const P = 4.4, u = ((t + s.eatOff) % P) / P;
    const e = u < 0.4 ? Math.sin((u / 0.4) * Math.PI) : 0;
    const dip = e * 1.6;
    g.save(); g.globalAlpha = alpha;
    box(g, x - 7, 195, 14, 5, look.pants); box(g, x - 7, 199, 5, 7, look.pants); box(g, x + 2, 199, 5, 7, look.pants);
    box(g, x - 8, 205, 7, 2, '#0b0b10'); box(g, x + 1, 205, 8, 2, '#0b0b10');
    g.fillStyle = look.coat;
    g.beginPath(); g.moveTo(x - 9.5, 197); g.lineTo(x - 11.5, 171); g.quadraticCurveTo(x - 10, 164, x, 164 + dip * 0.4); g.quadraticCurveTo(x + 10, 164, x + 11.5, 171); g.lineTo(x + 9.5, 197); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, 168); g.lineTo(x, 196); g.stroke();
    g.strokeStyle = rim; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 11.2, 172); g.quadraticCurveTo(x - 10, 164.5, x, 164.4 + dip * 0.4); g.quadraticCurveTo(x + 10, 164.5, x + 11.2, 172); g.stroke();
    // folded umbrella hooked on the counter
    g.strokeStyle = s.look.umb; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + 16, 176); g.lineTo(x + 16.5, 195); g.stroke();
    g.strokeStyle = '#2a2a30'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 16.5, 195); g.lineTo(x + 16.5, 200); g.stroke();
    // arms
    g.strokeStyle = look.coat; g.lineWidth = 4;
    g.beginPath(); g.moveTo(x - 10, 170); g.lineTo(x - 14, 175); g.lineTo(x - 11, 177); g.stroke();
    const hx = lerp(x + 14, x + 6.5, e), hy = lerp(177, 160, e);
    g.beginPath(); g.moveTo(x + 10, 170); g.lineTo(lerp(x + 15, x + 13, e), lerp(176, 168, e)); g.lineTo(hx, hy); g.stroke();
    g.fillStyle = '#a77a5f'; g.beginPath(); g.arc(hx, hy, 1.9, 0, 7); g.fill();
    g.strokeStyle = '#c9a46a'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx - 2.5 + e * 2, hy - 8 - e * 2); g.moveTo(hx + 1, hy); g.lineTo(hx - 1 + e * 2, hy - 8 - e * 2); g.stroke();
    // head
    const hy0 = 157 + dip;
    box(g, x - 2.5, hy0 + 4, 5, 5, '#a77a5f');
    g.fillStyle = '#a77a5f'; g.fillRect(x - 7, hy0 - 1, 2, 3.5); g.fillRect(x + 5, hy0 - 1, 2, 3.5);
    g.fillStyle = look.hair; g.beginPath(); g.arc(x, hy0, 6.4, 0, 7); g.fill();
    g.strokeStyle = rim; g.lineWidth = 1.1; g.beginPath(); g.arc(x, hy0, 6.2, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    g.strokeStyle = 'rgba(170,190,255,0.25)'; g.lineWidth = 0.7; g.beginPath(); g.arc(x, hy0, 4.6, Math.PI * 1.2, Math.PI * 1.6); g.stroke(); // wet-hair sheen
    g.restore();
  }

  function walker(s, alpha) {
    const { look } = s, d = s.dir, x = s.wx, feet = 211;
    const sw = Math.sin(s.phase), moving = s.state === 'arriving' || s.state === 'leaving';
    g.save(); g.globalAlpha = alpha;
    // reflection of the figure on the wet sidewalk
    g.globalAlpha = alpha * 0.13; g.fillStyle = look.coat; g.fillRect(x - 4, feet + 1, 8, 14); g.globalAlpha = alpha;
    const leg = (ph, col) => {
      const fx = x + Math.sin(ph) * (moving ? 6 : 0.5), fy = feet - (moving ? Math.max(0, Math.cos(ph)) * 2 : 0);
      g.strokeStyle = col; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, feet - 19); g.lineTo(fx, fy - 1); g.stroke();
      box(g, fx - 2 + (d > 0 ? 0.5 : -1.5), fy - 1.5, 4, 2, '#0b0b10');
    };
    leg(s.phase + Math.PI, '#101219'); leg(s.phase, look.pants);
    const lean = moving ? d * 1 : 0;
    g.fillStyle = look.coat; g.beginPath(); g.moveTo(x - 4.5, feet - 17); g.lineTo(x - 4 + lean, feet - 37); g.quadraticCurveTo(x + lean, feet - 40, x + 4 + lean, feet - 37); g.lineTo(x + 4.5, feet - 17); g.fill();
    g.strokeStyle = 'rgba(255,190,120,0.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + (240 > x ? 4.4 : -4.4), feet - 36); g.lineTo(x + (240 > x ? 4.5 : -4.5), feet - 18); g.stroke();
    const hx = x + d * 0.6 + lean, hy = feet - 43 + (moving ? Math.abs(sw) * -0.4 : 0);
    g.fillStyle = '#a77a5f'; g.beginPath(); g.arc(hx, hy, 4.6, 0, 7); g.fill();
    g.fillStyle = look.hair; g.beginPath(); g.arc(hx - d * 0.6, hy - 0.8, 4.7, Math.PI * 0.92, Math.PI * 2.08); g.fill();
    // umbrella
    const k = clamp(s.umbK, 0, 1);
    const handX = x + d * 3, handY = feet - 33;
    g.strokeStyle = '#a77a5f'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, feet - 35); g.lineTo(handX, handY); g.stroke();
    if (k > 0.05) {
      const top = handY - 26, rw = 22 * k, rh = 10;
      g.strokeStyle = '#181a24'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(handX, handY); g.lineTo(handX, top - 2); g.stroke();
      g.fillStyle = look.umb; g.beginPath(); g.moveTo(handX - rw, top + rh * 0.6);
      g.quadraticCurveTo(handX - rw * 0.8, top - rh, handX, top - rh * 0.9);
      g.quadraticCurveTo(handX + rw * 0.8, top - rh, handX + rw, top + rh * 0.6);
      for (let i = 0; i < 4; i++) { const x1 = handX + rw - (i + 1) * rw / 2; g.quadraticCurveTo(x1 + rw / 4, top + rh * 0.95, x1, top + rh * 0.6); }
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.6;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(handX, top - rh * 0.9); g.lineTo(handX + i * rw * 0.42, top + rh * 0.6); g.stroke(); }
      g.strokeStyle = rim; g.lineWidth = 0.8; g.beginPath(); g.moveTo(handX - rw * 0.8, top - rh * 0.1); g.quadraticCurveTo(handX, top - rh * 1.1, handX + rw * 0.8, top - rh * 0.1); g.stroke();
    } else {
      g.strokeStyle = look.umb; g.lineWidth = 2; g.beginPath(); g.moveTo(handX, handY); g.lineTo(handX + d * 1, handY + 20); g.stroke();
    }
    g.restore();
  }

  function updateSeat(s, dt) {
    switch (s.state) {
      case 'empty':
        s.wait -= dt;
        if (s.wait <= 0) {
          s.look = LOOKS[(Math.random() * LOOKS.length) | 0];
          s.dir = Math.random() < 0.5 ? 1 : -1;
          s.wx = s.dir > 0 ? -26 : W + 26; s.umbK = 1; s.fade = 0; s.eatOff = Math.random() * 4;
          s.state = 'arriving';
        }
        break;
      case 'arriving':
        s.wx += s.dir * 36 * dt; s.phase += dt * 7.5;
        if ((s.dir > 0 && s.wx >= s.x) || (s.dir < 0 && s.wx <= s.x)) { s.wx = s.x; s.state = 'settling'; s.timer = 0; }
        break;
      case 'settling':
        s.timer += dt; s.umbK = 1 - clamp(s.timer / 0.9, 0, 1); s.fade = clamp((s.timer - 0.9) / 0.6, 0, 1);
        if (s.timer > 1.5) { s.state = 'sitting'; s.timer = rand(45, 100); }
        break;
      case 'sitting':
        s.timer -= dt;
        if (s.timer <= 0) { s.state = 'rising'; s.timer = 0; s.dir = Math.random() < 0.5 ? 1 : -1; }
        break;
      case 'rising':
        s.timer += dt; s.fade = 1 - clamp(s.timer / 0.6, 0, 1); s.umbK = clamp((s.timer - 0.6) / 0.9, 0, 1);
        if (s.timer > 1.5) { s.state = 'leaving'; s.umbK = 1; }
        break;
      case 'leaving':
        s.wx += s.dir * 36 * dt; s.phase += dt * 7.5;
        if (s.wx < -40 || s.wx > W + 40) { s.state = 'empty'; s.wait = rand(8, 45); }
        break;
      default:
    }
  }

  function drawCat(dt) {
    cat.startle = Math.max(0, cat.startle - dt);
    cat.nextBlink -= dt; if (cat.nextBlink < 0) { cat.blink = 0.14; cat.nextBlink = rand(2, 6); }
    cat.blink = Math.max(0, cat.blink - dt);
    const up = cat.startle > 0 ? -2.5 * Math.sin((cat.startle / 0.4) * Math.PI) : 0;
    const x = 121, y = 184 + up;
    g.save();
    const tail = Math.sin(t * 1.3) * 3;
    g.strokeStyle = '#b8742f'; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 7, y - 1); g.quadraticCurveTo(x - 14, y - 2 + tail * 0.3, x - 13 + tail * 0.2, y - 9 + tail * 0.4); g.stroke();
    g.fillStyle = '#c47e34'; g.beginPath(); g.ellipse(x, y - 3, 8.5, 6.5, 0, 0, 7); g.fill();
    g.fillStyle = '#e9c9a0'; g.beginPath(); g.ellipse(x + 4, y - 1, 3.5, 4, 0, 0, 7); g.fill();       // white bib
    g.fillStyle = '#c47e34'; g.beginPath(); g.arc(x + 4, y - 11, 4.6, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x + 0.5, y - 14); g.lineTo(x + 1.5, y - 19.5); g.lineTo(x + 5, y - 15); g.fill();
    g.beginPath(); g.moveTo(x + 8, y - 15); g.lineTo(x + 9.8, y - 19.5); g.lineTo(x + 6, y - 15.4); g.fill();
    g.strokeStyle = '#8a5222'; g.lineWidth = 0.6; for (const sx of [-3, 0, 3]) { g.beginPath(); g.moveTo(x + sx, y - 8); g.lineTo(x + sx + 0.5, y - 4); g.stroke(); }
    if (cat.blink > 0 || cat.startle > 0.2) { box(g, x + 2, y - 11.4, 2, 0.6, '#1c1008'); box(g, x + 6, y - 11.4, 2, 0.6, '#1c1008'); }
    else { box(g, x + 2.2, y - 12, 1.5, 2, '#d8e860'); box(g, x + 6.2, y - 12, 1.5, 2, '#d8e860'); box(g, x + 2.8, y - 11.7, 0.7, 1.6, '#100a04'); box(g, x + 6.8, y - 11.7, 0.7, 1.6, '#100a04'); }
    box(g, x + 4.6, y - 9.2, 1, 0.8, '#e69a9a');
    g.fillStyle = 'rgba(255,170,100,0.28)'; g.beginPath(); g.ellipse(x - 3, y - 6, 4, 3, 0, Math.PI, 0); g.fill(); // warm rim from the lantern
    g.restore();
  }

  function drawNoren() {
    const labels = ['中', '華', 'そ', 'ば'];
    const gust = Math.sin(t * 0.7) * 0.012 + Math.sin(t * 0.23) * 0.01;
    for (let i = 0; i < 4; i++) {
      const x0 = 169 + i * 36, sk = Math.sin(t * 1.4 + i * 0.9) * 0.035 + gust + intensity * 0.01;
      g.save();
      g.translate(x0, 112); g.transform(1, 0, sk, 1, 0, 0);
      const wv = Math.sin(t * 2.2 + i) * 0.6;
      g.fillStyle = vgrad(g, 0, 20, [[0, '#8e2428'], [1, '#6a1a20']]);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(34, 0); g.lineTo(34, 18 + wv); g.lineTo(0, 18 - wv); g.fill();
      box(g, 0, 17 - wv, 34, 1.4, '#2a0d10'); box(g, 0, 0, 34, 1, 'rgba(0,0,0,0.45)'); box(g, 15, 1, 0.6, 16, 'rgba(0,0,0,0.12)'); box(g, 0, 0, 1, 18, 'rgba(255,170,120,0.35)');
      g.fillStyle = '#f2ead8'; g.font = `800 13px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(labels[i], 17, 9.2);
      g.restore();
    }
  }

  function drawLantern(lx, ly, label, phase) {
    const sway = Math.sin(t * 1.1 + phase) * 0.05 + Math.sin(t * 0.4 + phase) * 0.03 + intensity * 0.01;
    g.save();
    g.translate(lx, ly); g.rotate(sway);
    g.strokeStyle = '#150d0a'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 0); g.stroke();
    const gr = g.createRadialGradient(0, 14, 1, 0, 14, 14);
    const f = 0.9 + Math.sin(t * 7 + phase) * 0.05;
    gr.addColorStop(0, `rgba(255,${(150 * f) | 0},70,1)`); gr.addColorStop(1, '#a8231c');
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, 14, 8.5, 12, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(90,10,10,0.55)'; g.lineWidth = 0.6;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(0, 14, 8.5 * Math.abs(k) / 2.6, 12, 0, 0, 7); g.stroke(); }
    box(g, -5, 1.5, 10, 2.2, '#140d0b'); box(g, -5, 24.4, 10, 2.2, '#140d0b');
    g.fillStyle = '#1a0d0a'; g.font = `800 10px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 0, 14.5);
    g.restore();
  }

  function drawCar() {
    const c = car, y = 254, L = 58;
    const x = c.x, d = c.dir;
    g.save();
    g.translate(x, y); g.scale(d, 1);                // local +x is the car's front
    // headlight beam on the road
    g.globalCompositeOperation = 'lighter';
    const bg = g.createLinearGradient(L / 2, 0, L / 2 + 130, 0);
    bg.addColorStop(0, 'rgba(255,240,200,0.28)'); bg.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = bg; g.beginPath(); g.moveTo(L / 2 - 2, -8); g.lineTo(L / 2 + 130, -22); g.lineTo(L / 2 + 130, 6); g.lineTo(L / 2 - 2, -3); g.fill();
    g.globalCompositeOperation = 'source-over';
    // body
    g.fillStyle = c.color;
    g.beginPath(); g.moveTo(-L / 2, -6); g.quadraticCurveTo(-L / 2 - 1, -15, -L / 2 + 6, -16); g.lineTo(L / 2 - 8, -16); g.quadraticCurveTo(L / 2 + 1, -15, L / 2, -8); g.lineTo(L / 2, -4); g.lineTo(-L / 2, -4); g.fill();
    g.beginPath(); g.moveTo(-L / 2 + 10, -16); g.lineTo(-L / 2 + 16, -25); g.lineTo(L / 2 - 20, -25); g.lineTo(L / 2 - 8, -16); g.fill();
    g.fillStyle = 'rgba(120,140,190,0.35)';
    g.beginPath(); g.moveTo(-L / 2 + 14, -17); g.lineTo(-L / 2 + 18, -23.5); g.lineTo(-2, -23.5); g.lineTo(-2, -17); g.fill();
    g.beginPath(); g.moveTo(1, -17); g.lineTo(1, -23.5); g.lineTo(L / 2 - 21, -23.5); g.lineTo(L / 2 - 12, -17); g.fill();
    box(g, -L / 2, -16, L, 0.8, 'rgba(180,200,255,0.25)');
    for (const wx of [-L / 2 + 12, L / 2 - 14]) { box(g, wx - 5.5, -8, 11, 8, '#050509'); g.fillStyle = '#2a2d3a'; g.beginPath(); g.arc(wx, -2, 4.3, 0, 7); g.fill(); g.fillStyle = '#0b0b10'; g.beginPath(); g.arc(wx, -2, 2, 0, 7); g.fill(); }
    box(g, L / 2 - 3, -11, 3, 3, '#fff4d0'); box(g, -L / 2, -11, 2, 3, '#ff3a30');
    g.globalCompositeOperation = 'lighter';
    glow('yellow', L / 2 + 2, -9, 16, 0.9); glow('red', -L / 2, -9, 14, 0.7);
    // light reflected on the wet road
    for (let i = 0; i < 18; i += 2) {
      const f = 1 - i / 18, dx = Math.sin(i * 0.6 + t * 4) * 1.5;
      g.fillStyle = `rgba(255,236,190,${0.3 * f})`; g.fillRect(L / 2 - 3 + dx, 1 + i, 4, 1.4);
      g.fillStyle = `rgba(255,60,48,${0.25 * f})`; g.fillRect(-L / 2 - 1 + dx, 1 + i, 3, 1.4);
    }
    g.restore();
    // spray behind the wheels
    g.fillStyle = 'rgba(190,200,230,0.07)';
    for (let k = 0; k < 4; k++) g.fillRect(x - d * (L / 2 + 4 + k * 7), y - 2 - k, 9, 2);
  }

  function drawTrain() {
    const tr = train, y = 66;
    for (let i = 0; i < 4; i++) {
      const x0 = tr.x + i * 44 * tr.dir;
      g.fillStyle = '#262a44'; g.fillRect(x0, y, 42, 12);
      g.fillStyle = '#9a2a3a'; g.fillRect(x0, y + 8, 42, 1.4);
      for (let w = 0; w < 6; w++) { g.fillStyle = 'rgba(255,240,205,0.88)'; g.fillRect(x0 + 3 + w * 6.5, y + 2.5, 4.6, 4); }
      g.fillStyle = 'rgba(255,240,205,0.12)'; g.fillRect(x0, y + 12, 42, 2);
    }
  }

  // ---- frame
  function frame(dt) {
    t += dt; cookCycle += dt;
    if (burst > 0) { emitSteam(266, 152, 3, 6, 1.5); burst = Math.max(0, burst - dt * 2.5); }
    const warmFlick = 0.9 + Math.sin(t * 6.8) * 0.04 + Math.sin(t * 13.1 + 2) * 0.03 + (Math.random() < 0.01 ? -0.08 : 0);

    // weather
    intensity = clamp(0.68 + Math.sin(t * 0.045) * 0.22 + Math.sin(t * 0.13 + 1) * 0.1, 0.4, 1);
    wind = -20 + Math.sin(t * 0.21) * 10 + Math.sin(t * 0.9) * 3;

    // events
    nextFlash -= dt;
    if (nextFlash <= 0) { flash = { t: 0, power: rand(0.7, 1) }; nextFlash = rand(40, 110); cat.startle = 0.4; pendingThunder.push({ in: rand(0.5, 2.8), dist: rand(0.1, 0.8) }); }
    flash.t += dt;
    for (const p of pendingThunder) p.in -= dt;
    for (let i = pendingThunder.length - 1; i >= 0; i--) if (pendingThunder[i].in <= 0) { thunder(pendingThunder[i].dist); pendingThunder.splice(i, 1); }
    const fl = flash.t < 0.9 ? flash.power * Math.max(0, (flash.t < 0.12 ? 1 : flash.t < 0.2 ? 0.2 : flash.t < 0.34 ? 0.9 : Math.exp(-(flash.t - 0.34) * 5))) : 0;

    nextCar -= dt;
    if (nextCar <= 0 && !car) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      car = { dir, x: dir > 0 ? -70 : W + 70, speed: rand(110, 150), color: ['#161a28', '#2a1a1e', '#1a2626', '#262230', '#2c2c36'][(Math.random() * 5) | 0] };
      nextCar = rand(16, 45);
    }
    if (car) { car.x += car.dir * car.speed * dt; if (car.x < -90 || car.x > W + 90) car = null; }
    nextTrain -= dt;
    if (nextTrain <= 0 && !train) { const dir = Math.random() < 0.5 ? 1 : -1; train = { dir, x: dir > 0 ? -190 : W + 190 - 44, speed: 85 }; nextTrain = rand(50, 100); }
    if (train) { train.x += train.dir * train.speed * dt; if (train.x < -220 || train.x > W + 220) train = null; }
    seats.forEach((s) => updateSeat(s, dt));

    // steam sources
    if (Math.random() < dt * 14) emitSteam(266, 152, 1, 8, 1);
    for (const s of seats) if (s.state === 'sitting' || s.fade > 0.5) if (Math.random() < dt * 5) emitSteam(s.x + rand(-6, 6), 168, 1, 6, 0.7);
    if (Math.random() < dt * 24 * intensity) { // roof drips
      const dx = rand(0, 1) < 0.35 ? (Math.random() < 0.5 ? 152 : 328) : rand(154, 326);
      drips.push({ x: dx, y: 113, v: 0 });
    }

    // ------------------------------------------------ draw
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.drawImage(far, 0, 0, W, H);
    if (Math.sin(t * 2.2) > 0.4) box(g, 301, 5, 3, 3, '#ff3a2a');
    glow2('red', 302.5, 6.5, 10, Math.sin(t * 2.2) > 0.4 ? 0.7 : 0);
    if (fl > 0) { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(150,160,230,${fl * 0.45})`; g.fillRect(0, 0, W, 175); g.globalCompositeOperation = 'source-over'; }
    if (train) drawTrain();
    g.drawImage(mid, 0, 0, W, H);
    // neon sign on the big right-hand building
    {
      const on = Math.sin(t * 31) > -0.97 || Math.sin(t * 0.7) < 0.9;
      g.save(); g.font = `800 12px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = on ? '#ffb2de' : '#6a2a52'; g.fillText('酒', 441, 70); g.fillText('場', 441, 84);
      g.fillStyle = on ? '#9fe9ff' : '#2a4a56'; g.fillRect(430, 94, 22, 1.4); g.font = `700 6px ${SANS}`; g.fillText('B A R', 441, 100);
      g.restore();
    }
    // lightning-lit wash on the mid ground
    if (fl > 0) { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(110,120,190,${fl * 0.2})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }

    drawRain(true);
    g.drawImage(interior, 0, 0, W, H);
    drawCook();
    drawSteam('back');
    g.drawImage(front, 0, 0, W, H);
    drawNoren();
    // string bulbs
    for (let i = 0; i < 9; i++) {
      const bx = 160 + i * 20, by = 114 + Math.sin((i / 8) * Math.PI) * 3.5;
      box(g, bx - 1.5, by, 3, 3.4, '#ffe9b0');
    }
    drawLantern(147, 112, '麺', 0); drawLantern(334, 112, '旨', 2);
    for (const s of seats) {
      if (s.fade > 0) seated(s, s.fade);
      if (['arriving', 'leaving', 'settling', 'rising'].includes(s.state)) walker(s, s.state === 'settling' ? 1 - s.fade : s.state === 'rising' ? 1 - s.fade : 1);
    }
    drawCat(dt);

    // light: everything additive from here on
    g.globalCompositeOperation = 'lighter';
    glow('warm', 240, 150, 120, 0.42 * warmFlick);
    glow('warm', 240, 190, 90, 0.18 * warmFlick);
    glow('red', 147, 126, 38, 0.55 * warmFlick); glow('red', 334, 126, 34, 0.5 * warmFlick); glow('warm', 140, 140, 70, 0.22 * warmFlick);
    for (let i = 0; i < 9; i++) glow('yellow', 160 + i * 20, 116 + Math.sin((i / 8) * Math.PI) * 3.5, 11, 0.62 * (0.92 + Math.sin(t * 5 + i) * 0.05));
    glow('cyan', 386, 172, 64, 0.34 + (Math.sin(t * 40) > 0.995 ? 0.2 : 0));
    glow('pink', 441, 86, 48, 0.3); glow('cool', 441, 90, 30, 0.1);
    glow('yellow', 87, 64, 26, 0.7); // street lamp
    g.globalAlpha = 1;
    const cone = g.createLinearGradient(0, 64, 0, 212);
    cone.addColorStop(0, 'rgba(255,214,150,0.22)'); cone.addColorStop(1, 'rgba(255,214,150,0.02)');
    g.fillStyle = cone; g.beginPath(); g.moveTo(84, 65); g.lineTo(90, 65); g.lineTo(138, 214); g.lineTo(34, 214); g.fill();

    // reflections in the wet ground
    reflect(240, 205, 120, 'warm', 0.22 * warmFlick, 44);
    reflect(147, 214, 12, 'red', 0.4, 40); reflect(334, 214, 12, 'red', 0.36, 40);
    reflect(386, 208, 24, 'cyan', 0.3, 46); reflect(441, 216, 14, 'pink', 0.22, 38);
    reflect(87, 214, 10, 'yellow', 0.28, 50);
    for (let i = 0; i < 9; i++) reflect(160 + i * 20, 218, 4, 'yellow', 0.16, 26, 1.2);
    g.globalAlpha = 1;

    if (car) drawCar();
    // ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.life += dt; r.r = r.max * Math.min(1, r.life / 0.7);
      if (r.life > 0.7) { ripples.splice(i, 1); continue; }
      const L = clamp(lightAt(r.x, r.y), 0, 1);
      g.strokeStyle = `rgba(${(190 + L * 65) | 0},${(205 + L * 10) | 0},${(255 - L * 90) | 0},${(0.38 * (1 - r.life / 0.7) * (0.35 + L)).toFixed(3)})`;
      g.lineWidth = 0.7; g.beginPath(); g.ellipse(r.x, r.y, r.r, r.r * 0.3, 0, 0, 7); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = splashes.length - 1; i >= 0; i--) {
      const p = splashes[i];
      p.life += dt; p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life > 0.28) { splashes.splice(i, 1); continue; }
      g.fillStyle = `rgba(200,215,255,${0.5 * (1 - p.life / 0.28)})`; g.fillRect(p.x, p.y, 1, 1);
    }
    // roof drips
    for (let i = drips.length - 1; i >= 0; i--) {
      const d = drips[i];
      d.v += 380 * dt; d.y += d.v * dt;
      if (d.y >= 204) { drips.splice(i, 1); ripple(d.x + rand(-1, 1), rand(203, 208), 0.8); if (Math.random() < 0.6) splashes.push({ x: d.x, y: 203, vx: rand(-25, 25), vy: -rand(40, 80), life: 0 }); continue; }
      g.fillStyle = 'rgba(220,232,255,0.55)'; g.fillRect(d.x, d.y, 0.9, Math.min(5, d.v * 0.02 + 1));
    }
    drawRain(false, dt);
    drawSteam('front', dt);
    g.drawImage(vignette, 0, 0, W, H);
    if (fl > 0) { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(170,180,255,${fl * 0.12})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
  }

  function glow2(name, x, y, r, a) { if (a <= 0) return; g.globalCompositeOperation = 'lighter'; glow(name, x, y, r, a); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }

  function drawSteam(pass, dt = 0) {
    if (pass === 'front') {
      for (let i = steam.length - 1; i >= 0; i--) {
        const p = steam[i];
        p.life += dt; p.x += (p.vx + Math.sin(t * 1.5 + p.y * 0.1) * 2) * dt; p.y += p.vy * dt; p.r += dt * 2.2;
        if (p.life > p.max || p.y < 110) steam.splice(i, 1);
      }
      return;
    }
    g.globalCompositeOperation = 'source-over';
    for (const p of steam) {
      const k = p.life / p.max;
      g.globalAlpha = Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.2;
      g.drawImage(puff, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    g.globalAlpha = 1;
  }

  const buckets = [[[], 'rgba(140,160,215,0.22)'], [[], 'rgba(215,225,255,0.34)'], [[], 'rgba(255,214,160,0.55)']];
  function drawRain(farPass, dt = 0) {
    const n = Math.floor(drops.length * intensity);
    for (const b of buckets) b[0].length = 0;
    for (let i = 0; i < n; i++) {
      const d = drops[i];
      const isFar = d.z < 0.3;
      if (isFar !== farPass) { if (!farPass) { /* near pass moves everything */ } else continue; }
      if (!farPass) {
        const vy = 330 + d.z * 160;
        d.y += vy * dt; d.x += wind * (0.7 + d.z * 0.6) * dt;
        if (d.y >= d.land) {
          if (d.z >= 0.12 && Math.random() < 0.5) ripple(d.x, d.land, 0.6 + d.z * 0.7);
          if (Math.random() < 0.5) for (let k = 0; k < 2; k++) splashes.push({ x: d.x, y: d.land - 1, vx: rand(-30, 30), vy: -rand(30, 80), life: 0 });
          Object.assign(d, newDrop(false));
          continue;
        }
      }
      if (isFar !== farPass) continue;
      const len = 5 + d.z * 9, L = lightAt(d.x, d.y);
      const under = d.x > 148 && d.x < 332 && d.y > 90 && d.y < 204 && d.z > 0.3;
      const bi = under ? 0 : L > 0.42 ? 2 : L > 0.12 ? 1 : 0;
      buckets[bi][0].push(d.x, d.y, d.x + (wind * (0.7 + d.z * 0.6) / (330 + d.z * 160)) * len, d.y + len);
    }
    for (const [pts, col] of buckets) {
      if (!pts.length) continue;
      g.strokeStyle = col; g.lineWidth = farPass ? 0.6 : 0.8; g.beginPath();
      for (let i = 0; i < pts.length; i += 4) { g.moveTo(pts[i], pts[i + 1]); g.lineTo(pts[i + 2], pts[i + 3]); }
      g.stroke();
    }
  }

  return {
    frame,
    get intensity() { return intensity; },
    lightning() { nextFlash = 0; },
  };
}
