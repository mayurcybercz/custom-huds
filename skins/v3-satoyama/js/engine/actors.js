// Everyone who lives in Satoyama: people with daily schedules, the dog and cat you can pet,
// the toad family, birds, fireflies. Each actor reacts to the pointer and can trigger sounds.
import { W, GROUND, WATER, rng, sprite, rect, px, ellipse, line, clamp, lerp, inRange } from './util.js';
import { HOUSES, BELL, YAGURA, FIRE, STALL, PADDY, HUT, OWL, DOG_SPOT, CAT_SPOT, forestY, hillY } from './world.js';

// ---------------------------------------------------------------- sprite parts
const HEAD = {
  hair: ['..hhh..', '.hhhhh.', '.hhssS.', '..sssS.', '...sS..'],
  bun: ['hh.....', 'hhhhh..', '.hhssS.', '..sssS.', '...sS..'],
  hat: ['..xxx..', '.xxxxX.', 'xxxxxXX', '..ssS..', '...sS..'],
  bald: ['..sss..', '.sssss.', '.sssSS.', '..sssS.', '...sS..'],
};
const TORSO = ['.ccccC.', 'cccccCC', 'cccccCC', 'sooooOs', '.ccccC.', '.ccccC.', '.cccCC.', '.ccCCC.'];
const LEGS = [
  ['.ll.ll.', '.ll.ll.', '.ff.ff.'],
  ['..lll..', '.ll..l.', '.ff..f.'],
  ['..ll...', '..ll...', '..ff...'],
  ['.l..ll.', '.l...ll', '.f...ff'],
];
const KID_HEAD = ['.hhh.', 'hhhss', '.hssS', '..sS.'];
const KID_TORSO = ['.ccC.', 'cccCC', 'scccs', '.cCC.'];
const KID_LEGS = [['.l.l.', '.l.l.', '.f.f.'], ['l...l', 'l...l', 'f...f'], ['..l..', '.l.l.', '.f.f.'], ['l..l.', '.l..l', '.f..f']];

const cache = new Map();
function setCh(rows, r, c, ch) { if (r >= 0 && r < rows.length && c >= 0 && c < rows[r].length) rows[r] = rows[r].slice(0, c) + ch + rows[r].slice(c + 1); }
// pose: 'down' | 'wave' | 'up' (both arms up, dancing) ; legs: frame index
function adultRows(head, pose, legs) {
  const key = `a${head}${pose}${legs}`;
  if (cache.has(key)) return cache.get(key);
  const rows = [...HEAD[head], ...TORSO, ...LEGS[legs % 4]];
  if (pose === 'wave' || pose === 'up') { setCh(rows, 3, 6, 's'); setCh(rows, 4, 6, 's'); setCh(rows, 8, 6, 'O'); }
  if (pose === 'up') { setCh(rows, 3, 0, 's'); setCh(rows, 4, 0, 's'); setCh(rows, 8, 0, 'o'); }
  cache.set(key, rows);
  return rows;
}
function kidRows(pose, legs) {
  const key = `k${pose}${legs}`;
  if (cache.has(key)) return cache.get(key);
  const rows = [...KID_HEAD, ...KID_TORSO, ...KID_LEGS[legs % 4]];
  if (pose === 'wave' || pose === 'up') { setCh(rows, 1, 4, 's'); setCh(rows, 2, 4, 's'); setCh(rows, 6, 4, 'c'); }
  if (pose === 'up') { setCh(rows, 1, 0, 's'); setCh(rows, 2, 0, 's'); setCh(rows, 6, 0, 'c'); }
  cache.set(key, rows);
  return rows;
}

