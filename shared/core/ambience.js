// Ambient audio for all skins, synthesised with WebAudio (plus optional CC0 samples a skin ships)
// so the repo stays nearly asset-free: rain and thunder (v2), and the village voices, layers
// and sample loops used by the v3 skin (see the second half of this file).
let ctx = null;
let master = null;
let volume = 0.5;
let analyser = null;
const buffers = {};

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    master.connect(analyser);
  }
  if (ctx.state === 'suspended' && volume > 0) ctx.resume();
  return ctx;
}

// Stereo noise buffers (channels decorrelated for width): white, pink (Kellet filter) or brown.
function noise(kind, seconds = 4) {
  const key = `${kind}:${seconds}`;
  if (buffers[key]) return buffers[key];
  const c = audio();
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
  }
  return (buffers[key] = buf);
}

function loopSource(kind) {
  const s = ctx.createBufferSource();
  s.buffer = noise(kind);
  s.loop = true;
  return s;
}

function filter(type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function gain(v) {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

// 'running' | 'suspended' | 'closed' | 'none' (not created yet).
export function status() {
  return ctx ? ctx.state : 'none';
}

// Current output level (RMS, 0..1). Handy for meters, and for checking that sound is playing.
export function meter() {
  if (!analyser) return 0;
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  return Math.sqrt(data.reduce((a, v) => a + v * v, 0) / data.length);
}

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (!master) return;
  master.gain.setTargetAtTime(volume, ctx.currentTime, 0.3);
  // muted: stop the whole audio graph so it costs no CPU; resume when the volume comes back
  if (volume === 0) setTimeout(() => { if (volume === 0 && ctx.state === 'running') ctx.suspend(); }, 1200);
  else if (ctx.state === 'suspended') ctx.resume();
}

// ---------------------------------------------------------------- rain
let rain = null;

// One raindrop tick: a very short band-passed noise burst at a random pitch and position.
function drop(dest, level) {
  const t = ctx.currentTime + Math.random() * 0.04;
  const src = ctx.createBufferSource();
  src.buffer = noise('white');
  const bp = filter('bandpass', 1400 + Math.random() * 4800, 2 + Math.random() * 6);
  const g = ctx.createGain();
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.random() * 2 - 1;
  const peak = (0.04 + Math.random() * 0.1) * level;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02 + Math.random() * 0.05);
  src.connect(bp).connect(g).connect(pan).connect(dest);
  src.start(t, Math.random() * 3, 0.1);
}

// A nearby drip into a puddle: a tiny sine "plink" that falls in pitch.
function plink(dest) {
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.random() * 1.6 - 0.8;
  const f = 1700 + Math.random() * 1600;
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.62, t + 0.06);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.035, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(g).connect(pan).connect(dest);
  o.start(t);
  o.stop(t + 0.12);
}

export function startRain(level = 0.8) {
  audio();
  if (rain) { setRainLevel(level); return; }
  const out = gain(0);
  out.connect(master);
  // steady body of the rain
  const body = loopSource('pink');
  const bodyGain = gain(0.55);
  body.connect(filter('highpass', 420)).connect(filter('lowpass', 7200)).connect(bodyGain).connect(out);
  // high sizzle
  const hiss = loopSource('white');
  const hissGain = gain(0.05);
  hiss.connect(filter('bandpass', 3600, 0.6)).connect(hissGain).connect(out);
  // low rumble of rain on roofs and streets
  const rumble = loopSource('brown');
  const rumbleGain = gain(0.45);
  rumble.connect(filter('lowpass', 240)).connect(rumbleGain).connect(out);
  // slow swells, so the rain "breathes"
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.09;
  const lfoDepth = gain(0.12);
  lfo.connect(lfoDepth).connect(bodyGain.gain);
  [body, hiss, rumble, lfo].forEach((n) => n.start());

  rain = { out, nodes: [body, hiss, rumble, lfo], bodyGain, hissGain, rumbleGain, level };
  rain.timer = setInterval(() => {
    if (!rain || ctx.state !== 'running') return;
    const n = Math.random() < rain.level ? 1 + (Math.random() * 3 * rain.level | 0) : 0;
    for (let i = 0; i < n; i++) drop(out, rain.level);
    if (Math.random() < 0.02 * rain.level) plink(out);
  }, 45);
  setRainLevel(level);
  out.gain.setTargetAtTime(1, ctx.currentTime, 1.2); // fade in
}

