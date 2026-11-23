const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  setCustomPauseShortcut: (key) => ipcRenderer.send('set-custom-pause-shortcut', key),
  onMediaPlayPause: (callback) => {
    const handler = (_event, val) => callback(val);
    ipcRenderer.on('media-play-pause', handler);
    return () => ipcRenderer.removeListener('media-play-pause', handler);
  },
  onMediaNext: (callback) => {
    const handler = (_event, val) => callback(val);
    ipcRenderer.on('media-next', handler);
    return () => ipcRenderer.removeListener('media-next', handler);
  },
  onMediaPrev: (callback) => {
    const handler = (_event, val) => callback(val);
    ipcRenderer.on('media-prev', handler);
    return () => ipcRenderer.removeListener('media-prev', handler);
  },
});
