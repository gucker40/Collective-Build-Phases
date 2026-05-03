"""
users.py - Local user authentication for Logos
- bcrypt password hashing
- JWT session tokens (7-day expiry)
- Per-user data directory isolation under APPDATA/users/{username}/
- Admin/dev role with full diagnostic access
"""

import os
import json
import hashlib
import secrets
import time
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ── Paths ─────────────────────────────────────────────────────────────────────
APPDATA    = Path(os.environ.get("APPDATA", os.path.expanduser("~"))) / "logos-app"
USERS_DIR  = APPDATA / "users"
USERS_FILE = APPDATA / "users.json"
USERS_DIR.mkdir(parents=True, exist_ok=True)

# ── Simple JWT-like token (no external deps) ──────────────────────────────────
# Format: base64(payload_json).signature
# We keep it simple — HMAC-SHA256 with a secret stored in APPDATA
SECRET_FILE = APPDATA / ".token_secret"

def _get_secret() -> str:
    if SECRET_FILE.exists():
        return SECRET_FILE.read_text().strip()
    secret = secrets.token_hex(32)
    SECRET_FILE.write_text(secret)
    SECRET_FILE.chmod(0o600)
    return secret

def _make_token(username: str, role: str) -> str:
    import base64, hmac
    secret  = _get_secret()
    payload = json.dumps({"u": username, "r": role, "exp": int(time.time()) + 7*24*3600})
    b64     = base64.urlsafe_b64encode(payload.encode()).decode()
    sig     = hmac.new(secret.encode(), b64.encode(), hashlib.sha256).hexdigest()
    return f"{b64}.{sig}"

def _verify_token(token: str) -> Optional[dict]:
    import base64, hmac
    try:
        b64, sig = token.rsplit(".", 1)
        secret   = _get_secret()
        expected = hmac.new(secret.encode(), b64.encode(), hashlib.sha256).hexdigest()
        if not secrets.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(b64 + "==").decode())
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

# ── Password hashing (no bcrypt dep — use PBKDF2) ─────────────────────────────
def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk   = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000)
    return f"{salt}:{dk.hex()}"

def _check_password(password: str, stored: str) -> bool:
    try:
        salt, dk_hex = stored.split(":", 1)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000)
        return secrets.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False

# ── User store ────────────────────────────────────────────────────────────────
def _load_users() -> dict:
    try:
        if USERS_FILE.exists():
            return json.loads(USERS_FILE.read_text())
    except Exception:
        pass
    return {}

def _save_users(users: dict):
    USERS_FILE.write_text(json.dumps(users, indent=2))

def _user_data_dir(username: str) -> Path:
    d = USERS_DIR / username
    for sub in ["", "history", "artifacts", "vault", "memory", "notes", "todos"]:
        (d / sub).mkdir(parents=True, exist_ok=True)
    return d

def get_all_users() -> list:
    users = _load_users()
    return [
        {
            "username": u,
            "role":     d.get("role", "user"),
            "created":  d.get("created", 0),
            "last_login": d.get("last_login", 0),
            "display_name": d.get("display_name", u),
        }
        for u, d in users.items()
    ]

def user_count() -> int:
    return len(_load_users())

# ── FastAPI router ─────────────────────────────────────────────────────────────
router  = APIRouter()
bearer  = HTTPBearer(auto_error=False)

def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)
) -> Optional[dict]:
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

# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/count")
async def count_users():
    """Used by frontend to decide: show setup wizard or login screen."""
    return {"count": user_count()}

