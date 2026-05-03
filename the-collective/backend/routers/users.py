"""users.py — Auth: registration, login, JWT tokens, admin routes."""

import hashlib
import json
import secrets
import time
from typing import Optional

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import APPDATA, get_secret
from db import get_db

router = APIRouter()
bearer = HTTPBearer(auto_error=False)

SECRET_FILE = APPDATA / ".token_secret"


def _get_secret() -> str:
    if SECRET_FILE.exists():
        return SECRET_FILE.read_text().strip()
    s = secrets.token_hex(32)
    SECRET_FILE.write_text(s)
    SECRET_FILE.chmod(0o600)
    return s


def _make_token(user_id: str, username: str, role: str) -> str:
    import base64, hmac
    payload = json.dumps({"id": user_id, "u": username, "r": role,
                          "exp": int(time.time()) + 7 * 24 * 3600})
    b64 = base64.urlsafe_b64encode(payload.encode()).decode()
    sig = hmac.new(_get_secret().encode(), b64.encode(), hashlib.sha256).hexdigest()
    return f"{b64}.{sig}"


def _verify_token(token: str) -> Optional[dict]:
    import base64, hmac
    try:
        b64, sig = token.rsplit(".", 1)
        expected = hmac.new(_get_secret().encode(), b64.encode(), hashlib.sha256).hexdigest()
        if not secrets.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(b64 + "==").decode())
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


def _hash(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000)
    return f"{salt}:{dk.hex()}"


def _check(password: str, stored: str) -> bool:
    try:
        salt, dk_hex = stored.split(":", 1)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000)
        return secrets.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> Optional[dict]:
    if not creds:
        return None
    return _verify_token(creds.credentials)


def require_user(user: Optional[dict] = Depends(get_current_user)) -> dict:
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


def require_admin(user: Optional[dict] = Depends(get_current_user)) -> dict:
    if not user or user.get("r") != "admin":
        raise HTTPException(403, "Admin access required")
    return user


import uuid as _uuid


@router.get("/count")
async def count_users(db: aiosqlite.Connection = Depends(get_db)):
    row = await db.execute_fetchall("SELECT COUNT(*) AS n FROM users")
    return {"count": row[0]["n"] if row else 0}


@router.post("/register")
async def register(request: Request, db: aiosqlite.Connection = Depends(get_db)):
    body     = await request.json()
    username = body.get("username", "").strip().lower()
    password = body.get("password", "")
    display  = body.get("display_name", username)

    if not username or len(username) < 2:
        raise HTTPException(400, "Username must be at least 2 characters")
    if not password or len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if not username.replace("_","").replace("-","").isalnum():
        raise HTTPException(400, "Username may only contain letters, numbers, - and _")

    rows = await db.execute_fetchall("SELECT COUNT(*) AS n FROM users")
    user_count = rows[0]["n"] if rows else 0
    role = "admin" if user_count == 0 else "user"

    existing = await db.execute_fetchall("SELECT id FROM users WHERE username=?", (username,))
    if existing:
        raise HTTPException(409, "Username already taken")

    uid = str(_uuid.uuid4())
    now = time.time()
    await db.execute(
        "INSERT INTO users (id,username,password_hash,display_name,role,created_at,last_login) VALUES (?,?,?,?,?,?,?)",
        (uid, username, _hash(password), display, role, now, now)
    )
    await db.commit()

    token = _make_token(uid, username, role)
    return {"token": token, "id": uid, "username": username, "display_name": display, "role": role}


@router.post("/login")
async def login(request: Request, db: aiosqlite.Connection = Depends(get_db)):
    body     = await request.json()
    username = body.get("username", "").strip().lower()
    password = body.get("password", "")

    rows = await db.execute_fetchall("SELECT * FROM users WHERE username=?", (username,))
    if not rows:
        raise HTTPException(401, "Invalid username or password")
    u = rows[0]
    if not _check(password, u["password_hash"]):
        raise HTTPException(401, "Invalid username or password")

    await db.execute("UPDATE users SET last_login=? WHERE id=?", (time.time(), u["id"]))
    await db.commit()

    token = _make_token(u["id"], username, u["role"])
    return {"token": token, "id": u["id"], "username": username,
            "display_name": u["display_name"] or username, "role": u["role"]}


@router.get("/me")
async def me(user: dict = Depends(require_user), db: aiosqlite.Connection = Depends(get_db)):
    rows = await db.execute_fetchall("SELECT * FROM users WHERE id=?", (user["id"],))
    if not rows:
        raise HTTPException(404, "User not found")
    u = rows[0]
    return {"id": u["id"], "username": u["username"], "display_name": u["display_name"],
            "role": u["role"], "created_at": u["created_at"]}


@router.post("/logout")
async def logout():
    return {"ok": True}


@router.get("/admin/users")
async def admin_list(admin: dict = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    rows = await db.execute_fetchall(
        "SELECT id,username,display_name,role,created_at,last_login FROM users ORDER BY created_at"
    )
    return {"users": [dict(r) for r in rows]}


@router.delete("/admin/user/{uid}")
async def admin_delete(uid: str, admin: dict = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    rows = await db.execute_fetchall("SELECT role FROM users WHERE id=?", (uid,))
    if not rows:
        raise HTTPException(404, "User not found")
    if rows[0]["role"] == "admin":
        raise HTTPException(400, "Cannot delete admin account")
    await db.execute("DELETE FROM users WHERE id=?", (uid,))
    await db.commit()
    return {"deleted": uid}


@router.post("/admin/user/{uid}/reset-password")
async def admin_reset_pw(uid: str, request: Request, admin: dict = Depends(require_admin),
                         db: aiosqlite.Connection = Depends(get_db)):
    body = await request.json()
    pw = body.get("password", "")
    if len(pw) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    await db.execute("UPDATE users SET password_hash=? WHERE id=?", (_hash(pw), uid))
    await db.commit()
    return {"ok": True}


@router.get("/admin/diagnostics")
async def diagnostics(admin: dict = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    import platform
    rows = await db.execute_fetchall("SELECT COUNT(*) AS n FROM users")
    user_count = rows[0]["n"] if rows else 0
    return {
        "platform": platform.system(),
        "python": platform.python_version(),
        "appdata": str(APPDATA),
        "user_count": user_count,
        "db_path": str(APPDATA / "collective.db"),
    }
