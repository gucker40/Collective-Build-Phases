"""history.py — Chat session persistence (SQLite-backed)."""

import json
import re
import time
import uuid
from typing import List, Optional

import aiosqlite
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from db import get_db
from routers.users import get_current_user

router = APIRouter()


class MessageIn(BaseModel):
    role: str
    content: str


class SaveRequest(BaseModel):
    session_id: Optional[str] = None
    messages: List[MessageIn]
    title: Optional[str] = None


STOP_WORDS = {
    "a","an","the","is","are","was","were","be","been","being","have","has","had",
    "do","does","did","will","would","could","should","may","might","can",
    "i","my","me","we","our","you","your","it","its","this","that","these","those",
    "what","how","why","when","where","who","which","please","help","make",
    "create","write","tell","show","give","get","find","need","want",
}


def auto_title(messages: list) -> str:
    user_msgs = [m for m in messages if m.get("role") == "user"]
    if not user_msgs:
        return "Untitled"
    text = user_msgs[0].get("content", "").strip()
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'[#*`_\[\]()]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    words = text.split()
    meaningful = []
    for w in words:
        clean = re.sub(r'[^a-zA-Z0-9]', '', w).lower()
        if clean and clean not in STOP_WORDS and len(clean) > 2:
            meaningful.append(w.rstrip('.,!?;:'))
    if not meaningful:
        return " ".join(text.split()[:4])[:40] or "Untitled"
    title = " ".join(meaningful[:4])
    title = " ".join(w.capitalize() if w.lower() == w else w for w in title.split())
    return title[:45]


@router.post("/save")
async def save_history(
    request: SaveRequest,
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    user_id  = user["id"] if user else "anonymous"
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    now      = time.time()

    if request.session_id:
        rows = await db.execute_fetchall("SELECT id,title FROM sessions WHERE id=? AND user_id=?",
                                         (request.session_id, user_id))
        if rows:
            sid = rows[0]["id"]
            title = rows[0]["title"] or auto_title(messages)
            await db.execute("UPDATE sessions SET title=?,updated_at=? WHERE id=?", (title, now, sid))
            await db.execute("DELETE FROM messages WHERE session_id=?", (sid,))
            for msg in messages:
                await db.execute(
                    "INSERT INTO messages (id,session_id,user_id,role,content,created_at) VALUES (?,?,?,?,?,?)",
                    (str(uuid.uuid4()), sid, user_id, msg["role"], msg["content"], now)
                )
            await db.commit()
            return {"id": sid, "title": title}

    sid   = request.session_id or str(uuid.uuid4())
    title = request.title or auto_title(messages)
    await db.execute(
        "INSERT INTO sessions (id,user_id,title,created_at,updated_at) VALUES (?,?,?,?,?)",
        (sid, user_id, title, now, now)
    )
    for msg in messages:
        await db.execute(
            "INSERT INTO messages (id,session_id,user_id,role,content,created_at) VALUES (?,?,?,?,?,?)",
            (str(uuid.uuid4()), sid, user_id, msg["role"], msg["content"], now)
        )
    await db.commit()
    return {"id": sid, "title": title}


@router.get("/list")
async def list_history(
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    user_id = user["id"] if user else "anonymous"
    rows = await db.execute_fetchall(
        "SELECT s.id, s.title, s.created_at, s.updated_at, COUNT(m.id) AS message_count "
        "FROM sessions s LEFT JOIN messages m ON m.session_id=s.id "
        "WHERE s.user_id=? GROUP BY s.id ORDER BY s.updated_at DESC",
        (user_id,)
    )
    return {"sessions": [dict(r) for r in rows]}


@router.get("/load/{session_id}")
async def load_history(
    session_id: str,
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    user_id = user["id"] if user else "anonymous"
    rows = await db.execute_fetchall("SELECT * FROM sessions WHERE id=? AND user_id=?",
                                      (session_id, user_id))
    if not rows:
        return {"id": session_id, "messages": [], "title": ""}
    session = dict(rows[0])
    msgs = await db.execute_fetchall(
        "SELECT role,content FROM messages WHERE session_id=? ORDER BY created_at",
        (session_id,)
    )
    session["messages"] = [dict(m) for m in msgs]
    return session


@router.delete("/delete/{session_id}")
async def delete_history(
    session_id: str,
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    user_id = user["id"] if user else "anonymous"
    await db.execute("DELETE FROM messages WHERE session_id=?", (session_id,))
    await db.execute("DELETE FROM sessions WHERE id=? AND user_id=?", (session_id, user_id))
    await db.commit()
    return {"deleted": True}
