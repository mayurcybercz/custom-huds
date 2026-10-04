import { cssVar } from '../core/util.js';

// Embedded PowerShell via node-pty + xterm.js. Colours follow the skin's --term-* / palette vars.
function theme() {
  const v = cssVar;
  return {
    background: 'rgba(0,0,0,0)', foreground: v('--term-fg', v('--text', '#c6f6ff')), cursor: v('--term-cursor', v('--ok', '#39ff88')),
    selectionBackground: v('--term-selection', 'rgba(0,229,255,0.3)'),
    black: v('--term-black', '#03070a'), red: v('--danger', '#ff3860'), green: v('--ok', '#39ff88'), yellow: v('--warn', '#ffb000'),
    blue: v('--term-blue', '#3d8bff'), magenta: v('--accent2', '#ff2bd6'), cyan: v('--accent', '#00e5ff'), white: v('--text', '#c6f6ff'),
    brightBlack: v('--dim', '#5f8794'), brightRed: v('--danger', '#ff6b8a'), brightGreen: v('--ok', '#7dffb0'), brightYellow: v('--warn', '#ffd060'),
    brightBlue: v('--term-blue', '#7cb0ff'), brightMagenta: v('--accent2', '#ff7be8'), brightCyan: v('--accent', '#7ff2ff'), brightWhite: v('--term-bright', '#ffffff'),
  };
}

export async function mount({ body: host }) {
  const term = new window.Terminal({
    fontSize: 12.5,
    cursorBlink: true,
    cursorStyle: 'bar',
    allowTransparency: true,
    scrollback: 5000,
    fontFamily: cssVar('--term-font', 'JBM, Consolas, monospace'),
    theme: theme(),
  });
  const fit = new window.FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(host);
  await document.fonts.ready;
  fit.fit();

  term.onData((d) => window.nexus.term.input(d));
  window.nexus.term.onData((d) => term.write(d));
  window.nexus.term.onExit(() => {
    term.write('\r\n\x1b[33m[shell exited, press any key to restart]\x1b[0m\r\n');
    const sub = term.onKey(() => { sub.dispose(); term.clear(); window.nexus.term.start(term.cols, term.rows); });
  });
  // Ctrl+Shift+C / Ctrl+Shift+V for copy/paste; plain Ctrl+C stays an interrupt.
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown' || !e.ctrlKey || !e.shiftKey) return true;
    if (e.code === 'KeyC') { navigator.clipboard.writeText(term.getSelection()); return false; }
    if (e.code === 'KeyV') { navigator.clipboard.readText().then((t) => window.nexus.term.input(t)); return false; }
    return true;
  });

  const { reused } = await window.nexus.term.start(term.cols, term.rows);
  if (reused) window.nexus.term.input('\r');
  new ResizeObserver(() => {
    if (!host.clientWidth) return;
    fit.fit();
    window.nexus.term.resize(term.cols, term.rows);
  }).observe(host);
  return term;
}
