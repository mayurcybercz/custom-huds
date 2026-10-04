// Procedural ambient audio: no sound files, everything is synthesised with WebAudio so any
// skin can use it and the repo stays asset-free. Currently: rain (with droplets and drips)
// and thunder. New voices (wind, water, bells, birds…) follow the same pattern.
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
  if (ctx.state === 'suspended') ctx.resume();
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
  if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.3);
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
