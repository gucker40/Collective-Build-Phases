"""chat.py — Main Logos chat endpoint with SSE streaming."""

import json
import time
from typing import List, Optional

import aiosqlite
from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from db import get_db
from routers.users import get_current_user
from inference.router import detect_intent, route_stream
from inference.engine import vision_complete, warmup

router = APIRouter()


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    intent: Optional[str] = None
    memory_enabled: bool = True
    skill_ids: Optional[List[str]] = None


class IntentRequest(BaseModel):
    prompt: str


async def _get_memories(user_id: str, query: str, db: aiosqlite.Connection, n: int = 4) -> list:
    words = set(query.lower().split())
    rows = await db.execute_fetchall(
        "SELECT text, type, tags, timestamp FROM memories WHERE user_id=? ORDER BY timestamp DESC LIMIT 100",
        (user_id,)
    )
    scored = []
    for r in rows:
        row_words = set((r["text"] or "").lower().split())
        score = len(words & row_words)
        if score > 0:
            scored.append((score, dict(r)))
    scored.sort(key=lambda x: (x[0], x[1].get("timestamp", 0)), reverse=True)
    return [m for _, m in scored[:n]]


async def _get_active_skills(skill_ids: Optional[List[str]], db: aiosqlite.Connection) -> list:
    if not skill_ids:
        rows = await db.execute_fetchall("SELECT content_json FROM skills WHERE enabled=1")
    else:
        placeholders = ",".join("?" * len(skill_ids))
        rows = await db.execute_fetchall(
            f"SELECT content_json FROM skills WHERE enabled=1 AND id IN ({placeholders})",
            tuple(skill_ids)
        )
    skills = []
    for r in rows:
        try:
            skills.append(json.loads(r["content_json"]))
        except Exception:
            pass
    return skills


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    user: Optional[dict] = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    intent = request.intent or detect_intent(last_user)
    user_id = user["id"] if user else "anonymous"

    if intent == "remember":
        async def remember_stream():
            import uuid, time as _time
            mid = str(uuid.uuid4())
            try:
                await db.execute(
                    "INSERT INTO memories (id,user_id,text,type,timestamp) VALUES (?,?,?,?,?)",
                    (mid, user_id, last_user, "Conversation", _time.time())
                )
                await db.commit()
                msg = "✦ Sealed to memory."
            except Exception as e:
                msg = f"Memory seal failed: {e}"
            yield f"data: {json.dumps({'type':'content','content':msg})}\n\n"
            yield f"data: {json.dumps({'type':'done','member':'memory','intent':'remember'})}\n\n"
        return StreamingResponse(remember_stream(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    memories = []
    if request.memory_enabled and user:
        try:
            memories = await _get_memories(user_id, last_user, db)
        except Exception:
            pass

    active_skills = []
    try:
        active_skills = await _get_active_skills(request.skill_ids, db)
    except Exception:
        pass

    from inference.router import select_member
    member = select_member(intent)

    async def stream_gen():
        async for chunk in route_stream(messages, intent, memories, active_skills):
            yield f"data: {json.dumps({'type':'content','content':chunk})}\n\n"
        yield f"data: {json.dumps({'type':'done','member':member,'intent':intent})}\n\n"

    return StreamingResponse(
        stream_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/intent")
async def analyze_intent(request: IntentRequest):
    intent = detect_intent(request.prompt)
    return {"intent": intent}


@router.post("/vision")
async def vision(file: UploadFile = File(...), prompt: str = "Describe this image in detail."):
    import base64
    contents = await file.read()
    b64 = base64.b64encode(contents).decode()
    result = await vision_complete(b64, prompt, file.content_type or "image/png")
    return {"analysis": result, "member": "opsis"}


@router.get("/status")
async def logos_status(db: aiosqlite.Connection = Depends(get_db)):
    from config import load_config, get_secret
    from inference.engine import _native_models
    cfg = load_config()
    provider = cfg.get("provider", "groq")
    groq_ok = bool(get_secret("groq_key"))

    council = {
        "pneuma": False,
        "techne": False,
        "opsis":  False,
    }

    if provider == "native":
        for k in council:
            council[k] = k in _native_models
    elif groq_ok:
        council["pneuma"] = True
        council["techne"] = True
    else:
        import httpx
        oll_url = cfg.get("ollama_url", "http://localhost:11434")
        try:
            async with httpx.AsyncClient(timeout=3.0) as c:
                r = await c.get(f"{oll_url}/api/tags")
                if r.status_code == 200:
                    models = [m["name"] for m in r.json().get("models", [])]
                    council["pneuma"] = any("qwen3" in m or "llama" in m or "mistral" in m for m in models)
                    council["techne"] = any("coder" in m for m in models)
                    council["opsis"]  = any("vl" in m or "llava" in m for m in models)
        except Exception:
            pass

    return {
        "logos": "active",
        "provider": provider,
        "council": council,
        "groq_configured": groq_ok,
        "native_available": len(_native_models) > 0,
    }


@router.post("/warmup")
async def trigger_warmup():
    import asyncio
    asyncio.create_task(warmup())
    return {"started": True}
