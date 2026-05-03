"""
db.py — SQLite setup, schema, and JSON migration.
All tables are user-scoped via user_id.
"""

import json
import time
import uuid
import os
import aiosqlite
from pathlib import Path
from typing import AsyncGenerator
from config import APPDATA

DB_PATH = APPDATA / "collective.db"

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    username     TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    role         TEXT DEFAULT 'user',
    created_at   REAL,
    last_login   REAL,
    settings_json TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    title      TEXT,
    created_at REAL,
    updated_at REAL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
    id         TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    role       TEXT NOT NULL,
    content    TEXT,
    created_at REAL,
    intent     TEXT,
    member     TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS artifacts (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    title      TEXT,
    language   TEXT DEFAULT 'html',
    content    TEXT,
    created_at REAL,
    tags       TEXT DEFAULT '[]',
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS memories (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    text       TEXT NOT NULL,
    type       TEXT DEFAULT 'Conversation',
    tags       TEXT DEFAULT '[]',
    timestamp  REAL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS vault_items (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL,
    filename          TEXT NOT NULL,
    content           TEXT,
    created_at        REAL,
    updated_at        REAL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    status      TEXT DEFAULT 'todo',
    done        INTEGER DEFAULT 0,
    priority    TEXT DEFAULT 'medium',
    due_date    TEXT,
    project_id  TEXT,
    created_at  REAL,
    updated_at  REAL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notes (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    title      TEXT,
    content    TEXT,
    tags       TEXT DEFAULT '[]',
    created_at REAL,
    updated_at REAL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    color       TEXT DEFAULT '#a07aff',
    created_at  REAL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    amount      REAL NOT NULL,
    type        TEXT NOT NULL,
    category    TEXT,
    subcategory TEXT,
    description TEXT,
    date        TEXT NOT NULL,
    account_id  TEXT,
    source      TEXT DEFAULT 'manual',
    raw_json    TEXT,
    created_at  REAL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS accounts (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    name             TEXT NOT NULL,
    type             TEXT,
    institution      TEXT,
    balance          REAL,
    currency         TEXT DEFAULT 'USD',
    source           TEXT DEFAULT 'manual',
    plaid_account_id TEXT,
    last_synced      TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS portfolio_holdings (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    ticker       TEXT NOT NULL,
    shares       REAL,
    avg_cost     REAL,
    account_id   TEXT,
    last_updated TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS skills (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    version      TEXT,
    author       TEXT,
    description  TEXT,
    content_json TEXT,
    installed_at REAL,
    enabled      INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS mindmap_nodes (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    source_id   TEXT,
    source_type TEXT,
    keywords    TEXT DEFAULT '[]',
    title       TEXT,
    created_at  REAL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS board_posts (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT,
    type       TEXT DEFAULT 'Discussion',
    votes      INTEGER DEFAULT 0,
    created_at REAL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS board_comments (
    id         TEXT PRIMARY KEY,
    post_id    TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    body       TEXT,
    created_at REAL,
    FOREIGN KEY (post_id) REFERENCES board_posts(id)
);
"""


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA)
        # Add columns introduced after initial schema (safe on existing DBs)
        for sql in [
            "ALTER TABLE tasks ADD COLUMN done INTEGER DEFAULT 0",
            "ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'medium'",
        ]:
            try:
                await db.execute(sql)
            except Exception:
                pass  # column already exists
        await db.commit()
    await _migrate_from_json()


async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys=ON")
        yield db


# ── JSON migration ────────────────────────────────────────────────────────────

async def _migrate_from_json():
    """One-time import of v2A data from %APPDATA%/logos-app/ into SQLite."""
    OLD_APPDATA = Path(os.environ.get("APPDATA", os.path.expanduser("~"))) / "logos-app"
    MIGRATED_FLAG = APPDATA / ".migrated_v2"
    if MIGRATED_FLAG.exists() or not OLD_APPDATA.exists():
        return

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Migrate users
        old_users_file = OLD_APPDATA / "users.json"
        if old_users_file.exists():
            try:
                old_users = json.loads(old_users_file.read_text())
                for username, data in old_users.items():
                    uid = str(uuid.uuid4())
                    await db.execute(
                        "INSERT OR IGNORE INTO users (id,username,password_hash,display_name,role,created_at,last_login) VALUES (?,?,?,?,?,?,?)",
                        (uid, username, data.get("password_hash",""), data.get("display_name", username),
                         data.get("role","user"), data.get("created", time.time()), data.get("last_login", time.time()))
                    )
            except Exception:
                pass

        # Migrate artifacts
        old_art_dir = OLD_APPDATA / "artifacts"
        if old_art_dir.exists():
            try:
                # Get first admin user id
                row = await db.execute_fetchall("SELECT id FROM users WHERE role='admin' LIMIT 1")
                uid = row[0]["id"] if row else "migrated"
                for meta_f in old_art_dir.glob("*.meta.json"):
                    try:
                        m = json.loads(meta_f.read_text())
                        content_f = old_art_dir / f"{m['id']}.html"
                        content = content_f.read_text() if content_f.exists() else ""
                        await db.execute(
                            "INSERT OR IGNORE INTO artifacts (id,user_id,title,language,content,created_at) VALUES (?,?,?,?,?,?)",
                            (m["id"], uid, m.get("title","Untitled"), m.get("language","html"), content, m.get("created", time.time()))
                        )
                    except Exception:
                        pass
            except Exception:
                pass

        # Migrate memories
        old_mem_file = OLD_APPDATA / "memory" / "memories.json"
        if old_mem_file.exists():
            try:
                row = await db.execute_fetchall("SELECT id FROM users WHERE role='admin' LIMIT 1")
                uid = row[0]["id"] if row else "migrated"
                mems = json.loads(old_mem_file.read_text())
                for m in mems:
                    await db.execute(
                        "INSERT OR IGNORE INTO memories (id,user_id,text,type,tags,timestamp) VALUES (?,?,?,?,?,?)",
                        (m.get("id", str(uuid.uuid4())), uid, m.get("text",""), m.get("type","Conversation"),
                         json.dumps(m.get("tags",[])), m.get("timestamp", time.time()))
                    )
            except Exception:
                pass

        await db.commit()

    MIGRATED_FLAG.write_text("migrated")
