// The village soundscape: continuous layers (creek, wind, rain on thatch, bonfire, festival crowd,
// children) plus birds, insects, frogs and festival music chosen by time, place and weather.
// Sounds placed in the world are panned and attenuated by where the camera is looking.
import * as amb from '../../../shared/core/ambience.js';
import { W, inRange } from './engine/util.js';
import { YAGURA, FIRE } from './engine/world.js';

const PLAZA_X = (YAGURA.x + FIRE.x) / 2;

export function createSoundscape(onTaiko) {
  let camX = 0, enabled = true, kidsBoost = 0, lastTick = 0, beatAt = 0, step = 0, lastFue = 0;

  // place a world-x sound in the stereo field; far-off sounds are quieter
  function place(opts = {}) {
    const center = camX + W / 2;
    if (opts.x !== undefined) {
      const dx = opts.x - center;
      const pan = Math.max(-1, Math.min(1, dx / (W * 0.6)));
      const fall = Math.max(0.12, 1 - Math.max(0, Math.abs(dx) - W * 0.45) / 520);
      return { ...opts, pan, vol: (opts.vol ?? 1) * fall };
    }
    if (opts.sx !== undefined) return { ...opts, pan: (opts.sx / W) * 2 - 1 };
    return opts;
  }

  function event(name, opts = {}) {
    if (!enabled) return;
    if (name === 'giggle') { kidsBoost = 2.5; return; }
    if (name === 'bell' && amb.playSample('bell', place({ ...opts, vol: 0.9 }))) return;
    if (name === 'toad' && opts.ambient && Math.random() < 0.6) return;
    amb.play(name, place(opts));
  }

  function update(state, env, dt, now) {
    camX = state.camX;
    if (!enabled) return;
    const h = state.hour, rain = state.rain, center = camX + W / 2;
    const near = (x, span = 520) => Math.max(0, 1 - Math.abs(x - center) / span);
    const forest = center > 1000;
    const evening = inRange(h, 19.2, 23.3) && rain < 0.5;
    amb.layer('creek', (forest ? 0.32 : 0.46) + rain * 0.12);
    amb.layer('wind', inRange(h, 8, 18) ? 0.32 + rain * 0.3 : 0.14 + rain * 0.3);
    amb.layer('thatchRain', rain * 0.8);
    amb.layer('fire', evening ? 0.5 * near(FIRE.x) : 0);
    amb.layer('crowd', evening && state.festival ? 0.42 * near(PLAZA_X) : 0);
    kidsBoost = Math.max(0, kidsBoost - dt);
    const kidsOut = inRange(h, 8.4, 17.2) && rain < 0.5;
    amb.sampleLoop('kids', kidsOut ? (0.05 + Math.min(kidsBoost, 1) * 0.07) * near(PLAZA_X, 600) : 0);

    // festival music: taiko pattern on the yagura, flute phrases now and then
    if (evening && state.festival) {
      if (now - beatAt > 300) {
        beatAt = now;
        const pat = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.6, 0, 1, 0, 0, 0];
        const a = pat[step++ % pat.length];
        if (a) { amb.play('taiko', place({ x: YAGURA.x, accent: a, vol: 0.55 })); if (onTaiko) onTaiko(); }
      }
      if (now - lastFue > 11000 && Math.random() < 0.01) { lastFue = now; amb.play('fue', place({ x: YAGURA.x, vol: 0.6 })); }
    }

    if (now - lastTick < 200) return;
    lastTick = now;
    const night = env.dark > 0.45;
    const rates = { // events per minute
      uguisu: rain < 0.5 && inRange(h, 5.4, 11) ? 2.4 : rain < 0.5 && inRange(h, 11, 16) ? 0.7 : 0,
      sparrows: rain < 0.5 && inRange(h, 5.4, 9.5) ? 5 : rain < 0.5 && inRange(h, 9.5, 16.8) ? 1.4 : 0,
      tonbi: rain < 0.5 && inRange(h, 9.5, 16) ? 1 : 0,
      crows: inRange(h, 16.6, 19.2) ? 3 : inRange(h, 5, 7) ? 0.8 : 0,
      higurashi: rain < 0.5 && inRange(h, 16.5, 19.5) ? 2.6 : rain < 0.5 && inRange(h, 4.6, 6) ? 1 : 0,
      furin: !forest && inRange(h, 8, 21) ? 1.3 : 0,
      cricket: night ? (rain > 0.5 ? 12 : 44) : 0,
      kajika: night ? (forest ? 3 : 1.6) * (1 + rain * 0.5) : 0,
      owl: inRange(h, 21.8, 5) ? (forest ? 1.2 : 0.2) : 0,
    };
    for (const [name, perMin] of Object.entries(rates)) {
      if (!perMin || Math.random() > perMin / 300) continue;
      const vol = forest && (name === 'furin' || name === 'sparrows') ? 0.4 : 1;
      amb.play(name, { vol });
    }
  }

  return {
    event,
    update,
    setEnabled(v) { enabled = v; if (!v) { for (const l of ['creek', 'wind', 'thatchRain', 'fire', 'crowd']) amb.layer(l, 0); amb.sampleLoop('kids', 0); } },
    get enabled() { return enabled; },
  };
}

// Load the optional CC0 recordings that ship with the skin (missing files are fine).
export async function loadRecordings() {
  const files = { kids: 'skins/v3-satoyama/audio/children.mp3', bell: 'skins/v3-satoyama/audio/bell.mp3' };
  for (const [name, path] of Object.entries(files)) {
    try {
      const buf = await window.hud.assets.read(path);
      if (buf) await amb.loadSample(name, buf);
    } catch { /* recording not installed: synthesised fallback */ }
  }
}
