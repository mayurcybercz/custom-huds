// Animated lo-fi backdrop: a city skyline under a sky that follows the real time of day
// (night → dawn → day → dusk), with stars, moon/sun, drifting clouds, lit windows,
// and falling sakura petals or rain. Runs at ~30fps and pauses while the window is hidden.

// Sky keyframes by hour of day; colours are interpolated between neighbours.
const PALETTES = {
  night: { top: '#0b0a1f', mid: '#231a4a', low: '#4a2d6b', far: '#2a2050', near: '#140e2b', win: '#ffd38a', cloud: [150, 120, 210, 0.16], lit: 0.55, stars: 1, moon: 1 },
  dawn: { top: '#2a2457', mid: '#b77fb3', low: '#ffc3a0', far: '#6b5a8f', near: '#3c2f5c', win: '#ffe2b0', cloud: [255, 214, 226, 0.34], lit: 0.25, stars: 0.25, moon: 0.3 },
  day: { top: '#5b9ef0', mid: '#a6cdfa', low: '#ffe2ef', far: '#8b97cf', near: '#5d659f', win: '#fff3c4', cloud: [255, 255, 255, 0.55], lit: 0.06, stars: 0, moon: 0 },
  dusk: { top: '#2b1f5c', mid: '#b25d9b', low: '#ffad85', far: '#4a3266', near: '#2a1a40', win: '#ffcf8a', cloud: [255, 176, 196, 0.34], lit: 0.4, stars: 0.35, moon: 0.5 },
};
const KEYS = [[0, 'night'], [5, 'night'], [6.8, 'dawn'], [9.5, 'day'], [16.5, 'day'], [18.6, 'dusk'], [20.6, 'night'], [24, 'night']];

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const lerp = (a, b, t) => a + (b - a) * t;
const mixHex = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], t))).join(',')})`; };

function paletteAt(hour) {
  let i = 0;
  while (i < KEYS.length - 2 && hour >= KEYS[i + 1][0]) i++;
  const [h0, k0] = KEYS[i], [h1, k1] = KEYS[i + 1];
  const t = h1 === h0 ? 0 : Math.min(1, Math.max(0, (hour - h0) / (h1 - h0)));
  const a = PALETTES[k0], b = PALETTES[k1];
  const out = {};
  for (const key of ['top', 'mid', 'low', 'far', 'near']) out[key] = mixHex(a[key], b[key], t);
  for (const key of ['lit', 'stars', 'moon']) out[key] = lerp(a[key], b[key], t);
  out.win = t < 0.5 ? a.win : b.win;
  out.cloud = a.cloud.map((v, j) => lerp(v, b.cloud[j], t));
  out.day = PALETTES.day === a || PALETTES.day === b ? (PALETTES.day === a ? 1 - t : t) : 0;
  if (k0 === 'day' && k1 === 'day') out.day = 1;
  return out;
}

const rand = (a, b) => a + Math.random() * (b - a);

export function startScene(canvas, initialMode = 'petals') {
  const ctx = canvas.getContext('2d');
  let w = 0, hgt = 0;
  let mode = initialMode;
  let stars = [], clouds = [], buildings = [], particles = [];
  let farLayer = null, nearLayer = null; // offscreen silhouettes, rebuilt on resize / palette change
  let layerKey = '';

  function resize() {
    w = canvas.width = innerWidth;
    hgt = canvas.height = innerHeight;
    stars = Array.from({ length: 160 }, () => ({ x: rand(0, w), y: rand(0, hgt * 0.62), r: rand(0.4, 1.5), p: rand(0, 6.28), s: rand(0.6, 2) }));
    clouds = Array.from({ length: 7 }, () => makeCloud(rand(-200, w)));
    buildings = [];
    for (const layer of ['far', 'near']) {
      let x = -20;
      while (x < w + 40) {
        const bw = layer === 'far' ? rand(40, 110) : rand(60, 150);
        const bh = layer === 'far' ? rand(hgt * 0.16, hgt * 0.42) : rand(hgt * 0.08, hgt * 0.3);
        const windows = [];
        for (let wy = hgt - bh + 14; wy < hgt - 12; wy += 14) {
          for (let wx = x + 8; wx < x + bw - 10; wx += 12) {
            if (Math.random() < 0.85) windows.push({ x: wx, y: wy, seed: Math.random(), t: Math.random() });
          }
        }
        buildings.push({ layer, x, w: bw, h: bh, windows, antenna: Math.random() < 0.25 });
        x += bw + (layer === 'far' ? rand(-12, 6) : rand(-6, 16));
      }
    }
    layerKey = '';
    particles = [];
  }

  function makeCloud(x) {
    const puffs = Array.from({ length: 5 + (Math.random() * 4 | 0) }, (_, i) => ({ dx: i * rand(22, 34), dy: rand(-14, 8), r: rand(18, 36) }));
    return { x, y: rand(30, hgt * 0.38), v: rand(4, 11), puffs, scale: rand(0.7, 1.4) };
  }

  function buildLayers(pal) {
    const key = `${pal.far}|${pal.near}`;
    if (key === layerKey && farLayer) return;
    layerKey = key;
    const make = (layer, color) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = hgt;
      const g = c.getContext('2d');
      g.fillStyle = color;
      for (const b of buildings.filter((x) => x.layer === layer)) {
        g.fillRect(b.x, hgt - b.h, b.w, b.h);
        if (b.antenna) g.fillRect(b.x + b.w / 2 - 1, hgt - b.h - 18, 2, 18);
      }
      return c;
    };
    farLayer = make('far', pal.far);
    nearLayer = make('near', pal.near);
  }

  function spawn() {
    if (mode === 'petals' && particles.length < 46 && Math.random() < 0.25) {
      particles.push({ kind: 'petal', x: rand(-100, w), y: -20, vx: rand(12, 40), vy: rand(18, 38), rot: rand(0, 6.28), vr: rand(-1.5, 1.5), sway: rand(0, 6.28), size: rand(4, 7.5) });
    } else if (mode === 'rain') {
      for (let i = 0; i < 6 && particles.length < 260; i++) {
        particles.push({ kind: 'rain', x: rand(-100, w + 100), y: rand(-60, -10), vy: rand(650, 900), len: rand(10, 22) });
      }
    }
  }

  let last = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden || t - last < 33) return; // ~30fps, paused when hidden
    const dt = Math.min(0.1, (t - (last || t)) / 1000);
    last = t;

    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const pal = paletteAt(hour);
    buildLayers(pal);

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, hgt);
    sky.addColorStop(0, pal.top);
    sky.addColorStop(0.55, pal.mid);
    sky.addColorStop(1, pal.low);
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

    // moon (night) or sun (day)
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
    if (pal.day > 0.02) {
      const sy = 110;
      const glow = ctx.createRadialGradient(mx, sy, 10, mx, sy, 220);
      glow.addColorStop(0, `rgba(255,248,220,${0.7 * pal.day})`);
      glow.addColorStop(1, 'rgba(255,248,220,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(mx - 220, sy - 220, 440, 440);
    }

    // clouds
    const [cr, cg, cb, ca] = pal.cloud;
    ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${ca.toFixed(3)})`;
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x > w + 60) Object.assign(c, makeCloud(-320));
      ctx.beginPath();
      for (const p of c.puffs) ctx.arc(c.x + p.dx * c.scale, c.y + p.dy * c.scale, p.r * c.scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // city: far silhouettes, their windows, then near ones
    ctx.drawImage(farLayer, 0, 0);
    drawWindows('far', pal, t);
    ctx.drawImage(nearLayer, 0, 0);
    drawWindows('near', pal, t);

    // warm haze at street level
    const haze = ctx.createLinearGradient(0, hgt * 0.75, 0, hgt);
    haze.addColorStop(0, 'rgba(255,150,190,0)');
    haze.addColorStop(1, 'rgba(255,150,190,0.12)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, hgt * 0.75, w, hgt * 0.25);

    // particles
    spawn();
    for (const p of particles) {
      if (p.kind === 'petal') {
        p.sway += dt * 2;
        p.x += (p.vx + Math.sin(p.sway) * 18) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = 'rgba(255,190,214,0.85)';
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,225,236,0.9)';
        ctx.beginPath(); ctx.ellipse(-p.size * 0.25, -p.size * 0.1, p.size * 0.35, p.size * 0.18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        p.y += p.vy * dt;
        p.x += p.vy * dt * 0.12;
        ctx.strokeStyle = 'rgba(190,210,255,0.32)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.len * 0.12, p.y - p.len); ctx.stroke();
      }
    }
    particles = particles.filter((p) => p.y < hgt + 30 && p.x < w + 60);
  }

  function drawWindows(layer, pal, t) {
    ctx.fillStyle = pal.win;
    for (const b of buildings) {
      if (b.layer !== layer) continue;
      for (const win of b.windows) {
        // each window slowly toggles on/off around the palette's "lit" ratio
        const on = (win.seed + Math.sin(t / 60000 + win.t * 40) * 0.08) < pal.lit;
        if (!on) continue;
        ctx.globalAlpha = layer === 'far' ? 0.55 : 0.85;
        ctx.fillRect(win.x, win.y, 5, 7);
      }
    }
    ctx.globalAlpha = 1;
  }

  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  return {
    setMode(m) { mode = m; particles = []; },
  };
}
