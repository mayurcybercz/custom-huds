// v2 "lo-fi": cozy anime / lo-fi skin. Shared widgets + a skin-specific hero (clock, greeting, daily rings),
// an animated time-of-day city backdrop, and a drop-down terminal.
import { bootHud } from '../../../shared/core/hud.js';
import { widgets } from '../../../shared/widgets/index.js';
import { load, save } from '../../../shared/core/util.js';
import { startScene } from './scene.js';
import * as ambience from '../../../shared/core/ambience.js';
import { mount as hero } from './hero.js';

const SCENE_MODES = [['petals', '✿', 'sakura petals'], ['rain', '☂', 'rain'], ['clear', '☾', 'clear sky']];
const VOLUMES = [[0.6, '🔊', 'on'], [0.25, '🔉', 'quiet'], [0, '🔇', 'off']];

document.querySelectorAll('.panel').forEach((p, i) => p.style.setProperty('--i', i));

// Backdrop + weather. Weather changes the scene lighting, the card glass tint and the ambience.
let modeIdx = 0;
const scene = startScene(document.getElementById('scene'), SCENE_MODES[modeIdx][0], {
  glass: document.getElementById('glass'),
  onStrike: (distance) => setTimeout(() => ambience.thunder(distance), 500 + distance * 2800), // sound travels slower than light
  onRainLevel: (level) => ambience.setRainLevel(level),
});
window.hudScene = scene; // handy from DevTools: hudScene.lightning()
const sceneBtn = document.getElementById('btn-scene');
function applyMode() {
  const [mode, icon, label] = SCENE_MODES[modeIdx];
  scene.setMode(mode);
  document.body.dataset.weather = mode;
  sceneBtn.textContent = icon;
  sceneBtn.title = `Weather: ${label} (click to change)`;
  if (mode === 'rain') ambience.startRain(scene.rainLevel);
  else ambience.stopRain();
}
sceneBtn.addEventListener('click', () => {
  modeIdx = (modeIdx + 1) % SCENE_MODES.length;
  save('v2scene', SCENE_MODES[modeIdx][0]);
  applyMode();
});

// Ambient sound volume: on → quiet → off.
let volIdx = 0;
const soundBtn = document.getElementById('btn-sound');
function applyVolume() {
  const [v, icon, label] = VOLUMES[volIdx];
  ambience.setVolume(v);
  soundBtn.textContent = icon;
  soundBtn.title = `Ambient sound: ${label} (click to change)`;
}
soundBtn.addEventListener('click', () => {
  volIdx = (volIdx + 1) % VOLUMES.length;
  save('v2sound', volIdx);
  applyVolume();
});

Promise.all([load('v2scene', 'petals'), load('v2sound', 0)]).then(([savedMode, savedVol]) => {
  modeIdx = Math.max(0, SCENE_MODES.findIndex(([m]) => m === savedMode));
  volIdx = Math.min(VOLUMES.length - 1, Math.max(0, Number(savedVol) || 0));
  applyVolume();
  applyMode();
});

// Drop-down terminal: Ctrl + ` or the ⌨ button.
const quake = document.getElementById('quake');
function toggleQuake(force) {
  const open = quake.classList.toggle('open', force);
  if (open) setTimeout(() => quake.querySelector('.xterm-helper-textarea')?.focus(), 250);
}
document.getElementById('btn-term').addEventListener('click', () => toggleQuake());
addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.code === 'Backquote') { e.preventDefault(); toggleQuake(); }
  else if (e.key === 'Escape' && quake.classList.contains('open')) toggleQuake(false);
}, true);

bootHud({ ...widgets, hero });
