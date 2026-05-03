# The Collective — Phase 4

Local-first AI workspace. Electron desktop app + React frontend + FastAPI backend.

## Quick Start (Windows)

**Requirements:** Python 3.10+, Node.js 18+

Double-click one of the launcher scripts at the repo root:

| Script | What it does |
|---|---|
| `start-web.bat` | Starts backend + opens `http://localhost:5173` in your browser |
| `start-electron.bat` | Starts backend + launches the Electron desktop window |

Both scripts install dependencies automatically on first run.

## Manual Setup

**Backend**
```
cd the-collective\backend
pip install -r requirements.txt
python main.py
```

**Frontend** (separate terminal)
```
cd the-collective\frontend
npm install
npm run dev          # web mode → http://localhost:5173
npm run electron:dev # desktop mode (requires backend running)
```

**Build installer**
```
cd the-collective\frontend
npm install
npm run electron:build:win
# installer → the-collective\frontend\release\
```

## Structure

```
the-collective/
├── backend/                 FastAPI + SQLite
│   ├── inference/           AI engine (llama-cpp → Groq → LM Studio → Ollama → Claude)
│   ├── routers/             API endpoints (chat, artifacts, history, memory, …)
│   ├── services/            Codebase self-edit, web search, keyword extraction
│   ├── config.py            config.json / secrets.json split
│   ├── db.py                16-table SQLite schema + v2A-7 migration
│   └── main.py              FastAPI app + SPA serving
│
├── frontend/                React 18 + Zustand + Vite 5
│   ├── src/
│   │   ├── logos/           ChatPanel, ArtifactPanel, LogosSigil
│   │   ├── pillars/         Dashboard, Productivity, Finance, DataVault, Config
│   │   ├── layout/          AppShell, Sidebar, TitleBar
│   │   ├── components/      Auth screens, HistorySidebar, LoadingScreen
│   │   ├── store/           Zustand stores (auth, ui)
│   │   ├── theme/           Design tokens
│   │   └── api/             Typed API client
│   ├── electron.js          Main process (window, backend launcher, IPC)
│   ├── preload.js           Context bridge
│   ├── electron-builder.json NSIS / DMG / AppImage config
│   └── package.json
│
└── skills/
    └── builtin/             html-dashboards.skill.json, code-expert.skill.json
```

## AI Engine Fallback Chain

Logos tries providers in this order, using whichever responds first:

1. **Native** — local GGUF model via llama-cpp-python (optional, needs .gguf file)
2. **Groq** — free cloud API, fastest for most use cases
3. **LM Studio** — local server on port 1234
4. **Ollama** — local server on port 11434
5. **Claude** — Anthropic API (most capable fallback)

Add API keys in-app via **Config → Providers** or during the setup wizard (all fields optional).

## First Run

1. Register an account (first user is automatically admin)
2. Complete the setup wizard — choose your provider, optionally paste an API key
3. Start chatting with Logos

## Building the Windows Installer

```
cd the-collective\frontend
npm install
npm run electron:build:win
```

The `.exe` installer will be at `the-collective\frontend\release\`.
