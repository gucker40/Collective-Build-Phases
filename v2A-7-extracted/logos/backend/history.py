"""
history.py - Chat session persistence with auto-generated titles.
Titles generated from content using rule-based extraction (no Ollama call).
"""

import os
import json
import uuid
import time
import re
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

HISTORY_PATH = (
    Path(os.environ.get("APPDATA", os.path.expanduser("~")))
    / "logos-app" / "history"
)
HISTORY_PATH.mkdir(parents=True, exist_ok=True)


class MessageIn(BaseModel):
    role: str
    content: str


class SaveRequest(BaseModel):
    session_id: Optional[str] = None
    messages: List[MessageIn]
    title: Optional[str] = None


def generate_title(messages: list) -> str:
    """
    Generate a 3-4 word title from message content.
    Rule-based, instant, no model call needed.
    """
    # Get the first user message
    user_msgs = [m for m in messages if m.get("role") == "user"]
    if not user_msgs:
        return "Untitled conversation"

    text = user_msgs[0].get("content", "").strip()
    if not text:
        return "Untitled conversation"

    # Strip code blocks, markdown, punctuation
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'[#*`_\[\]()]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()

    # Common stop words to skip
    stop = {"a","an","the","is","are","was","were","be","been","being",
            "have","has","had","do","does","did","will","would","could",
            "should","may","might","can","i","my","me","we","our","you",
            "your","it","its","this","that","these","those","what","how",
            "why","when","where","who","which","please","help","make",
            "create","write","tell","show","give","get","find","need","want"}

    # Extract meaningful words
    words = text.split()
    meaningful = []
    for w in words:
        clean = re.sub(r'[^a-zA-Z0-9]', '', w).lower()
        if clean and clean not in stop and len(clean) > 2:
            meaningful.append(w.rstrip('.,!?;:'))

    if not meaningful:
        # Fall back to first 4 words
        words4 = text.split()[:4]
        return " ".join(words4)[:40] if words4 else "Untitled conversation"

    # Take first 3-4 meaningful words, title case
    title_words = meaningful[:4]
    title = " ".join(title_words)

    # Title case but preserve acronyms
    title = " ".join(w.capitalize() if w.lower() == w else w for w in title.split())

    return title[:45]


def session_path(session_id: str) -> Path:
    return HISTORY_PATH / f"{session_id}.json"


def load_session(session_id: str) -> Optional[dict]:
    p = session_path(session_id)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def save_session(data: dict) -> bool:
    try:
        session_path(data["id"]).write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        return True
    except Exception:
        return False


@router.post("/save")
async def save_history(request: SaveRequest):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    now = time.time()

    if request.session_id:
        existing = load_session(request.session_id)
        if existing:
            existing["messages"] = messages
            existing["updated_at"] = now
            existing["message_count"] = len(messages)
            # Keep existing title unless we now have more content to work with
            if not existing.get("title") or existing["title"] == "Untitled conversation":
                existing["title"] = generate_title(messages)
            save_session(existing)
            return {"id": existing["id"], "title": existing["title"]}

    # New session
    sid = request.session_id or str(uuid.uuid4())
    title = request.title or generate_title(messages)
    data = {
        "id":            sid,
        "title":         title,
        "messages":      messages,
        "created_at":    now,
        "updated_at":    now,
        "message_count": len(messages),
    }
    save_session(data)
    return {"id": sid, "title": title}


@router.get("/list")
async def list_history():
    sessions = []
    for p in sorted(HISTORY_PATH.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            sessions.append({
                "id":            data["id"],
                "title":         data.get("title", "Untitled"),
                "message_count": data.get("message_count", len(data.get("messages", []))),
                "updated_at":    data.get("updated_at", 0),
                "created_at":    data.get("created_at", 0),
            })
        except Exception:
            continue
    return {"sessions": sessions}


@router.get("/load/{session_id}")
async def load_history(session_id: str):
    data = load_session(session_id)
    if not data:
        return {"id": session_id, "messages": [], "title": ""}
    return data


@router.delete("/delete/{session_id}")
async def delete_history(session_id: str):
    p = session_path(session_id)
    if p.exists():
        p.unlink()
        return {"deleted": True}
    return {"deleted": False}
