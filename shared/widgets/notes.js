import { h, uid, load, save, sanitizeMarkdown } from '../core/util.js';

// Scratchpad notes: several notes as tabs, autosaved, with a markdown preview toggle.
export async function mount({ body: root, meta }) {
  let notes = await load('notes', null);
  if (!notes || !notes.length) notes = [{ id: uid(), title: 'scratch', text: '', updated: Date.now() }];
  let activeId = notes[0].id;
  let preview = false;
  let saveTimer = 0;
  const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => save('notes', notes), 400); };

  const tabs = h('div', { class: 'notes-tabs' });
  const area = h('textarea', { class: 'notes-area', spellcheck: 'false', placeholder: 'type anything… (markdown works, ⇄ to preview)' });
  const view = h('div', { class: 'notes-view md' });
  const previewBtn = h('button', { class: 'btn', title: 'Toggle markdown preview', onclick: () => { preview = !preview; render(); } }, '⇄');
  root.append(h('div', { class: 'notes-bar' }, tabs, previewBtn), area, view);

  const active = () => notes.find((n) => n.id === activeId) || notes[0];

  function render() {
    const n = active();
    tabs.replaceChildren(...notes.map((x) => h('button', {
      class: `notes-tab${x.id === n.id ? ' on' : ''}`,
      title: 'Double-click to rename · middle-click to delete',
      onclick: () => { activeId = x.id; render(); },
      ondblclick: () => {
        // Rename inline (Electron has no prompt()).
        const input = h('input', { class: 'input notes-rename', value: x.title });
        const done = () => { x.title = input.value.trim() || x.title; persist(); render(); };
        input.addEventListener('blur', done);
        input.addEventListener('keydown', (e) => e.key === 'Enter' && input.blur());
        tabs.querySelector('.on').replaceWith(input);
        input.select();
      },
      onauxclick: (e) => {
        if (e.button !== 1 || notes.length < 2 || !confirm(`Delete note "${x.title}"?`)) return;
        notes = notes.filter((y) => y !== x);
        activeId = notes[0].id;
        persist(); render();
      },
    }, x.title)), h('button', { class: 'notes-tab add', title: 'New note', onclick: () => {
      const n2 = { id: uid(), title: `note ${notes.length + 1}`, text: '', updated: Date.now() };
      notes.push(n2); activeId = n2.id; persist(); render(); area.focus();
    } }, '+'));
    if (document.activeElement !== area) area.value = n.text;
    area.hidden = preview;
    view.hidden = !preview;
    if (preview) view.innerHTML = sanitizeMarkdown(n.text || '*empty*');
    previewBtn.classList.toggle('on', preview);
    if (meta) meta.textContent = `${n.text.length} chars`;
  }

  area.addEventListener('input', () => {
    const n = active();
    n.text = area.value;
    n.updated = Date.now();
    if (meta) meta.textContent = `${n.text.length} chars`;
    persist();
  });
  // Tab inserts two spaces instead of leaving the textarea.
  area.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    area.setRangeText('  ', area.selectionStart, area.selectionEnd, 'end');
    area.dispatchEvent(new Event('input'));
  });
  render();
}
