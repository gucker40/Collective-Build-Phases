# The Collective — Phase 4

Local-first AI workspace. Five-pillar desktop app: Logos AI chat, Dashboard, Productivity, Finance, Data Vault.

---

## What you get when you extract the ZIP

```
TheCollective-Phase4/
│
├── BUILD-INSTALLER.bat      ← builds the Windows .exe installer
├── LAUNCH-WEB.bat           ← run instantly in your browser (no install)
├── LAUNCH-DESKTOP.bat       ← run as Electron desktop app (no install)
│
├── installer/               ← appears here after running BUILD-INSTALLER.bat
│   └── TheCollective-Setup-4.0.0.exe
│
└── the-collective/          ← all source code (don't need to touch this)
    ├── backend/
    ├── frontend/
    └── skills/
```

---

## Option 1 — Build the installer (recommended)

**Requirements:** Python 3.10+, Node.js 18+

1. Double-click **`BUILD-INSTALLER.bat`**
2. Wait ~60 seconds while it installs deps and compiles
3. When done, `installer/TheCollective-Setup-4.0.0.exe` appears at the root
4. Run that `.exe` to install like any normal Windows app

---

## Option 2 — Run without installing (dev mode)

| Script | What it does |
|---|---|
| `LAUNCH-WEB.bat` | Opens the app at `http://localhost:5173` in your browser |
| `LAUNCH-DESKTOP.bat` | Opens the app as an Electron desktop window |

Both install all dependencies automatically on first run.

---

## Requirements

| Tool | Version | Download |
|---|---|---|
| Python | 3.10+ | python.org — check "Add to PATH" |
| Node.js | 18+ (LTS) | nodejs.org |

---

## AI provider setup

On first launch you'll see a setup wizard. All fields are **optional** — you can skip and add keys later in **Config → Providers**.

| Provider | Where to get a key | Notes |
|---|---|---|
| **Groq** (recommended) | console.groq.com | Free tier, very fast |
| Claude API | console.anthropic.com | Most capable fallback |
| LM Studio | localhost:1234 | Run LM Studio app separately |
| Ollama | localhost:11434 | Run Ollama separately |
| Native GGUF | — | Drop a `.gguf` file in `the-collective/models/` |

---

## Source layout (inside `the-collective/`)

```
backend/
  inference/        AI engine — llama-cpp → Groq → LM Studio → Ollama → Claude
  routers/          API endpoints (chat, artifacts, history, memory, vault, …)
  services/         Codebase self-edit, web search, keyword extraction
  config.py         config.json / secrets.json separation (no hardcoded keys)
  db.py             16-table SQLite schema
  main.py           FastAPI app + React SPA serving

frontend/
  src/logos/        ChatPanel, ArtifactPanel, LogosSigil
  src/pillars/      Dashboard, Productivity, Finance, DataVault, Config
  src/layout/       AppShell, Sidebar, TitleBar
  src/components/   Auth screens, HistorySidebar, LoadingScreen
  src/store/        Zustand stores (auth, ui)
  src/theme/        Design tokens (colors, fonts, radius, shadow)
  src/api/          Typed API client
  electron.js       Main process (window management, backend launcher, IPC)
  preload.js        Context bridge (window controls, file system, HTML open)
  electron-builder.json   NSIS installer config

skills/
  builtin/          html-dashboards.skill.json, code-expert.skill.json
```
