"""tasks.py — Productivity pillar tasks CRUD."""
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
    notes: Optional[str] = None
    priority: str = "medium"
    done: bool = False
    due_date: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    priority: Optional[str] = None
    done: Optional[bool] = None
    due_date: Optional[str] = None

def _row(r) -> dict:
    d = dict(r)
    d["done"] = bool(d.get("done", 0))
    return d

@router.get("/list")
async def list_tasks(
    user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    rows = await db.execute_fetchall(
        "SELECT * FROM tasks WHERE user_id=? ORDER BY created_at DESC",
        (user["id"],),
    )
    return [_row(r) for r in rows]

@router.post("/create")
async def create_task(
    body: TaskIn,
    user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    now = time.time()
    tid = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO tasks (id,user_id,title,description,status,done,priority,due_date,created_at,updated_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?)",
        (tid, user["id"], body.title, body.notes, "todo",
         1 if body.done else 0, body.priority, body.due_date, now, now),
    )
    await db.commit()
    return {"id": tid, "title": body.title, "notes": body.notes,
            "priority": body.priority, "done": body.done,
            "created_at": now, "updated_at": now}

@router.put("/update/{task_id}")
async def update_task(
    task_id: str,
    body: TaskUpdate,
    user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    updates, vals = [], []
    if body.title    is not None: updates.append("title=?");       vals.append(body.title)
    if body.notes    is not None: updates.append("description=?"); vals.append(body.notes)
    if body.priority is not None: updates.append("priority=?");    vals.append(body.priority)
    if body.done     is not None:
        updates.append("done=?");   vals.append(1 if body.done else 0)
        updates.append("status=?"); vals.append("done" if body.done else "todo")
    if body.due_date is not None: updates.append("due_date=?");    vals.append(body.due_date)
    if not updates:
        return {"updated": False}
    updates.append("updated_at=?"); vals.append(time.time())
    vals += [task_id, user["id"]]
    await db.execute(
        f"UPDATE tasks SET {', '.join(updates)} WHERE id=? AND user_id=?", vals
    )
    await db.commit()
    row = await db.execute_fetchall("SELECT * FROM tasks WHERE id=?", (task_id,))
    return _row(row[0]) if row else {"updated": True}

@router.delete("/delete/{task_id}")
async def delete_task(
    task_id: str,
    user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    await db.execute("DELETE FROM tasks WHERE id=? AND user_id=?", (task_id, user["id"]))
    await db.commit()
    return {"deleted": task_id}
