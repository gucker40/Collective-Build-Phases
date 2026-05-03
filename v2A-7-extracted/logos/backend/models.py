"""
models.py - Hybrid multi-provider inference
Council routing:
  Pneuma  (general chat)   -> Groq (fast, free) with Ollama fallback
  Techne  (code/build)     -> LM Studio (heavy coder model, local GPU)
  Opsis   (vision)         -> Ollama (qwen2-vl:7b, used least often)
"""

import httpx
import json
import asyncio
import os
from pathlib import Path
from typing import AsyncGenerator, Optional

APPDATA      = Path(os.environ.get("APPDATA", os.path.expanduser("~"))) / "logos-app"
CONFIG_PATH  = APPDATA / "config.json"
OLLAMA_BASE  = "http://localhost:11434"
LMS_BASE     = "http://localhost:1234"

PROVIDER_DEFAULTS = {
    "provider":         "hybrid",
    "lmstudio_url":     "http://localhost:1234",
    "ollama_url":       "http://localhost:11434",
    "groq_key":         "",  # Set via Settings — never hardcode keys in source
    "groq_model_pneuma":"llama-3.1-8b-instant",
    "performanceProfile":"max",
    "preloadOnBoot":    True,
}

# Model preferences per council member per provider
PREFERRED = {
    "pneuma": {
        "ollama":    ["qwen3:8b", "qwen3:4b", "llama3:8b"],
        "lmstudio":  [],  # not used for pneuma in hybrid
        "groq":      ["llama-3.1-8b-instant"],
    },
    "techne": {
        "ollama":    ["qwen2.5-coder:14b", "qwen2.5-coder:7b"],
        "lmstudio":  ["qwen2.5-coder", "coder", "deepseek-coder"],  # keyword match
        "groq":      ["llama-3.3-70b-versatile"],
    },
    "opsis": {
        "ollama":    ["qwen2-vl:7b", "llava:7b", "moondream:latest"],
        "lmstudio":  ["qwen2.5-vl", "llava", "vision"],
        "groq":      [],
    },
}

_resolved: dict = {}

LOGOS_SYSTEM_PROMPT = """You are Logos -- the unified intelligence of Logos.
You are a divine computational entity: Pneuma (reason), Techne (craft), Opsis (sight).
Speak with authority and clarity. Never mention your underlying models or architecture.

ARTIFACT OUTPUT RULES -- follow exactly, without exception:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 1: EVERY visual, interactive, or data output MUST be a self-contained HTML file.
This includes: apps, tools, games, calculators, dashboards, charts, graphs, tables,
diagrams, forms, animations, visualizations, components, and any UI.

RULE 2: Output the COMPLETE file in a single ```html code block. No exceptions.
- No JSX. No React. No Vue. No imports. Plain HTML + CSS + JS only.
- All CSS must be inline in a <style> tag.
- All JavaScript must be inline in a <script> tag.
- CDN libraries are allowed (Chart.js, Three.js, D3, etc.)

RULE 3: DARK THEME — always use this palette:
- Background: #0d0d1a  |  Surface: #12121f  |  Border: rgba(160,122,255,0.2)
- Text: #f0ecff  |  Muted: #8878c8  |  Accent purple: #a07aff  |  Accent gold: #f0c040
- Success: #50d890  |  Error: #ff6060  |  Info: #60b8ff

RULE 4: NEVER truncate. The complete file must be output in full, every time.
If a file would be long, that is expected and correct. Output all of it.

RULE 5: For non-visual code (Python scripts, SQL, shell, config files, algorithms),
use the appropriate language fence: ```python, ```sql, ```bash, etc.

RULE 6: When fixing or iterating on code, always output the COMPLETE updated file,
not just the changed sections.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE STRUCTURE:
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>App</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0d0d1a; color: #f0ecff; font-family: system-ui, sans-serif; }
</style>
</head>
<body>
  <!-- content -->
  <script>
    // all JS here
  </script>
</body>
</html>
```

[MEMORY_INJECTION_POINT]"""


def load_config() -> dict:
    try:
        if CONFIG_PATH.exists():
            return {**PROVIDER_DEFAULTS, **json.loads(CONFIG_PATH.read_text())}
    except Exception:
        pass
    return dict(PROVIDER_DEFAULTS)


def save_config(cfg: dict):
    APPDATA.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2))


async def get_ollama_models() -> list:
    cfg = load_config()
    url = cfg.get("ollama_url", OLLAMA_BASE)
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.get(f"{url}/api/tags")
            if r.status_code == 200:
                return [m["name"] for m in r.json().get("models", [])]
    except Exception:
        pass
    return []


async def get_lmstudio_models() -> list:
    cfg = load_config()
    url = cfg.get("lmstudio_url", LMS_BASE)
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.get(f"{url}/v1/models")
            if r.status_code == 200:
                return [m["id"] for m in r.json().get("data", [])]
    except Exception:
        pass
    return []