@router.post("/register")
async def register(request: Request):
    body     = await request.json()
    username = body.get("username", "").strip().lower()
    password = body.get("password", "")
    display  = body.get("display_name", username)

    if not username or len(username) < 2:
        raise HTTPException(400, "Username must be at least 2 characters")
    if not password or len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if not username.replace("_", "").replace("-", "").isalnum():
        raise HTTPException(400, "Username may only contain letters, numbers, - and _")

    users = _load_users()
    if username in users:
        raise HTTPException(409, "Username already taken")

    # First user ever registered becomes admin
    role  = "admin" if len(users) == 0 else "user"
    users[username] = {
        "password_hash": _hash_password(password),
        "role":          role,
        "display_name":  display,
        "created":       int(time.time()),
        "last_login":    int(time.time()),
        "settings":      {},
    }
    _save_users(users)
    _user_data_dir(username)

    token = _make_token(username, role)
    return {
        "token":        token,
        "username":     username,
        "display_name": display,
        "role":         role,
    }

@router.post("/login")
async def login(request: Request):
    body     = await request.json()
    username = body.get("username", "").strip().lower()
    password = body.get("password", "")

    users = _load_users()
    user  = users.get(username)
    if not user or not _check_password(password, user["password_hash"]):
        raise HTTPException(401, "Invalid username or password")

    users[username]["last_login"] = int(time.time())
    _save_users(users)

    token = _make_token(username, user["role"])
    return {
        "token":        token,
        "username":     username,
        "display_name": user.get("display_name", username),
        "role":         user["role"],
    }

@router.get("/me")
async def me(user: dict = Depends(require_user)):
    users = _load_users()
    u     = users.get(user["u"], {})
    return {
        "username":     user["u"],
        "role":         user["r"],
        "display_name": u.get("display_name", user["u"]),
    }

@router.post("/logout")
async def logout():
    # Tokens are stateless — client drops the token
    return {"ok": True}

@router.get("/data-dir")
async def get_data_dir(user: dict = Depends(require_user)):
    """Returns the user's data directory path for the backend to use."""
    d = _user_data_dir(user["u"])
    return {"path": str(d)}

# ── Admin / Dev Console routes ────────────────────────────────────────────────

@router.get("/admin/users")
async def admin_list_users(admin: dict = Depends(require_admin)):
    return {"users": get_all_users()}

@router.get("/admin/user/{username}/config")
async def admin_get_user_config(username: str, admin: dict = Depends(require_admin)):
    users = _load_users()
    if username not in users:
        raise HTTPException(404, "User not found")
    u = users[username]
    return {
        "username":     username,
        "role":         u.get("role"),
        "display_name": u.get("display_name"),
        "created":      u.get("created"),
        "last_login":   u.get("last_login"),
        "settings":     u.get("settings", {}),
        "data_dir":     str(_user_data_dir(username)),
    }

@router.delete("/admin/user/{username}")
async def admin_delete_user(username: str, admin: dict = Depends(require_admin)):
    users = _load_users()
    if username not in users:
        raise HTTPException(404, "User not found")
    if users[username].get("role") == "admin":
        raise HTTPException(400, "Cannot delete admin account")
    del users[username]
    _save_users(users)
    return {"deleted": username}

@router.post("/admin/user/{username}/reset-password")
async def admin_reset_password(username: str, request: Request, admin: dict = Depends(require_admin)):
    body     = await request.json()
    new_pass = body.get("password", "")
    if len(new_pass) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    users = _load_users()
    if username not in users:
        raise HTTPException(404, "User not found")
    users[username]["password_hash"] = _hash_password(new_pass)
    _save_users(users)
    return {"ok": True}

@router.get("/admin/diagnostics")
async def admin_diagnostics(admin: dict = Depends(require_admin)):
    """Full system diagnostic for the dev console."""
    import platform
    users    = _load_users()
    all_dirs = []
    for uname in users:
        udir = USERS_DIR / uname
        if udir.exists():
            size = sum(f.stat().st_size for f in udir.rglob("*") if f.is_file())
            all_dirs.append({"username": uname, "data_size_bytes": size})

    return {
        "platform":    platform.system(),
        "python":      platform.python_version(),
        "appdata":     str(APPDATA),
        "user_count":  len(users),
        "users":       get_all_users(),
        "disk_usage":  all_dirs,
    }
