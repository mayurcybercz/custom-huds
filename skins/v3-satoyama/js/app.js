// v3 "Satoyama": a living Japanese village as the desktop, with a quiet one-colour HUD at the edges.
import { bootHud } from '../../../shared/core/hud.js';
import { widgets } from '../../../shared/widgets/index.js';
import { h, load, save } from '../../../shared/core/util.js';
import * as ambience from '../../../shared/core/ambience.js';
import { createRenderer } from './engine/render.js';
import { phaseName } from './engine/env.js';
import { createDirector, MODES } from './director.js';
import { createPointer } from './pointer.js';
import { createSoundscape, loadRecordings } from './soundscape.js';

const HUD_COLOURS = [['238 231 214', 'washi'], ['255 200 216', 'sakura'], ['200 228 176', 'matcha'], ['255 212 150', 'lantern'], ['190 214 255', 'sora']];
const VOLUMES = [[0.5, '🔊', 'on'], [0.22, '🔉', 'quiet'], [0, '🔇', 'off']];

const prefs = { mode: 'auto', colour: 0, volume: 0, hidden: false, ...(await load('v3prefs', {})) };
const savePrefs = () => save('v3prefs', prefs);

// ---------------------------------------------------------------- scene, sound, time
const canvasEl = document.getElementById('scene');
const director = createDirector(prefs.mode);
director.setMode(prefs.mode);
const pointer = createPointer(canvasEl);
let renderer = null;
const soundscape = createSoundscape(() => renderer && renderer.taikoHit());
renderer = createRenderer(canvasEl, { sound: (name, opts) => soundscape.event(name, opts) });
window.satoyama = { director, renderer }; // handy from DevTools

ambience.setVolume(VOLUMES[prefs.volume][0]);
loadRecordings();

// 30 fps while you're interacting, 20 fps as a backdrop, 15 fps after a minute without input (saves CPU).
let last = performance.now(), lastDraw = 0, lastInput = 0;
addEventListener('pointermove', () => { lastInput = performance.now(); });
addEventListener('keydown', () => { lastInput = performance.now(); });
function loop(now) {
  requestAnimationFrame(loop);
  const idle = now - lastInput;
  const frameMs = idle < 4000 ? 33 : idle < 60000 ? 50 : 66;
  if (document.hidden || now - lastDraw < frameMs) return;
  lastDraw = now;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const events = director.update(dt);
  if (events.bell) renderer.ringBell(now);
  pointer.beginFrame(director.state.camX);
  const { env } = renderer.frame(director.state, pointer.p, dt, now);
  pointer.endFrame();
  soundscape.update(director.state, env, dt, now);
}
requestAnimationFrame(loop);

// ---------------------------------------------------------------- caption + clock widget
const caption = document.getElementById('caption');
function updateCaption() {
  const s = director.state, hh = Math.floor(s.hour), mm = Math.floor((s.hour % 1) * 60);
  const [jp, en] = phaseName(s.hour);
  caption.replaceChildren(h('b', {}, jp), `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${en} · ${s.sceneName}`);
}
setInterval(updateCaption, 500);
updateCaption();

function vclock({ body }) {
  const time = h('div', { class: 'vc-time' }), date = h('div', { class: 'vc-date' }), greet = h('div', { class: 'vc-greet' });
  body.append(time, date, greet);
  const tick = () => {
    const d = new Date();
    time.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    date.textContent = `${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · ${d.toLocaleDateString('ja-JP', { weekday: 'short' })}`;
    const hr = d.getHours();
    greet.textContent = hr < 5 ? 'お休みなさい · rest well' : hr < 11 ? 'おはよう · good morning' : hr < 17 ? 'こんにちは · good afternoon' : 'こんばんは · good evening';
  };
  tick();
  setInterval(tick, 1000);
}

// ---------------------------------------------------------------- dock: modes, sheets, sound, colour, hide
const modeBtn = document.getElementById('btn-mode'), modeLabel = document.getElementById('mode-label'), menu = document.getElementById('modes');
function renderModes() {
  const cur = MODES.find((m) => m.id === director.state.mode);
  modeLabel.textContent = cur.label;
  modeBtn.firstChild.textContent = `${cur.icon} `;
  menu.replaceChildren(...MODES.map((m) => h('button', {
    class: m.id === director.state.mode ? 'on' : '',
    onclick: () => { director.setMode(m.id); prefs.mode = m.id; savePrefs(); menu.hidden = true; renderModes(); updateCaption(); },
  }, h('span', {}, m.icon), m.label, m.hint ? h('small', {}, m.hint) : null)));
  document.getElementById('btn-next').hidden = director.state.mode !== 'auto';
}
modeBtn.addEventListener('click', () => { menu.hidden = !menu.hidden; });
document.getElementById('btn-next').addEventListener('click', () => { director.nextScene(); updateCaption(); });
renderModes();

