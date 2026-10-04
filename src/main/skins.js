// Skin discovery: every folder in /skins with a skin.json + index.html is a selectable skin.
const fs = require('fs');
const path = require('path');
const store = require('./store');

const SKINS_DIR = path.join(__dirname, '..', '..', 'skins');
const DEFAULT_SKIN = 'v1-nexus';

function list() {
  return fs.readdirSync(SKINS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(SKINS_DIR, d.name, 'index.html')))
    .map((d) => {
      let meta = {};
      try { meta = JSON.parse(fs.readFileSync(path.join(SKINS_DIR, d.name, 'skin.json'), 'utf8')); } catch { /* optional */ }
      return { id: d.name, name: meta.name || d.name, version: meta.version || '', description: meta.description || '' };
    })
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

function current() {
  const wanted = process.env.NEXUS_SKIN || (store.get('settings') || {}).skin || DEFAULT_SKIN;
  const all = list();
  return (all.find((s) => s.id === wanted) || all.find((s) => s.id === DEFAULT_SKIN) || all[0]).id;
}

function set(id) {
  if (!list().some((s) => s.id === id)) return false;
  store.set('settings', { ...(store.get('settings') || {}), skin: id });
  return true;
}

const entry = (id) => path.join(SKINS_DIR, id, 'index.html');

module.exports = { list, current, set, entry };
