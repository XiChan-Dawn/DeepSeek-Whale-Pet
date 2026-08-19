const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pet', {
  onEvent: (cb) => ipcRenderer.on('pet:event', (_e, d) => cb(d)),
  onConn: (cb) => ipcRenderer.on('pet:conn', (_e, ok) => cb(ok)),
  quit: () => ipcRenderer.send('pet:quit'),
  logState: (s) => ipcRenderer.send('pet:log', s),
  setTopmost: (v) => ipcRenderer.send('pet:topmost', v),
  setSize: (w, h) => ipcRenderer.send('pet:size', w, h)
});
