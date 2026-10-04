import { h, load, save } from '../core/util.js';
import { openModal, closeModal } from '../core/modal.js';

// Auto-scrolling image wall. Sources: Pinterest boards (public RSS) and Wallhaven searches (SFW only).
// Hover pauses the scroll; click opens the original pin / wallpaper page in the browser.
const DEFAULT_SOURCES = [
  { type: 'wallhaven', value: 'lofi' },
  { type: 'wallhaven', value: 'anime city night' },
  { type: 'wallhaven', value: 'studio ghibli' },
];
const SPEED_PX_PER_SEC = 18;
const REFRESH_MS = 30 * 60 * 1000;

export async function mount({ body: root, meta, slot }) {
  let sources = await load('imageSources', DEFAULT_SOURCES);
  const track = h('div', { class: 'img-track' });
  const viewport = h('div', { class: 'img-viewport' }, track);
  root.append(viewport);

  async function refresh() {
    if (meta) meta.textContent = 'loading…';
    const { items, failed } = await window.hud.images.fetch(sources);
    if (!items.length) {
      track.replaceChildren(h('div', { class: 'empty' }, failed.length ? `couldn't load: ${failed.join(', ')}` : 'no images: add sources with ⚙'));
      if (meta) meta.textContent = '';
      return;
    }
    // Two copies of the set so the scroll can loop seamlessly.
    const tiles = (list) => list.map((it) => h('figure', { class: 'img-tile', title: it.title || '', onclick: () => it.link && window.hud.openExternal(it.link) },
      h('img', { src: it.src, loading: 'lazy', referrerpolicy: 'no-referrer', alt: '', onerror: (e) => e.target.closest('figure').remove() })));
    track.replaceChildren(h('div', { class: 'img-set' }, ...tiles(items)), h('div', { class: 'img-set' }, ...tiles(items)));
    offset = 0;
    if (meta) meta.textContent = `${items.length} images${failed.length ? ` · ${failed.length} source(s) failed` : ''}`;
  }

  // Smooth vertical auto-scroll, paused on hover or while the window is hidden.
  let offset = 0;
  let last = performance.now();
  let paused = false;
  viewport.addEventListener('mouseenter', () => { paused = true; });
  viewport.addEventListener('mouseleave', () => { paused = false; });
  viewport.addEventListener('wheel', (e) => { offset += e.deltaY * 0.6; e.preventDefault(); }, { passive: false });
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    if (!paused && !document.hidden) offset += SPEED_PX_PER_SEC * dt;
    const set = track.firstElementChild;
    const loop = set ? set.offsetHeight : 0;
    if (loop > 0) {
      offset = ((offset % loop) + loop) % loop;
      track.style.transform = `translateY(${-offset}px)`;
    }
  }
  requestAnimationFrame(frame);

  // Source editor: one per line, "pin: user/board" or "wh: search words".
  function editSources() {
    const text = h('textarea', { class: 'input', rows: 7, spellcheck: 'false' });
    text.value = sources.map((s) => `${s.type === 'pinterest' ? 'pin' : 'wh'}: ${s.value}`).join('\n');
    openModal(h('div', { class: 'dialog' },
      h('h3', {}, 'IMAGE SOURCES'),
      h('div', { class: 'note' }, 'One per line.', h('br'),
        h('b', {}, 'pin: '), 'a Pinterest board URL or user/board (e.g. pin: https://www.pinterest.com/name/lofi-aesthetic/)', h('br'),
        h('b', {}, 'wh: '), 'a Wallhaven search, SFW only (e.g. wh: anime rain)'),
      text,
      h('div', { class: 'foot' },
        h('button', { class: 'btn', onclick: () => { text.value = DEFAULT_SOURCES.map((s) => `wh: ${s.value}`).join('\n'); } }, 'DEFAULTS'),
        h('button', { class: 'btn', onclick: closeModal }, 'CANCEL'),
        h('button', { class: 'btn', onclick: () => {
          sources = text.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
            const m = /^(pin|pinterest|wh|wallhaven)\s*:\s*(.+)$/i.exec(l);
            if (m) return { type: /^p/i.test(m[1]) ? 'pinterest' : 'wallhaven', value: m[2].trim() };
            return { type: /pinterest\./i.test(l) ? 'pinterest' : 'wallhaven', value: l };
          });
          save('imageSources', sources);
          closeModal();
          refresh();
        } }, 'SAVE'))));
  }

  const cfgBtn = slot('config');
  if (cfgBtn) cfgBtn.addEventListener('click', editSources);
  const refreshBtn = slot('refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', refresh);
  refresh();
  setInterval(refresh, REFRESH_MS);
}
