// Tiny JSON-file store in the app's userData folder. Writes are debounced.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const file = path.join(app.getPath('userData'), 'data.json');

// One-time migration from before the project was renamed (NEXUS//HUD -> Custom HUDs).
// The old folder is left in place as a backup.
const legacyDir = path.join(app.getPath('appData'), 'nexus-hud');
if (!fs.existsSync(file) && fs.existsSync(path.join(legacyDir, 'nexus-data.json'))) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.copyFileSync(path.join(legacyDir, 'nexus-data.json'), file);
  // Chromium keeps the DPAPI key for safeStorage in "Local State"; bring it along so a saved API key still decrypts.
  const localState = path.join(app.getPath('userData'), 'Local State');
  if (!fs.existsSync(localState) && fs.existsSync(path.join(legacyDir, 'Local State'))) {
    fs.copyFileSync(path.join(legacyDir, 'Local State'), localState);
  }
}
let data = {};
try {
  data = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch {
  data = {};
}

let timer = null;

function flush() {
  clearTimeout(timer);
  timer = null;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function get(key) {
  return data[key];
}

function set(key, value) {
  data[key] = value;
  clearTimeout(timer);
  timer = setTimeout(flush, 400);
  return true;
}

module.exports = { get, set, flush, file };
