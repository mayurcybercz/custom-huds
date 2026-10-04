// Now-playing info for whatever Windows considers the current media session
// (Spotify desktop, Crunchyroll/YouTube in a browser, etc.) via a PowerShell poller.
const { spawn } = require('child_process');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const script = path.join(__dirname, 'scripts', 'media.ps1');
const cmdFile = path.join(app.getPath('temp'), 'custom-huds-media-cmd.txt');

let proc = null;
let target = null;
let lastThumb = null;

function start(sender) {
  target = sender;
  if (proc) return;
  proc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-CmdFile', cmdFile], {
    windowsHide: true,
  });
  readline.createInterface({ input: proc.stdout }).on('line', (line) => {
    let state;
    try { state = JSON.parse(line); } catch { return; }
    // The script only sends artwork when the track changes; keep it sticky.
    if (state.thumb) lastThumb = state.thumb;
    else if (state.active) state.thumb = lastThumb;
    if (target && !target.isDestroyed()) target.send('media:state', state);
  });
  proc.on('exit', () => {
    proc = null;
    // Restart after a pause unless the app is shutting down.
    if (!app.isQuitting) setTimeout(() => target && !target.isDestroyed() && start(target), 5000);
  });
}

function command(cmd) {
  if (['play', 'next', 'prev'].includes(cmd)) fs.writeFileSync(cmdFile, cmd);
}

function stop() {
  if (proc) proc.kill();
  proc = null;
}

module.exports = { start, command, stop };