export function setRainLevel(level) {
  if (!rain) return;
  rain.level = Math.max(0.1, Math.min(1, level));
  const t = ctx.currentTime;
  rain.bodyGain.gain.setTargetAtTime(0.35 + 0.35 * rain.level, t, 1.5);
  rain.hissGain.gain.setTargetAtTime(0.02 + 0.06 * rain.level, t, 1.5);
  rain.rumbleGain.gain.setTargetAtTime(0.25 + 0.3 * rain.level, t, 1.5);
}

export function stopRain() {
  if (!rain) return;
  const r = rain;
  rain = null;
  clearInterval(r.timer);
  r.out.gain.setTargetAtTime(0, ctx.currentTime, 0.8); // fade out
  setTimeout(() => { r.nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }); r.out.disconnect(); }, 4000);
}

// ---------------------------------------------------------------- thunder
// distance: 0 = overhead (sharp crack + heavy rumble), 1 = far away (soft low roll).
export function thunder(distance = 0.6) {
  audio();
  const t = ctx.currentTime + 0.05;
  const dur = 4 + Math.random() * 3 + distance * 2;
  const src = ctx.createBufferSource();
  src.buffer = noise('brown', 8);
  src.playbackRate.value = 0.7;
  const lp = filter('lowpass', 900 - distance * 600);
  lp.frequency.setValueAtTime(900 - distance * 600, t);
  lp.frequency.exponentialRampToValueAtTime(90, t + dur);
  // rolling envelope with a few random swells
  const steps = 120;
  const curve = new Float32Array(steps);
  let swell = 0;
  for (let i = 0; i < steps; i++) {
    const x = i / (steps - 1);
    if (Math.random() < 0.06) swell = 0.3 + Math.random() * 0.5;
    swell *= 0.93;
    const attack = Math.min(1, x / (0.04 + distance * 0.08));
    curve[i] = Math.max(0, attack * Math.pow(1 - x, 1.6) * (0.75 + swell)) * (1 - distance * 0.55);
  }
  curve[steps - 1] = 0;
  const g = gain(0);
  g.gain.setValueCurveAtTime(curve, t, dur);
  src.connect(lp).connect(g).connect(master);
  src.start(t, Math.random() * 2, dur + 0.5);
  if (distance < 0.45) {
    const crack = ctx.createBufferSource();
    crack.buffer = noise('white');
    const cg = gain(0);
    cg.gain.setValueAtTime(0, t);
    cg.gain.linearRampToValueAtTime(0.5 * (1 - distance), t + 0.01);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    crack.connect(filter('highpass', 700)).connect(filter('lowpass', 5000)).connect(cg).connect(master);
    crack.start(t, Math.random(), 0.5);
  }
}

// ================================================================ voices, layers and samples
// Used by the v3 village skin; any skin can call them. Each one-shot voice takes
// { vol, pan } and goes through a shared reverb so everything sits in one space.
let wetBus = null;
function reverb() {
  if (wetBus) return wetBus;
  const c = audio();
  const len = Math.floor(c.sampleRate * 2.6);
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
  }
  const conv = c.createConvolver();
  conv.buffer = ir;
  wetBus = gain(0.5);
  wetBus.connect(conv);
  conv.connect(master);
  return wetBus;
}

const clampPan = (p) => Math.max(-1, Math.min(1, p || 0));
const rnd = (a, b) => a + Math.random() * (b - a);

