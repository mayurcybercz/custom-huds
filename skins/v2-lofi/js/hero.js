import { h, load, save, listen, dayKey } from '../../../shared/core/util.js';
import { askText } from '../../../shared/core/modal.js';

// v2 hero: big clock, greeting, date, a rotating cozy line, and "daily rings" that
// summarise today's focus sessions, water and tasks (read from the shared store).
const VIBES = [
  'one thing at a time ✿', 'take a sip of water 💧', 'you are doing great', 'unclench your jaw, relax your shoulders',
  'small steps still count', 'breathe in… and out', 'lo-fi beats to focus to 🎧', 'be kind to yourself today',
  'progress, not perfection', 'stretch for a minute 🧘',
];
const RAIN_VIBES = ['listen to the rain ☔', 'cozy weather for deep work', 'tea and rain sounds 🍵', 'perfect weather to stay in'];
const FOCUS_GOAL = 4;
const raining = () => document.body.dataset.weather === 'rain';

function greeting(hr) {
  if (hr < 5) return ['good night', '🌙'];
  if (hr < 12) return ['good morning', '☀️'];
  if (hr < 17) return ['good afternoon', '🌤️'];
  if (hr < 21) return ['good evening', '🌆'];
  return ['good night', '🌙'];
}

function ring(r, color) {
  const C = 2 * Math.PI * r;
  return {
    C,
    track: `<circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="9"/>`,
    arc: `<circle class="ring-arc" cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"
            stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 60 60)"/>`,
  };
}

export async function mount({ body: root }) {
  const profile = await load('v2profile', { name: '' });
  const time = h('span', { class: 'hero-hm' });
  const greet = h('h1', { class: 'hero-greet', title: 'Double-click to set your name' });
  const date = h('div', { class: 'hero-date' });
  const vibe = h('div', { class: 'hero-vibe' });

  const rings = [ring(50, 'var(--accent)'), ring(38, 'var(--accent3)'), ring(26, 'var(--ok)')];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.classList.add('hero-rings-svg');
  svg.innerHTML = rings.map((r) => r.track + r.arc).join('');
  const arcs = [...svg.querySelectorAll('.ring-arc')];
  const legend = h('div', { class: 'hero-legend' });

  root.append(
    h('div', { class: 'hero-left' }, h('div', { class: 'hero-time' }, time), h('div', {}, greet, date, vibe)),
    h('div', { class: 'hero-rings' }, svg, legend));

  greet.addEventListener('dblclick', async () => {
    const n = await askText('WHAT SHOULD I CALL YOU?', profile.name);
    if (n === null) return;
    profile.name = n.trim().slice(0, 24);
    save('v2profile', profile);
    tick();
  });

  let vibeIdx = Math.floor(Math.random() * VIBES.length);
  function tick() {
    const d = new Date();
    time.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    const [g, icon] = greeting(d.getHours());
    greet.textContent = `${g}${profile.name ? `, ${profile.name}` : ''} ${raining() ? '🌧️' : icon}`;
    date.textContent = `${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · ${d.toLocaleDateString('ja-JP', { weekday: 'long' })}`;
  }
  function rotateVibe() {
    vibe.classList.remove('show');
    setTimeout(() => {
      const list = raining() ? RAIN_VIBES : VIBES;
      vibe.textContent = list[vibeIdx++ % list.length];
      vibe.classList.add('show');
    }, 400);
  }

  async function refreshRings() {
    const today = dayKey();
    const [pomo, water, todos, meals] = await Promise.all([load('pomodoro', {}), load('water', {}), load('todos', []), load('meals', {})]);
    const sessions = pomo.day === today ? pomo.sessions || 0 : 0;
    const ml = (water.log || {})[today] || 0;
    const goal = water.goal || 2000;
    const doneToday = todos.filter((t) => t.done && t.doneAt && dayKey(new Date(t.doneAt)) === today).length;
    const open = todos.filter((t) => !t.done).length;
    const kcal = ((meals.days || {})[today] || []).reduce((a, e) => a + (e.kcal || 0), 0);
    const values = [sessions / FOCUS_GOAL, ml / goal, doneToday + open ? doneToday / (doneToday + open) : 0];
    arcs.forEach((arc, i) => { arc.style.strokeDashoffset = String(rings[i].C * (1 - Math.min(1, values[i]))); });
    legend.replaceChildren(
      h('div', { style: { '--c': 'var(--accent)' } }, h('i'), h('b', {}, `${sessions}/${FOCUS_GOAL}`), ' focus'),
      h('div', { style: { '--c': 'var(--accent3)' } }, h('i'), h('b', {}, `${(ml / 1000).toFixed(1)}/${(goal / 1000).toFixed(1)} L`), ' water'),
      h('div', { style: { '--c': 'var(--ok)' } }, h('i'), h('b', {}, `${doneToday}/${doneToday + open}`), ' tasks'),
      h('div', { style: { '--c': 'var(--warn)' } }, h('i'), h('b', {}, `${kcal.toLocaleString()}`), ' kcal'));
  }

  ['pomo:done', 'water:add', 'todo:done', 'meal:add', 'schedule:done'].forEach((evt) => listen(evt, () => setTimeout(refreshRings, 300)));
  tick();
  rotateVibe();
  refreshRings();
  setInterval(tick, 1000);
  setInterval(rotateVibe, 5 * 60 * 1000);
  setInterval(refreshRings, 20 * 1000);
}
