"""network.py — Cloudflare tunnel + LAN access. No hardcoded tokens."""

import asyncio
import json
import os
import platform
import shutil
import socket
import subprocess
import time
from pathlib import Path

from fastapi import APIRouter, Request

from config import APPDATA, get_secret, save_secrets, load_secrets

TUNNEL_LOG = APPDATA / "logs" / "cloudflared.log"
router     = APIRouter()

_proc  = None
_logfh = None


def get_lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def find_cloudflared():
    pf86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
    pf   = os.environ.get("ProgramFiles",      r"C:\Program Files")
    home = os.environ.get("USERPROFILE", "")
    candidates = [
        APPDATA / "cloudflared.exe",
        Path(pf86) / "cloudflared" / "cloudflared.exe",
        Path(pf)   / "cloudflared" / "cloudflared.exe",
        Path(r"C:\Cloudflared\bin\cloudflared.exe"),
        Path(home) / "bin" / "cloudflared.exe",
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return shutil.which("cloudflared")


def tunnel_running() -> bool:
    return bool(_proc and _proc.poll() is None)


def _log_tail(n: int = 6000) -> str:
    try:
        if TUNNEL_LOG.exists():
            return TUNNEL_LOG.read_bytes()[-n:].decode("utf-8", "replace")
    except Exception:
        pass
    return ""


async def start_tunnel(token: str = "") -> dict:
    global _proc, _logfh
    if tunnel_running():
        return {"ok": True, "status": "already_running"}

    token = (token or get_secret("tunnel_token")).strip()
    if not token:
        return {"ok": False, "error": "No tunnel token — add it in Config → Network Settings."}
    if not token.startswith("eyJ"):
        return {"ok": False, "error": "Token must start with 'eyJ'. Get it from Cloudflare Zero Trust → Networks → Tunnels."}

    cf = find_cloudflared()
    if not cf:
        return {"ok": False, "error": f"cloudflared.exe not found. Download from cloudflare.com and place in {APPDATA}"}

    try:
        result = subprocess.run([cf, "--version"], capture_output=True, text=True, timeout=8,
                                creationflags=0x08000000 if platform.system() == "Windows" else 0)
        ver = (result.stdout or result.stderr).strip()
    except Exception as e:
        return {"ok": False, "error": f"cloudflared error: {e}"}

    try:
        _logfh = open(TUNNEL_LOG, "ab", buffering=0)
        _logfh.write(f"\n[{time.strftime('%Y-%m-%dT%H:%M:%S')}] Starting — {ver}\n".encode())
    except Exception as e:
        return {"ok": False, "error": f"Cannot write log: {e}"}

    try:
        _proc = subprocess.Popen(
            [cf, "tunnel", "--no-autoupdate", "--loglevel", "info", "run", "--token", token],
            stdin=subprocess.DEVNULL, stdout=_logfh, stderr=subprocess.STDOUT,
            creationflags=0x08000000 if platform.system() == "Windows" else 0,
        )
    except Exception as e:
        return {"ok": False, "error": f"Launch failed: {e}"}

    await asyncio.sleep(3)
    if _proc.poll() is not None:
        return {"ok": False, "error": "cloudflared exited immediately.", "log_tail": _log_tail()}

    return {"ok": True, "status": "started", "version": ver}


def stop_tunnel():
    global _proc, _logfh
    if _proc:
        try:
            _proc.terminate()
            _proc.wait(timeout=5)
        except Exception:
            try:
                _proc.kill()
            except Exception:
                pass
        _proc = None
    if _logfh:
        try:
            _logfh.close()
        except Exception:
            pass
        _logfh = None


@router.get("/status")
async def network_status():
    from config import load_config
    cfg = load_config()
    return {
        "lan_ip":               get_lan_ip(),
        "lan_url":              f"http://{get_lan_ip()}:{cfg.get('lan_port', 8000)}",
        "tunnel_running":       tunnel_running(),
        "cloudflared_installed": find_cloudflared() is not None,
        "tunnel_token_set":     bool(get_secret("tunnel_token")),
        "custom_domain":        cfg.get("custom_domain", ""),
    }


@router.get("/config")
async def get_config():
    from config import load_config
    cfg = load_config()
    sec = load_secrets()
    return {
        **cfg,
        "tunnel_token": "***configured***" if sec.get("tunnel_token") else "",
        "lan_port": cfg.get("lan_port", 8000),
    }


@router.post("/config")
async def save_config_route(request: Request):
    body = await request.json()
    from config import save_config, load_config
    cfg = load_config()

    if body.get("tunnel_token") and body["tunnel_token"] != "***configured***":
        save_secrets({"tunnel_token": body["tunnel_token"].strip()})

    for k in ["web_enabled", "custom_domain", "lan_port"]:
        if k in body:
            cfg[k] = body[k]
    save_config(cfg)
    return {"saved": True}


@router.post("/tunnel/start")
async def tunnel_start(request: Request):
    body  = await request.json()
    token = body.get("token", "").strip()
    if token and token != "***configured***":
        save_secrets({"tunnel_token": token})
    return await start_tunnel(token)


@router.post("/tunnel/stop")
async def tunnel_stop():
    stop_tunnel()
    return {"ok": True, "status": "stopped"}


@router.get("/tunnel/log")
async def tunnel_log():
    return {"log": _log_tail(8192)}


@router.get("/lan-ip")
async def lan_ip():
    return {"ip": get_lan_ip()}
