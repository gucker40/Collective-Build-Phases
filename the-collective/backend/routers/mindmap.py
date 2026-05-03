"""mindmap.py — Mind Map data (Phase 4 Step 3). Keyword engine live; D3 visualization next phase."""
from typing import Optional
import aiosqlite
from fastapi import APIRouter, Depends
from db import get_db
from routers.users import get_current_user

router = APIRouter()

@router.get("/graph")
async def get_graph(user: Optional[dict] = Depends(get_current_user), db: aiosqlite.Connection = Depends(get_db)):
    user_id = user["id"] if user else "anonymous"
    sessions = await db.execute_fetchall("SELECT id,title FROM sessions WHERE user_id=? ORDER BY updated_at DESC LIMIT 50", (user_id,))
    artifacts = await db.execute_fetchall("SELECT id,title,language FROM artifacts WHERE user_id=? ORDER BY created_at DESC LIMIT 50", (user_id,))
    nodes, edges = [], []
    for s in sessions:
        nodes.append({"id": f"chat_{s['id']}", "label": s["title"] or "Chat", "type": "chat", "color": "#a07aff"})
    for a in artifacts:
        nodes.append({"id": f"art_{a['id']}", "label": a["title"] or "Artifact", "type": "artifact", "color": "#f0c040"})
    return {"nodes": nodes, "edges": edges, "status": "Phase 4 Step 3 — full graph coming soon"}
