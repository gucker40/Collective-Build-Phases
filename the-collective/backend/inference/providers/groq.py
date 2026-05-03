"""Groq cloud provider — fast, free tier, ideal for Pneuma."""

import json
import httpx
from typing import AsyncGenerator

GROQ_BASE = "https://api.groq.com/openai/v1/chat/completions"


def _trim(messages: list, max_chars: int = 24000) -> list:
    total = sum(len(m.get("content", "")) for m in messages)
    if total <= max_chars:
        return messages
    system = [m for m in messages if m["role"] == "system"]
    conv   = [m for m in messages if m["role"] != "system"]
    while conv and sum(len(m.get("content","")) for m in system + conv) > max_chars:
        conv.pop(0)
    result = []
    for m in system + conv:
        if len(m.get("content","")) > 6000:
            result.append({**m, "content": m["content"][:6000] + "…[trimmed]"})
        else:
            result.append(m)
    return result


async def stream(
    messages: list,
    api_key: str,
    model: str = "llama-3.1-8b-instant",
) -> AsyncGenerator[str, None]:
    messages = _trim(messages)
    try:
        async with httpx.AsyncClient(timeout=120.0) as c:
            async with c.stream(
                "POST", GROQ_BASE,
                json={"model": model, "messages": messages, "stream": True, "temperature": 0.7},
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            ) as r:
                if r.status_code == 401:
                    yield "*Invalid Groq API key — check Config → Provider Settings.*"
                    return
                if r.status_code == 413:
                    trimmed = [messages[0]] + messages[-4:] if len(messages) > 5 else messages
                    async for chunk in stream(trimmed, api_key, model):
                        yield chunk
                    return
                if r.status_code == 429:
                    yield "*Groq rate limit — wait a moment and try again.*"
                    return
                if r.status_code != 200:
                    yield f"*Groq error {r.status_code} — check provider settings.*"
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
        yield "*Cannot reach Groq — check internet connection.*"
    except Exception as e:
        yield f"*Groq error: {str(e)[:160]}*"


async def complete(messages: list, api_key: str, model: str = "llama-3.1-8b-instant") -> str:
    result = ""
    async for chunk in stream(messages, api_key, model):
        result += chunk
    return result
