const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize:    () => ipcRenderer.send('win:minimize'),
  maximize:    () => ipcRenderer.send('win:maximize'),
  close:       () => ipcRenderer.send('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:isMaximized'),

  // Open HTML artifact in system browser or new BrowserWindow
  openHtml: (content, filename) => ipcRenderer.invoke('open:html', { content, filename }),

  // Open a URL in the embedded browser panel
  openUrl: (url) => ipcRenderer.invoke('open:url', url),

  // File system helpers
  selectFile:   (filters) => ipcRenderer.invoke('fs:selectFile', filters),
  selectFolder: ()         => ipcRenderer.invoke('fs:selectFolder'),
  readFile:     (path)     => ipcRenderer.invoke('fs:readFile', path),
  writeFile:    (path, data) => ipcRenderer.invoke('fs:writeFile', { path, data }),

  // App metadata
  getVersion: () => ipcRenderer.invoke('app:version'),
  getAppPath: () => ipcRenderer.invoke('app:path'),

  // Backend process management (for packaged build)
  backendReady: (cb) => ipcRenderer.on('backend:ready', (_, data) => cb(data)),
  backendError: (cb) => ipcRenderer.on('backend:error', (_, data) => cb(data)),
});
