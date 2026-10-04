const pty = require('@lydell/node-pty');
const os = require('os');

let proc = null;
let target = null;

function start(sender, cols, rows) {
  target = sender;
  if (proc) {
    // Renderer reloaded: keep the existing shell and just resize it.
    resize(cols, rows);
    return { reused: true };
  }
  proc = pty.spawn('powershell.exe', ['-NoLogo'], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: os.homedir(),
    env: process.env,
  });
  proc.onData((d) => {
    if (target && !target.isDestroyed()) target.send('term:data', d);
  });
  proc.onExit(({ exitCode }) => {
    proc = null;
    if (target && !target.isDestroyed()) target.send('term:exit', exitCode);
  });
  return { reused: false };
}

function write(data) {
  if (proc) proc.write(data);
}

function resize(cols, rows) {
  if (proc && cols > 0 && rows > 0) {
    try { proc.resize(cols, rows); } catch { /* shell may be exiting */ }
  }
}

function kill() {
  if (proc) {
    try { proc.kill(); } catch { /* already gone */ }
    proc = null;
  }
}

module.exports = { start, write, resize, kill };