// A per-voice output: volume, stereo position and a send to the reverb.
function voiceBus(pan = 0, vol = 1, wet = 0.3) {
  const c = audio();
  const g = gain(vol);
  const p = c.createStereoPanner();
  p.pan.value = clampPan(pan);
  g.connect(p);
  p.connect(master);
  if (wet > 0) { const s = gain(wet); p.connect(s); s.connect(reverb()); }
  return g;
}

// Oscillator with a pitch contour [[t, hz], …], an attack/hold/release envelope and optional vibrato.
function tone(dest, t, dur, pts, peak, attack = 0.01, type = 'sine', vib = null) {
  const os = ctx.createOscillator();
  os.type = type;
  os.frequency.setValueAtTime(pts[0][1], t);
  for (const [dt, f] of pts.slice(1)) os.frequency.linearRampToValueAtTime(f, t + dt);
  if (vib) {
    const l = ctx.createOscillator(), d = gain(vib[1]);
    l.frequency.value = vib[0];
    l.connect(d); d.connect(os.frequency);
    l.start(t); l.stop(t + dur + 0.05);
  }
  const g = ctx.createGain();
  const a = Math.max(0.004, attack), hold = Math.max(a + 0.001, dur * 0.65);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  os.connect(g); g.connect(dest);
  os.start(t); os.stop(t + dur + 0.05);
}

// Band-passed noise burst (knocks, splashes, crackles, breaths).
function nburst(dest, t, dur, f, q, peak, kind = 'white') {
  const n = ctx.createBufferSource();
  n.buffer = noise(kind);
  const b = filter('bandpass', f, q), g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(b); b.connect(g); g.connect(dest);
  n.start(t, Math.random() * 3, dur + 0.05);
}

// Amplitude-modulated tone (insects, frogs): carrier glide + square-wave gating.
function trill(dest, t, dur, f0, f1, rate0, rate1, peak) {
  const os = ctx.createOscillator();
  os.frequency.setValueAtTime(f0, t);
  os.frequency.linearRampToValueAtTime(f1, t + dur);
  const am = gain(0.5), lfo = ctx.createOscillator(), depth = gain(0.5);
  lfo.type = 'square';
  lfo.frequency.setValueAtTime(rate0, t);
  lfo.frequency.linearRampToValueAtTime(rate1, t + dur);
  lfo.connect(depth); depth.connect(am.gain);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.3, dur * 0.2));
  env.gain.setValueAtTime(peak, t + dur * 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  os.connect(am); am.connect(env); env.connect(dest);
  os.start(t); lfo.start(t); os.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}

