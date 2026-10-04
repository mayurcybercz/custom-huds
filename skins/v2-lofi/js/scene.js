// Animated lo-fi backdrop: a city skyline under a sky that follows the real time of day
// (night → dawn → day → dusk). Weather changes the lighting, not just the particles:
//  - petals: warm spring light, sun rays by day, sakura petals
//  - rain:   overcast sky, heavy cloud deck, two depths of rain, splashes, street mist,
//            more lit windows with halos, droplets on the "glass", occasional lightning
//  - clear:  crisp sky
// Weather changes cross-fade over a few seconds. Runs at ~30fps and pauses while hidden.

const PALETTES = {
  night: { top: '#0b0a1f', mid: '#231a4a', low: '#4a2d6b', far: '#2a2050', near: '#140e2b', win: '#ffd38a', cloud: [150, 120, 210, 0.16], lit: 0.55, stars: 1, moon: 1 },
  dawn: { top: '#2a2457', mid: '#b77fb3', low: '#ffc3a0', far: '#6b5a8f', near: '#3c2f5c', win: '#ffe2b0', cloud: [255, 214, 226, 0.34], lit: 0.25, stars: 0.25, moon: 0.3 },
  day: { top: '#5b9ef0', mid: '#a6cdfa', low: '#ffe2ef', far: '#8b97cf', near: '#5d659f', win: '#fff3c4', cloud: [255, 255, 255, 0.55], lit: 0.06, stars: 0, moon: 0 },
  dusk: { top: '#2b1f5c', mid: '#b25d9b', low: '#ffad85', far: '#4a3266', near: '#2a1a40', win: '#ffcf8a', cloud: [255, 176, 196, 0.34], lit: 0.4, stars: 0.35, moon: 0.5 },
};
const KEYS = [[0, 'night'], [5, 'night'], [6.8, 'dawn'], [9.5, 'day'], [16.5, 'day'], [18.6, 'dusk'], [20.6, 'night'], [24, 'night']];
const COLOR_KEYS = ['top', 'mid', 'low', 'far', 'near', 'win'];

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
for (const p of Object.values(PALETTES)) for (const k of COLOR_KEYS) p[k] = hex(p[k]);

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const rand = (a, b) => a + Math.random() * (b - a);

function paletteAt(hour) {
  let i = 0;
  while (i < KEYS.length - 2 && hour >= KEYS[i + 1][0]) i++;
  const [h0, k0] = KEYS[i], [h1, k1] = KEYS[i + 1];
  const t = h1 === h0 ? 0 : Math.min(1, Math.max(0, (hour - h0) / (h1 - h0)));
  const a = PALETTES[k0], b = PALETTES[k1];
  const out = {};
  for (const k of COLOR_KEYS) out[k] = mix(a[k], b[k], t);
  for (const k of ['lit', 'stars', 'moon']) out[k] = lerp(a[k], b[k], t);
  out.cloud = a.cloud.map((v, j) => lerp(v, b.cloud[j], t));
  out.day = (k0 === 'day' ? 1 - t : 0) + (k1 === 'day' ? t : 0);
  if (k0 === 'day' && k1 === 'day') out.day = 1;
  return out;
}

// Grey, darker version of a colour (same brightness ordering, so dusk stays dusky).
function overcast(c) {
  const lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  return mix(c, [lum * 0.95, lum, lum * 1.12], 0.78).map((v) => v * 0.6);
}
const WARM = [255, 186, 210];

