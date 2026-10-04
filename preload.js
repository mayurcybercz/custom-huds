const { contextBridge, ipcRenderer } = require('electron');

// Subscribe to a main-process channel; returns an unsubscribe function.
function on(channel, fn) {
  const handler = (_e, ...args) => fn(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('nexus', {
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    setApiKey: (key) => ipcRenderer.invoke('settings:setApiKey', key),
    setModel: (model) => ipcRenderer.invoke('settings:setModel', model),
    setEngine: (opts) => ipcRenderer.invoke('settings:setEngine', opts),
    startup: (enabled) => ipcRenderer.invoke('settings:startup', enabled),
  },
  skins: {
    list: () => ipcRenderer.invoke('skins:list'),
    set: (id) => ipcRenderer.invoke('skins:set', id),
  },
  feeds: {
    tech: () => ipcRenderer.invoke('feeds:tech'),
    anime: () => ipcRenderer.invoke('feeds:anime'),
    airing: () => ipcRenderer.invoke('feeds:airing'),
  },
  sys: {
    stats: () => ipcRenderer.invoke('sys:stats'),
  },
  term: {
    start: (cols, rows) => ipcRenderer.invoke('term:start', cols, rows),
    input: (data) => ipcRenderer.send('term:input', data),
    resize: (cols, rows) => ipcRenderer.send('term:resize', cols, rows),
    onData: (fn) => on('term:data', fn),
    onExit: (fn) => on('term:exit', fn),
  },
  media: {
    start: () => ipcRenderer.send('media:start'),
    cmd: (cmd) => ipcRenderer.send('media:cmd', cmd),
    onState: (fn) => on('media:state', fn),
  },
  research: {
    run: (id, topic) => ipcRenderer.invoke('research:run', id, topic),
    cancel: (id) => ipcRenderer.send('research:cancel', id),
    onEvent: (fn) => on('research:event', fn),
  },
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    hide: () => ipcRenderer.send('win:hide'),
    quit: () => ipcRenderer.send('win:quit'),
  },
  openExternal: (url) => ipcRenderer.send('open:external', url),
});
