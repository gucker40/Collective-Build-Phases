/**
 * electron.js - Logos
 * Runs the pre-compiled backend.exe. No Python. No terminals. No setup.
 */

const { app, BrowserWindow, shell, ipcMain, powerMonitor } = require("electron");
const path   = require("path");
const { spawn, exec, execSync } = require("child_process");
const fs     = require("fs");
const http   = require("http");
const https  = require("https");
const os     = require("os");

const isDev = !app.isPackaged;

// ── Paths ────────────────────────────────────────────────────────────────────
const FRONTEND_DIR = __dirname;
const ROOT_DIR     = path.join(__dirname, "..");

// In dev: use Python source. In prod: use compiled backend.exe
const BACKEND_DIR  = isDev
  ? path.join(ROOT_DIR, "backend")
  : path.join(process.resourcesPath, "backend");

const APPDATA      = path.join(app.getPath("appData"), "logos-app");
const LOGS         = path.join(APPDATA, "logs");
const CFG_PATH     = path.join(APPDATA, "config.json");

// Ensure all data dirs exist
[APPDATA, LOGS,
  path.join(APPDATA, "vault"),
  path.join(APPDATA, "memory"),
  path.join(APPDATA, "history"),
  path.join(APPDATA, "artifacts"),
].forEach(function(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── Config ───────────────────────────────────────────────────────────────────
function loadCfg() {
  try { if (fs.existsSync(CFG_PATH)) return JSON.parse(fs.readFileSync(CFG_PATH, "utf8")); }
  catch(e) {}
  return {};
}
function saveCfg(cfg) {
  try { fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2)); } catch(e) {}
}

// ── State ────────────────────────────────────────────────────────────────────
var mainWindow  = null;
var backendProc = null;
var viteProc    = null;
var allPids     = [];

// ── Logging ──────────────────────────────────────────────────────────────────
function log(name, msg) {
  try {
    fs.appendFileSync(
      path.join(LOGS, name + ".log"),
      "[" + new Date().toISOString() + "] " + msg + "\n"
    );
  } catch(e) {}
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function checkPort(url) {
  return new Promise(function(resolve) {
    var mod = url.startsWith("https") ? https : http;
    var req = mod.get(url, function(res) { resolve(res.statusCode < 500); res.resume(); });
    req.on("error", function() { resolve(false); });
    req.setTimeout(2000, function() { req.destroy(); resolve(false); });
  });
}

async function waitFor(url, maxMs) {
  maxMs = maxMs || 20000;
  var start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await checkPort(url)) return true;
    await new Promise(function(r) { setTimeout(r, 500); });
  }
  return false;
}

function spawnHidden(cmd, args, opts) {
  opts = opts || {};
  var proc = spawn(cmd, args, {
    windowsHide: true,
    detached:    false,
    stdio:       ["ignore", "pipe", "pipe"],
    cwd:         opts.cwd,
    env:         opts.env || process.env,
  });
  if (proc.pid) allPids.push(proc.pid);
  var logName = opts.logName || "proc";
  if (proc.stdout) proc.stdout.pipe(fs.createWriteStream(path.join(LOGS, logName + ".log"), { flags:"a" }));
  if (proc.stderr) proc.stderr.pipe(fs.createWriteStream(path.join(LOGS, logName + "-err.log"), { flags:"a" }));
  proc.on("error", function(e) { log(logName, "SPAWN ERROR: " + e.message); });
  return proc;
}

// ── Find local AI providers ───────────────────────────────────────────────────
function findExe(candidates) {
  for (var i = 0; i < candidates.length; i++) if (fs.existsSync(candidates[i])) return candidates[i];
  return null;
}

function findOllama() {
  var lad = process.env.LOCALAPPDATA || "";
  return findExe([
    path.join(lad, "Programs", "Ollama", "ollama.exe"),
    path.join(lad, "Ollama", "ollama.exe"),
    "C:\\Program Files\\Ollama\\ollama.exe",
  ]);
}

function findLMSCli() {
  var home = process.env.USERPROFILE || "";
  var lad  = process.env.LOCALAPPDATA || "";
  return findExe([
    path.join(home, ".lmstudio", "bin", "lms.exe"),
    path.join(home, ".cache", "lm-studio", "bin", "lms.exe"),
    path.join(lad, "LM-Studio", "bin", "lms.exe"),
    path.join(lad, "Programs", "LM Studio", "lms.exe"),
  ]);
}

