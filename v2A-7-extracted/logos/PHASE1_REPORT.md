# The Collective — Phase 1 Complete
## Handoff Report for Future Development Sessions

---

## What This Is

The Collective is a personal AI desktop application built on Electron + React (frontend) and FastAPI + Python (backend). It runs entirely locally — no cloud dependency except optional Groq API for fast inference. The aesthetic is dark, cosmic, occult-inspired: deep navy/purple palette, gold accents, serif "Cinzel" font for headings, "IBM Plex" for body/mono. All UI is custom-built with inline React styles — no component library.

**Codebase location:** `output/` folder
```
output/
  backend/          Python FastAPI server (port 8000)
  frontend/         Electron + React + Vite app
  build.bat         Single script to produce the installer
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 31 |
| Frontend | React 18 + Vite 5 |
| Styling | Inline React styles + custom CSS (`cosmic.css`) |
| Backend | Python FastAPI + Uvicorn (port 8000) |
| AI providers | Groq API / Ollama / LM Studio (hybrid routing) |
| Persistence | JSON files in `%APPDATA%\the-collective\` |
| Build | electron-builder (NSIS installer) |

---

## Architecture

### Boot Sequence
1. Electron launches → shows `LoadingScreen.jsx`
2. `electron.js` fires `startBackend()` and `startOllama()`/`startLMStudio()` **in parallel**
3. Backend uses a **bundled venv** at `backend/venv/Scripts/python.exe` — all packages pre-installed
4. `electron.js` → `findPython()` checks filesystem paths first, then registry, then PATH
5. `LoadingScreen` polls `localhost:8000/health` every 500ms, max 40s wait
6. Once healthy → fade into main app

### Frontend Layout (`App.jsx`)
```
TitleBar (custom frameless window controls)
├── Sidebar (68px icon nav)
├── HistorySidebar (only visible on chat view)
└── Main area
    ├── Active view panel (see Views below)
    └── ArtifactPanel (right-side slide-in, resizable)
```

### Views (Sidebar nav)
| View ID | Component | Description |
|---------|-----------|-------------|
| `chat` | `ChatPanel.jsx` | Main AI chat interface |
| `artifacts` | `ArtifactHistory.jsx` | Saved projects/code viewer |
| `library` | `Library.jsx` | Steam-style app shortcut launcher |
| `browser` | `Browser.jsx` | Embedded webview browser |
| `vault` | `VaultEditor.jsx` | Personal document vault |
| `memory` | `MemoryVault.jsx` | Sealed memory viewer |
| `settings` | `SettingsPanel.jsx` | Provider config, API keys |

---

## AI System — The Trilateral Council

Logos routes to three members based on intent:

| Member | Role | Provider (hybrid mode) |
|--------|------|----------------------|
| **Pneuma** | Reasoning, explanation, analysis | Groq (fast) → Ollama fallback |
| **Techne** | Code, building, artifacts | LM Studio → Groq fallback → Ollama |
| **Opsis** | Vision/image analysis | Ollama only (vision model) |

### Intent Routing (`router.py`)
The modal (`LogosModal.jsx`) shows 6 intent options:
- `explain` → Pneuma, standard system prompt
- `build` → Techne, HTML artifact system prompt
- `refine` → Pneuma, "surgical edit" system prompt
- `research` → Pneuma, "deep analysis" system prompt
- `remember` → Seals user message to memory, confirms
- `council` → Pneuma with full council framing + internal reasoning plan injected into system prompt

Intent detection is rule-based (keyword matching) — no Ollama call for detection.

### Provider Config (`models.py`)
Stored in `%APPDATA%\the-collective\config.json`:
```json
{
  "provider": "hybrid",
  "groq_key": "gsk_...",
  "groq_model_pneuma": "llama-3.1-8b-instant",
  "ollama_url": "http://localhost:11434",
  "lmstudio_url": "http://localhost:1234"
}
```

**Hybrid mode model preferences:**
- Pneuma: `qwen3:8b` (Ollama) or `llama-3.1-8b-instant` (Groq)
- Techne: `qwen2.5-coder:7b` (Ollama) or keyword-matched model (LM Studio)
- Opsis: `qwen2-vl:7b` (Ollama)

---

## Backend API Routes

Base URL: `http://localhost:8000`

