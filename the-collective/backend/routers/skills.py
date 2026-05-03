"""skills.py — Skill sheet management: install, list, toggle, delete."""

import json
import time
import uuid
from pathlib import Path
from typing import Optional

import aiosqlite
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from config import APPDATA
from db import get_db
from routers.users import require_admin, get_current_user

router    = APIRouter()
BUILT_IN  = Path(__file__).parent.parent.parent / "skills" / "builtin"
DOWNLOADED = APPDATA / "skills" / "downloaded"


async def _seed_builtin(db: aiosqlite.Connection):
    """Load built-in skill sheets into DB if not already present."""
    if not BUILT_IN.exists():
        return
    for skill_file in BUILT_IN.glob("*.skill.json"):
        try:
            data = json.loads(skill_file.read_text())
            sid  = data.get("id", skill_file.stem)
            existing = await db.execute_fetchall("SELECT id FROM skills WHERE id=?", (sid,))
            if not existing:
                await db.execute(
                    "INSERT INTO skills (id,name,version,author,description,content_json,installed_at,enabled) "
                    "VALUES (?,?,?,?,?,?,?,1)",
                    (sid, data.get("name",""), data.get("version","1.0"),
                     data.get("author","The Collective"), data.get("description",""),
                     json.dumps(data), time.time())
                )
        except Exception:
            pass
    await db.commit()


@router.get("/list")
async def list_skills(db: aiosqlite.Connection = Depends(get_db)):
    await _seed_builtin(db)
    rows = await db.execute_fetchall(
        "SELECT id,name,version,author,description,enabled,installed_at FROM skills ORDER BY name"
    )
    skills = []
    for r in rows:
        d = dict(r)
        try:
            content = json.loads(
                (await db.execute_fetchall("SELECT content_json FROM skills WHERE id=?", (d["id"],)))[0]["content_json"]
            )
            d["tags"] = content.get("tags", [])
            d["applies_to"] = content.get("applies_to", [])
        except Exception:
            d["tags"] = []
            d["applies_to"] = []
        skills.append(d)
    return {"skills": skills}


@router.post("/toggle/{skill_id}")
async def toggle_skill(skill_id: str, db: aiosqlite.Connection = Depends(get_db)):
    rows = await db.execute_fetchall("SELECT enabled FROM skills WHERE id=?", (skill_id,))
    if not rows:
        return JSONResponse({"error": "Skill not found"}, 404)
    new_state = 0 if rows[0]["enabled"] else 1
    await db.execute("UPDATE skills SET enabled=? WHERE id=?", (new_state, skill_id))
    await db.commit()
    return {"id": skill_id, "enabled": bool(new_state)}


@router.post("/install")
async def install_skill(request: Request, db: aiosqlite.Connection = Depends(get_db)):
    """Install a skill from a JSON payload or URL (Phase 4 — basic local install)."""
    body = await request.json()
    sid  = body.get("id") or str(uuid.uuid4())[:8]

    existing = await db.execute_fetchall("SELECT id FROM skills WHERE id=?", (sid,))
    if existing:
        await db.execute(
            "UPDATE skills SET name=?,version=?,author=?,description=?,content_json=?,enabled=1 WHERE id=?",
            (body.get("name",""), body.get("version","1.0"), body.get("author","Community"),
             body.get("description",""), json.dumps(body), sid)
        )
    else:
        await db.execute(
            "INSERT INTO skills (id,name,version,author,description,content_json,installed_at,enabled) "
            "VALUES (?,?,?,?,?,?,?,1)",
            (sid, body.get("name",""), body.get("version","1.0"), body.get("author","Community"),
             body.get("description",""), json.dumps(body), time.time())
        )
    await db.commit()

    # Save copy to downloaded folder
    try:
        DOWNLOADED.mkdir(parents=True, exist_ok=True)
        (DOWNLOADED / f"{sid}.skill.json").write_text(json.dumps(body, indent=2))
    except Exception:
        pass

    return {"installed": True, "id": sid}


@router.delete("/uninstall/{skill_id}")
async def uninstall_skill(skill_id: str, db: aiosqlite.Connection = Depends(get_db)):
    await db.execute("DELETE FROM skills WHERE id=?", (skill_id,))
    await db.commit()
    try:
        (DOWNLOADED / f"{skill_id}.skill.json").unlink(missing_ok=True)
    except Exception:
        pass
    return {"uninstalled": True, "id": skill_id}


@router.get("/get/{skill_id}")
async def get_skill(skill_id: str, db: aiosqlite.Connection = Depends(get_db)):
    rows = await db.execute_fetchall("SELECT * FROM skills WHERE id=?", (skill_id,))
    if not rows:
        return JSONResponse({"error": "not found"}, 404)
    r = dict(rows[0])
    try:
        r["content"] = json.loads(r["content_json"])
    except Exception:
        r["content"] = {}
    return r