const SKIN = { s: '#efc29c', S: '#d6a27c' };
function pal(cloth, opts = {}) {
  const shade = opts.shade || cloth.replace(/^#/, '').match(/../g).map((h) => Math.round(parseInt(h, 16) * 0.72).toString(16).padStart(2, '0')).join('');
  return {
    h: opts.hair || '#2a2220', ...SKIN, c: cloth, C: opts.shade || `#${shade}`, o: opts.obi || '#c9a860', O: opts.obiShade || '#a8884a',
    l: opts.legs || '#2e2a30', f: '#c9b48a', x: '#d2b46c', X: '#a88a4a',
  };
}

const DOG = {
  awake: ['............k.k.', '...........kkkk.', '..........kkekkw', '..t.......kwwwwn', '.tTt.....kkwwww.', '.tkkkkkkkkkww...', '..kkkkkkkkKKw...', '..wwKKKKKwwww...'],
  wag: ['............k.k.', '...........kkkk.', '..........kkekkw', '.tt.......kwwwwn', 'tTt......kkwwww.', '..kkkkkkkkkww...', '..kkkkkkkkKKw...', '..wwKKKKKwwww...'],
  happy: ['............k.k.', '...........kkkk.', '..........kkKkkw', '.tt.......kwwwwn', 'tTt......kkwwwwp', '..kkkkkkkkkww...', '..kkkkkkkkKKw...', '..wwKKKKKwwww...'],
  sleep: ['................', '................', '............kk..', '..t........kkkk.', '.tTt.....kkkKkkw', '.tkkkkkkkkkwwwwn', '..kkkkkkkkKKw...', '..wwKKKKKwwww...'],
};
const DOG_PAL = { k: '#c9783a', K: '#a35c27', w: '#f3e2c8', e: '#1a1410', n: '#2a1e18', t: '#e8d2b0', T: '#c9783a', p: '#e86a7a' };
const CAT = {
  sit: ['.....w.k.', '.....wwkk', '.....wewe', 't....wwnw', 't...wwwkk', 'tt.wwkkkk', '.twwwkkKk', '..wwkkKKk', '..wW.kK.k'],
  purr: ['.....w.k.', '.....wwkk', '.....wKwK', '.t...wwnw', 'tt..wwwkk', 't..wwkkkk', '..wwwkkKk', '..wwkkKKk', '..wW.kK.k'],
};
const CAT_PAL = { w: '#f2ebe0', W: '#d8cfc0', k: '#d98a3a', K: '#3a302a', e: '#5a9a42', n: '#e8a0a0', t: '#3a302a' };
const TOAD = { big: ['.e...e.', 'ggggggg', 'gGggGgg', 'ggggggg', '.g...g.'], small: ['e...e', 'ggggg', 'gGgGg', '.g.g.'] };
const TOAD_PAL = { g: '#7a6a3e', G: '#5a4c2a', e: '#d8c46a' };

// ---------------------------------------------------------------- the cast
const R = rng(99);
const CLOTHES = ['#3e4f7a', '#6a4a6a', '#7a5a3a', '#4a6a5a', '#8a3a3a', '#3a5a7a', '#5a5a6a'];
const YUKATA = ['#7fb0d8', '#e8a0b0', '#f0d8a0', '#a8c8e8', '#e8b0c8', '#c8d8f0', '#f0b8a0', '#b8e0d0', '#d8b8e8', '#a0c8f0'];

export function createActors(sound) {
  const S = {
    monk: { x: 262, dir: 1, bow: 0 },
    farmers: [{ x: 800, y: 279, ph: 0 }, { x: 886, y: 290, ph: 2 }],
    walkers: [0, 1, 2].map((i) => ({ x: 380 + i * 140, dir: i % 2 ? -1 : 1, speed: 8 + i * 3, y: 268 + (i % 2) * 2, cloth: CLOTHES[i * 2], head: ['hat', 'bun', 'hair'][i], carry: i === 0, wave: 0, frame: 0 })),
    kids: [0, 1, 2, 3].map((i) => ({ x: 560 + i * 20, y: 266 + (i % 3) * 2, vx: 0, tx: 600, cloth: ['#d65a5a', '#4a78c8', '#e8b84a', '#6aa84a'][i], hair: i === 2 ? '#5a3a22' : '#2a2220', wave: 0, jump: 0, excite: 0, frame: 0, pick: 0 })),
    kite: { kidX: 664, x: 700, y: 120, loop: 0 },
    gatherers: [0, 1, 2].map((i) => ({ off: i * 0.33, cloth: CLOTHES[3 + i] })),
    circle: [[-16, 0, 'hat'], [-9, 1, 'bun'], [9, 1, 'hair'], [16, 0, 'hair'], [2, 3, 'bun']].map(([dx, sit, head], i) => ({ dx, sit, head, cloth: CLOTHES[(i + 2) % CLOTHES.length], addWood: 0 })),
    dancers: YUKATA.map((c, i) => ({ c, i })),
    dog: { mood: 0, wag: 0, petting: 0, hearts: 0, barked: 0 },
    cat: { purr: 0, petting: 0 },
    toads: [{ x: HUT.x + 4, big: true, hop: 0, croak: 0, at: 0 }, { x: HUT.x - 10, big: false, hop: 0, croak: 0, at: 0.2 }, { x: HUT.x + 18, big: false, hop: 0, croak: 0, at: 0.45 }, { x: HUT.x - 20, big: false, hop: 0, croak: 0, at: 0.7 }],
    owl: { look: 0, hoot: 0 },
    perched: [0, 1, 2].map((i) => ({ x: HOUSES[1].x + 12 + i * 8, y: 0, fly: 0, vx: 0, vy: 0, home: HOUSES[1].x + 12 + i * 8 })),
    flock: Array.from({ length: 7 }, (_, i) => ({ ox: i * 9 + R() * 6, oy: (i % 3) * 4 + R() * 3, scatter: 0, sx: 0, sy: 0 })),
    crows: Array.from({ length: 6 }, (_, i) => ({ ox: i * 15, oy: (i % 3) * 7 })),
    fireflies: Array.from({ length: 56 }, (_, i) => {
      const forest = i < 34;
      return { bx: forest ? 950 + R() * 640 : 360 + R() * 560, by: forest ? 200 + R() * 80 : 284 + R() * 14, a: 0.2 + R() * 0.5, b: 0.3 + R() * 0.6, p: R() * 6.28, q: R() * 6.28, c: 0.8 + R() * 1.6, pullX: 0, pullY: 0 };
    }),
    fish: { t: -1, x: 0, dir: 1 },
    drummer: { hit: 0 },
  };

  const lastHover = new Map();
  // hover callbacks fire once when the pointer enters an actor, then cool down
  function hoverOnce(id, cooldown, fn, now) {
    const last = lastHover.get(id) || 0;
    if (now - last > cooldown) { lastHover.set(id, now); fn(); }
  }

  function personDraw(g, x, foot, opts) {
    const { head = 'hair', pose = 'down', legs = 0, cloth = '#3e4f7a', hair, flip = false, kid = false, bend = 0, crop = 0, obi, legsCol } = opts;
    const p = pal(cloth, { hair, obi, legs: legsCol });
    const rows = kid ? kidRows(pose, legs) : adultRows(head, pose, legs);
    const w = rows[0].length;
    const left = Math.round(x - w / 2);
    ellipse(g, x, foot, kid ? 3 : 4, 1, 'rgba(20,16,10,0.22)');
    if (bend) {
      sprite(g, rows.slice(rows.length - 3), p, left, foot, flip);
      sprite(g, rows.slice(0, rows.length - 3), p, left + (flip ? -2 : 2), foot - 3 + bend, flip);
    } else if (crop) {
      sprite(g, rows.slice(0, rows.length - crop), p, left, foot, flip);
    } else sprite(g, rows, p, left, foot, flip);
  }

  // ------------------------------------------------------------ update + draw, called every frame
  function frame(g, ctx) {
    const { t, dt, hour: h, env, camX, pointer, festival, now } = ctx;
    const X = (x) => Math.round(x - camX);
    const visible = (x, m = 40) => x > camX - m && x < camX + W + m;
    const rain = env.rain > 0.5;
    const pw = pointer && pointer.active ? pointer : null;
    const near = (x, y, rx, ry) => pw && Math.abs(pw.wx - x) < rx && Math.abs(pw.wy - y) < ry;
    const drawList = []; // y-sorted people & animals
    const add = (foot, fn) => drawList.push([foot, fn]);
    const out = { lights: [], emissive: [] }; // extra light sources from actors

    // monk sweeping the temple grounds at dawn
    if (inRange(h, 4.9, 8.7) && !rain && visible(S.monk.x)) {
      const m = S.monk;
      if (near(m.x, hillY(m.x) - 8, 6, 10)) { hoverOnce('monk', 6000, () => { m.bow = 1.6; }, now); }
      m.bow = Math.max(0, m.bow - dt);
      if (!m.bow) { m.x += m.dir * dt * 4; if (m.x > 300 || m.x < 236) m.dir *= -1; }
      const foot = Math.round(hillY(m.x));
      add(foot, () => {
        personDraw(g, X(m.x), foot, { head: 'bald', cloth: '#2f2f38', obi: '#c9963a', obiShade: '#a07830', pose: 'down', legs: m.bow ? 0 : Math.floor(t * 3) % 4, flip: m.dir < 0, bend: m.bow ? 2 : 0 });
        if (!m.bow) { const bx = X(m.x) + (m.dir > 0 ? 4 : -4), sw = Math.round(Math.sin(t * 5) * 3); line(g, bx, foot - 9, bx + sw * m.dir, foot, '#c9a860'); line(g, bx + sw * m.dir - 2, foot, bx + sw * m.dir + 2, foot, '#a8884a'); }
      });
    }

    // farmers planting in the paddies
    if ((inRange(h, 6.4, 11) || inRange(h, 13, 16.6)) && !rain) {
      S.farmers.forEach((f, i) => {
        if (!visible(f.x)) return;
        const hover = near(f.x, f.y - 8, 6, 10);
        if (hover) hoverOnce(`farmer${i}`, 5000, () => { f.wave = 2; }, now);
        f.wave = Math.max(0, (f.wave || 0) - dt);
        const bend = f.wave ? 0 : (Math.sin(t * 1.3 + f.ph) > -0.2 ? 3 : 0);
        add(f.y, () => personDraw(g, X(f.x), f.y, { head: 'hat', cloth: i ? '#5a4a3a' : '#3e4f7a', pose: f.wave ? 'wave' : 'down', bend, legsCol: '#3a3a3a' }));
      });
    }

    // villagers walking the path
    if (inRange(h, 7, 19.2)) {
      S.walkers.forEach((wk, i) => {
        if (rain && i > 1) return;
        wk.x += wk.dir * wk.speed * dt * (rain ? 1.3 : 1);
        if (wk.x > 770) { wk.dir = -1; } else if (wk.x < 352) { wk.dir = 1; }
        if (!visible(wk.x)) return;
        if (near(wk.x, wk.y - 8, 5, 10)) hoverOnce(`walker${i}`, 5000, () => { wk.wave = 1.5; }, now);
        wk.wave = Math.max(0, wk.wave - dt);
        add(wk.y, () => {
          personDraw(g, X(wk.x), wk.y, { head: rain ? 'hair' : wk.head, cloth: wk.cloth, pose: wk.wave ? 'wave' : 'down', legs: wk.wave ? 0 : Math.floor(t * wk.speed * 0.5) % 4, flip: wk.dir < 0 });
          if (wk.carry && !rain) { const bx = X(wk.x) + (wk.dir > 0 ? -5 : 3); rect(g, bx, wk.y - 13, 3, 5, '#a8854f'); rect(g, bx, wk.y - 13, 3, 1, '#c9a46a'); }
          if (rain) { const ux = X(wk.x); const col = i ? '#c8463a' : '#3a5a8a'; ellipse(g, ux, wk.y - 18, 8, 2, col); rect(g, ux - 8, wk.y - 18, 17, 1, col); rect(g, ux, wk.y - 17, 1, 6, '#6a4a30'); for (let k = -8; k <= 8; k += 4) px(g, ux + k, wk.y - 16, '#2a2a2a'); }
        });
      });
    }

    // kids playing tag in the square, one flying a kite
    const kidsOut = inRange(h, 8.4, 17.2) && !rain;
    if (kidsOut) {
      S.kids.forEach((k, i) => {
        k.pick -= dt;
        if (k.pick <= 0) { k.tx = 552 + R() * 86; k.pick = 0.8 + R() * 2.2 - k.excite * 0.5; }
        const speed = 26 + k.excite * 20;
        k.vx = lerp(k.vx, Math.sign(k.tx - k.x) * speed, dt * 3);
        if (Math.abs(k.tx - k.x) < 2) k.vx *= 0.7;
        k.x += k.vx * dt;
        k.excite = Math.max(0, k.excite - dt * 0.2);
        k.wave = Math.max(0, k.wave - dt);
        k.jump = Math.max(0, k.jump - dt * 3);
        if (R() < dt * 0.3) k.jump = 1;
        if (near(k.x, k.y - 6, 5, 8)) hoverOnce(`kid${i}`, 2500, () => { k.wave = 1.2; k.jump = 1; if (sound) sound('giggle', { x: k.x }); }, now);
        if (!visible(k.x)) return;
        const hop = Math.round(Math.sin(k.jump * Math.PI) * 3);
        add(k.y, () => personDraw(g, X(k.x), k.y - hop, { kid: true, cloth: k.cloth, hair: k.hair, pose: k.wave ? 'wave' : k.excite > 0.5 ? 'up' : 'down', legs: Math.abs(k.vx) > 4 ? Math.floor(t * 10 + i) % 4 : 0, flip: k.vx < 0 }));
      });
      const kt = S.kite;
      kt.loop = Math.max(0, kt.loop - dt);
      const lp = kt.loop > 0 ? (1 - kt.loop / 2) * Math.PI * 2 : 0;
      kt.x = kt.kidX + 34 + Math.sin(t * 0.6) * 8 + (kt.loop ? Math.sin(lp) * 14 : 0);
      kt.y = 124 + Math.sin(t * 0.9) * 7 + (kt.loop ? -Math.cos(lp) * 14 + 14 : 0);
      if (near(kt.x, kt.y, 6, 6) && pw.down) kt.loop = kt.loop || 2;
      if (visible(kt.kidX, 80)) {
        add(268, () => {
          personDraw(g, X(kt.kidX), 268, { kid: true, cloth: '#7a9a4a', pose: 'wave' });
          for (let i = 0; i <= 26; i++) { const u = i / 26; px(g, X(lerp(kt.kidX + 2, kt.x, u)), lerp(257, kt.y + 4, u) + Math.sin(u * Math.PI) * 9, 'rgba(240,232,214,0.75)'); }
          const kx = X(kt.x), ky = Math.round(kt.y);
          for (let dy = -4; dy <= 4; dy++) { const hw = 3 - Math.abs(dy) * 0.7; rect(g, kx - hw, ky + dy, hw * 2 + 1, 1, dy < 0 ? '#d0452f' : '#b03a28'); }
          rect(g, kx - 1, ky - 1, 3, 3, '#f0e8dc'); px(g, kx, ky, '#d0452f');
          for (let i = 0; i < 6; i++) px(g, kx + Math.round(Math.sin(t * 4 + i * 0.8) * 2), ky + 5 + i * 2, i % 2 ? '#f0c84a' : '#f0e8dc');
        });
      }
    }

    // dusk: people coming home with baskets
    if (inRange(h, 16.5, 19.6) && !rain) {
      S.gatherers.forEach((gt, i) => {
        const p = ((t * 0.018 + gt.off) % 1), x = 770 - p * 380;
        if (!visible(x) || x < 400) return;
        add(269, () => {
          personDraw(g, X(x), 269, { head: i === 1 ? 'bun' : 'hat', cloth: gt.cloth, legs: Math.floor(t * 4 + i) % 4, flip: true });
          if (i === 2) { rect(g, X(x) + 2, 255, 6, 2, '#7a5a3a'); rect(g, X(x) + 2, 254, 6, 1, '#8a6a4a'); } else { rect(g, X(x) + 3, 256, 4, 6, '#a8854f'); rect(g, X(x) + 3, 253, 4, 3, '#d8c070'); }
        });
      });
    }

    // evening around the bonfire
    const evening = inRange(h, 19.2, 23.3) && !rain;
    if (evening && visible(FIRE.x, 60)) {
      S.circle.forEach((p, i) => {
        p.addWood -= dt;
        if (p.addWood < 0 && i === 3) { p.addWood = 14 + R() * 10; if (sound) sound('crackle', { x: FIRE.x }); }
        const foot = 266 + (i % 2) * 3;
        add(foot - (p.sit ? 0 : 0), () => personDraw(g, X(FIRE.x + p.dx), foot, { head: p.head, cloth: p.cloth, flip: p.dx > 0, crop: p.sit ? 4 : 0, pose: i === 3 && p.addWood > 12.5 ? 'wave' : 'down' }));
      });
      out.lights.push({ x: FIRE.x, y: 258, r: 64 + Math.sin(t * 9) * 4 + Math.sin(t * 23) * 2, col: [240, 120, 40], a: 0.95 });
      out.emissive.push((e) => {
        for (let i = 0; i < 14; i++) {
          const fx = X(FIRE.x) - 5 + (i % 11), fh = 3 + Math.round(Math.abs(Math.sin(t * 7 + i * 1.7)) * 8 + Math.sin(t * 13 + i) * 1.5);
          e.fillStyle = i % 4 === 0 ? '#fff0b0' : i % 2 ? '#ffb040' : '#ff7a28';
          e.fillRect(fx, 264 - fh, 1, fh);
        }
        for (let i = 0; i < 6; i++) { const age = (t * 0.6 + i / 6) % 1; e.fillStyle = `rgba(255,170,80,${(1 - age).toFixed(2)})`; e.fillRect(X(FIRE.x) + Math.round(Math.sin(age * 9 + i) * 4), Math.round(258 - age * 40), 1, 1); }
      });
    }

    // festival: dancers around the yagura, drummer, food stall, sparklers
    if (evening && festival) {
      const n = S.dancers.length;
      S.dancers.forEach((d, i) => {
        const a = t * 0.3 + (i * Math.PI * 2) / n, x = YAGURA.x + Math.cos(a) * 30, foot = 266 + Math.round(Math.sin(a) * 4);
        if (!visible(x)) return;
        add(foot, () => personDraw(g, X(x), foot, { head: i % 3 ? 'bun' : 'hair', cloth: d.c, obi: '#c8463a', pose: (Math.floor(t * 1.4) + i) % 2 ? 'up' : 'wave', legs: Math.floor(t * 2 + i) % 4, flip: Math.sin(a) > 0 }));
      });
      S.drummer.hit = Math.max(0, S.drummer.hit - dt * 4);
      add(229, () => personDraw(g, X(YAGURA.x + 6), 229, { head: 'hair', cloth: '#f0e8dc', obi: '#c8463a', pose: S.drummer.hit > 0.5 ? 'up' : 'down', flip: true, crop: 0 }));
      // yatai stall with a lantern
      add(262, () => {
        const sx = X(STALL.x);
        rect(g, sx - 12, 246, 24, 12, '#7a5a3a'); rect(g, sx - 12, 246, 24, 2, '#8a6a4a');
        for (let i = 0; i < 24; i += 4) rect(g, sx - 12 + i, 236, 4, 3, (i / 4) % 2 ? '#f0e8dc' : '#d0452f');
        rect(g, sx - 13, 239, 26, 1, '#5a3d29'); rect(g, sx - 12, 239, 1, 7, '#5a3d29'); rect(g, sx + 11, 239, 1, 7, '#5a3d29');
        personDraw(g, sx, 258, { head: 'hair', cloth: '#3e4f7a', crop: 5 });
      });
      out.lights.push({ x: STALL.x, y: 242, r: 26, col: [230, 150, 70], a: 0.8 });
      out.emissive.push((e) => { e.fillStyle = '#ffcf80'; e.fillRect(X(STALL.x) - 1, 240, 3, 4); });
      // two kids with sparklers near the stall
      [[STALL.x + 18, 0], [STALL.x + 26, 1]].forEach(([x, i]) => {
        add(268, () => personDraw(g, X(x), 268, { kid: true, cloth: YUKATA[i * 3 + 1], pose: 'wave', flip: i === 1 }));
        out.emissive.push((e) => { for (let k = 0; k < 7; k++) { const a = R() * 6.28, d = R() * 4; e.fillStyle = k % 2 ? '#fff4c0' : '#ffb040'; e.fillRect(X(x) + (i ? -3 : 3) + Math.round(Math.cos(a) * d), 256 + Math.round(Math.sin(a) * d), 1, 1); } });
        out.lights.push({ x: x + (i ? -3 : 3), y: 256, r: 12, col: [255, 200, 110], a: 0.7 });
      });
    }

    // the shiba: awake by day, asleep at night; pet it by holding the mouse and rubbing
    {
      const d = S.dog, x = DOG_SPOT.x, y = DOG_SPOT.y;
      const asleep = inRange(h, 22, 6) && d.petting <= 0;
      const over = near(x + 2, y - 4, 9, 6);
      if (over) { hoverOnce('dog', 3000, () => { d.wag = 2; }, now); }
      if (over && pw.down && Math.abs(pw.dx) + Math.abs(pw.dy) > 0.2) {
        d.petting = 1.5; d.mood = Math.min(3, d.mood + dt);
        d.hearts += Math.abs(pw.dx) + Math.abs(pw.dy);
        if (d.hearts > 36) { d.hearts = 0; ctx.fx.heart(x + 2, y - 10); if (sound) sound('dog', { x, bark: d.barked <= 0 }); d.barked = 20; }
      }
      d.petting = Math.max(0, d.petting - dt);
      d.wag = Math.max(0, d.wag - dt);
      d.barked = Math.max(0, d.barked - dt);
      d.mood = Math.max(0, d.mood - dt * 0.2);
      if (visible(x)) {
        const rows = asleep ? DOG.sleep : d.petting > 0 ? DOG.happy : (d.wag > 0 || d.mood > 0.5) && Math.floor(t * 8) % 2 ? DOG.wag : DOG.awake;
        add(y, () => { ellipse(g, X(x), y, 8, 1, 'rgba(20,16,10,0.22)'); sprite(g, rows, DOG_PAL, X(x) - 8, y); if (asleep && Math.floor(t) % 3 === 0) { px(g, X(x) + 6, y - 12 - (t % 1) * 3, 'rgba(240,240,255,0.7)'); } });
      }
    }

    // the cat: on the veranda by day, on the roof at night; pet it for a purr
    {
      const c = S.cat, onRoof = inRange(h, 20.5, 6), hs = HOUSES[2];
      const x = onRoof ? hs.cx + 6 : CAT_SPOT.x, y = onRoof ? hs.ridge : CAT_SPOT.y - 5;
      const over = near(x, y - 4, 6, 6);
      if (over && pw.down && Math.abs(pw.dx) + Math.abs(pw.dy) > 0.2) {
        if (c.petting <= 0 && sound) sound('purr', { x });
        c.petting = 1.8;
        c.hearts = (c.hearts || 0) + Math.abs(pw.dx) + Math.abs(pw.dy);
        if (c.hearts > 40) { c.hearts = 0; ctx.fx.heart(x, y - 12); if (sound) sound('purr', { x }); }
      }
      c.petting = Math.max(0, c.petting - dt);
      if (visible(x) && !(rain && !onRoof)) {
        add(y, () => sprite(g, c.petting > 0 ? CAT.purr : CAT.sit, CAT_PAL, X(x) - 4, y, true));
        if (onRoof && env.dark > 0.4 && c.petting <= 0 && Math.sin(t * 0.5) > -0.85) out.emissive.push((e) => { e.fillStyle = '#c8f070'; e.fillRect(X(x) - 4 + 3, y - 7, 1, 1); e.fillRect(X(x) - 4 + 1, y - 7, 1, 1); });
      }
    }

    // sparrows on the roof of house 2 (fly off when the pointer comes close)
    if (inRange(h, 5.5, 18.5) && !rain) {
      const ridge = HOUSES[1].ridge;
      S.perched.forEach((b, i) => {
        if (!b.y) b.y = ridge;
        if (!b.fly && near(b.x, b.y, 14, 10)) { b.fly = 4; b.vx = (R() - 0.5) * 50; b.vy = -40 - R() * 20; if (sound && i === 0) sound('flutter', { x: b.x }); }
        if (b.fly) { b.fly -= dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 6 * dt; if (b.fly <= 0) { b.fly = 0; b.x = b.home; b.y = ridge; } }
        if (!visible(b.x)) return;
        add(ridge, () => { const bx = X(b.x), by = Math.round(b.y); if (b.fly) { px(g, bx, by, '#5a4632'); px(g, bx - 1, by - (Math.floor(t * 14) % 2), '#5a4632'); px(g, bx + 1, by - (Math.floor(t * 14) % 2), '#5a4632'); } else { rect(g, bx, by - 2, 3, 2, '#7a5c3e'); px(g, bx + 2, by - 3, '#5a4632'); px(g, bx + 3, by - 2, '#d8a040'); px(g, bx, by, '#3a2a1e'); } });
      });
    }

    // toad family: out of the hut after dark; hover = croak, click = hop
    if (inRange(h, 19.8, 5)) {
      const hrs = h >= 19.8 ? h - 19.8 : h + 4.2;
      S.toads.forEach((td, i) => {
        if (hrs < td.at) return;
        if (!visible(td.x)) return;
        const foot = forestY(td.x) + 5;
        if (near(td.x, foot - 2, 5, 4)) hoverOnce(`toad${i}`, 2000, () => { td.croak = 1.2; if (sound) sound('toad', { x: td.x }); }, now);
        if (near(td.x, foot - 2, 5, 4) && pw.down && !td.hop) { td.hop = 1; td.dir = pw.wx > td.x ? -1 : 1; }
        if (!td.hop && R() < dt * 0.05) { td.hop = 1; td.dir = R() < 0.5 ? -1 : 1; }
        if (td.hop) { td.hop = Math.max(0, td.hop - dt * 2.2); td.x = clamp(td.x + td.dir * dt * 14, HUT.x - 34, HUT.x + 30); }
        if (!td.croak && R() < dt * 0.06) { td.croak = 1; if (sound && i === 0) sound('toad', { x: td.x, ambient: true }); }
        td.croak = Math.max(0, td.croak - dt);
        const lift = Math.round(Math.sin(td.hop * Math.PI) * 4);
        add(foot, () => { sprite(g, td.big ? TOAD.big : TOAD.small, TOAD_PAL, X(td.x) - 3, foot - lift, td.dir < 0); if (td.croak && Math.floor(t * 8) % 2) rect(g, X(td.x) - 1, foot - lift - 1, 3, 1, '#ece2b0'); });
        if (env.dark > 0.4) out.emissive.push((e) => { e.fillStyle = 'rgba(240,226,140,0.55)'; const w = td.big ? 7 : 5, ey = foot - lift - (td.big ? 5 : 4); e.fillRect(X(td.x) - 3, ey, 1, 1); e.fillRect(X(td.x) - 3 + w - 1, ey, 1, 1); });
      });
      out.lights.push({ x: HUT.x + 12, y: forestY(HUT.x) - 10, r: 46, col: [220, 150, 70], a: 0.9 });
      out.emissive.push((e) => { e.fillStyle = '#ff9a5a'; e.fillRect(X(HUT.x + 11), forestY(HUT.x) - 13, 3, 4); e.fillStyle = '#ffd6a0'; e.fillRect(X(HUT.x + 12), forestY(HUT.x) - 12, 1, 1); });
    }

    // owl in the cedars late at night
    if (inRange(h, 21.8, 5) && visible(OWL.x)) {
      const o = S.owl;
      if (near(OWL.x, OWL.y, 6, 6)) hoverOnce('owl', 5000, () => { o.look = 2; if (sound) sound('owl', { x: OWL.x }); }, now);
      o.look = Math.max(0, o.look - dt);
      add(OWL.y, () => { const ox = X(OWL.x); rect(g, ox - 2, OWL.y - 7, 5, 7, '#5a4632'); rect(g, ox - 1, OWL.y - 5, 3, 4, '#7a6448'); px(g, ox - 2, OWL.y - 8, '#5a4632'); px(g, ox + 2, OWL.y - 8, '#5a4632'); });
      if (Math.sin(t * 0.6) > -0.92) out.emissive.push((e) => { e.fillStyle = '#ffd860'; const ox = X(OWL.x) + (o.look ? 1 : 0); e.fillRect(ox - 1, OWL.y - 6, 1, 1); e.fillRect(ox + 1, OWL.y - 6, 1, 1); });
    }

    // sky birds: a sparrow flock by day (scatters near the pointer), crows heading home at dusk, a soaring kite-hawk
    const birds = [];
    if (inRange(h, 6, 16.8) && !rain) {
      const fx = ((t * 24) % (W + 260)) - 130, fy = 70 + Math.sin(t * 0.3) * 10;
      S.flock.forEach((b, i) => {
        const bx = fx + b.ox + b.sx, by = fy + b.oy + b.sy;
        if (pw && pw.inSky && Math.hypot(pw.sx - bx, pw.sy - by) < 22 && b.scatter <= 0) { b.scatter = 2; b.vx = (bx - pw.sx) * 3; b.vy = (by - pw.sy) * 3 - 20; if (sound && i === 0) sound('flutter', { sx: bx }); }
        if (b.scatter > 0) { b.scatter -= dt; b.sx += (b.vx || 0) * dt; b.sy += (b.vy || 0) * dt; } else { b.sx *= 0.98; b.sy *= 0.98; }
        birds.push([bx, by, '#4a3c30', Math.floor(t * 9 + i) % 2]);
      });
    }
    if (inRange(h, 9.5, 16) && !rain) { const a = t * 0.18; birds.push([W * 0.7 + Math.cos(a) * 60, 48 + Math.sin(a) * 14, '#3a3028', 2]); }
    if (inRange(h, 16.8, 19.3) && !rain) S.crows.forEach((c, i) => { const bx = W + 80 - ((t * 18 + c.ox) % (W + 200)), by = 64 + c.oy + Math.sin(t * 2 + i) * 2; birds.push([bx, by, '#16161e', Math.floor(t * 5 + i) % 2]); });

    // fireflies drift toward the pointer at night
    const flies = [];
    if (env.dark > 0.45 && !rain) {
      for (const f of S.fireflies) {
        if (!visible(f.bx, 30)) continue;
        const pulse = Math.max(0, Math.sin(t * f.c + f.p)) ** 3;
        let x = f.bx + Math.sin(t * f.a + f.p) * 18 + f.pullX, y = f.by + Math.sin(t * f.b + f.q) * 9 + f.pullY;
        if (pw && Math.hypot(pw.wx - x, pw.wy - y) < 50) { f.pullX += (pw.wx - x) * dt * 0.6; f.pullY += (pw.wy - y) * dt * 0.6; } else { f.pullX *= 0.995; f.pullY *= 0.995; }
        x = f.bx + Math.sin(t * f.a + f.p) * 18 + f.pullX; y = f.by + Math.sin(t * f.b + f.q) * 9 + f.pullY;
        flies.push([x, y, pulse]);
        if (pulse > 0.1) out.lights.push({ x, y, r: 9, col: [150, 230, 90], a: pulse * 0.7 });
      }
      out.emissive.push((e) => { for (const [x, y, p] of flies) { if (p < 0.05) continue; const fx = X(x), fy = Math.round(y); e.fillStyle = `rgba(225,255,150,${p.toFixed(3)})`; e.fillRect(fx, fy, 1, 1); e.fillStyle = `rgba(200,255,120,${(p * 0.4).toFixed(3)})`; e.fillRect(fx - 1, fy, 3, 1); e.fillRect(fx, fy - 1, 1, 3); } });
    }

    // a fish jumps now and then (or where you touch the water)
    const fish = S.fish;
    if (fish.t < 0 && R() < dt * 0.04) { fish.t = 0; fish.x = camX + 80 + R() * (W - 160); fish.dir = R() < 0.5 ? -1 : 1; }
    if (ctx.fishAt) { fish.t = 0; fish.x = ctx.fishAt; fish.dir = R() < 0.5 ? -1 : 1; }
    if (fish.t >= 0) {
      fish.t += dt;
      const p = fish.t / 0.7;
      if (p >= 1) { fish.t = -1; ctx.fx.ripple(fish.x + fish.dir * 10, WATER + 8); if (sound) sound('splash', { x: fish.x, vol: 0.5 }); } else {
        const fxp = fish.x + fish.dir * p * 10, fyp = WATER + 8 - Math.sin(p * Math.PI) * 12;
        add(WATER + 10, () => { rect(g, X(fxp) - 2, Math.round(fyp), 5, 2, '#c8b8a0'); px(g, X(fxp) + (fish.dir > 0 ? 2 : -2), Math.round(fyp), '#e8d8c0'); px(g, X(fxp) - fish.dir * 3, Math.round(fyp) - 1, '#a8987a'); });
        if (p < 0.05) ctx.fx.ripple(fish.x, WATER + 8);
      }
    }

    // draw everyone back to front
    drawList.sort((a, b) => a[0] - b[0]);
    for (const [, fn] of drawList) fn();
    return { ...out, birds };
  }

  return {
    frame,
    taikoHit() { S.drummer.hit = 1; },
    exciteKids() { S.kids.forEach((k) => { k.excite = 2; k.jump = 1; }); },
    state: S,
  };
}
