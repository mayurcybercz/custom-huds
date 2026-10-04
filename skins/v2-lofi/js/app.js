// v2 "lo-fi": cozy anime / lo-fi skin. Shared widgets + a skin-specific hero (clock, greeting, daily rings),
// an animated time-of-day city backdrop, and a drop-down terminal.
import { bootHud } from '../../../shared/core/hud.js';
import { widgets } from '../../../shared/widgets/index.js';
import { load, save } from '../../../shared/core/util.js';
import { startScene } from './scene.js';
import { mount as hero } from './hero.js';

const SCENE_MODES = [['petals', '✿', 'sakura petals'], ['rain', '☂', 'rain'], ['clear', '☾', 'clear sky']];

document.querySelectorAll('.panel').forEach((p, i) => p.style.setProperty('--i', i));

// Backdrop + weather toggle.
let modeIdx = Math.max(0, SCENE_MODES.findIndex(([m]) => m === 'petals'));
const scene = startScene(document.getElementById('scene'), SCENE_MODES[modeIdx][0]);
const sceneBtn = document.getElementById('btn-scene');
const showMode = () => {
  const [, icon, label] = SCENE_MODES[modeIdx];
  sceneBtn.textContent = icon;
  sceneBtn.title = `Weather: ${label} (click to change)`;
};
load('v2scene', 'petals').then((saved) => {
  modeIdx = Math.max(0, SCENE_MODES.findIndex(([m]) => m === saved));
  scene.setMode(SCENE_MODES[modeIdx][0]);
  showMode();
});
sceneBtn.addEventListener('click', () => {
  modeIdx = (modeIdx + 1) % SCENE_MODES.length;
  scene.setMode(SCENE_MODES[modeIdx][0]);
  save('v2scene', SCENE_MODES[modeIdx][0]);
  showMode();
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