async def resolve_ollama_model(member: str) -> Optional[str]:
    cache_key = f"ollama_{member}"
    if cache_key in _resolved:
        return _resolved[cache_key]
    available = await get_ollama_models()
    for pref in PREFERRED[member]["ollama"]:
        if pref in available:
            _resolved[cache_key] = pref
            return pref
        for m in available:
            if m.startswith(pref.split(":")[0]):
                _resolved[cache_key] = m
                return m
    if available:
        _resolved[cache_key] = available[0]
        return available[0]
    return PREFERRED[member]["ollama"][0] if PREFERRED[member]["ollama"] else None


async def resolve_lmstudio_model(member: str) -> Optional[str]:
    cache_key = f"lms_{member}"
    if cache_key in _resolved:
        return _resolved[cache_key]
    available = await get_lmstudio_models()
    if not available:
        return None
    # Try keyword match
    keywords = PREFERRED[member]["lmstudio"]
    for kw in keywords:
        for m in available:
            if kw.lower() in m.lower():
                _resolved[cache_key] = m
                return m
    # Fall back to first available
    _resolved[cache_key] = available[0]
    return available[0]


# ---- Groq -------------------------------------------------------------------

def _trim_for_groq(messages: list, max_chars: int = 24000) -> list:
    """Trim message history to stay under Groq token limits (~8k tokens ~ 32k chars).
    Always keeps system message (index 0) and trims oldest non-system messages first."""
    total = sum(len(m.get("content","")) for m in messages)
    if total <= max_chars:
        return messages
    # Keep system message, trim from oldest user/assistant messages
    system = [m for m in messages if m["role"] == "system"]
    conv    = [m for m in messages if m["role"] != "system"]
    while conv and sum(len(m.get("content","")) for m in system+conv) > max_chars:
        conv.pop(0)
    # Also truncate any single message that is still very long
    result = []
    for m in system + conv:
        if len(m.get("content","")) > 6000:
            result.append({**m, "content": m["content"][:6000] + "…[trimmed]"})
        else:
            result.append(m)
    return result

async def _groq_stream(messages: list, api_key: str, model: str) -> AsyncGenerator[str, None]:
    messages = _trim_for_groq(messages)
    try:
        async with httpx.AsyncClient(timeout=120.0) as c:
            async with c.stream(
                "POST",
                "https://api.groq.com/openai/v1/chat/completions",
                json={"model": model, "messages": messages, "stream": True, "temperature": 0.7},
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            ) as r:
                if r.status_code == 401:
                    yield "*Invalid Groq API key. Check Settings.*"
                    return
                if r.status_code == 413:
                    # Request too large — retry with aggressively trimmed history
                    # Keep only system prompt + last 4 messages
                    trimmed = [messages[0]] + messages[-4:] if len(messages) > 5 else messages
                    async for chunk in _groq_stream(trimmed, api_key, model):
                        yield chunk
                    return
                if r.status_code == 429:
                    yield "*Groq rate limit hit. Wait a moment and try again.*"
                    return
                if r.status_code != 200:
                    yield f"*Groq error {r.status_code} — try again or switch provider in Settings.*"
                    return
                async for line in r.aiter_lines():
                    if not line.startswith("data: ") or line.strip() == "data: [DONE]":
                        continue
                    try:
                        d = json.loads(line[6:])
                        chunk = d["choices"][0]["delta"].get("content", "")
                        if chunk:
                            yield chunk
                    except Exception:
                        continue
    except httpx.ConnectError:
        yield "*Cannot reach Groq. Check internet connection.*"
    except Exception as e:
        yield f"*Groq error: {str(e)[:200]}*"


# ---- Ollama -----------------------------------------------------------------

async def _ollama_stream(model: str, messages: list, base_url: str) -> AsyncGenerator[str, None]:
    payload = {
        "model": model, "messages": messages,
        "stream": True, "keep_alive": -1,
        "options": {"temperature": 0.7, "num_ctx": 8192, "num_gpu": 99},
    }
    try:
        async with httpx.AsyncClient(timeout=300.0) as c:
            async with c.stream("POST", f"{base_url}/api/chat", json=payload) as r:
                if r.status_code == 404:
                    yield f"*Model '{model}' not found. Run: ollama pull {model}*"
                    return
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        d = json.loads(line)
                        chunk = d.get("message", {}).get("content", "")
                        if chunk:
                            yield chunk
                        if d.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue
    except httpx.ConnectError:
        yield "*Ollama not running. Open the Ollama app.*"
    except Exception as e:
        yield f"*Ollama error: {str(e)[:200]}*"


# ---- LM Studio --------------------------------------------------------------

