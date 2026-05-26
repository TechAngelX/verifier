const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('verifier', {
  version: '1.0.0',
  onDemo: (cb) => ipcRenderer.on('demo', (_, data) => cb(data))
});
