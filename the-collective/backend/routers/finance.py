"""finance.py — Finance pillar (Phase 4 Step 3). Schema ready; UI coming next phase."""
import time, uuid, json
from typing import Optional
import aiosqlite
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from db import get_db
from routers.users import get_current_user

router = APIRouter()

class TransactionIn(BaseModel):
    amount: float
    type: str  # income | expense | transfer
    category: Optional[str] = None
    description: Optional[str] = None
    date: str  # ISO 8601
    account_id: Optional[str] = None

@router.get("/status")
async def status(): return {"status": "Phase 4 Step 3 — coming soon"}

@router.get("/transactions")
async def list_transactions(user: Optional[dict] = Depends(get_current_user), db: aiosqlite.Connection = Depends(get_db)):
    user_id = user["id"] if user else "anonymous"
    rows = await db.execute_fetchall("SELECT * FROM transactions WHERE user_id=? ORDER BY date DESC LIMIT 100", (user_id,))
    return {"transactions": [dict(r) for r in rows]}

@router.post("/transactions")
async def add_transaction(body: TransactionIn, user: Optional[dict] = Depends(get_current_user), db: aiosqlite.Connection = Depends(get_db)):
    user_id = user["id"] if user else "anonymous"
    tid = str(uuid.uuid4())
    await db.execute("INSERT INTO transactions (id,user_id,amount,type,category,description,date,created_at) VALUES (?,?,?,?,?,?,?,?)",
                     (tid, user_id, body.amount, body.type, body.category, body.description, body.date, time.time()))
    await db.commit()
    return {"id": tid, "saved": True}

@router.delete("/transactions/{tid}")
async def delete_transaction(tid: str, user: Optional[dict] = Depends(get_current_user), db: aiosqlite.Connection = Depends(get_db)):
    user_id = user["id"] if user else "anonymous"
    await db.execute("DELETE FROM transactions WHERE id=? AND user_id=?", (tid, user_id))
    await db.commit()
    return {"deleted": tid}