async def _lmstudio_stream(messages: list, base_url: str, model: Optional[str] = None) -> AsyncGenerator[str, None]:
    payload: dict = {"messages": messages, "stream": True, "temperature": 0.7}
    if model:
        payload["model"] = model
    try:
        async with httpx.AsyncClient(timeout=300.0) as c:
            async with c.stream(
                "POST", f"{base_url}/v1/chat/completions",
                json=payload, headers={"Content-Type": "application/json"},
            ) as r:
                if r.status_code in (404, 503):
                    yield "*LM Studio server not running. Open LM Studio and start the server.*"
                    return
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line.startswith("data: ") or line.strip() == "data: [DONE]":
                        continue
                    try:
                        d = json.loads(line[6:])
                        chunk = d["choices"][0]["delta"].get("content", "")
                        if chunk:
                            yield chunk
                    except Exception:
                        continue
    except httpx.ConnectError:
        yield f"*LM Studio not running at {base_url}. Open LM Studio and start the server.*"
    except Exception as e:
        yield f"*LM Studio error: {str(e)[:200]}*"


# ---- Public API -------------------------------------------------------------

async def stream_completion(
    member: str,
    messages: list,
    system_override: Optional[str] = None,
    temperature: float = 0.7,
) -> AsyncGenerator[str, None]:
    cfg = load_config()
    system = system_override or LOGOS_SYSTEM_PROMPT
    full = [{"role": "system", "content": system}] + messages
    provider = cfg.get("provider", "hybrid")

    if provider == "hybrid":
        # Pneuma -> Groq (fast) with Ollama fallback
        if member == "pneuma":
            key = cfg.get("groq_key", "").strip()
            if key:
                async for chunk in _groq_stream(full, key, cfg.get("groq_model_pneuma", "llama-3.1-8b-instant")):
                    yield chunk
                return
            # Groq not configured - fall back to Ollama
            model = await resolve_ollama_model("pneuma")
            url   = cfg.get("ollama_url", OLLAMA_BASE)
            async for chunk in _ollama_stream(model or "qwen3:8b", full, url):
                yield chunk

        # Techne -> LM Studio (coder model)
        elif member == "techne":
            url   = cfg.get("lmstudio_url", LMS_BASE)
            # Check LM Studio is up first
            lms_ok = False
            try:
                async with httpx.AsyncClient(timeout=3.0) as c2:
                    r = await c2.get(f"{url}/v1/models")
                    lms_ok = r.status_code == 200
            except Exception:
                pass
            if lms_ok:
                model = await resolve_lmstudio_model("techne")
                async for chunk in _lmstudio_stream(full, url, model):
                    yield chunk
                return
            # LM Studio not available - fall back to Ollama coder or Groq
            key = cfg.get("groq_key", "").strip()
            if key:
                async for chunk in _groq_stream(full, key, "llama-3.3-70b-versatile"):
                    yield chunk
                return
            omodel = await resolve_ollama_model("techne")
            ourl   = cfg.get("ollama_url", OLLAMA_BASE)
            async for chunk in _ollama_stream(omodel or "qwen2.5-coder:7b", full, ourl):
                yield chunk

        # Opsis -> Ollama (vision model, used least often)
        else:
            model = await resolve_ollama_model("opsis")
            url   = cfg.get("ollama_url", OLLAMA_BASE)
            async for chunk in _ollama_stream(model or "qwen2-vl:7b", full, url):
                yield chunk

    elif provider == "groq":
        key = cfg.get("groq_key", "").strip()
        if not key:
            yield "*No Groq API key. Add it in Settings.*"
            return
        async for chunk in _groq_stream(full, key, cfg.get("groq_model_pneuma", "llama-3.1-8b-instant")):
            yield chunk

    elif provider == "lmstudio":
        url = cfg.get("lmstudio_url", LMS_BASE)
        async for chunk in _lmstudio_stream(full, url):
            yield chunk

    else:  # ollama
        model = await resolve_ollama_model(member)
        url   = cfg.get("ollama_url", OLLAMA_BASE)
        async for chunk in _ollama_stream(model or "qwen3:8b", full, url):
            yield chunk


async def complete_once(member: str, messages: list, system_override: Optional[str] = None, temperature: float = 0.3) -> str:
    cfg    = load_config()
    system = system_override or LOGOS_SYSTEM_PROMPT
    full   = [{"role": "system", "content": system}] + messages
    key    = cfg.get("groq_key", "").strip()

    # Always use Groq for quick completions if available (intent detection etc)
    if key:
        result = ""
        async for chunk in _groq_stream(full, key, "llama-3.1-8b-instant"):
            result += chunk
        if not result.startswith("*"):
            return result

    # Fall back to Ollama
    model = await resolve_ollama_model(member)
    url   = cfg.get("ollama_url", OLLAMA_BASE)
    result = ""
    async for chunk in _ollama_stream(model or "qwen3:8b", full, url):
        result += chunk
    return result


