import { h, timeAgo, emit } from '../core/util.js';

// Brand-ish colours per source; skins can restyle .feed-item .src if they clash.
const SRC_COLORS = { HN: '#ff6600', VERGE: '#ff2bd6', TC: '#2ecc71', ARS: '#ff3860', MIT: '#ffb000', ANN: '#00a8e8', CR: '#f47521', MAL: '#7c8cff' };
const REFRESH_MS = 15 * 60 * 1000;

function newsList(items) {
  return h('div', { class: 'feed' }, ...items.map((it) =>
    h('div', { class: 'feed-item', title: it.title, style: { '--c': SRC_COLORS[it.source] || 'var(--accent)' }, onclick: () => window.nexus.openExternal(it.link) },
      h('span', { class: 'src' }, it.source),
      h('span', { class: 't' }, it.title),
      h('span', { class: 'ago' }, timeAgo(it.date)))));
}

function failNote(failed) {
  return failed && failed.length ? h('div', { class: 'empty' }, `unreachable: ${failed.join(', ')}`) : '';
}

// AI / tech news. Emits 'tech:headlines' so skins can build tickers etc.
export function tech({ body: root, meta: metaSlot, slot }) {
  const meta = metaSlot || document.createElement('span');
  async function refresh() {
    meta.innerHTML = '<span class="spinner"></span>';
    try {
      const { items, failed } = await window.nexus.feeds.tech();
      root.replaceChildren(newsList(items), failNote(failed));
      meta.textContent = `${items.length} items · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      emit('tech:headlines', items);
    } catch (e) {
      root.replaceChildren(h('div', { class: 'empty' }, `feed error: ${e.message}`));
      meta.textContent = 'offline';
    }
  }
  const refreshBtn = slot('refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', refresh);
  refresh();
  setInterval(refresh, REFRESH_MS);
}

// Anime: AniList airing schedule + news, switched by a [data-slot=tabs] button group.
export function anime({ body: root, slot }) {
  const tabs = slot('tabs');
  let tab = 'airing';

  function airingList(list) {
    const now = Date.now();
    if (!list.length) return h('div', { class: 'empty' }, 'nothing popular airing in this window');
    return h('div', {}, ...list.map((a) => {
      const diff = a.at - now;
      const live = diff <= 0;
      const when = live ? `aired ${timeAgo(a.at)} ago`
        : diff < 3600e3 ? `in ${Math.ceil(diff / 60e3)}m`
        : new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return h('div', { class: 'air-item', style: { '--c': a.color || 'var(--line)' } },
        h('img', { src: a.cover, alt: '', loading: 'lazy' }),
        h('div', { class: 't', title: a.title, onclick: () => window.nexus.openExternal(a.url) }, a.title, h('small', {}, `EPISODE ${a.episode}`)),
        h('div', { class: `when${live ? ' live' : ''}` }, when,
          a.crunchyroll ? h('div', {}, h('span', { class: 'badge cr', title: 'Watch on Crunchyroll', onclick: () => window.nexus.openExternal(a.crunchyroll) }, 'CR ▶')) : null));
    }));
  }

  async function refresh() {
    root.replaceChildren(h('div', { class: 'empty' }, h('span', { class: 'spinner' }), ' syncing…'));
    try {
      if (tab === 'airing') {
        root.replaceChildren(airingList(await window.nexus.feeds.airing()));
      } else {
        const { items, failed } = await window.nexus.feeds.anime();
        root.replaceChildren(newsList(items), failNote(failed));
      }
    } catch (e) {
      root.replaceChildren(h('div', { class: 'empty' }, `feed error: ${e.message}`));
    }
  }
  if (tabs) tabs.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    tab = b.dataset.tab;
    tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    refresh();
  });
  const refreshBtn = slot('refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', refresh);
  refresh();
  setInterval(refresh, REFRESH_MS);
}
