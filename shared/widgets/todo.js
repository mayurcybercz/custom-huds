import { h, uid, load, save, emit } from '../core/util.js';

const PRI = [
  { key: 'lo', label: 'LO', color: 'var(--dim)' },
  { key: 'md', label: 'MD', color: 'var(--accent)' },
  { key: 'hi', label: 'HI', color: 'var(--warn)' },
  { key: 'xx', label: '!!', color: 'var(--danger)' },
];
const priIndex = (k) => Math.max(0, PRI.findIndex((p) => p.key === k));

export async function mount({ body: root, meta }) {
  let todos = await load('todos', []);
  const input = h('input', { class: 'input', placeholder: '> new task… (enter)  ·  prefix ! for high priority' });
  const list = h('div', { class: 'list' });
  root.append(input, list);

  const persist = () => save('todos', todos);

  function render() {
    // Open tasks first (by priority), then done ones (most recent first).
    const sorted = [...todos].sort((a, b) =>
      (a.done - b.done) || (a.done ? b.doneAt - a.doneAt : priIndex(b.pri) - priIndex(a.pri) || a.created - b.created));
    list.replaceChildren(...sorted.map((t) => {
      const p = PRI[priIndex(t.pri)];
      const row = h('div', { class: `todo-item${t.done ? ' done' : ''}`, style: { '--p': p.color } },
        h('div', { class: 'chk', title: 'Toggle done', onclick: () => toggle(t, row) }),
        h('div', { class: 'txt', title: t.text }, t.text),
        h('span', { class: 'pri', title: 'Click to change priority', onclick: () => cyclePri(t) }, p.label),
        h('button', { class: 'del', title: 'Delete', onclick: () => remove(t) }, '✕'));
      return row;
    }));
    if (!todos.length) list.append(h('div', { class: 'empty' }, 'No tasks. Type above and hit ', h('b', {}, 'ENTER'), '.'));
    const open = todos.filter((t) => !t.done).length;
    if (meta) meta.textContent = `${open} open · ${todos.length - open} done`;
  }

  function toggle(t, row) {
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : 0;
    if (t.done) {
      row.classList.add('zap');
      emit('todo:done', t);
    }
    persist();
    setTimeout(render, t.done ? 350 : 0);
  }
  function cyclePri(t) {
    t.pri = PRI[(priIndex(t.pri) + 1) % PRI.length].key;
    persist(); render();
  }
  function remove(t) {
    todos = todos.filter((x) => x !== t);
    persist(); render();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    let text = input.value.trim();
    if (!text) return;
    let pri = 'md';
    if (text.startsWith('!!')) { pri = 'xx'; text = text.slice(2).trim(); }
    else if (text.startsWith('!')) { pri = 'hi'; text = text.slice(1).trim(); }
    todos.push({ id: uid(), text, pri, done: false, created: Date.now(), doneAt: 0 });
    input.value = '';
    persist(); render();
  });
  render();
}
