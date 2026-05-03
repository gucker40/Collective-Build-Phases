"""main.py — The Collective Phase 4 backend."""

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config import APPDATA, load_config, save_config, load_secrets, save_secrets
from db import init_db

from routers import (
    chat, artifacts, history, memory, vault, users, network, skills,
    finance, tasks, mindmap, board,
)
from services.web_search import router as search_router
from inference.engine import warmup as engine_warmup


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    asyncio.create_task(_delayed_warmup())
    yield


async def _delayed_warmup():
    await asyncio.sleep(8)
    try:
        await engine_warmup()
    except Exception:
        pass
    # Auto-start tunnel if configured
    try:
        from config import get_secret, load_config as _lc
        from routers.network import start_tunnel, tunnel_running
        cfg = _lc()
        if cfg.get("web_enabled") and get_secret("tunnel_token") and not tunnel_running():
            await start_tunnel()
    except Exception:
        pass


app = FastAPI(title="The Collective", version="4.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(users.router,     prefix="/users",     tags=["auth"])
app.include_router(chat.router,      prefix="/logos",     tags=["logos"])
app.include_router(artifacts.router, prefix="/artifacts", tags=["artifacts"])
app.include_router(history.router,   prefix="/history",   tags=["history"])
app.include_router(memory.router,    prefix="/memory",    tags=["memory"])
app.include_router(vault.router,     prefix="/vault",     tags=["vault"])
app.include_router(network.router,   prefix="/network",   tags=["network"])
app.include_router(skills.router,    prefix="/skills",    tags=["skills"])
app.include_router(finance.router,   prefix="/finance",   tags=["finance"])
app.include_router(tasks.router,     prefix="/tasks",     tags=["tasks"])
app.include_router(mindmap.router,   prefix="/mindmap",   tags=["mindmap"])
app.include_router(board.router,     prefix="/board",     tags=["board"])
app.include_router(search_router,    prefix="/search",    tags=["search"])

# ── Codebase self-edit API ────────────────────────────────────────────────────
from fastapi import APIRouter as _APIRouter
from services import codebase as _cb

_cb_router = _APIRouter()

@_cb_router.get("/files")
async def cb_list(pattern: str = "**/*.py"):
    return {"files": _cb.list_files(pattern)}

@_cb_router.get("/read")
async def cb_read(path: str):
    return _cb.read_file(path)

@_cb_router.post("/suggest")
async def cb_suggest(request: Request):
    body = await request.json()
    return _cb.suggest_edit(body["path"], body.get("old",""), body["new"])

@_cb_router.post("/apply")
async def cb_apply(request: Request):
    body = await request.json()
    return _cb.apply_edit(body["path"], body.get("old",""), body["new"])

@_cb_router.post("/revert")
async def cb_revert(request: Request):
    body = await request.json()
    return _cb.revert_edit(body["path"])

app.include_router(_cb_router, prefix="/logos/codebase", tags=["codebase"])

# ── Settings ──────────────────────────────────────────────────────────────────

@app.get("/settings")
async def get_settings():
    cfg = load_config()
    sec = load_secrets()
    return {
        **cfg,
        "groq_key":      "***configured***" if sec.get("groq_key") else "",
        "anthropic_key": "***configured***" if sec.get("anthropic_key") else "",
    }

@app.post("/settings")
async def post_settings(request: Request):
    body = await request.json()
    secrets_update = {}
    if body.get("groq_key") and body["groq_key"] != "***configured***":
        secrets_update["groq_key"] = body.pop("groq_key")
    if body.get("anthropic_key") and body["anthropic_key"] != "***configured***":
        secrets_update["anthropic_key"] = body.pop("anthropic_key")
    if secrets_update:
        save_secrets(secrets_update)
    save_config(body)
    return {"saved": True}

@app.post("/test/{provider}")
async def test_provider(provider: str):
    from config import load_config as _lc, get_secret
    cfg = _lc()
    import time, httpx
    start = time.time()
    ms = lambda: int((time.time() - start) * 1000)
    try:
        if provider == "groq":
            key = get_secret("groq_key")
            if not key:
                return {"ok": False, "ms": 0, "msg": "No API key configured"}
            from inference.providers.groq import complete
            result = await complete(
                [{"role":"system","content":"Reply: ready"},{"role":"user","content":"?"}],
                key, "llama-3.1-8b-instant"
            )
            ok = bool(result) and not result.startswith("*")
            return {"ok": ok, "ms": ms(), "msg": f"{ms()}ms" if ok else result[:80]}
        elif provider in ("ollama", "lmstudio"):
            url = cfg.get(f"{provider}_url", "http://localhost:11434" if provider == "ollama" else "http://localhost:1234")
            path = "/api/tags" if provider == "ollama" else "/v1/models"
            async with httpx.AsyncClient(timeout=10.0) as c:
                r = await c.get(f"{url}{path}")
            ok = r.status_code == 200
            return {"ok": ok, "ms": ms(), "msg": f"{ms()}ms" if ok else "Not running"}
        return {"ok": False, "ms": 0, "msg": "Unknown provider"}
    except Exception as e:
        return {"ok": False, "ms": ms(), "msg": str(e)[:100]}

# ── SPA serving ───────────────────────────────────────────────────────────────

_DIST_ENV  = os.environ.get("TC_WEB_DIST", "")
_DIST      = Path(_DIST_ENV) if _DIST_ENV and Path(_DIST_ENV).exists() \
             else Path(__file__).parent.parent / "frontend" / "dist"
_WEB       = _DIST.exists()

if _WEB:
    _ASSETS = _DIST / "assets"
    if _ASSETS.exists():
        app.mount("/assets", StaticFiles(directory=str(_ASSETS)), name="assets")

    @app.get("/app", include_in_schema=False)
    @app.get("/app/{path:path}", include_in_schema=False)
    async def serve_spa(path: str = ""):
        return FileResponse(str(_DIST / "index.html"))


@app.get("/")
async def root():
    if _WEB:
        return FileResponse(str(_DIST / "index.html"))
    return {"status": "online", "service": "The Collective", "version": "4.0.0"}

@app.get("/health")
async def health():
    return {"status": "ok", "version": "4.0.0"}

@app.get("/status")
async def status():
    return {"status": "online", "service": "The Collective", "version": "4.0.0", "web_enabled": _WEB}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, log_level="warning")
