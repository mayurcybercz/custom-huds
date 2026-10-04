import { h, uid, load, save, emit, dayKey } from '../core/util.js';
import { askText } from '../core/modal.js';

// Meal log per day. Type "oats with banana 350" — a trailing number is read as kcal.
// Recently used meals show up as one-click chips.
const SLOTS = [
  { key: 'breakfast', label: 'Breakfast', icon: '🍳' },
  { key: 'lunch', label: 'Lunch', icon: '🍱' },
  { key: 'snack', label: 'Snacks', icon: '🍡' },
  { key: 'dinner', label: 'Dinner', icon: '🍜' },
];

function parseEntry(text) {
  const m = /^(.*?)[\s,]+(\d{2,4})\s*(k?cal)?$/i.exec(text.trim());
  return m ? { text: m[1].trim(), kcal: Number(m[2]) } : { text: text.trim(), kcal: 0 };
}

// Default the input to whichever meal fits the time of day.
function slotForNow() {
  const hr = new Date().getHours();
  return hr < 11 ? 'breakfast' : hr < 15 ? 'lunch' : hr < 18 ? 'snack' : 'dinner';
}

export async function mount({ body: root, meta }) {
  const data = { goal: 2000, days: {}, ...(await load('meals', {})) };
  const persist = () => save('meals', data);
  let viewDate = new Date();
  let slot = slotForNow();

  const dateLabel = h('span', { class: 'meals-date' });
  const slotSel = h('select', { class: 'meals-slot', onchange: () => { slot = slotSel.value; } },
    ...SLOTS.map((s) => h('option', { value: s.key }, `${s.icon} ${s.label}`)));
  const input = h('input', { class: 'input', placeholder: 'what did you eat? (add kcal at the end)' });
  const list = h('div', { class: 'meals-list' });
  const chips = h('div', { class: 'meals-chips' });
  const totalFill = h('i');
  const totalTxt = h('span');

  const shift = (days) => { viewDate = new Date(viewDate.getTime() + days * 864e5); render(); };
  root.append(
    h('div', { class: 'meals-nav' },
      h('button', { class: 'btn', onclick: () => shift(-1) }, '‹'), dateLabel,
      h('button', { class: 'btn', onclick: () => shift(1) }, '›')),
    h('div', { class: 'meals-add' }, slotSel, input),
    chips,
    list,
    h('div', { class: 'meals-total' }, h('div', { class: 'bar' }, totalFill), totalTxt));

  const entries = () => (data.days[dayKey(viewDate)] = data.days[dayKey(viewDate)] || []);

  function add(text, kcal, inSlot = slot) {
    if (!text) return;
    entries().push({ id: uid(), slot: inSlot, text, kcal, at: Date.now() });
    persist();
    emit('meal:add', { text, kcal, slot: inSlot });
    render();
  }

  function recent() {
    const seen = new Map();
    for (const day of Object.keys(data.days).sort().reverse().slice(0, 14)) {
      for (const e of data.days[day]) if (!seen.has(e.text.toLowerCase())) seen.set(e.text.toLowerCase(), e);
    }
    return [...seen.values()].slice(0, 8);
  }

  function render() {
    const isToday = dayKey(viewDate) === dayKey();
    dateLabel.textContent = isToday ? 'Today' : viewDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    slotSel.value = slot;
    const items = entries();
    list.replaceChildren(...SLOTS.map((s) => {
      const rows = items.filter((e) => e.slot === s.key);
      const kcal = rows.reduce((a, e) => a + (e.kcal || 0), 0);
      return h('div', { class: `meals-group${rows.length ? '' : ' empty-slot'}` },
        h('div', { class: 'meals-head' }, h('span', {}, `${s.icon} ${s.label}`), h('small', {}, kcal ? `${kcal} kcal` : rows.length ? '' : '—')),
        ...rows.map((e) => h('div', { class: 'meals-row' },
          h('span', { class: 'meals-text', title: e.text }, e.text),
          e.kcal ? h('small', {}, `${e.kcal}`) : null,
          h('button', { class: 'del', title: 'Remove', onclick: () => {
            data.days[dayKey(viewDate)] = items.filter((x) => x !== e); persist(); render();
          } }, '✕'))));
    }));
    chips.replaceChildren(...recent().map((e) =>
      h('button', { class: 'chip', title: `Add to ${slot}`, onclick: () => add(e.text, e.kcal) }, e.text)));
    const total = items.reduce((a, e) => a + (e.kcal || 0), 0);
    totalFill.style.width = `${Math.min(100, (total / data.goal) * 100)}%`;
    totalFill.style.background = total > data.goal * 1.1 ? 'var(--warn)' : 'var(--ok)';
    totalTxt.textContent = `${total} / ${data.goal} kcal`;
    if (meta) meta.textContent = `${items.length} logged${total ? ` · ${total} kcal` : ''}`;
  }

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !input.value.trim()) return;
    const { text, kcal } = parseEntry(input.value);
    add(text, kcal);
    input.value = '';
  });
  totalTxt.title = 'Double-click to set your daily kcal goal';
  totalTxt.addEventListener('dblclick', async () => {
    const g = Number(await askText('DAILY KCAL GOAL', String(data.goal)));
    if (g > 0) { data.goal = g; persist(); render(); }
  });
  // Follow the calendar past midnight when the user is looking at "today".
  let shownDay = dayKey();
  setInterval(() => {
    if (dayKey() !== shownDay) {
      if (dayKey(viewDate) === shownDay) viewDate = new Date();
      shownDay = dayKey();
      render();
    }
  }, 60000);
  render();
}