function findLMStudio() {
  var lad = process.env.LOCALAPPDATA || "";
  return findExe([
    path.join(lad, "Programs", "LM Studio", "LM Studio.exe"),
    path.join(lad, "LM Studio", "LM Studio.exe"),
    "C:\\Program Files\\LM Studio\\LM Studio.exe",
    path.join(process.env.USERPROFILE||"", "AppData", "Local", "Programs", "LM Studio", "LM Studio.exe"),
  ]);
}

// ── Find Python ───────────────────────────────────────────────────────────────
function findPython() {
  // In production: use the venv bundled inside the app — guaranteed to have all packages
  var bundledVenv = path.join(BACKEND_DIR, "venv", "Scripts", "python.exe");
  if (fs.existsSync(bundledVenv)) {
    log("backend", "Using bundled venv: " + bundledVenv);
    return bundledVenv;
  }

  // Dev fallback: look for a venv in the source backend folder
  var devVenv = path.join(ROOT_DIR, "backend", "venv", "Scripts", "python.exe");
  if (fs.existsSync(devVenv)) {
    log("backend", "Using dev venv: " + devVenv);
    return devVenv;
  }

  // Last resort: system Python (dev only — prod should always have the venv)
  log("backend", "WARNING: No venv found, falling back to system Python");
  var lad = process.env.LOCALAPPDATA || "";
  var pf  = process.env.PROGRAMFILES || "C:\\Program Files";
  var candidates = [
    path.join(lad, "Programs", "Python", "Python313", "python.exe"),
    path.join(lad, "Programs", "Python", "Python312", "python.exe"),
    path.join(lad, "Programs", "Python", "Python311", "python.exe"),
    path.join(lad, "Programs", "Python", "Python310", "python.exe"),
    path.join(pf, "Python313", "python.exe"),
    path.join(pf, "Python312", "python.exe"),
    path.join(pf, "Python311", "python.exe"),
  ];
  for (var i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i])) return candidates[i];
  }
  return "python";
}

// ── Start backend ─────────────────────────────────────────────────────────────
async function startBackend() {
  if (await checkPort("http://localhost:8000/health")) {
    log("backend", "Already running"); return true;
  }

  var python = findPython();
  var mainPy = path.join(BACKEND_DIR, "main.py");

  if (!fs.existsSync(mainPy)) {
    log("backend", "ERROR: main.py not found at " + mainPy);
    return false;
  }

  log("backend", "Starting: " + python);

  // Tell the backend where the web frontend dist is
  // In production: bundled at resources/web-dist/
  // In dev: at frontend/dist/ relative to source root
  var webDistPath = isDev
    ? path.join(ROOT_DIR, "frontend", "dist")
    : path.join(process.resourcesPath, "web-dist");
  log("backend", "Web dist path: " + webDistPath);

  var backendEnv = Object.assign({}, process.env, {
    TC_WEB_DIST: webDistPath
  });

  backendProc = spawnHidden(python, [mainPy], { cwd: BACKEND_DIR, logName: "backend", env: backendEnv });

  var crashed = false;
  backendProc.on("exit", function(code) {
    if (code !== 0 && code !== null) {
      log("backend", "Crashed with exit code " + code + " — check backend-err.log");
      crashed = true;
    }
  });

  // Poll every 500ms, bail immediately if process crashed, timeout at 30s
  var start = Date.now();
  while (Date.now() - start < 30000) {
    if (crashed) { log("backend", "Bailing — process already dead"); return false; }
    if (await checkPort("http://localhost:8000/health")) { log("backend", "Ready"); return true; }
    await new Promise(function(r) { setTimeout(r, 500); });
  }
  log("backend", "Timed out after 30s — check backend-err.log");
  return false;
}

async function startOllama() {
  if (await checkPort("http://localhost:11434/")) return true;
  var exe = findOllama();
  if (!exe) { log("ollama", "Not found"); return false; }
  var proc = spawnHidden(exe, ["serve"], {
    env: Object.assign({}, process.env, {
      OLLAMA_NUM_GPU: "99",
      CUDA_VISIBLE_DEVICES: "0",
      OLLAMA_KEEP_ALIVE: "-1",
    }),
    logName: "ollama",
  });
  proc.unref();
  return waitFor("http://localhost:11434/", 25000);
}

