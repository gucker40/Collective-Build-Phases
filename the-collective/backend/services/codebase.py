"""
codebase.py — Logos self-edit service.
Logos can READ its own source, SUGGEST edits (diff preview), and APPLY approved changes.
Never auto-applies — every edit requires explicit user approval.
"""

import difflib
from pathlib import Path
from typing import Optional

APP_ROOT = Path(__file__).parent.parent.parent


def _safe_path(relative: str) -> Optional[Path]:
    """Resolve relative path within APP_ROOT, reject traversal attempts."""
    try:
        p = (APP_ROOT / relative).resolve()
        p.relative_to(APP_ROOT.resolve())  # raises ValueError if outside root
        return p
    except (ValueError, Exception):
        return None


def list_files(pattern: str = "**/*.py") -> list:
    """Return list of source files matching glob pattern."""
    try:
        return [str(p.relative_to(APP_ROOT)) for p in APP_ROOT.glob(pattern)
                if not any(part.startswith(".") or part == "__pycache__" or part == "node_modules"
                           for part in p.parts)]
    except Exception:
        return []


def read_file(relative_path: str) -> dict:
    """Read a source file. Returns content or error."""
    p = _safe_path(relative_path)
    if not p:
        return {"error": "Path traversal rejected"}
    if not p.exists():
        return {"error": f"File not found: {relative_path}"}
    try:
        content = p.read_text(encoding="utf-8")
        return {"path": relative_path, "content": content, "lines": len(content.splitlines())}
    except Exception as e:
        return {"error": str(e)}


def suggest_edit(relative_path: str, old_content: str, new_content: str) -> dict:
    """
    Generate a unified diff for user review.
    Returns diff text — does NOT apply the change.
    """
    p = _safe_path(relative_path)
    if not p:
        return {"error": "Path traversal rejected"}

    current = ""
    if p.exists():
        try:
            current = p.read_text(encoding="utf-8")
        except Exception as e:
            return {"error": str(e)}

    if old_content and old_content not in current:
        return {"error": "old_content not found in file — diff rejected"}

    proposed = current.replace(old_content, new_content, 1) if old_content else new_content
    diff = difflib.unified_diff(
        current.splitlines(keepends=True),
        proposed.splitlines(keepends=True),
        fromfile=f"a/{relative_path}",
        tofile=f"b/{relative_path}",
    )
    diff_text = "".join(diff)
    return {
        "path":      relative_path,
        "diff":      diff_text,
        "lines_before": len(current.splitlines()),
        "lines_after":  len(proposed.splitlines()),
        "pending_approval": True,
    }


def apply_edit(relative_path: str, old_content: str, new_content: str) -> dict:
    """
    Apply an approved edit to a source file.
    Must only be called after user explicitly approves the diff from suggest_edit().
    """
    p = _safe_path(relative_path)
    if not p:
        return {"error": "Path traversal rejected", "applied": False}
    if not p.exists():
        return {"error": "File not found", "applied": False}

    try:
        current = p.read_text(encoding="utf-8")
        if old_content and old_content not in current:
            return {"error": "old_content not found — edit rejected", "applied": False}

        updated = current.replace(old_content, new_content, 1) if old_content else new_content

        # Backup original
        backup = p.with_suffix(p.suffix + ".bak")
        backup.write_text(current, encoding="utf-8")

        p.write_text(updated, encoding="utf-8")
        return {"applied": True, "path": relative_path, "backup": str(backup.relative_to(APP_ROOT))}

    except Exception as e:
        return {"error": str(e), "applied": False}


def revert_edit(relative_path: str) -> dict:
    """Revert to the .bak backup created by apply_edit."""
    p = _safe_path(relative_path)
    if not p:
        return {"error": "Path traversal rejected"}
    backup = p.with_suffix(p.suffix + ".bak")
    if not backup.exists():
        return {"error": "No backup found"}
    try:
        p.write_text(backup.read_text(encoding="utf-8"), encoding="utf-8")
        backup.unlink()
        return {"reverted": True, "path": relative_path}
    except Exception as e:
        return {"error": str(e)}
