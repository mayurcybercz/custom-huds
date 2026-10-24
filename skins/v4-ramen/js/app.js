// v4 "Ramen": one scene, no widgets. The dock only holds sound, a storm button and the window controls.
import { bootHud } from '../../../shared/core/hud.js';
import { load, save } from '../../../shared/core/util.js';
import * as ambience from '../../../shared/core/ambience.js';
import { createScene } from './scene.js';

const VOLUMES = [[0, '🔇', 'off'], [0.22, '🔉', 'quiet'], [0.5, '🔊', 'on']];
const prefs = { volume: 2, hidden: false, ...(await load('v4prefs', {})) };
const savePrefs = () => save('v4prefs', prefs);

bootHud({}); // no widgets; wires the window controls and the settings dialog

let soundOn = false;
const scene = await createScene(document.getElementById('scene'), {
  thunder: (distance) => { if (soundOn) ambience.thunder(distance); },
});

// 30 fps while you're interacting, 20 fps as a backdrop, 15 fps after a minute without input.
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
  scene.frame(dt);
}
requestAnimationFrame(loop);

// the rain's sound follows the rain you can see
setInterval(() => { if (soundOn) ambience.setRainLevel(0.35 + scene.intensity * 0.65); }, 2000);

const soundBtn = document.getElementById('btn-sound');
function applyVolume() {
  const [v, icon, label] = VOLUMES[prefs.volume];
  ambience.setVolume(v);
  soundOn = v > 0;
  if (soundOn) ambience.startRain(0.35 + scene.intensity * 0.65); else ambience.stopRain();
  soundBtn.textContent = icon;
  soundBtn.title = `Ambient sound: ${label} (M)`;
}
const cycleSound = () => { prefs.volume = (prefs.volume + 1) % VOLUMES.length; savePrefs(); applyVolume(); };
soundBtn.addEventListener('click', cycleSound);
applyVolume();

document.getElementById('btn-bolt').addEventListener('click', () => scene.lightning());

const applyHidden = () => document.body.classList.toggle('hud-hidden', prefs.hidden);
const toggleHidden = () => { prefs.hidden = !prefs.hidden; savePrefs(); applyHidden(); };
document.getElementById('btn-hide').addEventListener('click', toggleHidden);
applyHidden();

addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea, select')) return;
  if (e.key === 'm' || e.key === 'M') cycleSound();
  else if (e.key === 'h' || e.key === 'H') toggleHidden();
});

// the dock fades in while the mouse moves, then away again so only the stall is left
let awakeTimer = 0;
addEventListener('pointermove', () => {
  document.body.classList.add('awake');
  clearTimeout(awakeTimer);
  awakeTimer = setTimeout(() => document.body.classList.remove('awake'), 3500);
});
