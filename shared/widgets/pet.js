import { h, load, save, listen, cssVar } from '../core/util.js';
import { askText } from '../core/modal.js';

// A tamagotchi-style companion. Stats decay in real time (including while the app is closed),
// finishing tasks and projects makes it happy and earns XP, and it grows as it levels up.
const S = 32; // sprite canvas size in pixels
const DECAY_PER_HOUR = { hunger: 8, happy: 6, clean: 5, energy: 5 };
const SLEEP_REGEN_PER_HOUR = 40;
const HATCH_MS = 60 * 1000;

const LINES = {
  happy: ['all systems nominal :)', 'you are doing great, operator', 'compiling good vibes…', 'ping? pong!', 'i love this desktop', '01101000 01101001'],
  ok: ['idle loop engaged', 'what are we building today?', 'scanning for snacks…', 'beep.'],
  hungry: ['sudo feed me', 'low on bytes… need food', 'stomach.exe has stopped responding'],
  bored: ['play with me?', 'so… bored… run me a game', 'entertainment buffer empty'],
  dirty: ['my cache needs clearing', 'there are bits everywhere', 'garbage collection please'],
  tired: ['battery low… zzz?', 'need to defrag (sleep)', 'eyes.render() failing'],
  sleep: ['zzz…', 'dreaming of electric sheep', 'zZz'],
};

// Sprite colours come from the skin's CSS variables (--pet-*), with the v1 green as fallback.
function palette() {
  const v = (name, fb) => cssVar(name, fb);
  return {
    body: v('--pet-body', '#39ff88'), edge: v('--pet-edge', '#1fd873'), shade: v('--pet-shade', '#a8ffd0'),
    dirty: v('--pet-dirty', '#2f8f62'), dark: v('--pet-dark', '#0b3d2a'), eye: v('--pet-eye', '#ffffff'),
    cheek: v('--pet-cheek', '#ff7be8'), heart: v('--pet-heart', '#ff2bd6'), spark: v('--pet-spark', '#00e5ff'),
    antenna: [v('--pet-antenna-a', '#ff2bd6'), v('--pet-antenna-b', '#00e5ff')],
    eggShell: v('--pet-egg', '#0a2e22'), eggDot: v('--pet-egg-dot', '#0f5a3a'), crack: v('--pet-crack', '#c6f6ff'),
    food: [v('--pet-food', '#ffb000'), v('--pet-food-2', '#ff8a00')], mouth: v('--pet-mouth', '#ff3860'),
    dirt: [v('--pet-dirt', '#ff3860'), v('--pet-dirt-2', '#ffb000')],
  };
}

function defaults() {
  const now = Date.now();
  return { name: 'BYTE', born: now, hunger: 80, happy: 80, energy: 90, clean: 100, xp: 0, sleeping: false, last: now };
}

const clamp = (v) => Math.max(0, Math.min(100, v));
const level = (xp) => Math.floor(Math.sqrt(xp / 20)) + 1;

function stage(p) {
  if (Date.now() - p.born < HATCH_MS) return 'egg';
  const lv = level(p.xp);
  return lv < 3 ? 'baby' : lv < 6 ? 'teen' : 'adult';
}

// Apply decay for the time since p.last (works for offline gaps too).
function simulate(p, now = Date.now()) {
  const hrs = Math.max(0, (now - p.last) / 3600e3);
  p.hunger = clamp(p.hunger - DECAY_PER_HOUR.hunger * hrs * (p.sleeping ? 0.5 : 1));
  p.happy = clamp(p.happy - DECAY_PER_HOUR.happy * hrs * (p.sleeping ? 0.3 : 1));
  p.clean = clamp(p.clean - DECAY_PER_HOUR.clean * hrs);
  if (p.sleeping) {
    p.energy = clamp(p.energy + SLEEP_REGEN_PER_HOUR * hrs);
    if (p.energy >= 100) p.sleeping = false;
  } else {
    p.energy = clamp(p.energy - DECAY_PER_HOUR.energy * hrs);
  }
  // Well cared-for pets slowly earn XP on their own.
  const avg = (p.hunger + p.happy + p.energy + p.clean) / 4;
  if (avg > 60) p.xp += hrs * 6;
  p.last = now;
}

