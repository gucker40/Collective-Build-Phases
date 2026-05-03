const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Window controls
  minimize:      () => ipcRenderer.send("window-minimize"),
  maximize:      () => ipcRenderer.send("window-maximize"),
  close:         () => ipcRenderer.send("window-close"),
  // Config
  getConfig:     () => ipcRenderer.invoke("get-config"),
  saveConfig:    (cfg) => ipcRenderer.invoke("save-config", cfg),
  getStatus:     () => ipcRenderer.invoke("get-status"),
  getPowerState: () => ipcRenderer.invoke("get-power-state"),
  onPowerChanged:(cb) => ipcRenderer.on("power-changed", (_, d) => cb(d)),
  // Utilities
  openHtml:      (html, filename) => ipcRenderer.invoke("open-html", html, filename),
  launchApp:     (path) => ipcRenderer.invoke("launch-app", path),
  // Browser view (Phase 2A.1)
  browserShow:   (bounds) => ipcRenderer.send("browser-show", bounds),
  browserHide:   () => ipcRenderer.send("browser-hide"),
  browserNavigate:(url) => ipcRenderer.invoke("browser-navigate", url),
  browserGo:     (dir) => ipcRenderer.invoke("browser-go", dir),
  onBrowserNav:  (cb) => {
    const listener = (_, d) => cb(d);
    ipcRenderer.on("browser-nav", listener);
    // Return unsubscribe function
    return () => ipcRenderer.removeListener("browser-nav", listener);
  },
});
