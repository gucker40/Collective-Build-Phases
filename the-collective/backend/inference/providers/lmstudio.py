"""LM Studio local provider — optional fallback."""

import json
import httpx
from typing import AsyncGenerator, Optional

KEYWORDS = {
    "pneuma": ["qwen3", "llama", "mistral", "phi"],
    "techne": ["coder", "deepseek", "qwen2.5-coder", "starcoder"],
    "opsis":  ["vl", "vision", "llava", "qwen2-vl"],
}

_resolved: dict = {}


async def list_models(base_url: str) -> list:
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.get(f"{base_url}/v1/models")
            if r.status_code == 200:
                return [m["id"] for m in r.json().get("data", [])]
    except Exception:
        pass
    return []


async def resolve_model(member: str, base_url: str) -> Optional[str]:
    key = f"{base_url}_{member}"
    if key in _resolved:
        return _resolved[key]
    available = await list_models(base_url)
    if not available:
        return None
    for kw in KEYWORDS.get(member, []):
        for m in available:
            if kw.lower() in m.lower():
                _resolved[key] = m
                return m
    _resolved[key] = available[0]
    return available[0]


async def stream(
    messages: list,
    base_url: str,
    model: Optional[str] = None,
) -> AsyncGenerator[str, None]:
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
                    yield "*LM Studio server not running — open LM Studio and start the server.*"
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
        yield f"*LM Studio not running at {base_url}.*"
    except Exception as e:
        yield f"*LM Studio error: {str(e)[:160]}*"
