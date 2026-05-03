"""
engine.py — Logos inference engine.

Fallback chain:
  1. Native llama-cpp-python (if installed + model file exists)
  2. Groq cloud API (if key configured)
  3. LM Studio (if running locally)
  4. Ollama (if running locally)
  5. Claude Code API (last resort — requires Anthropic key)
"""

import asyncio
from pathlib import Path
from typing import AsyncGenerator, Optional

from config import load_config, get_secret, MODELS_DIR
import inference.providers.groq      as groq_provider
import inference.providers.ollama    as ollama_provider
import inference.providers.lmstudio  as lmstudio_provider
import inference.providers.claude_code as claude_provider

# Attempt native llama.cpp import — graceful if not installed
try:
    from llama_cpp import Llama
    LLAMA_CPP_AVAILABLE = True
except ImportError:
    LLAMA_CPP_AVAILABLE = False

_native_models: dict = {}   # { "pneuma": Llama, "techne": Llama, "opsis": Llama }


def load_native_model(role: str, model_path: str, n_gpu_layers: int = -1):
    if not LLAMA_CPP_AVAILABLE:
        return False
    path = Path(model_path)
    if not path.exists():
        return False
    try:
        _native_models[role] = Llama(
            model_path=str(path),
            n_ctx=8192,
            n_gpu_layers=n_gpu_layers,
            verbose=False,
        )
        return True
    except Exception:
        return False


def load_configured_models():
    cfg = load_config()
    for role in ("pneuma", "techne", "opsis"):
        path = cfg.get(f"native_model_{role}", "")
        if not path:
            # Check default location
            model_dir = MODELS_DIR / role
            gguf_files = list(model_dir.glob("*.gguf"))
            if gguf_files:
                path = str(gguf_files[0])
        if path:
            load_native_model(role, path, cfg.get("n_gpu_layers", -1))


async def _native_stream(role: str, messages: list) -> AsyncGenerator[str, None]:
    model = _native_models.get(role)
    if not model:
        return
    try:
        loop = asyncio.get_event_loop()
        def _run():
            return list(model.create_chat_completion(messages, stream=True))
        tokens = await loop.run_in_executor(None, _run)
        for token in tokens:
            chunk = token["choices"][0]["delta"].get("content", "")
            if chunk:
                yield chunk
    except Exception as e:
        yield f"*Native inference error: {str(e)[:160]}*"


async def stream(
    member: str,
    messages: list,
    system_prompt: str,
) -> AsyncGenerator[str, None]:
    cfg         = load_config()
    groq_key    = get_secret("groq_key")
    anthropic_key = get_secret("anthropic_key")
    provider    = cfg.get("provider", "groq")
    full_msgs   = [{"role": "system", "content": system_prompt}] + messages

    # ── 1. Native llama.cpp ───────────────────────────────────────────────────
    if provider in ("native", "hybrid") and member in _native_models:
        got_content = False
        async for chunk in _native_stream(member, full_msgs):
            got_content = True
            yield chunk
        if got_content:
            return

    # ── 2. Provider-specific routing ──────────────────────────────────────────
    if provider == "groq" or (provider in ("native", "hybrid") and groq_key):
        if groq_key:
            model = cfg.get(f"groq_model_{member}", cfg.get("groq_model_pneuma", "llama-3.1-8b-instant"))
            async for chunk in groq_provider.stream(full_msgs, groq_key, model):
                yield chunk
            return

    if provider == "lmstudio":
        url = cfg.get("lmstudio_url", "http://localhost:1234")
        model = await lmstudio_provider.resolve_model(member, url)
        async for chunk in lmstudio_provider.stream(full_msgs, url, model):
            yield chunk
        return

    if provider == "ollama":
        url = cfg.get("ollama_url", "http://localhost:11434")
        model = await ollama_provider.resolve_model(member, url)
        async for chunk in ollama_provider.stream(model, full_msgs, url):
            yield chunk
        return

    # ── 3. Hybrid: try each provider in order ────────────────────────────────
    if provider == "hybrid":
        lms_url = cfg.get("lmstudio_url", "http://localhost:1234")
        lms_ok = False
        try:
            import httpx
            async with httpx.AsyncClient(timeout=3.0) as c:
                r = await c.get(f"{lms_url}/v1/models")
                lms_ok = r.status_code == 200
        except Exception:
            pass

        if lms_ok and member == "techne":
            model = await lmstudio_provider.resolve_model(member, lms_url)
            async for chunk in lmstudio_provider.stream(full_msgs, lms_url, model):
                yield chunk
            return

        oll_url = cfg.get("ollama_url", "http://localhost:11434")
        oll_models = await ollama_provider.list_models(oll_url)
        if oll_models:
            model = await ollama_provider.resolve_model(member, oll_url)
            async for chunk in ollama_provider.stream(model, full_msgs, oll_url):
                yield chunk
            return

    # ── 4. Final fallback: Claude Code API ───────────────────────────────────
    if anthropic_key:
        yield "\n*⟳ Handing off to Claude Code…*\n\n"
        async for chunk in claude_provider.stream(messages, anthropic_key, system=system_prompt):
            yield chunk
        return

    yield ("*No AI provider available. Configure a Groq API key or install Ollama "
           "to get started — Config → Provider Settings.*")


async def complete(member: str, messages: list, system_prompt: str) -> str:
    result = ""
    async for chunk in stream(member, messages, system_prompt):
        result += chunk
    return result


async def vision_complete(image_b64: str, prompt: str, mime_type: str = "image/png") -> str:
    cfg = load_config()
    url = cfg.get("ollama_url", "http://localhost:11434")
    model = await ollama_provider.resolve_model("opsis", url)
    if not model:
        return "No vision model found. Install Ollama and run: ollama pull qwen2-vl:7b"
    import httpx
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
    except Exception as e:
        return f"Vision error: {str(e)[:200]}"


async def warmup():
    load_configured_models()
    cfg = load_config()
    groq_key = get_secret("groq_key")
    if groq_key:
        return  # Groq needs no warmup

    oll_url = cfg.get("ollama_url", "http://localhost:11434")
    import httpx
    async def _warm(member: str):
        model = await ollama_provider.resolve_model(member, oll_url)
        if not model:
            return
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": "hi"}],
            "stream": False, "keep_alive": -1,
            "options": {"num_ctx": 512, "num_predict": 1},
        }
        try:
            async with httpx.AsyncClient(timeout=120.0) as c:
                await c.post(f"{oll_url}/api/chat", json=payload)
        except Exception:
            pass

    await asyncio.gather(_warm("pneuma"), _warm("opsis"), return_exceptions=True)