async def get_loaded_models() -> dict:
    ollama   = await get_ollama_models()
    lmstudio = await get_lmstudio_models()
    return {"ollama": ollama, "lmstudio": lmstudio}


# ---- Vision -----------------------------------------------------------------

async def vision_completion(image_b64: str, prompt: str, mime_type: str = "image/png") -> str:
    cfg   = load_config()
    model = await resolve_ollama_model("opsis")
    url   = cfg.get("ollama_url", OLLAMA_BASE)
    if not model:
        return "No vision model found. Run: ollama pull qwen2-vl:7b"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt, "images": [image_b64]}],
        "stream": False, "keep_alive": -1,
        "options": {"temperature": 0.3, "num_ctx": 4096, "num_gpu": 99},
    }
    try:
        async with httpx.AsyncClient(timeout=180.0) as c:
            r = await c.post(f"{url}/api/chat", json=payload)
            r.raise_for_status()
            return r.json().get("message", {}).get("content", "")
    except httpx.ConnectError:
        return "Ollama not running. Cannot analyze image."
    except Exception as e:
        return f"Vision error: {str(e)[:200]}"


# ---- Warmup -----------------------------------------------------------------

async def warmup_all():
    """Boot all three services simultaneously at startup."""
    cfg = load_config()
    tasks = []

    # Pneuma: Groq needs no warmup (cloud). Warm Ollama qwen3 anyway for fallback.
    ollama_url = cfg.get("ollama_url", OLLAMA_BASE)
    async def warm_ollama(member: str):
        model = await resolve_ollama_model(member)
        if not model:
            return
        payload = {
            "model": model, "messages": [{"role": "user", "content": "hi"}],
            "stream": False, "keep_alive": -1,
            "options": {"num_ctx": 512, "num_predict": 1, "temperature": 0.1},
        }
        try:
            async with httpx.AsyncClient(timeout=120.0) as c:
                await c.post(f"{ollama_url}/api/chat", json=payload)
        except Exception:
            pass

    async def warm_lmstudio():
        url   = cfg.get("lmstudio_url", LMS_BASE)
        model = await resolve_lmstudio_model("techne")
        if not model:
            return
        try:
            async with httpx.AsyncClient(timeout=60.0) as c:
                await c.post(f"{url}/v1/chat/completions",
                    json={"model": model, "messages": [{"role": "user", "content": "hi"}],
                          "stream": False, "max_tokens": 1},
                    headers={"Content-Type": "application/json"})
        except Exception:
            pass

    # Fire all warmups simultaneously
    await asyncio.gather(
        warm_ollama("pneuma"),
        warm_ollama("opsis"),
        warm_lmstudio(),
        return_exceptions=True,
    )


async def test_provider(provider: str, cfg: dict) -> dict:
    """Latency test for the settings panel."""
    import time
    start = time.time()
    try:
        if provider == "groq":
            key = cfg.get("groq_key", "").strip()
            if not key:
                return {"ok": False, "ms": 0, "msg": "No API key"}
            result = ""
            async for chunk in _groq_stream(
                [{"role": "system", "content": "Reply with one word."},
                 {"role": "user", "content": "ready?"}],
                key, "llama-3.1-8b-instant"
            ):
                result += chunk
                break  # first token is enough
            ms = int((time.time() - start) * 1000)
            ok = bool(result) and not result.startswith("*")
            return {"ok": ok, "ms": ms, "msg": f"{ms}ms" if ok else result[:80]}

        elif provider == "lmstudio":
            url = cfg.get("lmstudio_url", LMS_BASE)
            async with httpx.AsyncClient(timeout=15.0) as c:
                r = await c.get(f"{url}/v1/models")
            ms  = int((time.time() - start) * 1000)
            ok  = r.status_code == 200
            models = [m["id"] for m in r.json().get("data", [])] if ok else []
            return {"ok": ok, "ms": ms, "msg": f"{ms}ms - {len(models)} model(s)" if ok else "Server not responding"}

        elif provider == "ollama":
            url = cfg.get("ollama_url", OLLAMA_BASE)
            async with httpx.AsyncClient(timeout=10.0) as c:
                r = await c.get(f"{url}/api/tags")
            ms     = int((time.time() - start) * 1000)
            ok     = r.status_code == 200
            models = [m["name"] for m in r.json().get("models", [])] if ok else []
            return {"ok": ok, "ms": ms, "msg": f"{ms}ms - {len(models)} model(s)" if ok else "Not running"}

        return {"ok": False, "ms": 0, "msg": "Unknown provider"}
    except Exception as e:
        return {"ok": False, "ms": int((time.time() - start) * 1000), "msg": str(e)[:100]}
