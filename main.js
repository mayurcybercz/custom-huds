const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, shell, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./src/main/store');
const feeds = require('./src/main/feeds');
const sysinfo = require('./src/main/sysinfo');
const terminal = require('./src/main/terminal');
const media = require('./src/main/media');
const research = require('./src/main/research');
const skins = require('./src/main/skins');
const images = require('./src/main/images');

const TOGGLE_HOTKEY = 'Control+Alt+Space';

let win = null;
let tray = null;

// In dev (npm start) Windows must launch electron.exe with this folder as an argument.
const loginItem = () => ({ path: process.execPath, args: app.isPackaged ? [] : [app.getAppPath()] });
const getStartup = () => app.getLoginItemSettings(loginItem()).openAtLogin;
const setStartup = (on) => app.setLoginItemSettings({ ...loginItem(), openAtLogin: on });

// Windows needs an AppUserModelID for toast notifications (pomodoro, water, schedule).
// In dev the electron.exe path works as the ID.
if (process.platform === 'win32') app.setAppUserModelId(app.isPackaged ? 'com.mayurcybercz.customhuds' : process.execPath);

// Screenshot test runs: keep painting even when other windows cover the HUD.
if (process.env.HUD_SNAPSHOT || process.env.HUD_SNAPSHOT_SEQ) app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    ...workArea,
    frame: false,
    resizable: true,
    show: false,
    backgroundColor: '#03070a',
    title: 'Custom HUDs',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: !(process.env.HUD_SNAPSHOT || process.env.HUD_SNAPSHOT_SEQ),
      autoplayPolicy: 'no-user-gesture-required', // ambient sound starts without a click
    },
  });
  win.loadFile(skins.entry(skins.current()));
  win.once('ready-to-show', () => {
    win.show();
    win.maximize();
  });

  // Dev aid: HUD_SNAPSHOT=path.png saves a screenshot a few seconds after launch
  // (HUD_SNAPSHOT_JS runs first in the page, HUD_SNAPSHOT_DELAY sets the wait in ms).
  // HUD_SNAPSHOT_SEQ=steps.json runs [{ js, wait, file }, …] one after another (several shots per launch).
  if (process.env.HUD_SNAPSHOT_SEQ) {
    win.webContents.on('console-message', (_e, level, message) => level >= 2 && console.log('[renderer]', message));
    setTimeout(async () => {
      const steps = JSON.parse(fs.readFileSync(process.env.HUD_SNAPSHOT_SEQ, 'utf8'));
      for (const step of steps) {
        if (step.js) await win.webContents.executeJavaScript(step.js).catch((e) => console.log('[step error]', e.message));
        await new Promise((r) => setTimeout(r, step.wait || 1500));
        if (step.file) { fs.writeFileSync(step.file, (await win.webContents.capturePage()).toPNG()); console.log('shot', step.file); }
      }
      console.log('sequence done');
    }, Number(process.env.HUD_SNAPSHOT_DELAY || 6000));
  }
  if (process.env.HUD_SNAPSHOT) {
    win.webContents.on('console-message', (_e, level, message) => level >= 2 && console.log('[renderer]', message));
    setTimeout(async () => {
      if (process.env.HUD_SNAPSHOT_JS) await win.webContents.executeJavaScript(process.env.HUD_SNAPSHOT_JS);
      await new Promise((r) => setTimeout(r, 1200));
      const img = await win.webContents.capturePage();
      require('fs').writeFileSync(process.env.HUD_SNAPSHOT, img.toPNG());
      console.log('snapshot saved');
    }, Number(process.env.HUD_SNAPSHOT_DELAY || 9000));
  }

  // Open links in the user's real browser instead of inside the HUD.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  // Closing hides to tray; quitting goes through the tray menu or the HUD's power button.
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function switchSkin(id) {
  if (!skins.set(id) || !win) return false;
  win.loadFile(skins.entry(id));
  if (tray) buildTrayMenu();
  return true;
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function toggleWindow() {
  if (!win) return;
  if (win.isVisible() && win.isFocused()) win.minimize();
  else showWindow();
}

function buildTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  buildTrayMenu();
  tray.on('click', toggleWindow);
}