const sheet = document.getElementById('sheet'), sheetTitle = document.getElementById('sheet-title');
const SHEET_TITLES = { research: 'research', notes: 'notes', meals: 'meals', projects: 'projects', launcher: 'launcher', anime: 'anime', pet: 'companion' };
function openSheet(name) {
  if (!sheet.hidden && sheet.dataset.open === name) { sheet.hidden = true; return; }
  sheet.hidden = false;
  sheet.dataset.open = name;
  sheetTitle.textContent = SHEET_TITLES[name];
  document.querySelectorAll('#sheet .pane').forEach((p) => { p.hidden = p.dataset.pane !== name; });
  document.querySelectorAll('#dock [data-sheet]').forEach((b) => b.classList.toggle('on', b.dataset.sheet === name));
  const input = sheet.querySelector(`.pane[data-pane="${name}"] input, .pane[data-pane="${name}"] textarea`);
  if (input) setTimeout(() => input.focus(), 50);
}
function closeSheet() { sheet.hidden = true; document.querySelectorAll('#dock [data-sheet]').forEach((b) => b.classList.remove('on')); }
document.querySelectorAll('#dock [data-sheet]').forEach((b) => b.addEventListener('click', () => openSheet(b.dataset.sheet)));
document.getElementById('sheet-close').addEventListener('click', closeSheet);
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

const soundBtn = document.getElementById('btn-sound');
function applyVolume() {
  const [v, icon, label] = VOLUMES[prefs.volume];
  ambience.setVolume(v);
  soundscape.setEnabled(v > 0);
  soundBtn.textContent = icon;
  soundBtn.title = `Ambient sound: ${label} (M)`;
}
soundBtn.addEventListener('click', () => { prefs.volume = (prefs.volume + 1) % VOLUMES.length; savePrefs(); applyVolume(); });
applyVolume();

function applyColour() {
  const [rgbv, name] = HUD_COLOURS[prefs.colour % HUD_COLOURS.length];
  document.documentElement.style.setProperty('--hud', rgbv);
  document.getElementById('btn-color').title = `HUD colour: ${name}`;
}
document.getElementById('btn-color').addEventListener('click', () => { prefs.colour = (prefs.colour + 1) % HUD_COLOURS.length; savePrefs(); applyColour(); });
applyColour();

function applyHidden() { document.body.classList.toggle('hud-hidden', prefs.hidden); }
document.getElementById('btn-hide').addEventListener('click', () => { prefs.hidden = !prefs.hidden; savePrefs(); applyHidden(); });
applyHidden();

// rails and dock brighten while you're moving the mouse, then fade back so the village shows
let awakeTimer = 0;
addEventListener('pointermove', () => {
  document.body.classList.add('awake');
  clearTimeout(awakeTimer);
  awakeTimer = setTimeout(() => document.body.classList.remove('awake'), 3500);
});

// drop-down terminal
const quake = document.getElementById('quake');
function toggleQuake(force) {
  const open = quake.classList.toggle('open', force);
  if (open) setTimeout(() => quake.querySelector('.xterm-helper-textarea')?.focus(), 250);
}
document.getElementById('btn-term').addEventListener('click', () => toggleQuake());

// keyboard: H hide HUD, N next scene, M sound, Ctrl+` terminal, Esc closes things
addEventListener('keydown', (e) => {
  const typing = e.target.closest && e.target.closest('input, textarea, select, .xterm');
  if (e.ctrlKey && e.code === 'Backquote') { e.preventDefault(); toggleQuake(); return; }
  if (e.key === 'Escape') { if (quake.classList.contains('open')) toggleQuake(false); else if (!menu.hidden) menu.hidden = true; else if (!sheet.hidden) closeSheet(); return; }
  if (typing || e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.key === 'h' || e.key === 'H') { prefs.hidden = !prefs.hidden; savePrefs(); applyHidden(); }
  if (e.key === 'n' || e.key === 'N') { director.nextScene(); updateCaption(); }
  if (e.key === 'm' || e.key === 'M') { prefs.volume = prefs.volume === 2 ? 0 : 2; savePrefs(); applyVolume(); }
}, true);

bootHud({ ...widgets, vclock });
