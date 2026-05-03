"""tasks.py — Productivity pillar (Phase 4 Step 3). Schema ready; UI coming next phase."""
import time, uuid
from typing import Optional
import aiosqlite
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from db import get_db
from routers.users import get_current_user

router = APIRouter()

class TaskIn(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "todo"
    due_date: Optional[str] = None
    project_id: Optional[str] = None

@router.get("/status")
async def status(): return {"status": "Phase 4 Step 3 — coming soon"}

@router.get("/list")
async def list_tasks(user: Optional[dict] = Depends(get_current_user), db: aiosqlite.Connection = Depends(get_db)):
    user_id = user["id"] if user else "anonymous"
    rows = await db.execute_fetchall("SELECT * FROM tasks WHERE user_id=? ORDER BY created_at DESC", (user_id,))
    return {"tasks": [dict(r) for r in rows]}

@router.post("/create")
async def create_task(body: TaskIn, user: Optional[dict] = Depends(get_current_user), db: aiosqlite.Connection = Depends(get_db)):
    user_id = user["id"] if user else "anonymous"
    now = time.time(); tid = str(uuid.uuid4())
    await db.execute("INSERT INTO tasks (id,user_id,title,description,status,due_date,project_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                     (tid,user_id,body.title,body.description,body.status,body.due_date,body.project_id,now,now))
    await db.commit()
    return {"id": tid, "saved": True}
