"""vault.py — Encrypted notes vault (SQLite-backed)."""

import time
import uuid
from typing import Optional

import aiosqlite
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from db import get_db
from routers.users import get_current_user

router = APIRouter()


class SaveRequest(BaseModel):
    id: Optional[str] = None
    filename: str
    content: str


def _safe_name(filename: str) -> str:
    import re
    name = re.sub(r'[^\w\-. ]', '_', filename)
    if not name.endswith(".md"):
        name += ".md"
    return name[:120]


@router.get("/files")
async def list_files(
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    user_id = user["id"] if user else "anonymous"
    rows = await db.execute_fetchall(
        "SELECT id,filename,created_at,updated_at FROM vault_items WHERE user_id=? ORDER BY updated_at DESC",
        (user_id,)
    )
    return {"files": [dict(r) for r in rows]}


@router.post("/save")
async def save_file(
    request: SaveRequest,
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    user_id  = user["id"] if user else "anonymous"
    filename = _safe_name(request.filename)
    now      = time.time()

    if request.id:
        rows = await db.execute_fetchall("SELECT id FROM vault_items WHERE id=? AND user_id=?",
                                          (request.id, user_id))
        if rows:
            await db.execute(
                "UPDATE vault_items SET filename=?,content=?,updated_at=? WHERE id=?",
                (filename, request.content, now, request.id)
            )
            await db.commit()
            return {"saved": True, "id": request.id, "filename": filename}

    vid = request.id or str(uuid.uuid4())[:8]
    await db.execute(
        "INSERT INTO vault_items (id,user_id,filename,content,created_at,updated_at) VALUES (?,?,?,?,?,?)",
        (vid, user_id, filename, request.content, now, now)
    )
    await db.commit()
    return {"saved": True, "id": vid, "filename": filename}


@router.get("/load")
async def load_file(
    filename: str,
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    user_id = user["id"] if user else "anonymous"
    name = _safe_name(filename)
    rows = await db.execute_fetchall(
        "SELECT * FROM vault_items WHERE filename=? AND user_id=?", (name, user_id)
    )
    if not rows:
        return {"content": "", "error": "File not found"}
    r = dict(rows[0])
    return {"id": r["id"], "filename": r["filename"], "content": r["content"]}


@router.delete("/delete")
async def delete_file(
    filename: str,
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    user_id = user["id"] if user else "anonymous"
    name = _safe_name(filename)
    await db.execute("DELETE FROM vault_items WHERE filename=? AND user_id=?", (name, user_id))
    await db.commit()
    return {"deleted": True, "filename": filename}