function weatherize(pal, wx) {
  const out = { ...pal };
  for (const k of ['top', 'mid', 'low', 'far', 'near']) {
    let c = pal[k];
    if (wx.petals > 0) c = mix(c, WARM, (k === 'low' || k === 'mid' ? 0.12 : 0.05) * wx.petals);
    if (wx.rain > 0) c = mix(c, overcast(c), wx.rain);
    out[k] = c;
  }
  out.stars = pal.stars * (1 - wx.rain);
  out.moon = pal.moon * (1 - 0.92 * wx.rain);
  out.sun = pal.day * (1 - 0.85 * wx.rain) * (1 + 0.35 * wx.petals);
  out.lit = Math.min(0.85, pal.lit + 0.2 * wx.rain);
  const [r, g, b, a] = pal.cloud;
  const cloudRgb = mix([r, g, b], overcast([r, g, b]), wx.rain);
  out.cloud = [...cloudRgb, lerp(a, 0.6, wx.rain)];
  // how dark it is overall: drives window halos
  out.dark = Math.min(1, (1 - pal.day) * 0.8 + wx.rain * 0.5);
  return out;
}

export function startScene(canvas, initialMode = 'petals', { glass = null, onStrike = null, onRainLevel = null } = {}) {
  const ctx = canvas.getContext('2d');
  const gctx = glass ? glass.getContext('2d') : null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, hgt = 0;
  let mode = initialMode;
  const wx = { rain: mode === 'rain' ? 1 : 0, petals: mode === 'petals' ? 1 : 0 };
  let rainLevel = 0.8;
  let stars = [], clouds = [], deck = [], buildings = [], petals = [], farRain = [], nearRain = [], splashes = [], droplets = [];
  let layers = null, layerKey = '';
  let flash = 0, flashSeq = null, bolt = null, nextStrike = performance.now() + rand(12000, 30000);
  let halo = null;

  function resize() {
    w = canvas.width = innerWidth;
    hgt = canvas.height = innerHeight;
    if (glass) { glass.width = w; glass.height = hgt; }
    stars = Array.from({ length: 160 }, () => ({ x: rand(0, w), y: rand(0, hgt * 0.62), r: rand(0.4, 1.5), p: rand(0, 6.28), s: rand(0.6, 2) }));
    clouds = Array.from({ length: 7 }, () => makeCloud(rand(-200, w), false));
    deck = Array.from({ length: 16 }, (_, i) => makeCloud((i / 16) * (w + 400) - 200, true));
    buildings = [];
    for (const layer of ['far', 'near']) {
      let x = -20;
      while (x < w + 40) {
        const bw = layer === 'far' ? rand(40, 110) : rand(60, 150);
        const bh = layer === 'far' ? rand(hgt * 0.16, hgt * 0.42) : rand(hgt * 0.08, hgt * 0.3);
        const windows = [];
        for (let wy = hgt - bh + 14; wy < hgt - 12; wy += 14) {
          for (let wx2 = x + 8; wx2 < x + bw - 10; wx2 += 12) {
            if (Math.random() < 0.85) windows.push({ x: wx2, y: wy, seed: Math.random(), t: Math.random() });
          }
        }
        buildings.push({ layer, x, w: bw, h: bh, windows, antenna: Math.random() < 0.25 });
        x += bw + (layer === 'far' ? rand(-12, 6) : rand(-6, 16));
      }
    }
    farRain = Array.from({ length: 260 }, () => newDrop(false, true));
    nearRain = Array.from({ length: 110 }, () => newDrop(true, true));
    droplets = Array.from({ length: 34 }, () => newDroplet(true));
    layerKey = '';
    petals = [];
  }

  function makeCloud(x, isDeck) {
    const n = isDeck ? 7 : 5 + (Math.random() * 4 | 0);
    const puffs = Array.from({ length: n }, (_, i) => ({ dx: i * rand(22, 34), dy: rand(-14, 8), r: rand(isDeck ? 34 : 18, isDeck ? 60 : 36) }));
    return { x, y: isDeck ? rand(-30, 110) : rand(30, hgt * 0.38), v: isDeck ? rand(14, 24) : rand(4, 11), puffs, scale: isDeck ? rand(1.2, 1.9) : rand(0.7, 1.4) };
  }

  function newDrop(near, scatter) {
    return {
      x: rand(-200, w + 50), y: scatter ? rand(-hgt, hgt) : rand(-80, -10),
      len: near ? rand(18, 32) : rand(8, 15), v: near ? rand(950, 1250) : rand(520, 700),
      ground: rand(hgt * 0.8, hgt), on: Math.random(),
    };
  }

  function newDroplet(scatter) {
    return { x: rand(0, w), y: scatter ? rand(0, hgt) : rand(0, hgt * 0.7), r: rand(1.2, 3.6), vy: 0, sliding: Math.random() < 0.15, life: scatter ? rand(0, 1) : 0, trail: [] };
  }

  function haloSprite(color) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    rg.addColorStop(0, css(color, 0.55));
    rg.addColorStop(1, css(color, 0));
    g.fillStyle = rg;
    g.fillRect(0, 0, 32, 32);
    return c;
  }

  // Silhouettes + windows (+ halos) are baked into offscreen canvases and rebuilt only when the
  // colours/lighting change noticeably or every few seconds (windows switch on and off slowly).
  function buildLayers(pal, t) {
    const q = (c) => c.map((v) => v >> 3).join(',');
    const bucket = Math.floor(t / 4000);
    const key = `${q(pal.far)}|${q(pal.near)}|${q(pal.win)}|${Math.round(pal.lit * 20)}|${Math.round(pal.dark * 10)}|${bucket}`;
    if (key === layerKey && layers) return;
    layerKey = key;
    if (!halo || halo.color !== q(pal.win)) { halo = haloSprite(pal.win); halo.color = q(pal.win); }
    const make = (layer, color) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = hgt;
      const g = c.getContext('2d');
      g.fillStyle = css(color);
      const list = buildings.filter((b) => b.layer === layer);
      for (const b of list) {
        g.fillRect(b.x, hgt - b.h, b.w, b.h);
        if (b.antenna) g.fillRect(b.x + b.w / 2 - 1, hgt - b.h - 18, 2, 18);
      }
      const haloAlpha = layer === 'near' ? 0.08 + 0.3 * pal.dark : 0.05 + 0.15 * pal.dark;
      for (const b of list) {
        for (const win of b.windows) {
          const on = win.seed + Math.sin(bucket * 0.15 + win.t * 40) * 0.08 < pal.lit;
          if (!on) continue;
          if (pal.dark > 0.25) {
            g.globalAlpha = haloAlpha;
            g.globalCompositeOperation = 'lighter';
            g.drawImage(halo, win.x - 13, win.y - 12);
            g.globalCompositeOperation = 'source-over';
          }
          g.globalAlpha = layer === 'far' ? 0.55 : 0.85;
          g.fillStyle = css(pal.win);
          g.fillRect(win.x, win.y, 5, 7);
        }
      }
      g.globalAlpha = 1;
      return c;
    };
    layers = { far: make('far', pal.far), near: make('near', pal.near) };
  }

  function strike(now) {
    const distance = rand(0.15, 0.95);
    const k = 1 - distance * 0.6;
    flashSeq = { start: now, k };
    if (distance < 0.7) {
      // jagged bolt across the visible top of the sky, with one branch
      const pts = [];
      let x = rand(w * 0.15, w * 0.85), y = 0;
      const end = rand(120, 260);
      while (y < end) { pts.push([x, y]); y += rand(8, 16); x += rand(-16, 16); }
      const at = pts[(pts.length * rand(0.3, 0.6)) | 0];
      const branch = [at];
      let bx = at[0], by = at[1];
      for (let i = 0; i < 6; i++) { by += rand(8, 14); bx += rand(4, 18) * (Math.random() < 0.5 ? -1 : 1); branch.push([bx, by]); }
      bolt = { pts, branch, until: now + 190 };
    }
    if (onStrike) onStrike(distance);
  }

  let last = 0;
  let lastLevelReport = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden || t - last < 33) return; // ~30fps, paused when hidden
    const dt = Math.min(0.1, (t - (last || t)) / 1000);
    last = t;

    // ease weather blend towards the selected mode
    const target = { rain: mode === 'rain' ? 1 : 0, petals: mode === 'petals' ? 1 : 0 };
    for (const k of ['rain', 'petals']) wx[k] += (target[k] - wx[k]) * Math.min(1, dt * 0.6);
    rainLevel = 0.62 + 0.28 * Math.sin(t / 85000) + 0.1 * Math.sin(t / 23000);
    if (onRainLevel && t - lastLevelReport > 2000) { lastLevelReport = t; onRainLevel(rainLevel); }

    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const pal = weatherize(paletteAt(hour), wx);
    buildLayers(pal, t);

    // lightning (rain only)
    if (mode === 'rain' && wx.rain > 0.85 && !reducedMotion && t > nextStrike) {
      strike(t);
      nextStrike = t + rand(25000, 80000);
    }
    flash = 0;
    if (flashSeq) {
      const e = t - flashSeq.start;
      const seq = [[0, 1], [60, 0.15], [120, 0.7], [210, 0.08], [300, 0]];
      if (e > 300) flashSeq = null;
      else {
        for (let i = 0; i < seq.length - 1; i++) {
          if (e >= seq[i][0] && e < seq[i + 1][0]) flash = lerp(seq[i][1], seq[i + 1][1], (e - seq[i][0]) / (seq[i + 1][0] - seq[i][0])) * flashSeq.k;
        }
      }
    }

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, hgt);
    sky.addColorStop(0, css(pal.top));
    sky.addColorStop(0.55, css(pal.mid));
    sky.addColorStop(1, css(pal.low));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, hgt);

    // stars
    if (pal.stars > 0.02) {
      for (const s of stars) {
        const a = pal.stars * (0.35 + 0.65 * Math.abs(Math.sin(t / 1000 * s.s + s.p)));
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
    }

    // moon / sun
    const mx = w * 0.66, my = 78;
    if (pal.moon > 0.02) {
      const glow = ctx.createRadialGradient(mx, my, 10, mx, my, 150);
      glow.addColorStop(0, `rgba(255,230,240,${0.35 * pal.moon})`);
      glow.addColorStop(1, 'rgba(255,230,240,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(mx - 150, my - 150, 300, 300);
      ctx.fillStyle = `rgba(255,244,236,${0.95 * pal.moon})`;
      ctx.beginPath(); ctx.arc(mx, my, 36, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(232,214,214,${0.5 * pal.moon})`;
      [[-10, -8, 7], [12, 6, 5], [-2, 14, 4]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, Math.PI * 2); ctx.fill(); });
    }
    if (pal.sun > 0.02) {
      const sy = 110;
      const glow = ctx.createRadialGradient(mx, sy, 10, mx, sy, 240);
      glow.addColorStop(0, `rgba(255,246,222,${Math.min(0.9, 0.7 * pal.sun)})`);
      glow.addColorStop(1, 'rgba(255,246,222,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(mx - 240, sy - 240, 480, 480);
      // spring sun rays (petals mode)
      if (wx.petals > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
          const ang = Math.PI * (0.56 + i * 0.075) + Math.sin(t / 9000 + i) * 0.02;
          const len = 1100;
          const spread = 0.022 + (i % 2) * 0.012;
          const g = ctx.createLinearGradient(mx, sy, mx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
          g.addColorStop(0, `rgba(255,225,235,${0.09 * wx.petals * pal.sun})`);
          g.addColorStop(1, 'rgba(255,225,235,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(mx, sy);
          ctx.lineTo(mx + Math.cos(ang - spread) * len, sy + Math.sin(ang - spread) * len);
          ctx.lineTo(mx + Math.cos(ang + spread) * len, sy + Math.sin(ang + spread) * len);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // fair-weather clouds
    const [cr, cg, cb, ca] = pal.cloud;
    const lit = (v) => Math.min(255, v + flash * 120);
    ctx.fillStyle = `rgba(${lit(cr) | 0},${lit(cg) | 0},${lit(cb) | 0},${(ca * (1 - 0.4 * wx.rain)).toFixed(3)})`;
    for (const c of clouds) {
      c.x += c.v * dt * (1 + wx.rain);
      if (c.x > w + 60) Object.assign(c, makeCloud(-320, false));
      ctx.beginPath();
      for (const p of c.puffs) ctx.arc(c.x + p.dx * c.scale, c.y + p.dy * c.scale, p.r * c.scale, 0, Math.PI * 2);
      ctx.fill();
    }
    // storm deck (rain): a heavy, darker layer of cloud across the top
    if (wx.rain > 0.02) {
      const deckColor = overcast(pal.cloud.slice(0, 3)).map((v) => Math.min(255, v * 0.85 + flash * 140));
      ctx.fillStyle = css(deckColor, 0.75 * wx.rain);
      for (const c of deck) {
        c.x += c.v * dt;
        if (c.x > w + 80) Object.assign(c, makeCloud(-480, true));
        ctx.beginPath();
        for (const p of c.puffs) ctx.arc(c.x + p.dx * c.scale, c.y + p.dy * c.scale, p.r * c.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // lightning flash + bolt
    if (flash > 0) {
      const fg = ctx.createLinearGradient(0, 0, 0, hgt * 0.7);
      fg.addColorStop(0, `rgba(225,225,255,${0.32 * flash})`);
      fg.addColorStop(1, 'rgba(225,225,255,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, w, hgt * 0.7);
    }
    if (bolt && t < bolt.until) {
      ctx.save();
      ctx.strokeStyle = 'rgba(245,240,255,0.95)';
      ctx.shadowColor = 'rgba(190,170,255,0.9)';
      ctx.shadowBlur = 14;
      for (const [path, width] of [[bolt.pts, 2.2], [bolt.branch, 1.2]]) {
        ctx.lineWidth = width;
        ctx.beginPath();
        path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      ctx.restore();
    } else if (bolt) bolt = null;

    // city
    ctx.drawImage(layers.far, 0, 0);
    if (wx.rain > 0.02) {
      // distance haze between the two rows of buildings
      ctx.fillStyle = css(overcast(pal.mid), 0.22 * wx.rain);
      ctx.fillRect(0, hgt * 0.55, w, hgt * 0.45);
    }
    ctx.drawImage(layers.near, 0, 0);

    // street level: warm haze, or cold mist in the rain
    const haze = ctx.createLinearGradient(0, hgt * 0.7, 0, hgt);
    haze.addColorStop(0, 'rgba(0,0,0,0)');
    haze.addColorStop(1, `rgba(${lerp(255, 150, wx.rain) | 0},${lerp(150, 168, wx.rain) | 0},${lerp(190, 200, wx.rain) | 0},${(0.12 + 0.14 * wx.rain).toFixed(3)})`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, hgt * 0.7, w, hgt * 0.3);

    // petals
    if (wx.petals > 0.02) {
      if (mode === 'petals' && petals.length < 46 && Math.random() < 0.25) {
        petals.push({ x: rand(-100, w), y: -20, vx: rand(12, 40), vy: rand(18, 38), rot: rand(0, 6.28), vr: rand(-1.5, 1.5), sway: rand(0, 6.28), size: rand(4, 7.5) });
      }
      for (const p of petals) {
        p.sway += dt * 2;
        p.x += (p.vx + Math.sin(p.sway) * 18) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = wx.petals;
        ctx.fillStyle = 'rgba(255,190,214,0.85)';
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,225,236,0.9)';
        ctx.beginPath(); ctx.ellipse(-p.size * 0.25, -p.size * 0.1, p.size * 0.35, p.size * 0.18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      petals = petals.filter((p) => p.y < hgt + 30 && p.x < w + 60);
    } else if (petals.length) petals = [];

    // rain: far layer (thin, faint), near layer (long, brighter) with splashes
    if (wx.rain > 0.02) {
      const wind = 0.13 + 0.06 * Math.sin(t / 7000);
      const density = wx.rain * rainLevel;
      ctx.lineCap = 'round';
      for (const [list, near] of [[farRain, false], [nearRain, true]]) {
        ctx.strokeStyle = near ? `rgba(210,220,245,${(0.48 * wx.rain).toFixed(3)})` : `rgba(190,200,230,${(0.28 * wx.rain).toFixed(3)})`;
        ctx.lineWidth = near ? 1.4 : 1;
        ctx.beginPath();
        for (const d of list) {
          d.y += d.v * dt;
          d.x += d.v * dt * wind;
          if (d.y > (near ? d.ground : hgt)) {
            if (near && d.on < density && splashes.length < 160) {
              for (let i = 0; i < 2; i++) splashes.push({ x: d.x, y: d.ground, vx: rand(-50, 50), vy: rand(-110, -50), life: 0.3 });
            }
            Object.assign(d, newDrop(near, false));
          }
          if (d.on > density) continue; // density decides how many drops are visible
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.len * wind, d.y - d.len);
        }
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(215,225,245,${(0.45 * wx.rain).toFixed(3)})`;
      for (const s of splashes) {
        s.vy += 600 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt;
        ctx.fillRect(s.x, s.y, 1.4, 1.4);
      }
      splashes = splashes.filter((s) => s.life > 0);
    }

    drawGlass(dt);
  }

  // Raindrops on the "window" in front of the HUD: a few beads, some of which slide down.
  function drawGlass(dt) {
    if (!gctx) return;
    gctx.clearRect(0, 0, w, hgt);
    if (wx.rain < 0.05) return;
    const alpha = Math.min(1, wx.rain);
    for (const d of droplets) {
      d.life = Math.min(1, d.life + dt * 0.4);
      if (!d.sliding && Math.random() < 0.0015) d.sliding = true;
      if (d.sliding) {
        d.vy = Math.min(140, d.vy + rand(-20, 60) * dt * 10);
        d.vy = Math.max(0, d.vy);
        d.y += d.vy * dt;
        if (d.vy > 10 && Math.random() < 0.5) d.trail.push({ x: d.x + rand(-0.5, 0.5), y: d.y - d.r, a: 0.5 });
      }
      d.trail = d.trail.filter((p) => (p.a -= dt * 0.25) > 0);
      if (d.y > hgt + 10 || (!d.sliding && Math.random() < 0.0004)) Object.assign(d, newDroplet(false));
      const a = alpha * d.life;
      for (const p of d.trail) {
        gctx.fillStyle = `rgba(200,215,245,${(p.a * 0.25 * a).toFixed(3)})`;
        gctx.fillRect(p.x, p.y, 1, 1.5);
      }
      gctx.fillStyle = `rgba(190,205,240,${(0.12 * a).toFixed(3)})`;
      gctx.beginPath(); gctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); gctx.fill();
      gctx.strokeStyle = `rgba(20,20,45,${(0.25 * a).toFixed(3)})`;
      gctx.lineWidth = 0.8;
      gctx.beginPath(); gctx.arc(d.x, d.y, d.r, 0.2 * Math.PI, 0.9 * Math.PI); gctx.stroke();
      gctx.fillStyle = `rgba(255,255,255,${(0.55 * a).toFixed(3)})`;
      gctx.fillRect(d.x - d.r * 0.45, d.y - d.r * 0.5, Math.max(1, d.r * 0.4), Math.max(1, d.r * 0.4));
    }
  }

  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  return {
    setMode(m) { mode = m; },
    lightning() { strike(performance.now()); }, // manual strike (also handy when testing)
    get rainLevel() { return rainLevel; },
  };
}
