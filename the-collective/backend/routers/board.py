"""board.py — Collective Board community posts (Phase 4 Step 3)."""
import time, uuid
from typing import Optional
import aiosqlite
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from db import get_db
from routers.users import get_current_user, require_user

router = APIRouter()

class PostIn(BaseModel):
    title: str
    body: str
    type: str = "Discussion"  # Feature Request | Bug Report | Discussion | Showcase

@router.get("/posts")
async def list_posts(db: aiosqlite.Connection = Depends(get_db)):
    rows = await db.execute_fetchall("SELECT p.*, u.display_name FROM board_posts p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 50")
    return {"posts": [dict(r) for r in rows]}

@router.post("/posts")
async def create_post(body: PostIn, user: dict = Depends(require_user), db: aiosqlite.Connection = Depends(get_db)):
    pid = str(uuid.uuid4())
    await db.execute("INSERT INTO board_posts (id,user_id,title,body,type,votes,created_at) VALUES (?,?,?,?,?,0,?)",
                     (pid,user["id"],body.title,body.body,body.type,time.time()))
    await db.commit()
    return {"id": pid, "created": True}

@router.post("/posts/{pid}/vote")
async def vote_post(pid: str, db: aiosqlite.Connection = Depends(get_db)):
    await db.execute("UPDATE board_posts SET votes=votes+1 WHERE id=?", (pid,))
    await db.commit()
    return {"voted": True}

@router.delete("/posts/{pid}")
async def delete_post(pid: str, user: dict = Depends(require_user), db: aiosqlite.Connection = Depends(get_db)):
    await db.execute("DELETE FROM board_posts WHERE id=? AND user_id=?", (pid, user["id"]))
    await db.commit()
    return {"deleted": pid}
