import { h, uid, load, save } from '../core/util.js';
import { askText } from '../core/modal.js';

// Quick launcher: tiles for apps, folders, files and websites.
// Drop shortcuts/files/folders onto the panel to add them, or use "+" for a URL/path.
// Alt+1…9 launches the first nine tiles while the HUD is focused.
const SEED = [
  { name: 'GitHub', target: 'https://github.com' },
  { name: 'YouTube', target: 'https://youtube.com' },
  { name: 'Crunchyroll', target: 'https://www.crunchyroll.com' },
  { name: 'Pinterest', target: 'https://www.pinterest.com' },
];

const isUrl = (t) => /^https?:\/\//i.test(t);
const prettyName = (target) => {
  if (isUrl(target)) return new URL(target).hostname.replace(/^www\./, '').split('.')[0];
  return target.split(/[\\/]/).pop().replace(/\.(lnk|exe|url|bat|cmd)$/i, '') || target;
};

export async function mount({ body: root, meta }) {
  let tiles = await load('launcher', null);
  if (!tiles) tiles = SEED.map((t) => ({ id: uid(), ...t }));
  const persist = () => save('launcher', tiles);

  const grid = h('div', { class: 'launch-grid' });
  const status = h('div', { class: 'launch-status' });
  root.append(grid, status);

  function flash(msg) {
    status.textContent = msg;
    clearTimeout(flash.t);
    flash.t = setTimeout(() => { status.textContent = ''; }, 3000);
  }

  async function open(t) {
    const err = await window.hud.launch.open(t.target);
    flash(err ? `couldn't open ${t.name}: ${err}` : `launched ${t.name}`);
  }

  async function iconFor(t) {
    if (t.icon) return t.icon;
    if (isUrl(t.target)) return `${new URL(t.target).origin}/favicon.ico`;
    const icon = await window.hud.launch.icon(t.target);
    if (icon) { t.icon = icon; persist(); }
    return icon;
  }

  async function render() {
    grid.replaceChildren(...tiles.map((t, i) => {
      const img = h('img', { alt: '', draggable: 'false' });
      const fallback = h('span', { class: 'launch-letter' }, t.name.slice(0, 1).toUpperCase());
      img.addEventListener('error', () => img.replaceWith(fallback));
      iconFor(t).then((src) => { if (src) img.src = src; else img.replaceWith(fallback); });
      return h('button', {
        class: 'launch-tile', title: `${t.target}${i < 9 ? `  (Alt+${i + 1})` : ''}\nright-click to rename / remove`,
        onclick: () => open(t),
        oncontextmenu: async (e) => {
          e.preventDefault();
          const name = await askText(`RENAME (empty = remove "${t.name}")`, t.name);
          if (name === null) return;
          if (!name.trim()) tiles = tiles.filter((x) => x !== t);
          else t.name = name.trim();
          persist(); render();
        },
      }, h('div', { class: 'launch-icon' }, img), h('span', { class: 'launch-name' }, t.name), i < 9 ? h('kbd', {}, String(i + 1)) : null);
    }), h('button', { class: 'launch-tile add', title: 'Add a website or path', onclick: addManual }, h('div', { class: 'launch-icon' }, '+'), h('span', { class: 'launch-name' }, 'add')));
    if (meta) meta.textContent = 'drop apps & folders here';
  }

  async function addManual() {
    const target = await askText('URL, FOLDER OR APP PATH', 'https://');
    if (!target || !target.trim() || target.trim() === 'https://') return;
    const name = await askText('NAME', prettyName(target.trim()));
    tiles.push({ id: uid(), name: (name || prettyName(target)).trim(), target: target.trim() });
    persist(); render();
  }

  // Drag & drop files, folders, shortcuts and links.
  root.addEventListener('dragover', (e) => { e.preventDefault(); root.classList.add('drop'); });
  root.addEventListener('dragleave', () => root.classList.remove('drop'));
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    root.classList.remove('drop');
    const files = [...e.dataTransfer.files];
    for (const f of files) {
      const path = window.hud.pathForFile(f);
      if (path) tiles.push({ id: uid(), name: prettyName(path), target: path });
    }
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (!files.length && isUrl(url || '')) tiles.push({ id: uid(), name: prettyName(url.trim()), target: url.trim() });
    persist(); render();
  });

  addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || !/^Digit[1-9]$/.test(e.code)) return;
    const t = tiles[Number(e.code.slice(5)) - 1];
    if (t) { e.preventDefault(); open(t); }
  });

  persist();
  render();
}
