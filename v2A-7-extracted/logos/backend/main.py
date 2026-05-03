"""main.py - FastAPI app for Logos - Phase 2"""

import asyncio
import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from models import load_config, save_config, get_loaded_models, warmup_all, test_provider

APPDATA = Path(os.environ.get("APPDATA", os.path.expanduser("~"))) / "logos-app"
for d in [APPDATA, APPDATA/"vault", APPDATA/"memory", APPDATA/"history",
          APPDATA/"logs", APPDATA/"users", APPDATA/"artifacts"]:
    d.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="The Collective Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

from router    import router as logos_router
from artifacts import router as artifacts_router
from vault     import router as vault_router
from memory    import router as memory_router
from history   import router as history_router
from users     import router as users_router
from network   import router as network_router

app.include_router(logos_router,     prefix="/logos")
app.include_router(artifacts_router, prefix="/artifacts")
app.include_router(vault_router,     prefix="/vault")
app.include_router(memory_router,    prefix="/memory")
app.include_router(history_router,   prefix="/history")
app.include_router(users_router,     prefix="/users")
app.include_router(network_router,   prefix="/network")

# ── Serve Vite-built React app for browser/mobile access ─────────────────────
# In production: electron.js sets TC_WEB_DIST env var to the correct dist path
# In dev: fall back to relative path from source
import os as _os
_DIST_ENV = _os.environ.get("TC_WEB_DIST", "")
if _DIST_ENV and Path(_DIST_ENV).exists():
    _DIST = Path(_DIST_ENV)
else:
    # Dev mode: dist is two levels up from backend/
    _DIST = Path(__file__).parent.parent / "frontend" / "dist"
_WEB  = _DIST.exists()

if _WEB:
    # Serve static assets
    _ASSETS = _DIST / "assets"
    if _ASSETS.exists():
        app.mount("/assets", StaticFiles(directory=str(_ASSETS)), name="assets")

    # Serve index.html for all non-API routes so React Router works
    @app.get("/app", include_in_schema=False)
    @app.get("/app/{path:path}", include_in_schema=False)
    async def serve_spa(path: str = ""):
        return FileResponse(str(_DIST / "index.html"))

@app.get("/")
async def root():
    if _WEB:
        # Serve the React app directly at root
        return FileResponse(str(_DIST / "index.html"))
    return {"status": "online", "service": "The Collective", "web_enabled": False}

@app.get("/status")
async def status():
    return {"status": "online", "service": "The Collective", "web_enabled": _WEB}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/settings")
async def get_settings():
    return load_config()

@app.post("/settings")
async def post_settings(request: Request):
    body = await request.json()
    save_config(body)
    return {"saved": True}

@app.post("/test/{provider}")
async def test_connection(provider: str):
    cfg = load_config()
    result = await test_provider(provider, cfg)
    return result

@app.post("/preload")
async def preload():
    asyncio.create_task(warmup_all())
    return {"started": True}

@app.on_event("startup")
async def on_startup():
    async def delayed():
        await asyncio.sleep(10)
        await warmup_all()
        from network import load_network_config, start_tunnel, tunnel_running
        cfg = load_network_config()
        # Only auto-start if explicitly enabled AND not already running
        # tunnel_enabled defaults to False — user must opt in via Dev Console
        if cfg.get("tunnel_enabled") and cfg.get("tunnel_token") and not tunnel_running():
            await start_tunnel()
    asyncio.create_task(delayed())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, log_level="warning")
