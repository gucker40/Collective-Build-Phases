"""
vault.py - Vault file system endpoints
Serves the note-taking vault: list, save, load Markdown files.
Files stored at %APPDATA%/logos-app/vault/
"""

import os
import aiofiles
from pathlib import Path
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

VAULT_PATH = Path(os.environ.get("APPDATA", os.path.expanduser("~"))) / "logos-app" / "vault"
VAULT_PATH.mkdir(parents=True, exist_ok=True)


class SaveRequest(BaseModel):
    filename: str
    content: str


def safe_path(filename: str) -> Path:
    """Ensure filename stays within vault directory (no path traversal)."""
    # Strip any path components, keep only the filename
    clean = Path(filename).name
    if not clean.endswith(".md"):
        clean += ".md"
    return VAULT_PATH / clean


@router.get("/files")
async def list_files():
    """List all Markdown files in the vault."""
    try:
        files = sorted([
            f.name for f in VAULT_PATH.iterdir()
            if f.is_file() and f.suffix == ".md"
        ])
        return {"files": files, "vault_path": str(VAULT_PATH)}
    except Exception as e:
        return {"files": [], "error": str(e)}


@router.post("/save")
async def save_file(request: SaveRequest):
    """Save (create or overwrite) a Markdown note."""
    path = safe_path(request.filename)
    async with aiofiles.open(path, "w", encoding="utf-8") as f:
        await f.write(request.content)
    return {"saved": True, "filename": path.name, "size": len(request.content)}


@router.get("/load")
async def load_file(filename: str):
    """Load a Markdown note by filename."""
    path = safe_path(filename)
    if not path.exists():
        return {"content": "", "error": "File not found"}
    async with aiofiles.open(path, "r", encoding="utf-8") as f:
        content = await f.read()
    return {"filename": path.name, "content": content}


@router.delete("/delete")
async def delete_file(filename: str):
    """Delete a note from the vault."""
    path = safe_path(filename)
    if path.exists():
        path.unlink()
        return {"deleted": True, "filename": filename}
    return {"deleted": False, "error": "File not found"}
