import { h, load, save, emit, dayKey, notify } from '../core/util.js';

// Daily water tracker: tap to log a glass, animated fill, 7-day history, gentle reminders
// when you're behind pace during waking hours.
const DEFAULTS = { goal: 2000, glass: 250, remind: true, wakeFrom: 8, wakeTo: 22 };

export async function mount({ body: root, meta }) {
  const data = { ...DEFAULTS, log: {}, ...(await load('water', {})) };
  const persist = () => save('water', data);
  const today = () => data.log[dayKey()] || 0;

  const wave = h('div', { class: 'water-fill' }, h('div', { class: 'water-wave' }), h('div', { class: 'water-wave b' }));
  const amount = h('div', { class: 'water-amount' });
  const sub = h('div', { class: 'water-sub' });
  const week = h('div', { class: 'water-week' });
  root.append(
    h('div', { class: 'water-top' },
      h('div', { class: 'water-glass', title: 'Click to log a glass', onclick: () => add(data.glass) }, wave, amount),
      h('div', { class: 'water-side' },
        sub,
        h('div', { class: 'water-btns' },
          h('button', { class: 'btn', onclick: () => add(data.glass) }, `+${data.glass} ml`),
          h('button', { class: 'btn', onclick: () => add(500) }, '+500'),
          h('button', { class: 'btn', title: 'Undo one glass', onclick: () => add(-data.glass) }, '−')),
        h('label', { class: 'water-goal' }, 'goal ',
          h('input', { class: 'input', type: 'number', min: 500, max: 6000, step: 250, value: data.goal,
            onchange: (e) => { data.goal = Math.max(500, Number(e.target.value) || DEFAULTS.goal); persist(); render(); } }), ' ml'))),
    week);

  function add(ml) {
    const before = today();
    data.log[dayKey()] = Math.max(0, before + ml);
    persist();
    if (ml > 0) {
      root.classList.remove('splash'); void root.offsetWidth; root.classList.add('splash');
      emit('water:add', { ml, total: today() });
      if (before < data.goal && today() >= data.goal) {
        emit('water:goal', { total: today() });
        notify('Hydration goal reached 💧', `${today()} ml today. Nice!`);
      }
    }
    render();
  }

  function render() {
    const ml = today();
    const pct = Math.min(1, ml / data.goal);
    wave.style.height = `${pct * 100}%`;
    amount.textContent = `${Math.round(pct * 100)}%`;
    sub.replaceChildren(h('b', {}, `${ml}`), ` / ${data.goal} ml`, h('br'), h('small', {}, `${Math.ceil(Math.max(0, data.goal - ml) / data.glass)} glasses to go`));
    if (meta) meta.textContent = `${Math.floor(ml / data.glass)} glasses`;
    // last 7 days
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    week.replaceChildren(...days.map((d) => {
      const v = data.log[dayKey(d)] || 0;
      return h('div', { class: `water-day${v >= data.goal ? ' hit' : ''}`, title: `${dayKey(d)}: ${v} ml` },
        h('i', { style: { height: `${Math.min(100, (v / data.goal) * 100)}%` } }),
        h('span', {}, d.toLocaleDateString(undefined, { weekday: 'narrow' })));
    }));
  }

  // Remind roughly hourly if behind the linear pace for the waking window.
  let lastRemind = Date.now();
  setInterval(() => {
    const now = new Date();
    const hr = now.getHours() + now.getMinutes() / 60;
    if (!data.remind || hr < data.wakeFrom || hr > data.wakeTo) return;
    const expected = data.goal * ((hr - data.wakeFrom) / (data.wakeTo - data.wakeFrom));
    if (today() < expected - data.glass && Date.now() - lastRemind > 60 * 60 * 1000) {
      lastRemind = Date.now();
      notify('Water break 💧', `You're at ${today()} ml. Time for a glass.`);
    }
    render(); // also rolls over at midnight
  }, 60 * 1000);

  render();
}
