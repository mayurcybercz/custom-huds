// Tiny JSON-file store in the app's userData folder. Writes are debounced.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const file = path.join(app.getPath('userData'), 'nexus-data.json');
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
