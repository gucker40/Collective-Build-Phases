"""
config.py — Central config and secrets management.
config.json  → provider choices, UI prefs, model settings (safe to inspect)
secrets.json → API keys, tunnel token (never committed to source)
"""

import json
import os
from pathlib import Path

APPDATA = Path(os.environ.get("APPDATA", os.path.expanduser("~"))) / "the-collective"
CONFIG_PATH  = APPDATA / "config.json"
SECRETS_PATH = APPDATA / "secrets.json"
MODELS_DIR   = APPDATA / "models"

for _d in [APPDATA, MODELS_DIR,
           MODELS_DIR / "pneuma", MODELS_DIR / "techne", MODELS_DIR / "opsis",
           APPDATA / "logs", APPDATA / "skills" / "downloaded"]:
    _d.mkdir(parents=True, exist_ok=True)

CONFIG_DEFAULTS: dict = {
    "provider":            "groq",         # groq | ollama | lmstudio | native | hybrid
    "performance_profile": "auto",         # low | mid | high | max | auto
    "preload_on_boot":     True,
    "ollama_url":          "http://localhost:11434",
    "lmstudio_url":        "http://localhost:1234",
    "groq_model_pneuma":   "llama-3.1-8b-instant",
    "groq_model_techne":   "llama-3.3-70b-versatile",
    "native_model_pneuma": "",
    "native_model_techne": "",
    "native_model_opsis":  "",
    "n_gpu_layers":        -1,             # -1 = full GPU offload; 0 = CPU
    "personal_mode":       False,
    "file_access_level":   "standard",    # sandboxed | standard | full
    "web_enabled":         False,
    "theme_primary":       "#a07aff",
    "theme_gold":          "#f0c040",
    "theme_bg":            "#0d0d1a",
}

SECRETS_DEFAULTS: dict = {
    "groq_key":       "",
    "anthropic_key":  "",
    "tunnel_token":   "",
}


def load_config() -> dict:
    cfg = dict(CONFIG_DEFAULTS)
    try:
        if CONFIG_PATH.exists():
            cfg.update(json.loads(CONFIG_PATH.read_text()))
    except Exception:
        pass
    return cfg


def save_config(data: dict):
    cfg = load_config()
    cfg.update(data)
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2))


def load_secrets() -> dict:
    sec = dict(SECRETS_DEFAULTS)
    try:
        if SECRETS_PATH.exists():
            sec.update(json.loads(SECRETS_PATH.read_text()))
    except Exception:
        pass
    return sec


def save_secrets(data: dict):
    sec = load_secrets()
    sec.update(data)
    SECRETS_PATH.write_text(json.dumps(sec, indent=2))
    try:
        SECRETS_PATH.chmod(0o600)
    except Exception:
        pass


def get_secret(key: str) -> str:
    return load_secrets().get(key, "").strip()