function buildTrayMenu() {
  const skin = skins.list().find((s) => s.id === skins.current());
  tray.setToolTip(`Custom HUDs · ${skin ? skin.name : ''}  (${TOGGLE_HOTKEY.replace(/\+/g, ' + ')})`);
  const refreshMenu = () => {
    const startup = getStartup();
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show HUD', click: showWindow },
      { label: 'Reload', click: () => win && win.reload() },
      {
        label: 'Skin',
        submenu: skins.list().map((sk) => ({
          label: `${sk.name}${sk.version ? ` (v${sk.version})` : ''}`,
          type: 'radio',
          checked: sk.id === skins.current(),
          click: () => switchSkin(sk.id),
        })),
      },
      { type: 'separator' },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: startup,
        click: (item) => { setStartup(item.checked); refreshMenu(); },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
    ]));
  };
  refreshMenu();
}

function registerIpc() {
  ipcMain.handle('store:get', (_e, key) => store.get(key));
  ipcMain.handle('store:set', (_e, key, value) => store.set(key, value));

  ipcMain.handle('settings:get', () => research.getPublicSettings());
  ipcMain.handle('settings:setApiKey', (_e, key) => research.setApiKey(key));
  ipcMain.handle('settings:setModel', (_e, model) => research.setModel(model));
  ipcMain.handle('settings:setEngine', (_e, opts) => research.setResearchEngine(opts || {}));
  ipcMain.handle('settings:startup', (_e, enabled) => {
    if (typeof enabled === 'boolean') setStartup(enabled);
    return getStartup();
  });

  ipcMain.handle('skins:list', () => ({ skins: skins.list(), current: skins.current() }));
  ipcMain.handle('skins:set', (_e, id) => switchSkin(id));

  // Audio files that ship with a skin (CC0 recordings). Only skins/<id>/audio/* can be read.
  ipcMain.handle('assets:read', async (_e, rel) => {
    const full = path.resolve(__dirname, String(rel || ''));
    const skinsDir = path.join(__dirname, 'skins') + path.sep;
    if (!full.startsWith(skinsDir) || !/[\\/]audio[\\/][^\\/]+\.(mp3|ogg|wav)$/i.test(full)) return null;
    try {
      const b = await fs.promises.readFile(full);
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    } catch {
      return null;
    }
  });

  ipcMain.handle('images:fetch', (_e, sources) => images.fetchImages(Array.isArray(sources) ? sources : []));

  // Launcher: open a URL in the browser, or a file / folder / app shortcut with its default handler.
  ipcMain.handle('launch:open', async (_e, target) => {
    if (typeof target !== 'string' || !target.trim()) return 'empty target';
    if (/^https?:\/\//i.test(target)) { await shell.openExternal(target); return ''; }
    return shell.openPath(target.trim()); // '' on success, error text otherwise
  });
  ipcMain.handle('launch:icon', async (_e, target) => {
    try {
      return (await app.getFileIcon(target, { size: 'large' })).toDataURL();
    } catch {
      return null;
    }
  });

  ipcMain.handle('feeds:tech', () => feeds.techNews());
  ipcMain.handle('feeds:anime', () => feeds.animeNews());
  ipcMain.handle('feeds:airing', () => feeds.airingToday());

  ipcMain.handle('sys:stats', () => sysinfo.stats());

  ipcMain.handle('term:start', (e, cols, rows) => terminal.start(e.sender, cols, rows));
  ipcMain.on('term:input', (_e, data) => terminal.write(data));
  ipcMain.on('term:resize', (_e, cols, rows) => terminal.resize(cols, rows));

  ipcMain.on('media:start', (e) => media.start(e.sender));
  ipcMain.on('media:cmd', (_e, cmd) => media.command(cmd));

  ipcMain.handle('research:run', (e, id, topic) => research.run(e.sender, id, topic));
  ipcMain.on('research:cancel', (_e, id) => research.cancel(id));

  ipcMain.on('win:minimize', () => win && win.minimize());
  ipcMain.on('win:hide', () => win && win.hide());
  ipcMain.on('win:quit', () => { app.isQuitting = true; app.quit(); });
  ipcMain.on('open:external', (_e, url) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
  });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  buildTray();
  globalShortcut.register(TOGGLE_HOTKEY, toggleWindow);
});

app.on('before-quit', () => {
  app.isQuitting = true;
  terminal.kill();
  media.stop();
  store.flush();
});

app.on('will-quit', () => globalShortcut.unregisterAll());
