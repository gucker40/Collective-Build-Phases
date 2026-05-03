"""artifacts.py - Store and retrieve generated artifacts"""
import json, uuid, time, os, zipfile, io
from pathlib import Path
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse
from typing import List

APPDATA = Path(os.environ.get("APPDATA", os.path.expanduser("~"))) / "logos-app"
ART_DIR = APPDATA / "artifacts"
ART_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter()

def _time_ago(ts):
    d = int(time.time()) - int(ts)
    if d < 60:    return "just now"
    if d < 3600:  return f"{d//60}m ago"
    if d < 86400: return f"{d//3600}h ago"
    return f"{d//86400}d ago"

def _lang_from_ext(ext: str) -> str:
    return {"html":"html","htm":"html","svg":"svg","css":"css","js":"js",
            "ts":"ts","jsx":"jsx","tsx":"tsx","py":"python","sql":"sql",
            "sh":"bash","csv":"csv","json":"json","md":"md"}.get(ext.lower(), "html")

def _save_one(title: str, language: str, content: str, aid: str | None = None) -> dict:
    aid = aid or str(uuid.uuid4())[:8]
    meta = {
        "id":       aid,
        "title":    title,
        "language": language,
        "created":  int(time.time()),
        "size":     len(content),
        "uploaded": True,
    }
    ext_map = {"html":"html","svg":"svg","css":"css","js":"js","ts":"ts",
               "jsx":"jsx","tsx":"tsx","python":"py","sql":"sql","bash":"sh",
               "csv":"csv","json":"json","md":"md"}
    ext = ext_map.get(language, "html")
    (ART_DIR / f"{aid}.{ext}").write_text(content, encoding="utf-8")
    # Also write .html for the preview loader that always looks for .html
    if ext != "html":
        (ART_DIR / f"{aid}.html").write_text(content, encoding="utf-8")
    (ART_DIR / f"{aid}.meta.json").write_text(json.dumps(meta), encoding="utf-8")
    return meta

@router.post("/save")
async def save_artifact(body: dict):
    aid = body.get("id") or str(uuid.uuid4())[:8]
    meta = _save_one(
        title    = body.get("title", "Untitled"),
        language = body.get("language", "html"),
        content  = body.get("content", ""),
        aid      = aid,
    )
    return {"id": aid, "saved": True}

@router.post("/upload")
async def upload_artifacts(files: List[UploadFile] = File(...)):
    """
    Accept one or more files:
    - .html / .htm / .svg / .js / .css etc  → save directly as artifact
    - .zip                                   → extract, save each HTML/text file inside
    Returns list of saved artifact metadata.
    """
    saved = []
    errors = []

    for upload in files:
        raw = await upload.read()
        fname = upload.filename or "upload"
        ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""

        if ext == "zip":
            # Extract zip and import each file
            try:
                with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                    for member in zf.namelist():
                        # Skip directories, __MACOSX, hidden files
                        if member.endswith("/") or "/__MACOSX" in member or "/." in member:
                            continue
                        mext = member.rsplit(".", 1)[-1].lower() if "." in member else ""
                        if mext not in ("html","htm","svg","css","js","ts","jsx","tsx","py","sql","sh","csv","json","md"):
                            continue
                        try:
                            content = zf.read(member).decode("utf-8", errors="replace")
                            # Use filename without path as title
                            title = member.split("/")[-1].rsplit(".", 1)[0]
                            lang  = _lang_from_ext(mext)
                            meta  = _save_one(title, lang, content)
                            saved.append(meta)
                        except Exception as e:
                            errors.append(f"{member}: {e}")
            except Exception as e:
                errors.append(f"{fname} (zip error): {e}")
        else:
            # Single file
            try:
                content = raw.decode("utf-8", errors="replace")
                title   = fname.rsplit(".", 1)[0] if "." in fname else fname
                lang    = _lang_from_ext(ext)
                meta    = _save_one(title, lang, content)
                saved.append(meta)
            except Exception as e:
                errors.append(f"{fname}: {e}")

    return {"saved": saved, "count": len(saved), "errors": errors}

@router.get("/list")
async def list_artifacts():
    arts = []
    for f in sorted(ART_DIR.glob("*.meta.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            m = json.loads(f.read_text())
            m["created_ago"] = _time_ago(m.get("created", 0))
            arts.append(m)
        except Exception:
            pass
    return {"artifacts": arts}

@router.get("/get/{aid}")
async def get_artifact(aid: str):
    meta_f = ART_DIR / f"{aid}.meta.json"
    if not meta_f.exists():
        return JSONResponse({"error": "not found"}, 404)
    meta = json.loads(meta_f.read_text())
    # Try to find the actual content file
    lang     = meta.get("language", "html")
    ext_map  = {"html":"html","svg":"svg","python":"py","bash":"sh"}
    ext      = ext_map.get(lang, lang)
    html_f   = ART_DIR / f"{aid}.html"
    lang_f   = ART_DIR / f"{aid}.{ext}"
    if lang_f.exists():
        content = lang_f.read_text(encoding="utf-8")
    elif html_f.exists():
        content = html_f.read_text(encoding="utf-8")
    else:
        content = ""
    return {**meta, "content": content}

@router.delete("/delete/{aid}")
async def delete_artifact(aid: str):
    for f in ART_DIR.glob(f"{aid}.*"):
        f.unlink()
    return {"deleted": aid}
