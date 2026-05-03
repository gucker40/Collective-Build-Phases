const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

const isDev = !app.isPackaged;
const BACKEND_PORT = 8000;
const FRONTEND_PORT = 5173;

let mainWindow = null;
let backendProcess = null;

// ── Backend launcher ──────────────────────────────────────────────────────────

function getBackendPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'backend');
  }
  // Packaged: python backend is in resources/backend/
  return path.join(process.resourcesPath, 'backend');
}

function getPythonPath() {
  // Check for bundled Python first; fall back to system Python if not present.
  // A bundled interpreter is optional — system Python (installed as prereq) works fine.
  if (process.platform === 'win32') {
    const bundled = path.join(process.resourcesPath, 'python', 'python.exe');
    if (fs.existsSync(bundled)) return bundled;
    for (const name of ['python', 'py', 'python3']) {
      try {
        require('child_process').execFileSync(name, ['--version'], { stdio: 'ignore' });
        return name;
      } catch {}
    }
    return 'python';
  }
  const bundled = path.join(process.resourcesPath, 'python', 'bin', 'python3');
  if (fs.existsSync(bundled)) return bundled;
  return process.platform === 'darwin' ? 'python3' : 'python3';
}

function startBackend() {
  const backendDir = getBackendPath();
  const python = getPythonPath();
  const script = path.join(backendDir, 'main.py');

  if (!fs.existsSync(script)) {
    console.warn('[electron] Backend script not found at', script);
    return;
  }

  backendProcess = spawn(python, ['-u', script], {
    cwd: backendDir,
    env: { ...process.env, TC_WEB_DIST: path.join(__dirname, 'dist') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout.on('data', d => {
    const line = d.toString().trim();
    console.log('[backend]', line);
    if (line.includes('Application startup complete') || line.includes('Uvicorn running')) {
      mainWindow?.webContents.send('backend:ready', { port: BACKEND_PORT });
    }
  });

  backendProcess.stderr.on('data', d => {
    const line = d.toString().trim();
    if (line) console.error('[backend:err]', line);
  });

  backendProcess.on('close', code => {
    console.log('[electron] Backend exited:', code);
    if (code !== 0 && mainWindow) {
      mainWindow.webContents.send('backend:error', { code });
    }
    backendProcess = null;
  });
}

function waitForBackend(retries = 30, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function check() {
      const req = http.get(`http://localhost:${BACKEND_PORT}/api/health`, res => {
        resolve();
      });
      req.on('error', () => {
        if (++attempts >= retries) return reject(new Error('Backend did not start'));
        setTimeout(check, delay);
      });
      req.end();
    }
    check();
  });
}

// ── Window creation ───────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#06040f',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: !isDev,
    },
    icon: path.join(__dirname, 'public', 'icon.ico'),
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (!isDev) {
    startBackend();
    try { await waitForBackend(); } catch (e) { console.error(e.message); }
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
});

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.on('win:minimize', () => mainWindow?.minimize());
ipcMain.on('win:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('win:close', () => mainWindow?.close());
ipcMain.handle('win:isMaximized', () => mainWindow?.isMaximized() ?? false);

ipcMain.handle('open:html', async (_, { content, filename }) => {
  const tmp = path.join(app.getPath('temp'), filename || 'artifact.html');
  fs.writeFileSync(tmp, content, 'utf8');
  await shell.openPath(tmp);
  return tmp;
});

ipcMain.handle('open:url', async (_, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('fs:selectFile', async (_, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('fs:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('fs:readFile', async (_, filePath) => {
  try { return fs.readFileSync(filePath, 'utf8'); }
  catch (e) { throw new Error(e.message); }
});

ipcMain.handle('fs:writeFile', async (_, { path: filePath, data }) => {
  try { fs.writeFileSync(filePath, data, 'utf8'); return true; }
  catch (e) { throw new Error(e.message); }
});

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:path', () => app.getPath('userData'));
