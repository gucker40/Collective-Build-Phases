"""
preloader.py - Silently warms all Logos council models into VRAM.
Run at login or on app launch. No output, no windows.
Models stay resident in GPU memory until machine sleeps/reboots.
"""

import httpx
import asyncio
import sys
import os
import json
from pathlib import Path

OLLAMA_BASE = "http://localhost:11434"
APPDATA = Path(os.environ.get("APPDATA", "~")).expanduser() / "the-collective"
CONFIG  = APPDATA / "config.json"
LOG     = APPDATA / "logs" / "preloader.log"

MODELS = {
    "pneuma": ["qwen3:14b", "qwen3:8b", "qwen3:4b"],
    "techne": ["qwen2.5-coder:14b", "qwen2.5-coder:7b"],
    "opsis":  ["qwen2-vl:7b"],
}

# Tiny prompt that forces the model to load without doing real work
WARMUP_PROMPT = "Hi"


def log(msg: str):
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG, "a") as f:
            from datetime import datetime
            f.write(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}\n")
    except Exception:
        pass


async def get_available_models() -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{OLLAMA_BASE}/api/tags")
            return [m["name"] for m in r.json().get("models", [])]
    except Exception:
        return []


async def warmup_model(model: str) -> bool:
    """Send a minimal request to load model into VRAM."""
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                f"{OLLAMA_BASE}/api/generate",
                json={
                    "model": model,
                    "prompt": WARMUP_PROMPT,
                    "stream": False,
                    "options": {"num_predict": 1},  # only generate 1 token
                },
            )
            return r.status_code == 200
    except Exception as e:
        log(f"Warmup failed for {model}: {e}")
        return False


async def keep_alive(model: str) -> bool:
    """Ollama 0.21+ supports keep_alive to pin model in memory."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{OLLAMA_BASE}/api/generate",
                json={
                    "model": model,
                    "keep_alive": "24h",  # keep in VRAM for 24 hours
                    "prompt": "",
                    "stream": False,
                },
            )
            return r.status_code == 200
    except Exception:
        return False


async def main():
    log("Preloader starting")

    # Check if preloading is enabled in config
    try:
        if CONFIG.exists():
            cfg = json.loads(CONFIG.read_text())
            if not cfg.get("preloadOnBoot", True):
                log("Preloading disabled in config. Exiting.")
                return
    except Exception:
        pass

    # Wait for Ollama to be ready (up to 30s)
    for attempt in range(30):
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                r = await client.get(f"{OLLAMA_BASE}/api/tags")
                if r.status_code == 200:
                    break
        except Exception:
            pass
        await asyncio.sleep(1)
    else:
        log("Ollama not available after 30s. Exiting.")
        return

    available = await get_available_models()
    log(f"Available models: {available}")

    # Find and warm each council member
    for role, candidates in MODELS.items():
        model = next((m for m in candidates if any(
            av.startswith(m.split(":")[0]) for av in available
        )), None)

        if not model:
            # Try prefix match
            model = next((av for av in available for c in candidates
                         if av.startswith(c.split(":")[0])), None)

        if not model:
            log(f"{role}: no model found, skipping")
            continue

        log(f"{role}: warming {model}...")

        # Try keep_alive first (faster), fall back to warmup
        success = await keep_alive(model)
        if not success:
            success = await warmup_model(model)

        log(f"{role}: {'ready' if success else 'failed'}")

    log("Preloader complete")


if __name__ == "__main__":
    asyncio.run(main())
