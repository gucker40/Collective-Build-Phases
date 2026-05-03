"""Ollama local provider — optional fallback."""

import json
import httpx
from typing import AsyncGenerator, Optional

PREFERRED = {
    "pneuma": ["qwen3:8b", "qwen3:4b", "llama3:8b", "mistral:7b"],
    "techne": ["qwen2.5-coder:14b", "qwen2.5-coder:7b", "deepseek-coder:6.7b"],
    "opsis":  ["qwen2-vl:7b", "llava:7b", "moondream:latest"],
}

_resolved: dict = {}


async def list_models(base_url: str) -> list:
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.get(f"{base_url}/api/tags")
            if r.status_code == 200:
                return [m["name"] for m in r.json().get("models", [])]
    except Exception:
        pass
    return []


async def resolve_model(member: str, base_url: str) -> Optional[str]:
    key = f"{base_url}_{member}"
    if key in _resolved:
        return _resolved[key]
    available = await list_models(base_url)
    for pref in PREFERRED.get(member, []):
        if pref in available:
            _resolved[key] = pref
            return pref
        for m in available:
            if m.startswith(pref.split(":")[0]):
                _resolved[key] = m
                return m
    if available:
        _resolved[key] = available[0]
        return available[0]
    fallback = PREFERRED.get(member, ["qwen3:8b"])[0]
    return fallback


async def stream(
    model: str,
    messages: list,
    base_url: str,
) -> AsyncGenerator[str, None]:
    payload = {
        "model": model, "messages": messages, "stream": True, "keep_alive": -1,
        "options": {"temperature": 0.7, "num_ctx": 8192, "num_gpu": 99},
    }
    try:
        async with httpx.AsyncClient(timeout=300.0) as c:
            async with c.stream("POST", f"{base_url}/api/chat", json=payload) as r:
                if r.status_code == 404:
                    yield f"*Model '{model}' not found — run: ollama pull {model}*"
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
                    except Exception:
                        continue
    except httpx.ConnectError:
        yield "*Ollama not running — install from ollama.com or use a cloud provider.*"
    except Exception as e:
        yield f"*Ollama error: {str(e)[:160]}*"
