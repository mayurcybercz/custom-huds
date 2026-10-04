import { h, fmtDuration } from '../core/util.js';

// Now-playing for the active Windows media session (Spotify app, Crunchyroll/YouTube tab, ...).
const APP_NAMES = [[/spotify/i, 'SPOTIFY'], [/chrome/i, 'CHROME'], [/msedge|edge/i, 'EDGE'], [/firefox/i, 'FIREFOX'], [/vlc/i, 'VLC']];
const IDLE_HINT = 'start something in Spotify or a browser tab';

export function mount({ body: root, meta }) {
  const setMeta = (t) => { if (meta) meta.textContent = t; };
  const art = h('div', { class: 'm-art idle' }, '♪');
  const title = h('div', { class: 'm-title' }, 'NO SIGNAL');
  const artist = h('div', { class: 'm-artist' }, IDLE_HINT);
  const viz = h('div', { class: 'm-viz' }, ...Array.from({ length: 40 }, () => h('i')));
  const fill = h('i');
  const tNow = h('span'), tEnd = h('span');
  const playBtn = h('button', { class: 'btn play', title: 'Play / pause', onclick: () => window.nexus.media.cmd('play') }, '▶');
  root.append(art, h('div', { class: 'm-info' },
    title, artist, viz,
    h('div', { class: 'bar' }, fill),
    h('div', { class: 'm-time' }, tNow, tEnd),
    h('div', { class: 'm-ctrl' },
      h('button', { class: 'btn', title: 'Previous', onclick: () => window.nexus.media.cmd('prev') }, '⏮'),
      playBtn,
      h('button', { class: 'btn', title: 'Next', onclick: () => window.nexus.media.cmd('next') }, '⏭'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn launch', title: 'Open Spotify', onclick: () => window.nexus.openExternal('https://open.spotify.com') }, 'SPOTIFY ↗'),
      h('button', { class: 'btn launch', title: 'Open Crunchyroll', onclick: () => window.nexus.openExternal('https://www.crunchyroll.com') }, 'CRUNCHYROLL ↗'))));

  let state = { active: false };
  let shownThumb = null;

  window.nexus.media.onState((s) => {
    state = s;
    if (!s.active) {
      title.textContent = 'NO SIGNAL';
      artist.textContent = IDLE_HINT;
      art.className = 'm-art idle'; art.textContent = '♪'; art.style.backgroundImage = ''; shownThumb = null;
      setMeta('');
      return;
    }
    title.textContent = s.title || 'Unknown';
    title.title = s.title || '';
    artist.textContent = [s.artist, s.album].filter(Boolean).join(' / ') || '-';
    const known = APP_NAMES.find(([re]) => re.test(s.app));
    const app = known ? known[1] : (s.app || '').split(/[.!]/)[0].toUpperCase();
    setMeta(`${app} · ${s.status.toUpperCase()}`);
    playBtn.textContent = s.status === 'Playing' ? '❚❚' : '▶';
    if (s.thumb && s.thumb !== shownThumb) {
      shownThumb = s.thumb;
      art.className = 'm-art'; art.textContent = '';
      art.style.backgroundImage = `url("${s.thumb}")`;
    }
  });

  // Interpolate position between polls and animate the (decorative) visualizer.
  let t = 0;
  setInterval(() => {
    t += 1;
    const playing = state.active && state.status === 'Playing';
    let pos = state.position || 0;
    if (playing && state.updated) pos += (Date.now() - state.updated) / 1000;
    if (state.duration) pos = Math.min(pos, state.duration);
    fill.style.width = state.duration ? `${(pos / state.duration) * 100}%` : '0%';
    tNow.textContent = state.active ? fmtDuration(pos) : '';
    tEnd.textContent = state.active && state.duration ? fmtDuration(state.duration) : '';
    for (let i = 0; i < viz.children.length; i++) {
      const v = playing
        ? 15 + 70 * Math.abs(Math.sin(t * 0.35 + i * 0.6) * Math.cos(t * 0.13 + i * 0.25)) + Math.random() * 15
        : 4;
      viz.children[i].style.height = `${v}%`;
    }
  }, 120);

  window.nexus.media.start();
}
