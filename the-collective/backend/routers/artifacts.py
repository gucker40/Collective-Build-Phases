"""artifacts.py — SQLite-backed artifact CRUD."""

import io
import json
import time
import uuid
import zipfile
from typing import List, Optional

import aiosqlite
from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from db import get_db
from routers.users import get_current_user, require_user

router = APIRouter()

EXT_MAP = {
    "html":"html","svg":"svg","css":"css","js":"js","ts":"ts",
    "jsx":"jsx","tsx":"tsx","python":"py","sql":"sql","bash":"sh",
    "csv":"csv","json":"json","md":"md",
}
LANG_FROM_EXT = {v: k for k, v in EXT_MAP.items()}
LANG_FROM_EXT.update({"htm":"html","sh":"bash","py":"python"})


def _time_ago(ts: float) -> str:
    d = int(time.time()) - int(ts or 0)
    if d < 60:    return "just now"
    if d < 3600:  return f"{d // 60}m ago"
    if d < 86400: return f"{d // 3600}h ago"
    return f"{d // 86400}d ago"


class SaveRequest(BaseModel):
    id: Optional[str] = None
    title: str = "Untitled"
    language: str = "html"
    content: str = ""
    tags: Optional[List[str]] = []


@router.post("/save")
async def save_artifact(
    body: SaveRequest,
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    user_id = user["id"] if user else "anonymous"
    aid = body.id or str(uuid.uuid4())[:8]
    now = time.time()

    existing = await db.execute_fetchall("SELECT id FROM artifacts WHERE id=?", (aid,))
    if existing:
        await db.execute(
            "UPDATE artifacts SET title=?,language=?,content=?,tags=? WHERE id=?",
            (body.title, body.language, body.content, json.dumps(body.tags or []), aid)
        )
    else:
        await db.execute(
            "INSERT INTO artifacts (id,user_id,title,language,content,created_at,tags) VALUES (?,?,?,?,?,?,?)",
            (aid, user_id, body.title, body.language, body.content, now, json.dumps(body.tags or []))
        )
    await db.commit()
    return {"id": aid, "saved": True}


@router.get("/list")
async def list_artifacts(
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    user_id = user["id"] if user else "anonymous"
    rows = await db.execute_fetchall(
        "SELECT id,title,language,created_at,tags FROM artifacts WHERE user_id=? ORDER BY created_at DESC",
        (user_id,)
    )
    arts = []
    for r in rows:
        d = dict(r)
        d["created_ago"] = _time_ago(d.get("created_at", 0))
        d["tags"] = json.loads(d.get("tags") or "[]")
        arts.append(d)
    return {"artifacts": arts}


@router.get("/get/{aid}")
async def get_artifact(
    aid: str,
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    rows = await db.execute_fetchall("SELECT * FROM artifacts WHERE id=?", (aid,))
    if not rows:
        return JSONResponse({"error": "not found"}, 404)
    r = dict(rows[0])
    r["tags"] = json.loads(r.get("tags") or "[]")
    r["created_ago"] = _time_ago(r.get("created_at", 0))
    return r


@router.delete("/delete/{aid}")
async def delete_artifact(
    aid: str,
    user: dict = Depends(require_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    await db.execute("DELETE FROM artifacts WHERE id=? AND user_id=?", (aid, user["id"]))
    await db.commit()
    return {"deleted": aid}


@router.post("/upload")
async def upload_artifacts(
    files: List[UploadFile] = File(...),
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    user_id = user["id"] if user else "anonymous"
    saved, errors = [], []

    for upload in files:
        raw  = await upload.read()
        fname = upload.filename or "upload"
        ext   = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""

        if ext == "zip":
            try:
                with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                    for member in zf.namelist():
                        if member.endswith("/") or "__MACOSX" in member:
                            continue
                        mext = member.rsplit(".", 1)[-1].lower() if "." in member else ""
                        lang = LANG_FROM_EXT.get(mext)
                        if not lang:
                            continue
                        try:
                            content = zf.read(member).decode("utf-8", errors="replace")
                            title   = member.split("/")[-1].rsplit(".", 1)[0]
                            aid     = str(uuid.uuid4())[:8]
                            await db.execute(
                                "INSERT INTO artifacts (id,user_id,title,language,content,created_at) VALUES (?,?,?,?,?,?)",
                                (aid, user_id, title, lang, content, time.time())
                            )
                            saved.append({"id": aid, "title": title, "language": lang})
                        except Exception as e:
                            errors.append(f"{member}: {e}")
            except Exception as e:
                errors.append(f"{fname}: {e}")
        else:
            try:
                content = raw.decode("utf-8", errors="replace")
                title   = fname.rsplit(".", 1)[0] if "." in fname else fname
                lang    = LANG_FROM_EXT.get(ext, "html")
                aid     = str(uuid.uuid4())[:8]
                await db.execute(
                    "INSERT INTO artifacts (id,user_id,title,language,content,created_at) VALUES (?,?,?,?,?,?)",
                    (aid, user_id, title, lang, content, time.time())
                )
                saved.append({"id": aid, "title": title, "language": lang})
            except Exception as e:
                errors.append(f"{fname}: {e}")

    await db.commit()
    return {"saved": saved, "count": len(saved), "errors": errors}
