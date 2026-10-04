// Small effects: hearts from petting, ripples on the water, falling leaves, shooting stars, rain.
import { W, H, WATER, rgb, rng, px, rect } from './util.js';

const r = rng(808);

export function createFx() {
  const hearts = [], ripples = [], leaves = [], stars = [];
  const near = Array.from({ length: 150 }, () => ({ x: r() * W, y: r() * H, v: 330 + r() * 130, len: 6 + r() * 6 }));
  const far = Array.from({ length: 260 }, () => ({ x: r() * W, y: r() * H, v: 180 + r() * 80, len: 3 + r() * 3 }));
  const splashes = [];

  return {
    heart(wx, wy) { hearts.push({ wx, wy, age: 0, dx: (r() - 0.5) * 8 }); },
    ripple(wx, wy, big = false) { if (ripples.length < 40) ripples.push({ wx, wy, age: 0, max: big ? 14 : 8 }); },
    leaf(wx, wy, col) { if (leaves.length < 60) leaves.push({ wx, wy, vx: (r() - 0.5) * 10, vy: 8 + r() * 6, ph: r() * 6, col, age: 0 }); },
    shootingStar(sx, sy) { stars.push({ x: sx, y: sy, vx: -(140 + r() * 80), vy: 50 + r() * 40, age: 0 }); },

    update(dt) {
      for (const h of hearts) { h.age += dt; h.wy -= dt * 10; h.wx += Math.sin(h.age * 6) * dt * 4 + h.dx * dt; }
      for (const p of ripples) p.age += dt;
      for (const l of leaves) { l.age += dt; l.wx += (l.vx + Math.sin(l.age * 3 + l.ph) * 8) * dt; l.wy += l.vy * dt; }
      for (const s of stars) { s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; }
      for (const s of splashes) { s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 400 * dt; }
      filter(hearts, (h) => h.age < 1.6);
      filter(ripples, (p) => p.age < 1.4);
      filter(leaves, (l) => l.wy < WATER + 2 && l.age < 12);
      filter(stars, (s) => s.age < 1.2);
      filter(splashes, (s) => s.age < 0.35);
    },

    // in front of the scene (screen space after the camera)
    drawFront(g, camX) {
      for (const h of hearts) {
        const x = Math.round(h.wx - camX), y = Math.round(h.wy), a = Math.min(1, 1.6 - h.age);
        g.fillStyle = `rgba(255,110,150,${a.toFixed(2)})`;
        g.fillRect(x - 2, y, 2, 1); g.fillRect(x + 1, y, 2, 1);
        g.fillRect(x - 2, y + 1, 5, 1); g.fillRect(x - 1, y + 2, 3, 1); g.fillRect(x, y + 3, 1, 1);
        g.fillStyle = `rgba(255,220,230,${a.toFixed(2)})`; g.fillRect(x - 2, y, 1, 1);
      }
      for (const l of leaves) { g.fillStyle = l.col; g.fillRect(Math.round(l.wx - camX), Math.round(l.wy), 2, 1); }
      for (const s of splashes) { g.fillStyle = 'rgba(220,236,248,0.8)'; g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); }
    },
    drawStars(g) {
      for (const s of stars) {
        const a = Math.max(0, 1 - s.age / 1.2);
        for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(255,250,230,${(a * (1 - i / 14)).toFixed(3)})`; g.fillRect(Math.round(s.x - s.vx * i * 0.006), Math.round(s.y - s.vy * i * 0.006), 1, 1); }
        g.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; g.fillRect(Math.round(s.x) - 1, Math.round(s.y), 2, 1);
      }
    },
    drawRipples(g, camX) {
      for (const p of ripples) {
        const k = p.age / 1.4, rad = 1 + k * p.max, a = (1 - k) * 0.7, x = p.wx - camX;
        g.fillStyle = `rgba(230,242,250,${a.toFixed(3)})`;
        for (let i = 0; i < 24; i++) {
          const ang = (i / 24) * Math.PI * 2;
          g.fillRect(Math.round(x + Math.cos(ang) * rad), Math.round(p.wy + Math.sin(ang) * rad * 0.35), 1, 1);
        }
      }
    },
    // rain in two depths, with little splashes where the near drops land
    drawRain(g, amount, t, dt, wind = 0.2) {
      if (amount < 0.02) return;
      g.fillStyle = `rgba(190,202,224,${(0.32 * amount).toFixed(3)})`;
      for (const d of far) {
        d.y += d.v * dt; d.x += d.v * dt * wind;
        if (d.y > H) { d.y = -5; d.x = r() * W; }
        if (d.x > W) d.x -= W;
        g.fillRect(Math.round(d.x), Math.round(d.y), 1, Math.round(d.len));
      }
      g.fillStyle = `rgba(210,220,240,${(0.5 * amount).toFixed(3)})`;
      for (const d of near) {
        d.y += d.v * dt; d.x += d.v * dt * wind;
        if (d.y > H) {
          if (splashes.length < 80 && r() < amount) for (let i = 0; i < 2; i++) splashes.push({ x: d.x, y: WATER + r() * 40, vx: (r() - 0.5) * 50, vy: -60 - r() * 50, age: 0 });
          d.y = -10; d.x = r() * W;
        }
        if (d.x > W) d.x -= W;
        for (let i = 0; i < d.len; i++) g.fillRect(Math.round(d.x - i * wind), Math.round(d.y - i), 1, 1);
      }
    },
  };
}

function filter(arr, keep) { let j = 0; for (let i = 0; i < arr.length; i++) if (keep(arr[i])) arr[j++] = arr[i]; arr.length = j; }
