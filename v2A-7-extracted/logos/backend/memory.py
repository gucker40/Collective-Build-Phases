"""
memory.py - Eternal Memory System
Simple JSON-based persistent memory. No ML dependencies.
Keyword search covers all practical use cases for sealed memories.
"""

import os
import uuid
import time
import json
from typing import Optional, List
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

MEMORY_PATH = Path(os.environ.get("APPDATA", os.path.expanduser("~"))) / "logos-app" / "memory"
MEMORY_PATH.mkdir(parents=True, exist_ok=True)
MEMORY_FILE = MEMORY_PATH / "memories.json"


def _load() -> list:
    try:
        if MEMORY_FILE.exists():
            return json.loads(MEMORY_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []


def _save(memories: list):
    MEMORY_FILE.write_text(json.dumps(memories, indent=2), encoding="utf-8")


class SealRequest(BaseModel):
    text: str
    type: Optional[str] = "Conversation"
    tags: Optional[List[str]] = []


class MemoryEntry(BaseModel):
    id: str
    text: str
    type: str
    tags: List[str]
    timestamp: float
    preview: str


async def get_relevant_memories(query: str, n_results: int = 5) -> List[dict]:
    """Keyword search across sealed memories."""
    memories = _load()
    if not memories:
        return []

    query_words = set(query.lower().split())
    scored = []
    for m in memories:
        text_words = set(m.get("text", "").lower().split())
        # Score = number of query words found in memory text
        score = len(query_words & text_words)
        if score > 0:
            scored.append((score, m))

    # Sort by score desc, then recency desc
    scored.sort(key=lambda x: (x[0], x[1].get("timestamp", 0)), reverse=True)
    return [m for _, m in scored[:n_results]]


@router.post("/seal")
async def seal_memory(request: SealRequest):
    memories = _load()
    entry = {
        "id":        str(uuid.uuid4()),
        "text":      request.text,
        "type":      request.type,
        "tags":      request.tags or [],
        "timestamp": time.time(),
        "preview":   request.text[:100],
    }
    memories.append(entry)
    _save(memories)
    return {"id": entry["id"], "sealed": True, "type": entry["type"], "timestamp": entry["timestamp"]}


@router.get("/list")
async def list_memories():
    memories = _load()
    memories.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
    for m in memories:
        m["preview"] = m.get("text", "")[:120] + ("..." if len(m.get("text","")) > 120 else "")
    return {"memories": memories, "total": len(memories)}


@router.delete("/unseal/{memory_id}")
async def unseal_memory(memory_id: str):
    memories = _load()
    memories = [m for m in memories if m["id"] != memory_id]
    _save(memories)
    return {"unsealed": True, "id": memory_id}


@router.post("/search")
async def search_memories(query: str, n: int = 10):
    results = await get_relevant_memories(query, n_results=n)
    return {"results": results, "query": query}