async function startLMStudio() {
  if (await checkPort("http://localhost:1234/v1/models")) return true;
  var cli = findLMSCli();
  if (cli) {
    var p = spawnHidden(cli, ["server", "start", "--cors"], { logName: "lmstudio" });
    p.unref();
    var ok = await waitFor("http://localhost:1234/v1/models", 25000);
    if (ok) return true;
  }
  var exe = findLMStudio();
  if (!exe) return false;
  var p2 = spawnHidden(exe, [], { logName: "lmstudio" });
  p2.unref();
  return waitFor("http://localhost:1234/v1/models", 40000);
}

async function startVite() {
  if (await checkPort("http://localhost:5173/")) return true;
  var viteJs = path.join(FRONTEND_DIR, "node_modules", "vite", "bin", "vite.js");
  if (!fs.existsSync(viteJs)) return false;
  viteProc = spawnHidden("node", [viteJs, "--host"], { cwd: FRONTEND_DIR, logName: "vite" });
  return waitFor("http://localhost:5173/", 20000);
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
function killTree(pid) {
  if (!pid) return;
  try { execSync("taskkill /pid " + pid + " /T /F", { windowsHide:true, stdio:"ignore" }); } catch(e) {}
}

function cleanup() {
  log("app", "Shutting down — killing " + allPids.length + " processes");
  allPids.forEach(killTree);
  if (backendProc && !backendProc.killed) killTree(backendProc.pid);
  if (viteProc    && !viteProc.killed)    killTree(viteProc.pid);
  // Belt-and-suspenders port kill
  [8000, 5173].forEach(function(port) {
    try {
      execSync(
        'for /f "tokens=5" %a in (\'netstat -aon ^| findstr :' + port + '\') do taskkill /F /PID %a',
        { windowsHide:true, stdio:"ignore", shell:true }
      );
    } catch(e) {}
  });
}

app.on("before-quit", cleanup);
app.on("will-quit",   cleanup);
process.on("exit",    cleanup);

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 960, minHeight: 640,
    frame: false,
    backgroundColor: "#080810",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(FRONTEND_DIR, "preload.js"),
    },
    title: "The Collective",
    show: false,
    icon: path.join(FRONTEND_DIR, "public", "icon.ico"),
  });

  try { app.setJumpList(null); } catch(e) {}

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.on("did-fail-load", function(evt, code) {
      if ([-102, -6, -7].includes(code)) {
        setTimeout(function() { if (mainWindow) mainWindow.loadURL("http://localhost:5173"); }, 1500);
      }
    });
  } else {
    mainWindow.loadFile(path.join(FRONTEND_DIR, "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", function() { mainWindow.show(); });
  mainWindow.webContents.setWindowOpenHandler(function(details) {
    shell.openExternal(details.url); return { action: "deny" };
  });
  mainWindow.on("closed", function() { mainWindow = null; });
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.on("window-minimize", function() { if (mainWindow) mainWindow.minimize(); });
ipcMain.on("window-maximize", function() {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on("window-close", function() { cleanup(); if (mainWindow) mainWindow.close(); });

ipcMain.handle("get-status", async function() {
  var cfg = loadCfg();
  return {
    provider:  cfg.provider || "ollama",
    ollama:    await checkPort("http://localhost:11434/"),
    backend:   await checkPort("http://localhost:8000/health"),
    lmstudio:  await checkPort("http://localhost:1234/v1/models"),
    vite:      isDev ? await checkPort("http://localhost:5173/") : true,
    onBattery: powerMonitor.onBatteryPower,
  };
});

ipcMain.handle("get-config",      function()       { return loadCfg(); });
ipcMain.handle("save-config",     function(evt, c) { saveCfg(c); return { saved: true }; });
ipcMain.handle("get-power-state", function()       { return { onBattery: powerMonitor.onBatteryPower }; });
ipcMain.handle("open-html", async function(evt, html, filename) {
  var filePath = path.join(os.tmpdir(), filename || "collective-preview.html");
  fs.writeFileSync(filePath, html, "utf8");
  await shell.openPath(filePath);
  return { opened: filePath };
});
ipcMain.handle("launch-app", async function(evt, appPath) {
  try {
    log("launch", "Launching: " + appPath);
    await shell.openPath(appPath);
    return { launched: true };
  } catch(e) {
    log("launch", "Failed: " + e.message);
    return { launched: false, error: e.message };
  }
});

powerMonitor.on("on-battery", function() {
  if (mainWindow) mainWindow.webContents.send("power-changed", { onBattery: true });
});
powerMonitor.on("on-ac", function() {
  if (mainWindow) mainWindow.webContents.send("power-changed", { onBattery: false });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
app.whenReady().then(async function() {
  createWindow();

  if (isDev) startVite().catch(function(e) { log("vite", e.message); });

  var cfg      = loadCfg();
  var provider = cfg.provider || "auto";
  if (provider === "auto" || !provider) {
    provider = (findLMStudio() || findLMSCli()) ? "lmstudio" : "ollama";
    cfg.provider = provider;
    saveCfg(cfg);
    log("app", "Auto-detected provider: " + provider);
  }

  // Start backend AND AI provider in parallel — shaves 20-30s off boot
  var aiStart = provider === "lmstudio"
    ? startLMStudio().catch(function(e) { log("lmstudio", e.message); })
    : startOllama().catch(function(e) { log("ollama", e.message); });

  Promise.all([
    startBackend().catch(function(e) { log("backend", e.message); }),
    aiStart,
  ]).then(function() { log("app", "All services ready"); });

  app.on("activate", function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function() {
  if (process.platform !== "darwin") { cleanup(); app.quit(); }
});

// ── Phase 2A.1: WebContentsView browser (persists across sidebar navigation) ──

var browserView = null;
var browserPlaceholderBounds = null;

function createBrowserView() {
  if (browserView) return;
  const { WebContentsView } = require("electron");
  browserView = new WebContentsView({
    webPreferences: {
      partition:        "persist:logos-browser",
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          true,
    }
  });
  // Use the collective-browser partition so it persists across restarts
  browserView.webContents.loadURL("https://www.google.com");

  // Forward nav events to renderer
  function sendNav() {
    if (!mainWindow) return;
    var wc = browserView.webContents;
    mainWindow.webContents.send("browser-nav", {
      url:     wc.getURL(),
      title:   wc.getTitle(),
      canBack: typeof wc.canGoBack === "function" ? wc.canGoBack() : false,
      canFwd:  typeof wc.canGoForward === "function" ? wc.canGoForward() : false,
      loading: false,
    });
  }
  function sendLoading() {
    if (!mainWindow) return;
    mainWindow.webContents.send("browser-nav", { loading: true });
  }

  browserView.webContents.on("did-finish-load",     sendNav);
  browserView.webContents.on("did-navigate",        sendNav);
  browserView.webContents.on("did-navigate-in-page",sendNav);
  browserView.webContents.on("did-start-loading",   sendLoading);

  // Open popups externally
  browserView.webContents.setWindowOpenHandler(function(d) {
    shell.openExternal(d.url); return { action: "deny" };
  });
}

function showBrowserView() {
  if (!mainWindow || !browserView) return;
  if (!mainWindow.contentView.children.includes(browserView)) {
    mainWindow.contentView.addChildView(browserView);
  }
  // Size it to fill below the main app chrome — we use a fixed offset for the
  // Electron titlebar (32px) + app sidebar nav (0 horizontal — it's in the React layer)
  var [w, h] = mainWindow.getContentSize();
  // We'll receive the placeholder bounds via IPC for precise positioning
  var bounds = browserPlaceholderBounds || { x: 68, y: 72, width: w - 68, height: h - 72 };
  browserView.setBounds(bounds);
  browserView.setVisible(true);
}

function hideBrowserView() {
  if (browserView) browserView.setVisible(false);
}

// IPC handlers for browser view
ipcMain.on("browser-show", function(evt, bounds) {
  browserPlaceholderBounds = bounds;
  createBrowserView();
  showBrowserView();
});
ipcMain.on("browser-hide", function() {
  hideBrowserView();
});
ipcMain.handle("browser-navigate", function(evt, url) {
  createBrowserView();
  browserView.webContents.loadURL(url);
  showBrowserView();
  return { ok: true };
});
ipcMain.handle("browser-go", function(evt, dir) {
  if (!browserView) return;
  var wc = browserView.webContents;
  if (dir === "back"    && typeof wc.canGoBack === "function" && wc.canGoBack())    wc.goBack();
  if (dir === "forward" && typeof wc.canGoForward === "function" && wc.canGoForward()) wc.goForward();
  if (dir === "reload")   wc.reload();
  if (dir === "home")     wc.loadURL("https://www.google.com");
  return { ok: true };
});

// Resize browser view when window resizes
// (injected after createWindow — see app.whenReady patch below)
