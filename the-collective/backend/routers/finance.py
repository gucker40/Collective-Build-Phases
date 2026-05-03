"""finance.py — Finance pillar transactions CRUD."""
import time, uuid
from typing import Optional
import aiosqlite
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from db import get_db
from routers.users import get_current_user

router = APIRouter()

class TransactionIn(BaseModel):
    amount: float           # positive = income, negative = expense
    description: Optional[str] = None
    category: str = "Other"
    date: Optional[str] = None
    account_id: Optional[str] = None

@router.get("/list")
async def list_transactions(
    user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    rows = await db.execute_fetchall(
        "SELECT * FROM transactions WHERE user_id=? ORDER BY date DESC, created_at DESC LIMIT 500",
        (user["id"],),
    )
    return [dict(r) for r in rows]

@router.post("/create")
async def create_transaction(
    body: TransactionIn,
    user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    tid = str(uuid.uuid4())
    tx_type = "income" if body.amount >= 0 else "expense"
    date = body.date or time.strftime("%Y-%m-%d")
    await db.execute(
        "INSERT INTO transactions (id,user_id,amount,type,category,description,date,account_id,source,created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?)",
        (tid, user["id"], body.amount, tx_type, body.category,
         body.description, date, body.account_id, "manual", time.time()),
    )
    await db.commit()
    return {"id": tid, "amount": body.amount, "type": tx_type,
            "description": body.description, "category": body.category, "date": date}

@router.delete("/delete/{tid}")
async def delete_transaction(
    tid: str,
    user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    await db.execute("DELETE FROM transactions WHERE id=? AND user_id=?", (tid, user["id"]))
    await db.commit()
    return {"deleted": tid}