| Route | Method | Description |
|-------|--------|-------------|
| `/health` | GET | Health check — returns `{"status":"ok"}` |
| `/logos/chat` | POST | Main chat stream (SSE) |
| `/logos/intent` | POST | Rule-based intent detection |
| `/logos/vision` | POST | Image analysis (multipart) |
| `/logos/status` | GET | Council + provider status |
| `/artifacts/save` | POST | Save a code artifact |
| `/artifacts/upload` | POST | Upload HTML/ZIP files |
| `/artifacts/list` | GET | List all artifacts |
| `/artifacts/get/{id}` | GET | Fetch artifact content |
| `/artifacts/delete/{id}` | DELETE | Remove artifact |
| `/memory/seal` | POST | Seal text to memory |
| `/memory/list` | GET | List all memories |
| `/memory/unseal/{id}` | DELETE | Remove a memory |
| `/history/save` | POST | Save chat session |
| `/history/list` | GET | List sessions |
| `/history/load/{id}` | GET | Load session |
| `/vault/*` | Various | Document vault CRUD |

### SSE Stream Format (`/logos/chat`)
Sends newline-delimited JSON events:
```
data: {"type": "content", "content": "chunk text"}
data: {"type": "done", "member": "pneuma", "intent": "explain"}
```

---

## Key Components Reference

### `ChatPanel.jsx`
- Handles full send/receive/stream cycle
- `sendToLogos(userText, intent, baseMsgs)` — core function
- `extractAllBlocks(text)` — finds completed ` ```lang\ncode``` ` blocks
- `buildDisplayText(raw, blocks, userPrompt)` — replaces code blocks with `[[ARTIFACT:lang:title]]` tokens
- `smartTitle(lang, code, userPrompt)` — derives 2-3 word title from HTML `<title>`, `<h1>`, or user prompt keywords
- Artifact panel only opens on `done` event (never during streaming)
- `StreamingStatus` component shows elapsed time + model cold-load progress bar

### `ArtifactPanel.jsx`
- Right-side panel, resizable via drag handle
- Tabs: Preview (iframe) / Code (syntax highlighted)
- Custom tokenizer in `highlightCode()` — no dependencies
- iframe uses `ref`-based `srcdoc` updates (no `key` remount)
- `prevContentRef` guards prevent re-renders; resets on `artifact.title` or `open` change
- `requestAnimationFrame` wraps srcdoc write to ensure iframe is in DOM first

### `Library.jsx`
- Steam-style app grid with auto-themed cards
- `guessTheme(name)` — matches known apps (Steam, Discord, Spotify, etc.) or generates consistent color from name hash
- Drag-and-drop `.lnk`/`.exe`/`.url` import
- Persists to `localStorage` under key `collective_library_v1`
- Launches via `window.electronAPI.launchApp(path)` → `shell.openPath()`

### `Browser.jsx`
- Electron `<webview>` tag (requires `webviewTag: true` in BrowserWindow)
- Persistent session: `partition="persist:browser"`
- `normalizeUrl()` — handles bare domains, localhost, and search fallback
- Back/Forward/Reload/Home + bookmarks bar (Google, YouTube, GitHub, X, Reddit, Twitch)

### `memory.py`
- **No ChromaDB** — replaced with plain JSON at `%APPDATA%\the-collective\memory\memories.json`
- `get_relevant_memories(query)` — keyword scoring (intersection of query words vs memory words)
- Called before every chat message to inject relevant sealed memories into system prompt

---

## IPC Bridge (`preload.js` → `electron.js`)