function mood(p) {
  if (p.sleeping) return 'sleep';
  if (p.hunger < 30) return 'hungry';
  if (p.energy < 20) return 'tired';
  if (p.clean < 35) return 'dirty';
  if (p.happy < 35) return 'bored';
  return (p.hunger + p.happy + p.energy + p.clean) / 4 > 70 ? 'happy' : 'ok';
}

export async function mount({ body: root, meta }) {
  const pal = palette();
  const p = Object.assign(defaults(), await load('pet', {}));
  simulate(p);

  const canvas = h('canvas', { width: S, height: S, title: 'Pet me' });
  const bubble = h('div', { class: 'pet-bubble' });
  const name = h('div', { class: 'pet-name', title: 'Double-click to rename' }, p.name);
  const moodEl = h('div', { class: 'pet-mood' });
  const statDefs = [['hunger', 'FOOD', 'var(--ok)'], ['happy', 'JOY', 'var(--accent2)'], ['energy', 'ENERGY', 'var(--accent)'], ['clean', 'CLEAN', 'var(--warn)']];
  const bars = {};
  const stats = h('div', { class: 'pet-stats' }, ...statDefs.flatMap(([k, label, c]) => {
    bars[k] = { fill: h('i'), val: h('span') };
    return [h('span', { class: 'label' }, label), h('div', { class: 'bar seg', style: { '--c': c } }, bars[k].fill), bars[k].val];
  }));
  const xpFill = h('i');
  const xpTxt = h('span');
  const sleepBtn = h('button', { class: 'btn', onclick: () => act('sleep') }, 'SLEEP');
  root.append(
    h('div', { class: 'pet-stage' }, bubble, canvas),
    name, moodEl, stats,
    h('div', { class: 'pet-xp' }, h('div', { class: 'row', style: { display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--dim)', marginBottom: '3px' } }, h('span', {}, 'XP'), xpTxt),
      h('div', { class: 'bar' }, xpFill)),
    h('div', { class: 'pet-actions' },
      h('button', { class: 'btn', onclick: () => act('feed') }, 'FEED'),
      h('button', { class: 'btn', onclick: () => act('play') }, 'PLAY'),
      sleepBtn,
      h('button', { class: 'btn', onclick: () => act('clean') }, 'CLEAN')));

  // ---- speech ----
  let bubbleTimer = 0;
  function say(text, ms = 3500) {
    bubble.textContent = text;
    bubble.classList.add('on');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('on'), ms);
  }
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  // ---- actions ----
  let anim = { type: null, until: 0 };
  let particles = [];
  const persist = () => save('pet', p);

  function act(kind) {
    simulate(p);
    const st = stage(p);
    if (st === 'egg') { say('…the egg wobbles'); wobble = 1; return; }
    if (p.sleeping && kind !== 'sleep') { say('zzz… (it is sleeping)'); return; }
    switch (kind) {
      case 'feed':
        if (p.hunger > 95) { say('too full… no more bytes'); return; }
        p.hunger = clamp(p.hunger + 30); p.clean = clamp(p.clean - 5); p.xp += 2;
        anim = { type: 'eat', until: performance.now() + 1600 };
        say(pick(['nom nom nom', 'delicious packets', 'crunchy!']));
        break;
      case 'play':
        if (p.energy < 10) { say('too tired to play…'); return; }
        p.happy = clamp(p.happy + 25); p.energy = clamp(p.energy - 10); p.hunger = clamp(p.hunger - 5); p.xp += 4;
        anim = { type: 'play', until: performance.now() + 2000 };
        burst('heart', 6);
        say(pick(['wheee!', 'again! again!', 'best. operator. ever.']));
        break;
      case 'sleep':
        p.sleeping = !p.sleeping;
        say(p.sleeping ? 'goodnight…' : 'rebooting… good morning!');
        break;
      case 'clean':
        p.clean = 100; p.xp += 1;
        burst('spark', 10);
        say('cache cleared ✨');
        break;
    }
    persist(); renderStats();
  }

  name.addEventListener('dblclick', async () => {
    const n = await askText('NAME YOUR COMPANION', p.name);
    if (n && n.trim()) { p.name = n.trim().slice(0, 14).toUpperCase(); name.textContent = p.name; persist(); }
  });
  canvas.addEventListener('click', () => {
    if (stage(p) === 'egg') { wobble = 1; say('*tap tap*'); return; }
    if (p.sleeping) { say('zzz…'); return; }
    p.happy = clamp(p.happy + 2);
    burst('heart', 2);
    say(pick(['hehe', '<3', 'purr.exe', 'that tickles']));
    persist(); renderStats();
  });

  listen('todo:done', (t) => {
    simulate(p);
    p.happy = clamp(p.happy + 8); p.xp += 10;
    if (stage(p) !== 'egg' && !p.sleeping) {
      burst('spark', 5);
      say(pick([`task terminated: "${t.text.slice(0, 18)}"`, 'one less bug in the world', '+10 XP. nice work!']));
    }
    persist(); renderStats();
  });
  // Healthy-habit gadgets also feed the companion.
  const reward = (happy, xp, line) => {
    simulate(p);
    p.happy = clamp(p.happy + happy); p.xp += xp;
    if (stage(p) !== 'egg' && !p.sleeping) { burst('heart', 4); say(line); }
    persist(); renderStats();
  };
  listen('pomo:done', ({ minutes }) => reward(10, 15, `${minutes} focused minutes. so proud of you!`));
  listen('water:add', () => { simulate(p); p.clean = clamp(p.clean + 2); persist(); renderStats(); });
  listen('water:goal', () => reward(15, 20, 'hydration goal reached 💧'));
  listen('schedule:done', (b) => reward(5, 8, `"${b.title.slice(0, 18)}" done ✓`));
  listen('meal:add', () => { simulate(p); p.hunger = clamp(p.hunger + 10); persist(); renderStats(); say(pick(['yum, share?', 'smells good…', 'eating together :)'])); });

  listen('project:done', (proj) => {
    simulate(p);
    p.happy = clamp(p.happy + 30); p.xp += 60;
    burst('heart', 12);
    say(`SHIPPED ${proj.name.toUpperCase()}!! 🎉`, 6000);
    persist(); renderStats();
  });

  function renderStats() {
    for (const [k] of statDefs) {
      bars[k].fill.style.width = `${p[k]}%`;
      bars[k].val.textContent = Math.round(p[k]);
    }
    const lv = level(p.xp);
    const base = 20 * (lv - 1) ** 2, next = 20 * lv ** 2;
    xpFill.style.width = `${((p.xp - base) / (next - base)) * 100}%`;
    xpTxt.textContent = `LV ${lv} · ${Math.floor(p.xp)} / ${next}`;
    const m = mood(p);
    const st = stage(p);
    moodEl.textContent = st === 'egg' ? 'status: incubating…' : `status: ${m} · ${st}`;
    sleepBtn.textContent = p.sleeping ? 'WAKE' : 'SLEEP';
    const ageH = (Date.now() - p.born) / 3600e3;
    if (meta) meta.textContent = ageH < 24 ? `age ${Math.floor(ageH)}h` : `age ${Math.floor(ageH / 24)}d`;
  }

  // ---- particles ----
  function burst(kind, n) {
    for (let i = 0; i < n; i++) {
      particles.push({ kind, x: 16 + (Math.random() - 0.5) * 16, y: 14 + Math.random() * 6, vx: (Math.random() - 0.5) * 0.3, vy: -0.15 - Math.random() * 0.2, life: 1 });
    }
  }

  // ---- drawing ----
  const ctx = canvas.getContext('2d');
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const HEART = ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'];
  const sprite = (rows, ox, oy, c) => rows.forEach((r, y) => [...r].forEach((ch, x) => ch === 'x' && px(ox + x, oy + y, c)));

  let x = 16, dir = 1, wobble = 0, blink = 0;

  function drawEgg(t) {
    const wob = Math.sin(t / 120) * wobble * 2;
    wobble *= 0.97;
    for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
      const dx = (xx - 16 - wob * (y - 28) / 14) / 8, dy = (y - 21) / (y < 21 ? 11 : 8);
      const d = dx * dx + dy * dy;
      if (d <= 1) px(xx, y, d > 0.8 ? pal.body : (xx + y) % 5 === 0 ? pal.eggDot : pal.eggShell);
    }
    // cracks appear as it gets closer to hatching
    const prog = (Date.now() - p.born) / HATCH_MS;
    if (prog > 0.5) [[14, 14], [15, 15], [16, 14], [17, 15], [18, 14]].forEach(([a, b]) => px(a + wob, b, pal.crack));
  }

  function drawPet(t) {
    const st = stage(p);
    const m = mood(p);
    const size = { baby: [7, 6], teen: [9, 8], adult: [11, 9] }[st];
    const now = performance.now();
    const playing = anim.type === 'play' && now < anim.until;
    const eating = anim.type === 'eat' && now < anim.until;

    // wander
    if (!p.sleeping && !eating) {
      x += dir * (playing ? 0.25 : 0.04);
      if (x > 22 || x < 10) dir *= -1;
      if (Math.random() < 0.003) dir *= -1;
    }
    const bounce = p.sleeping ? Math.sin(t / 900) * 0.5 : playing ? -Math.abs(Math.sin(t / 110)) * 5 : Math.sin(t / 300) * 0.8;
    const cx = x, cy = 31 - size[1] + bounce;
    const sad = m === 'hungry' || m === 'bored' || m === 'tired';
    const body = m === 'dirty' ? pal.dirty : pal.body;
    const dark = pal.dark;

    // shadow
    ctx.globalAlpha = 0.2;
    for (let i = -size[0] + 2; i <= size[0] - 2; i++) px(x + i, 31, pal.body);
    ctx.globalAlpha = 1;

    // body (squash while bouncing)
    const squash = playing ? 1 + Math.sin(t / 110) * 0.08 : 1;
    const rx = size[0] * squash, ry = size[1] / squash;
    for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) {
      const d = (xx * xx) / (rx * rx) + (yy * yy) / (ry * ry);
      if (d > 1) continue;
      const edge = d > 0.72;
      const shade = yy < -ry * 0.4 && xx < 0 && !edge ? pal.shade : body;
      px(cx + xx, cy + yy, edge ? pal.edge : shade);
    }
    // antenna for teen+
    if (st !== 'baby') {
      const ax = cx + 2, ay = cy - ry;
      px(ax, ay - 1, pal.edge); px(ax + 1, ay - 2, pal.edge); px(ax + 1, ay - 3, pal.edge);
      px(ax + 1, ay - 4, Math.sin(t / 200) > 0 ? pal.antenna[0] : pal.antenna[1]);
    }
    // visor stripe for adults
    if (st === 'adult') { ctx.globalAlpha = 0.55; for (let i = -rx + 2; i <= rx - 2; i++) px(cx + i, cy - 2, pal.spark); ctx.globalAlpha = 1; }

    // eyes
    blink = blink > 0 ? blink - 1 : Math.random() < 0.006 ? 8 : 0;
    const ex = Math.round(size[0] * 0.4), ey = cy - 2;
    const look = Math.round(dir);
    [cx - ex, cx + ex].forEach((e) => {
      if (p.sleeping || blink > 0) { px(e - 1, ey + 1, dark); px(e, ey + 1, dark); px(e + 1, ey + 1, dark); return; }
      if (playing) { px(e - 1, ey + 1, dark); px(e, ey, dark); px(e + 1, ey + 1, dark); return; } // ^ ^
      px(e + look * 0.5, ey, dark); px(e + look * 0.5, ey + 1, dark); px(e + 1 + look * 0.5, ey, dark); px(e + 1 + look * 0.5, ey + 1, dark);
      px(e + look * 0.5, ey, pal.eye);
    });
    // cheeks
    if (m === 'happy' || playing) { px(cx - ex - 2, ey + 3, pal.cheek); px(cx + ex + 2, ey + 3, pal.cheek); }
    // mouth
    const my = ey + 4;
    if (eating) {
      const open = Math.sin(t / 90) > 0;
      px(cx, my, dark); px(cx + 1, my, dark); if (open) { px(cx, my + 1, pal.mouth); px(cx + 1, my + 1, dark); }
    } else if (p.sleeping) {
      px(cx, my, dark);
    } else if (sad) {
      px(cx - 1, my + 1, dark); px(cx, my, dark); px(cx + 1, my, dark); px(cx + 2, my + 1, dark);
    } else {
      px(cx - 1, my, dark); px(cx, my + 1, dark); px(cx + 1, my + 1, dark); px(cx + 2, my, dark);
    }
    // food
    if (eating) {
      const left = (anim.until - now) / 1600;
      const bites = Math.ceil(left * 3);
      for (let i = 0; i < bites; i++) { px(cx + rx + 2 + i, cy + 2, pal.food[0]); px(cx + rx + 2 + i, cy + 3, pal.food[1]); }
    }
    // dirt bits
    if (p.clean < 50) {
      const n = Math.ceil((50 - p.clean) / 10);
      for (let i = 0; i < n; i++) px(4 + i * 5 + (i % 2), 30 - (i % 3), (Math.floor(t / 400) + i) % 2 ? pal.dirt[0] : pal.dirt[1]);
    }
    // sleeping Zs
    if (p.sleeping) {
      const k = (t / 60) % 30;
      const zx = cx + rx - 1 + k / 8, zy = cy - ry - k / 4;
      [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]].forEach(([a, b]) => { ctx.globalAlpha = 1 - k / 30; px(zx + a, zy + b, pal.spark); ctx.globalAlpha = 1; });
    }
  }

  function frame(t) {
    requestAnimationFrame(frame);
    ctx.clearRect(0, 0, S, S);
    if (stage(p) === 'egg') drawEgg(t);
    else drawPet(t);
    particles = particles.filter((q) => (q.life -= 0.012) > 0);
    for (const q of particles) {
      q.x += q.vx; q.y += q.vy;
      ctx.globalAlpha = q.life;
      if (q.kind === 'heart') sprite(HEART, q.x - 2, q.y - 2, pal.heart);
      else px(q.x, q.y, Math.random() < 0.5 ? pal.eye : pal.spark);
      ctx.globalAlpha = 1;
    }
  }
  requestAnimationFrame(frame);

  // ---- clock tick ----
  let wasEgg = stage(p) === 'egg';
  setInterval(() => {
    simulate(p);
    const isEgg = stage(p) === 'egg';
    if (wasEgg && !isEgg) { burst('spark', 20); say(`${p.name} has hatched! hello, operator.`, 6000); }
    wasEgg = isEgg;
    renderStats();
    persist();
  }, 5000);
  setInterval(() => {
    if (stage(p) !== 'egg' && Math.random() < 0.6) say(pick(LINES[mood(p)]));
  }, 45000);

  renderStats();
  if (stage(p) === 'egg') say('an egg… something is inside', 5000);
  else setTimeout(() => say(pick(LINES[mood(p)])), 2500);
}
