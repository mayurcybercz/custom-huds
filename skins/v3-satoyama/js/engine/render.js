// Frame compositor. Order: sky → ridges & mist → (world + life, lit by the light map) →
// emissive lights + bloom → creek reflecting the finished village → reeds → effects → rain → vignette.
import { W, H, WATER, canvas, rgb, light, mix, clamp, inRange, rect } from './util.js';
import { environment } from './env.js';
import { buildWorld, RIDGES, HOUSES, TORO, LANTERN_STRINGS, TEMPLE, SACRED_TREE, SHISHI, BELL, groundY } from './world.js';
import { drawSky } from './sky.js';
import * as scenery from './scenery.js';
import { createActors } from './actors.js';
import { createFx } from './fx.js';

export function createRenderer(target, { sound }) {
  const g = target.getContext('2d');
  g.imageSmoothingEnabled = false;
  const buf = canvas(W, H), mask = canvas(W, H), lightMap = canvas(W, H), emis = canvas(W, H);
  const bloom = canvas(Math.ceil(W / 3), Math.ceil(H / 3));
  const world = buildWorld();
  const fx = createFx();
  const actors = createActors(sound);
  let bellAt = -1e9, lastRipple = 0, lastRustle = 0;
  const vignette = (() => {
    const v = canvas(W, H), gr = v.g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.72);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(6,4,16,0.42)');
    v.g.fillStyle = gr; v.g.fillRect(0, 0, W, H);
    return v.c;
  })();

  // Ridges change colour slowly, so each is cached as an image and only redrawn when its colour moves.
  const ridgeCache = RIDGES.map((R) => ({ ...canvas(R.width, H), key: '' }));
  function ridgeImage(i, col, hi) {
    const R = RIDGES[i], rc = ridgeCache[i];
    const key = `${col.map((v) => v >> 2).join(',')}|${hi.map((v) => v >> 2).join(',')}`;
    if (rc.key === key) return rc.c;
    rc.key = key;
    rc.g.clearRect(0, 0, R.width, H);
    rc.g.fillStyle = rgb(col);
    for (let x = 0; x < R.width; x++) rc.g.fillRect(x, R.top[x], 1, H - R.top[x]);
    rc.g.fillStyle = rgb(hi);
    for (let x = 0; x < R.width; x++) if (R.hi[x]) rc.g.fillRect(x, R.top[x], 1, 1);
    return rc.c;
  }

  function ringBell(now) { bellAt = now; if (sound) sound('bell', { x: BELL.x }); }

  function frame(state, pointer, dt, now) {
    const t = now / 1000, camX = Math.round(state.camX), hour = state.hour;
    const env = environment(hour, state.rain);
    const wind = 0.9 + Math.sin(t * 0.13) * 0.5 + state.rain * 0.8;
    const ctx = { t, dt, hour, env, camX, pointer, festival: state.festival, now, wind, rain: state.rain, fx, fishAt: null };
    const X = (x) => Math.round(x - camX);

    // ---- pointer presses that are about places rather than characters
    if (pointer.pressed) {
      const { wx, wy, sx, sy } = pointer;
      if (Math.abs(wx - BELL.x) < 14 && wy > BELL.y - 14 && wy < BELL.y + 16) ringBell(now);
      else if (Math.abs(wx - SHISHI.x) < 18 && Math.abs(wy - SHISHI.pivotY) < 12) scenery.triggerPump();
      else if (wy > WATER + 2) { fx.ripple(wx, wy, true); ctx.fishAt = wx + (Math.random() - 0.5) * 30; if (sound) sound('splash', { x: wx }); }
      else if (pointer.inSky && env.stars > 0.3) { fx.shootingStar(sx + 20, sy - 6); if (sound) sound('twinkle', { sx }); }
      else if (pointer.inSky) actors.exciteKids();
    }
    // trailing the pointer through the water leaves ripples
    if (pointer.active && pointer.wy > WATER + 1 && (Math.abs(pointer.dx) + Math.abs(pointer.dy) > 0.6) && now - lastRipple > 110) { lastRipple = now; fx.ripple(pointer.wx, pointer.wy); }

    // ================================================= scene buffer: world + animated scenery + life
    const b = buf.g;
    b.clearRect(0, 0, W, H);
    b.drawImage(world.canvas, -camX, 0);
    const touchedBamboo = scenery.drawBamboo(b, ctx, 'back') | scenery.drawBamboo(b, ctx, 'front');
    const rustled = scenery.drawPaddies(b, ctx);
    if ((touchedBamboo || rustled) && now - lastRustle > 400) { lastRustle = now; if (sound) sound('rustle', { x: pointer.wx }); }
    if (scenery.drawShishi(b, ctx) && sound) sound('shishi', { x: SHISHI.x });
    scenery.drawBell(b, ctx, now - bellAt);
    scenery.drawSmoke(b, ctx);
    const evening = inRange(hour, 19.2, 23.3) && state.rain < 0.5;
    const pointerSway = (L) => (pointer.active && Math.hypot(pointer.wx - L.x, pointer.wy - L.y) < 10 ? pointer.dx * 0.8 : 0);
    if (evening && state.festival) scenery.drawLanterns(b, ctx, pointerSway);
    // the camphor tree drops a leaf or two when you brush it
    if (pointer.active && Math.abs(pointer.wx - SACRED_TREE.x) < 44 && pointer.wy > 140 && pointer.wy < 220 && Math.abs(pointer.dx) > 0.8 && Math.random() < 0.3) {
      fx.leaf(pointer.wx, pointer.wy, '#6a9a5e');
      if (now - lastRustle > 500) { lastRustle = now; if (sound) sound('rustle', { x: pointer.wx }); }
    }
    const life = actors.frame(b, ctx);

    // ================================================= main canvas: sky, ridges, mist, birds
    drawSky(g, env, t, camX, pointer, dt);
    fx.drawStars(g);
    RIDGES.forEach((R, i) => {
      const off = Math.round(camX * R.p);
      const lit = light(R.color, env.ambient);
      const col = mix(lit, env.horizon, clamp(R.haze + env.mist * 0.12, 0, 0.9));
      const hi = mix(col, [255, 245, 225], 0.12 * (1 - env.dark));
      g.drawImage(ridgeImage(i, col, hi), -off, 0);
      // mist settling between the ridges
      if (i < 3) {
        const y0 = R.base + 4, a = clamp(env.mist * (0.55 - i * 0.12), 0, 0.7);
        if (a > 0.01) {
          const mg = g.createLinearGradient(0, y0 - 14, 0, y0 + 26);
          const mc = mix(env.horizon, [235, 235, 240], 0.4);
          mg.addColorStop(0, rgb(mc, 0)); mg.addColorStop(0.5, rgb(mc, a)); mg.addColorStop(1, rgb(mc, 0));
          g.fillStyle = mg;
          g.fillRect(0, y0 - 14, W, 40);
          g.fillStyle = rgb(mc, a * 0.5);
          for (let k = 0; k < 6; k++) { const yy = y0 - 6 + k * 4, len = 60 + k * 17; const x0 = ((t * (3 + k) + k * 140) % (W + len)) - len; g.fillRect(Math.round(x0), yy, len, 1); }
        }
      }
    });
    for (const [bx, by, col, frameNo] of life.birds) {
      const x = Math.round(bx), y = Math.round(by);
      g.fillStyle = col;
      if (frameNo === 2) { g.fillRect(x - 3, y, 3, 1); g.fillRect(x + 1, y, 3, 1); g.fillRect(x, y + 1, 1, 1); g.fillRect(x - 4, y - 1, 1, 1); g.fillRect(x + 4, y - 1, 1, 1); continue; }
      g.fillRect(x, y, 1, 1);
      if (frameNo) { g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 1, y - 1, 1, 1); } else { g.fillRect(x - 1, y + 1, 1, 1); g.fillRect(x + 1, y + 1, 1, 1); }
    }

    // ================================================= light map (ambient + every light source), multiplied into the buffer
    const k = env.lights;
    const lm = lightMap.g;
    lm.globalCompositeOperation = 'source-over';
    lm.fillStyle = rgb(env.ambient);
    lm.fillRect(0, 0, W, H);
    const lamp = (x, y, rad, col, a) => {
      const sx = x - camX;
      if (sx < -rad || sx > W + rad || a <= 0.01) return;
      const gr = lm.createRadialGradient(sx, y, 0, sx, y, rad);
      gr.addColorStop(0, rgb(col, a)); gr.addColorStop(1, rgb(col, 0));
      lm.fillStyle = gr; lm.fillRect(sx - rad, y - rad, rad * 2, rad * 2);
    };
    const lateNight = inRange(hour, 23.4, 5.2);
    const houseOn = (i) => (lateNight ? (i === 2 ? 1 : 0.12) : 1);
    if (k > 0) {
      lm.globalCompositeOperation = 'lighter';
      HOUSES.forEach((hs, i) => { for (const [wx, wy, ww, wh] of hs.windows || []) lamp(wx + ww / 2, wy + wh / 2, 30, [200, 128, 48], 0.9 * k * houseOn(i)); });
      for (const [x, y] of TORO) lamp(x, y - 12, 18, [210, 150, 70], 0.85 * k);
      lamp(TEMPLE.hall, groundY(TEMPLE.hall) - 12, 34, [200, 130, 60], 0.6 * k * (lateNight ? 0.3 : 1));
      if (evening && state.festival) for (const L of LANTERN_STRINGS) lamp(L.x, L.y + 1, 13, [230, 96, 56], 0.5 * k);
      for (const Lt of life.lights) lamp(Lt.x, Lt.y, Lt.r, Lt.col, Lt.a * Math.max(k, 0.5));
      lm.globalCompositeOperation = 'source-over';
    }
    mask.g.clearRect(0, 0, W, H);
    mask.g.drawImage(buf.c, 0, 0);
    b.globalCompositeOperation = 'multiply';
    b.drawImage(lightMap.c, 0, 0);
    b.globalCompositeOperation = 'destination-in';
    b.drawImage(mask.c, 0, 0);
    b.globalCompositeOperation = 'source-over';
    g.drawImage(buf.c, 0, 0);

    // ================================================= emissive light sources + bloom
    const e = emis.g;
    e.clearRect(0, 0, W, H);
    if (k > 0.02) {
      HOUSES.forEach((hs, i) => {
        const on = k * houseOn(i);
        for (const [wx, wy, ww, wh] of hs.windows || []) {
          e.fillStyle = `rgba(255,212,140,${(0.92 * on).toFixed(3)})`;
          e.fillRect(X(wx), wy, ww, wh);
          e.fillStyle = `rgba(150,100,56,${(0.7 * on).toFixed(3)})`;
          for (let x2 = 3; x2 < ww; x2 += 3) e.fillRect(X(wx) + x2, wy, 1, wh);
          for (let y2 = 3; y2 < wh; y2 += 3) e.fillRect(X(wx), wy + y2, ww, 1);
        }
      });
      e.fillStyle = `rgba(255,214,140,${k.toFixed(3)})`;
      for (const [x, y] of TORO) e.fillRect(X(x), y - 13, 1, 2);
      e.fillStyle = `rgba(255,190,110,${(k * 0.7).toFixed(3)})`;
      e.fillRect(X(TEMPLE.hall) - 9, groundY(TEMPLE.hall) - 17, 18, 13);
      if (evening && state.festival) {
        for (const L of LANTERN_STRINGS) {
          const x = X(L.x + Math.sin(t * 1.4 + L.ph) * 0.6), y = Math.round(L.y);
          e.fillStyle = `rgba(240,90,60,${k.toFixed(3)})`; e.fillRect(x - 1, y, 3, 2);
          e.fillStyle = `rgba(255,220,170,${k.toFixed(3)})`; e.fillRect(x, y, 1, 1);
        }
      }
    }
    for (const fn of life.emissive) fn(e);
    g.drawImage(emis.c, 0, 0);
    bloom.g.clearRect(0, 0, bloom.c.width, bloom.c.height);
    bloom.g.filter = 'blur(2px)';
    bloom.g.drawImage(emis.c, 0, 0, bloom.c.width, bloom.c.height);
    bloom.g.filter = 'none';
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.85;
    g.imageSmoothingEnabled = true;
    g.drawImage(bloom.c, 0, 0, W, H);
    g.restore();

    // ================================================= the creek, reeds, effects, rain, vignette
    scenery.drawCreek(g, target, ctx, fx);
    scenery.drawReeds(g, ctx);
    fx.update(dt);
    fx.drawFront(g, camX);
    fx.drawRain(g, state.rain, t, dt, 0.18 + wind * 0.04);
    if (state.rain > 0.02) { g.fillStyle = `rgba(40,50,70,${(0.12 * state.rain).toFixed(3)})`; g.fillRect(0, 0, W, H); }
    g.drawImage(vignette, 0, 0);

    return { env };
  }

  return {
    frame,
    ringBell,
    taikoHit: () => actors.taikoHit(),
    fx,
  };
}