| API | IPC Channel | Description |
|-----|-------------|-------------|
| `minimize/maximize/close` | send | Window controls |
| `getConfig()` | invoke | Load config.json |
| `saveConfig(cfg)` | invoke | Write config.json |
| `getStatus()` | invoke | Service health check |
| `getPowerState()` | invoke | Battery status |
| `openHtml(html, filename)` | invoke | Open HTML in default browser |
| `launchApp(path)` | invoke | Launch .lnk/.exe via shell.openPath |
| `onPowerChanged(cb)` | on | Battery state change listener |

---

## Building the Installer

**Requirements:** Node.js 18+, Python 3.11+

```bat
build.bat
```

Steps performed:
1. Creates `backend/venv/` with all pip packages installed
2. Runs `npm install` in frontend
3. Runs `vite build` 
4. Runs `electron-builder --win` → produces `dist-app/The Collective Setup 1.0.0.exe`

The installer (NSIS via electron-builder):
- Per-user install (no admin required)
- Creates Desktop + Start Menu shortcuts
- Registers in Add/Remove Programs
- Launches app on completion

**Critical:** `electron-builder.json` bundles `backend/**/*` (all files including venv). If you change Python dependencies, delete `backend/venv/` and re-run `build.bat`.

---

## Data Storage

All user data lives in `%APPDATA%\the-collective\`:
```
config.json          Provider settings + API keys
history/             Chat sessions (JSON)
artifacts/           Saved code artifacts (HTML/etc + .meta.json)
memory/
  memories.json      Sealed memories
vault/               User documents
logs/
  backend.log        FastAPI stdout
  backend-err.log    FastAPI stderr (CHECK THIS FIRST if backend fails)
  ollama.log
  lmstudio.log
```

---

## Known Patterns & Conventions

1. **All backend calls** use `const API = "http://localhost:8000"` — defined at top of each component
2. **Color palette:** bg `#0d0d1a`, surface `#07070e`, border `rgba(160,122,255,0.2)`, accent purple `#a07aff`, accent gold `#f0c040`, text `#f0ecff`, muted `#8878c8`
3. **Fonts:** `'Cinzel', serif` for headings/labels, `'IBM Plex Sans', sans-serif` for body, `'IBM Plex Mono', monospace` for code/meta
4. **No component library** — all UI is hand-styled inline React
5. **Artifact HTML system prompt** in `models.py` (`LOGOS_SYSTEM_PROMPT`) instructs always-dark-theme, self-contained single HTML file, no JSX
6. **`build.bat`** must be re-run whenever Python deps change (recreates venv)
7. **`electron.js`** in dev mode (`isDev = !app.isPackaged`) skips venv lookup and uses system Python
8. **HistorySidebar** only renders on `chat` view — not on other views

---

## Phase 1 Feature Checklist ✓

- [x] Multi-provider AI (Groq / Ollama / LM Studio / hybrid)
- [x] Trilateral Council routing (Pneuma / Techne / Opsis)
- [x] Full Council intent with reasoning plan
- [x] Artifact panel with live preview (HTML iframe) and syntax highlighting
- [x] Project upload (drag HTML/ZIP to import)
- [x] Chat history with session persistence
- [x] Memory vault (seal/unseal with keyword search)
- [x] Document vault
- [x] App Library (Steam-style, .lnk import, drag-and-drop)
- [x] Embedded browser (webview, bookmarks, persistent session)
- [x] Settings panel (provider switching, API key management)
- [x] NSIS installer via electron-builder
- [x] Windows Start Menu / Search registration
- [x] Frameless custom window with TitleBar controls

---

## Phase 2 Ideas (not built)

- Personal life dashboard (widgets: weather, calendar, tasks, clock, habits, finance)
- Ollama model manager (pull/delete models from within the app)
- Multi-window support
- Collective → browser integration (ask Logos about current page)
- Voice input
- Export chat as PDF/markdown
