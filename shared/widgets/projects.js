import { h, uid, load, save, emit } from '../core/util.js';

const STATUS = {
  active: { label: 'ACTIVE', color: 'var(--accent)' },
  paused: { label: 'PAUSED', color: 'var(--warn)' },
  blocked: { label: 'BLOCKED', color: 'var(--danger)' },
  done: { label: 'SHIPPED', color: 'var(--ok)' },
};

export async function mount({ body: root, meta, opts = {} }) {
  let projects = await load('projects', []);
  const openIds = new Set();
  const input = h('input', { class: 'input', placeholder: opts.placeholder || '> new project… (enter)' });
  const list = h('div', { class: 'list' });
  root.append(input, list);
  const persist = () => save('projects', projects);

  function render() {
    const order = { active: 0, blocked: 1, paused: 2, done: 3 };
    const sorted = [...projects].sort((a, b) => order[a.status] - order[b.status] || b.updated - a.updated);
    list.replaceChildren(...sorted.map(card));
    if (!projects.length) list.append(h('div', { class: 'empty' }, 'Track a project: type a name and hit ', h('b', {}, 'ENTER'), '.'));
    const active = projects.filter((p) => p.status === 'active').length;
    if (meta) meta.textContent = `${active} active`;
  }

  function card(p) {
    const st = STATUS[p.status];
    const fill = h('i', { style: { width: `${p.progress}%` } });
    const pct = h('span', { class: 'pct' }, `${p.progress}%`);
    const update = (patch) => {
      const wasDone = p.status === 'done';
      Object.assign(p, patch, { updated: Date.now() });
      if (!wasDone && p.status === 'done') emit('project:done', p);
      persist();
    };
    const range = h('input', {
      type: 'range', min: 0, max: 100, step: 5, value: p.progress,
      oninput: (e) => { fill.style.width = `${e.target.value}%`; pct.textContent = `${e.target.value}%`; },
      onchange: (e) => update({ progress: Number(e.target.value), status: Number(e.target.value) === 100 ? 'done' : p.status }) || render(),
    });
    const status = h('select', { onchange: (e) => { update({ status: e.target.value }); render(); } },
      ...Object.entries(STATUS).map(([k, v]) => h('option', { value: k, selected: k === p.status }, v.label)));
    const notes = h('textarea', { class: 'input', placeholder: 'notes / next step…', onchange: (e) => update({ notes: e.target.value }) });
    notes.value = p.notes || '';
    const link = h('input', { class: 'input', placeholder: 'link (https://…)', value: p.link || '', onchange: (e) => update({ link: e.target.value.trim() }) });

    const el = h('div', { class: `proj${openIds.has(p.id) ? ' open' : ''}`, style: { '--c': st.color } },
      h('div', { class: 'top', onclick: () => { openIds.has(p.id) ? openIds.delete(p.id) : openIds.add(p.id); el.classList.toggle('open'); } },
        h('span', { class: 'badge', style: { color: st.color } }, st.label),
        h('span', { class: 'name', title: p.name }, p.name),
        pct,
        h('button', { class: 'del', title: 'Delete project', onclick: (e) => { e.stopPropagation(); if (confirm(`Delete project "${p.name}"?`)) { projects = projects.filter((x) => x !== p); persist(); render(); } } }, '✕')),
      h('div', { class: 'bar seg', style: { '--c': st.color } }, fill),
      h('div', { class: 'detail', onclick: (e) => e.stopPropagation() },
        h('div', { class: 'rowx' }, range, status),
        notes,
        h('div', { class: 'rowx' }, link,
          h('button', { class: 'btn', title: 'Open link', onclick: () => p.link && window.hud.openExternal(p.link) }, '↗'))));
    return el;
  }

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !input.value.trim()) return;
    const p = { id: uid(), name: input.value.trim(), status: 'active', progress: 0, notes: '', link: '', created: Date.now(), updated: Date.now() };
    projects.push(p);
    openIds.add(p.id);
    input.value = '';
    persist(); render();
  });
  render();
}
