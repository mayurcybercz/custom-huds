import { h, uid, load, save, emit, dayKey, notify, toMin, fromMin } from '../core/util.js';

// Daily schedule / timetable. Blocks repeat daily, on weekdays, weekends, or once.
// Shows what's on now and what's next, lets you tick blocks off, and nudges you
// a few minutes before each block starts.
const REPEATS = { daily: 'every day', weekdays: 'weekdays', weekends: 'weekends', once: 'today only' };
const COLORS = ['var(--accent)', 'var(--accent2)', 'var(--accent3)', 'var(--ok)', 'var(--warn)'];
const REMIND_BEFORE_MIN = 5;

function appliesToday(b, d = new Date()) {
  const dow = d.getDay();
  if (b.repeat === 'weekdays') return dow >= 1 && dow <= 5;
  if (b.repeat === 'weekends') return dow === 0 || dow === 6;
  if (b.repeat === 'once') return b.date === dayKey(d);
  return true;
}

export async function mount({ body: root, meta }) {
  const data = { blocks: [], done: {}, ...(await load('schedule', {})) };
  const persist = () => save('schedule', data);
  const notified = new Set();

  const now = h('div', { class: 'sched-now' });
  const list = h('div', { class: 'sched-list' });
  const startIn = h('input', { class: 'input', type: 'time', value: fromMin(Math.ceil((new Date().getHours() * 60 + new Date().getMinutes()) / 30) * 30) });
  const endIn = h('input', { class: 'input', type: 'time' });
  const titleIn = h('input', { class: 'input', placeholder: 'add block… e.g. deep work' });
  const repeatSel = h('select', {}, ...Object.entries(REPEATS).map(([k, v]) => h('option', { value: k }, v)));
  const form = h('div', { class: 'sched-form' }, startIn, endIn, repeatSel, titleIn);
  root.append(now, list, form);

  startIn.addEventListener('change', () => { if (!endIn.value) endIn.value = fromMin(toMin(startIn.value) + 60); });
  const submit = () => {
    if (!titleIn.value.trim() || !startIn.value) return;
    const end = endIn.value || fromMin(toMin(startIn.value) + 60);
    data.blocks.push({
      id: uid(), start: startIn.value, end, title: titleIn.value.trim(), repeat: repeatSel.value,
      date: repeatSel.value === 'once' ? dayKey() : undefined, color: data.blocks.length % COLORS.length,
    });
    persist();
    titleIn.value = '';
    startIn.value = end;
    endIn.value = '';
    render();
  };
  [titleIn, endIn].forEach((el) => el.addEventListener('keydown', (e) => e.key === 'Enter' && submit()));

  const doneToday = () => (data.done[dayKey()] = data.done[dayKey()] || []);

  function render() {
    const d = new Date();
    const mins = d.getHours() * 60 + d.getMinutes();
    const today = data.blocks.filter((b) => appliesToday(b, d)).sort((a, b) => toMin(a.start) - toMin(b.start));
    const done = doneToday();
    const current = today.find((b) => toMin(b.start) <= mins && mins < toMin(b.end));
    const next = today.find((b) => toMin(b.start) > mins);

    now.replaceChildren(...[
      current
        ? h('div', {}, h('small', {}, 'NOW'), h('b', {}, current.title), h('span', {}, `ends in ${toMin(current.end) - mins} min`))
        : h('div', {}, h('small', {}, 'NOW'), h('b', {}, 'free time ☕')),
      next ? h('div', { class: 'next' }, h('small', {}, 'NEXT'), h('b', {}, next.title), h('span', {}, `${next.start} · in ${toMin(next.start) - mins} min`)) : null,
    ].filter(Boolean));

    list.replaceChildren(...today.map((b) => {
      const s = toMin(b.start), e = toMin(b.end);
      const state = mins >= e ? 'past' : mins >= s ? 'current' : 'future';
      const isDone = done.includes(b.id);
      const pct = state === 'current' ? ((mins - s) / Math.max(1, e - s)) * 100 : state === 'past' ? 100 : 0;
      return h('div', { class: `sched-block ${state}${isDone ? ' done' : ''}`, style: { '--c': COLORS[b.color % COLORS.length] } },
        h('div', { class: 'sched-time' }, b.start, h('small', {}, b.end)),
        h('div', { class: 'sched-body' },
          h('div', { class: 'sched-title' }, b.title),
          h('small', {}, REPEATS[b.repeat]),
          h('div', { class: 'sched-prog' }, h('i', { style: { width: `${pct}%` } }))),
        h('div', { class: 'chk', title: 'Mark done', onclick: () => {
          const list2 = doneToday();
          if (list2.includes(b.id)) list2.splice(list2.indexOf(b.id), 1);
          else { list2.push(b.id); emit('schedule:done', b); }
          persist(); render();
        } }),
        h('button', { class: 'del', title: 'Delete block', onclick: () => {
          if (!confirm(`Delete "${b.title}" (${REPEATS[b.repeat]})?`)) return;
          data.blocks = data.blocks.filter((x) => x !== b); persist(); render();
        } }, '✕'));
    }));
    if (!today.length) list.append(h('div', { class: 'empty' }, 'Nothing planned today. Add a block below.'));
    if (meta) meta.textContent = `${today.filter((b) => done.includes(b.id)).length}/${today.length} done`;
    const cur = list.querySelector('.current') || list.querySelector('.future');
    if (cur && !list.matches(':hover')) cur.scrollIntoView({ block: 'nearest' });

    // Reminders: shortly before a block starts.
    for (const b of today) {
      const key = `${dayKey()}:${b.id}`;
      const until = toMin(b.start) - mins;
      if (until >= 0 && until <= REMIND_BEFORE_MIN && !notified.has(key)) {
        notified.add(key);
        notify(`Up next: ${b.title}`, until ? `Starts at ${b.start} (in ${until} min)` : `Starting now (${b.start}–${b.end})`);
      }
    }
  }

  setInterval(render, 30 * 1000);
  render();
}