const VOICES = {
  // bamboo pump: hollow knock + smaller bounce
  shishi({ vol = 1, pan = -0.2 } = {}) {
    const t = audio().currentTime + 0.01, o = voiceBus(pan, vol, 0.6);
    for (const [dt, k] of [[0, 1], [0.22, 0.35]]) {
      nburst(o, t + dt, 0.16, 640, 14, 3 * k); nburst(o, t + dt, 0.12, 1320, 10, 2 * k);
      tone(o, t + dt, 0.13, [[0, 520], [0.12, 470]], 0.32 * k, 0.003); nburst(o, t + dt, 0.012, 3200, 0.8, 0.3 * k);
    }
  },
  // temple bell (bonshō): inharmonic partials in beating pairs, long decay, wooden striker thump
  bell({ vol = 1, pan = 0.15 } = {}) {
    const c = audio(), t = c.currentTime + 0.02, o = voiceBus(pan, vol, 0.55), f0 = 72;
    for (const [ratio, amp, dec] of [[0.5, 0.55, 38], [1, 1, 30], [2, 0.42, 20], [2.74, 0.4, 13], [3.3, 0.26, 10], [4.2, 0.22, 7], [5.4, 0.14, 5], [6.9, 0.1, 3.5]]) {
      for (const det of [0, rnd(0.6, 1.6)]) {
        const os = c.createOscillator(), g = c.createGain();
        os.frequency.value = f0 * ratio + det;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(amp * 0.085, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
        os.connect(g); g.connect(o); os.start(t); os.stop(t + dec + 0.1);
      }
    }
    nburst(o, t, 0.25, 180, 0.7, 0.8, 'brown');
  },
  uguisu({ vol = 1, pan = rnd(-0.8, 0.8) } = {}) {
    const t = audio().currentTime + 0.02, o = voiceBus(pan, vol * 0.6, 0.45);
    tone(o, t, 1.05, [[0, 1180], [0.8, 1290], [1.05, 1260]], 0.16, 0.25);
    tone(o, t + 1.25, 0.1, [[0, 1900], [0.1, 2050]], 0.14);
    tone(o, t + 1.39, 0.1, [[0, 2700], [0.1, 2600]], 0.14);
    tone(o, t + 1.53, 0.34, [[0, 2450], [0.34, 1650]], 0.15, 0.02);
  },
  sparrows({ vol = 1, pan = rnd(-0.9, 0.9) } = {}) {
    const t = audio().currentTime + 0.02, o = voiceBus(pan, vol * 0.5, 0.25), n = 3 + (Math.random() * 4 | 0);
    for (let i = 0; i < n; i++) {
      const up = Math.random() < 0.4;
      tone(o, t + i * rnd(0.1, 0.16), 0.06, up ? [[0, 3900], [0.06, 5100]] : [[0, 5300], [0.06, 4100]], 0.07, 0.004);
    }
  },
  tonbi({ vol = 1, pan = rnd(-0.6, 0.6) } = {}) {
    const t = audio().currentTime + 0.02, o = voiceBus(pan, vol * 0.55, 0.6);
    tone(o, t, 0.55, [[0, 2600], [0.4, 2950], [0.55, 2900]], 0.1, 0.05);
    tone(o, t + 0.65, 1.2, [[0, 2800], [1.2, 2050]], 0.08, 0.03, 'sine', [9, 120]);
  },
  crows({ vol = 1, pan = rnd(-0.9, 0.9) } = {}) {
    const t = audio().currentTime + 0.02, o = voiceBus(pan, vol * 0.5, 0.4), n = 2 + (Math.random() * 2 | 0);
    for (let i = 0; i < n; i++) {
      const st = t + i * rnd(0.45, 0.6), bp = filter('bandpass', 1150, 1.6);
      bp.connect(o);
      tone(bp, st, 0.36, [[0, 400], [0.36, 330]], 0.5, 0.02, 'sawtooth');
      nburst(o, st, 0.3, 1400, 1.2, 0.08);
    }
  },
  higurashi({ vol = 1, pan = rnd(-0.9, 0.9) } = {}) {
    const t = audio().currentTime + 0.02;
    trill(voiceBus(pan, vol * 0.35, 0.5), t, 3.6, 4900, 4300, 12.5, 9, 0.12);
  },
  cricket({ vol = 1, pan = rnd(-1, 1) } = {}) {
    const t = audio().currentTime + 0.02, f = rnd(4100, 4400);
    trill(voiceBus(pan, vol * 0.22, 0.2), t, rnd(0.4, 0.7), f, f, 42, 42, 0.1);
  },
  kajika({ vol = 1, pan = rnd(-0.7, 0.7) } = {}) {
    const t = audio().currentTime + 0.02, o = voiceBus(pan, vol * 0.45, 0.5);
    for (let i = 0; i < 4; i++) tone(o, t + i * 0.2, 0.12, [[0, 2100 + i * 90], [0.12, 2300 + i * 90]], 0.09, 0.01);
    trill(o, t + 0.85, 0.75, 2550, 1950, 26, 26, 0.09);
  },
  toad({ vol = 1, pan = rnd(-0.6, 0.6) } = {}) {
    const t = audio().currentTime + 0.02, o = voiceBus(pan, vol * 0.7, 0.3), lp = filter('lowpass', 1500), n = 3 + (Math.random() * 3 | 0);
    lp.connect(o);
    for (let i = 0; i < n; i++) {
      tone(lp, t + i * 0.17, 0.07, [[0, 600], [0.07, 540]], 0.16, 0.006);
      tone(lp, t + i * 0.17, 0.06, [[0, 1200], [0.06, 1080]], 0.05, 0.006);
    }
  },
  owl({ vol = 1, pan = rnd(0.2, 0.8) } = {}) {
    const t = audio().currentTime + 0.02, o = voiceBus(pan, vol * 0.7, 0.7);
    tone(o, t, 0.5, [[0, 410], [0.5, 390]], 0.13, 0.08);
    tone(o, t + 0.9, 0.22, [[0, 400], [0.22, 395]], 0.1, 0.05);
    tone(o, t + 1.2, 0.5, [[0, 405], [0.5, 380]], 0.12, 0.08);
  },
  furin({ vol = 1, pan = rnd(-0.5, 0.5) } = {}) {
    const t = audio().currentTime + 0.02, o = voiceBus(pan, vol * 0.6, 0.5), n = 1 + (Math.random() * 3 | 0);
    for (let i = 0; i < n; i++) {
      const st = t + i * rnd(0.1, 0.18);
      for (const [f, a, d] of [[2650, 0.06, 1.8], [5310, 0.03, 1], [7930, 0.02, 0.6]]) tone(o, st, d, [[0, f * rnd(0.995, 1.005)], [d, f]], a * (1 - i * 0.25), 0.003);
    }
  },
  taiko({ vol = 1, pan = 0.1, accent = 1 } = {}) {
    const t = audio().currentTime + 0.01, o = voiceBus(pan, vol * 0.8, 0.35);
    tone(o, t, 0.4, [[0, 88], [0.35, 52]], 0.55 * accent, 0.004);
    nburst(o, t, 0.04, 900, 0.8, 0.35 * accent, 'pink');
  },
  // bamboo flute: a short phrase in the yo scale with vibrato and breath
  fue({ vol = 1, pan = -0.2 } = {}) {
    const t0 = audio().currentTime + 0.02, o = voiceBus(pan, vol * 0.5, 0.6);
    const scale = [293.66, 329.63, 392, 440, 493.88, 587.33, 659.25];
    let idx = 3 + (Math.random() * 3 | 0), t = t0;
    const n = 6 + (Math.random() * 4 | 0);
    for (let i = 0; i < n; i++) {
      const d = rnd(0.3, 0.8), next = Math.max(0, Math.min(6, idx + (Math.random() < 0.5 ? -1 : 1) * (1 + (Math.random() * 2 | 0))));
      tone(o, t, d + 0.05, [[0, scale[idx] * 2], [d * 0.85, scale[idx] * 2], [d, scale[next] * 2]], 0.07, 0.04, 'sine', [5.6, 7]);
      nburst(o, t, d, 2600, 1, 0.012, 'pink');
      idx = next; t += d;
    }
  },
  // touch the creek: a soft plop and a few droplets
  splash({ vol = 1, pan = 0 } = {}) {
    const t = audio().currentTime + 0.01, o = voiceBus(pan, vol * 0.6, 0.35), f = rnd(500, 900);
    tone(o, t, 0.09, [[0, f], [0.08, f * 2.2]], 0.12, 0.004);
    nburst(o, t, 0.18, 1800, 0.9, 0.12);
    for (let i = 0; i < 3; i++) tone(o, t + rnd(0.08, 0.3), 0.05, [[0, rnd(1400, 2600)], [0.04, rnd(2200, 3400)]], 0.04, 0.003);
  },
  // birds taking off: a burst of wing flutter
  flutter({ vol = 1, pan = 0 } = {}) {
    const t = audio().currentTime + 0.01, o = voiceBus(pan, vol * 0.5, 0.25);
    for (let i = 0; i < 14; i++) nburst(o, t + i * rnd(0.025, 0.05), 0.035, rnd(700, 1500), 1.4, 0.18 * (1 - i / 16), 'pink');
  },
  // rice rustle under the cursor
  rustle({ vol = 1, pan = 0 } = {}) {
    const t = audio().currentTime + 0.01, o = voiceBus(pan, vol * 0.4, 0.15);
    for (let i = 0; i < 6; i++) nburst(o, t + i * rnd(0.03, 0.07), rnd(0.05, 0.12), rnd(2500, 6000), 0.8, 0.05);
  },
  // a falling star / sparkle: soft rising chime
  twinkle({ vol = 1, pan = 0 } = {}) {
    const t = audio().currentTime + 0.01, o = voiceBus(pan, vol * 0.5, 0.7);
    [1318.5, 1760, 2349.3].forEach((f, i) => tone(o, t + i * 0.09, 1.1, [[0, f], [1.1, f]], 0.035, 0.004));
  },
  // cat purr: low, rough, amplitude-modulated noise
  purr({ vol = 1, pan = 0, dur = 1.6 } = {}) {
    const t = audio().currentTime + 0.01, o = voiceBus(pan, vol * 0.9, 0.1);
    const n = ctx.createBufferSource(); n.buffer = noise('brown');
    const lp = filter('lowpass', 380), am = gain(0.5), lfo = ctx.createOscillator(), d = gain(0.5), env = ctx.createGain();
    lfo.frequency.value = 24; lfo.connect(d); d.connect(am.gain);
    env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(0.5, t + 0.2); env.gain.setValueAtTime(0.5, t + dur - 0.3); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(lp); lp.connect(am); am.connect(env); env.connect(o);
    n.start(t, Math.random(), dur + 0.1); lfo.start(t); lfo.stop(t + dur + 0.1);
  },
  // happy dog: a few soft pants and, sometimes, one small "wuf"
  dog({ vol = 1, pan = 0, bark = false } = {}) {
    const t = audio().currentTime + 0.01, o = voiceBus(pan, vol * 0.7, 0.2);
    for (let i = 0; i < 4; i++) nburst(o, t + i * 0.16, 0.09, 1400, 0.7, 0.08, 'pink');
    if (bark) { const bp = filter('bandpass', 700, 1.4); bp.connect(o); tone(bp, t + 0.7, 0.14, [[0, 330], [0.05, 420], [0.14, 260]], 0.6, 0.005, 'sawtooth'); }
  },
  // crackle burst from the bonfire (someone adds wood)
  crackle({ vol = 1, pan = 0 } = {}) {
    const t = audio().currentTime + 0.01, o = voiceBus(pan, vol, 0.2);
    for (let i = 0; i < 10; i++) nburst(o, t + rnd(0, 0.8), rnd(0.008, 0.025), rnd(1800, 5000), 2, rnd(0.08, 0.25));
  },
};

export function play(name, opts) {
  if (!VOICES[name] || volume <= 0) return;
  try { VOICES[name](opts); } catch (e) { console.warn('[ambience]', name, e); }
}
export const voiceNames = Object.keys(VOICES);

// ---- continuous layers, faded in and out by level (0 = off)
const layers = {};
function buildLayer(name) {
  const c = audio(), out = voiceBus(0, 0, name === 'creek' ? 0.15 : 0.1), nodes = [];
  const src = (kind) => { const s = c.createBufferSource(); s.buffer = noise(kind); s.loop = true; s.start(0, Math.random() * 3); nodes.push(s); return s; };
  const lfo = (hz, depth, param) => { const l = c.createOscillator(), d = gain(depth); l.frequency.value = hz; l.connect(d); d.connect(param); l.start(); nodes.push(l); };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); };
  let timer = null;
  if (name === 'creek') {
    const s = src('white'), f1 = filter('bandpass', 1700, 1.1), f2 = filter('bandpass', 780, 1.4);
    chain(s, f1, gain(0.22), out); chain(s, f2, gain(0.16), out);
    lfo(0.9, 380, f1.frequency); lfo(2.3, 220, f1.frequency); lfo(1.4, 160, f2.frequency); lfo(3.1, 90, f2.frequency);
    timer = setInterval(() => { // little bubbles
      if (ctx.state !== 'running' || Math.random() > 0.55) return;
      const t = ctx.currentTime + Math.random() * 0.1, f = rnd(420, 1300);
      tone(out, t, 0.05, [[0, f], [0.04, f * 1.8]], 0.05, 0.005);
    }, 180);
  } else if (name === 'wind') {
    const s = src('pink'), f = filter('bandpass', 520, 0.7), g = gain(0.16);
    chain(s, f, g, out); lfo(0.06, 260, f.frequency); lfo(0.045, 0.1, g.gain);
  } else if (name === 'fire') {
    chain(src('brown'), filter('lowpass', 420), gain(0.3), out);
    timer = setInterval(() => { if (ctx.state === 'running' && Math.random() < 0.7) nburst(out, ctx.currentTime + Math.random() * 0.2, rnd(0.008, 0.025), rnd(1800, 5000), 2, rnd(0.05, 0.2)); }, 120);
  } else if (name === 'crowd') {
    const s = src('pink'), g = gain(0.16);
    chain(s, filter('bandpass', 650, 0.9), g, out); lfo(0.3, 0.05, g.gain);
    chain(s, filter('bandpass', 1500, 1.2), gain(0.05), out);
  } else if (name === 'thatchRain') {
    chain(src('pink'), filter('highpass', 300), filter('lowpass', 4200), gain(0.5), out);
    chain(src('brown'), filter('lowpass', 220), gain(0.35), out);
    timer = setInterval(() => { if (ctx.state === 'running') for (let i = 0; i < 3; i++) if (Math.random() < 0.8) nburst(out, ctx.currentTime + Math.random() * 0.06, 0.03, rnd(900, 3500), 4, rnd(0.04, 0.14)); }, 60);
  }
  return { out, stop() { clearInterval(timer); nodes.forEach((n) => { try { n.stop(); } catch { /* stopped */ } }); out.disconnect(); } };
}
export function layer(name, level) {
  audio();
  let L = layers[name];
  if (!L && level > 0.01) L = layers[name] = buildLayer(name);
  if (!L) return;
  L.out.gain.setTargetAtTime(Math.max(0, level), ctx.currentTime, 1.2);
}

// ---- recorded samples (CC0 files shipped with a skin), decoded once, looped or played
const samples = {};
const sampleLoops = {};
export async function loadSample(name, arrayBuffer) {
  const c = audio();
  samples[name] = await c.decodeAudioData(arrayBuffer);
  return samples[name];
}
export function hasSample(name) { return Boolean(samples[name]); }
export function sampleLoop(name, level) {
  if (!samples[name]) return;
  let L = sampleLoops[name];
  if (!L && level > 0.005) {
    const s = ctx.createBufferSource();
    s.buffer = samples[name]; s.loop = true;
    const out = voiceBus(0, 0, 0.2);
    s.connect(out); s.start(0, Math.random() * samples[name].duration);
    L = sampleLoops[name] = { s, out };
  }
  if (L) L.out.gain.setTargetAtTime(Math.max(0, level), ctx.currentTime, 1.5);
}
export function playSample(name, { vol = 1, pan = 0 } = {}) {
  if (!samples[name] || volume <= 0) return false;
  const s = ctx.createBufferSource();
  s.buffer = samples[name];
  s.connect(voiceBus(pan, vol, 0.4));
  s.start();
  return true;
}
