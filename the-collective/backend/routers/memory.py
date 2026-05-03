"""memory.py — Sealed memory vault (SQLite-backed)."""

import json
import time
import uuid
from typing import List, Optional

import aiosqlite
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from db import get_db
from routers.users import get_current_user

router = APIRouter()


class SealRequest(BaseModel):
    text: str
    type: Optional[str] = "Conversation"
    tags: Optional[List[str]] = []


@router.post("/seal")
async def seal(
    request: SealRequest,
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    user_id = user["id"] if user else "anonymous"
    mid = str(uuid.uuid4())
    now = time.time()
    await db.execute(
        "INSERT INTO memories (id,user_id,text,type,tags,timestamp) VALUES (?,?,?,?,?,?)",
        (mid, user_id, request.text, request.type, json.dumps(request.tags or []), now)
    )
    await db.commit()
    return {"id": mid, "sealed": True, "type": request.type, "timestamp": now}


@router.get("/list")
async def list_memories(
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    user_id = user["id"] if user else "anonymous"
    rows = await db.execute_fetchall(
        "SELECT * FROM memories WHERE user_id=? ORDER BY timestamp DESC", (user_id,)
    )
    mems = []
    for r in rows:
        d = dict(r)
        d["tags"] = json.loads(d.get("tags") or "[]")
        d["preview"] = (d.get("text") or "")[:120]
        mems.append(d)
    return {"memories": mems, "total": len(mems)}


@router.post("/search")
async def search(
    query: str,
    n: int = 10,
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    user_id = user["id"] if user else "anonymous"
    rows = await db.execute_fetchall(
        "SELECT * FROM memories WHERE user_id=? ORDER BY timestamp DESC", (user_id,)
    )
    query_words = set(query.lower().split())
    scored = []
    for r in rows:
        text_words = set((r["text"] or "").lower().split())
        score = len(query_words & text_words)
        if score > 0:
            scored.append((score, dict(r)))
    scored.sort(key=lambda x: (x[0], x[1].get("timestamp", 0)), reverse=True)
    results = [m for _, m in scored[:n]]
    for m in results:
        m["tags"] = json.loads(m.get("tags") or "[]")
    return {"results": results, "query": query}


@router.delete("/unseal/{mid}")
async def unseal(
    mid: str,
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    user_id = user["id"] if user else "anonymous"
    await db.execute("DELETE FROM memories WHERE id=? AND user_id=?", (mid, user_id))
    await db.commit()
    return {"unsealed": True, "id": mid}
