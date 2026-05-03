"""
network.py - Phase 2A.1 - Fixed Cloudflare Tunnel + web access
Key fixes over 2A:
  - stderr redirected to log file (was DEVNULL — hiding all errors)
  - token.strip() before use (clipboard newlines break base64)
  - smoke-test binary before launching  
  - exhaustive Windows install path search
  - 3-second fast-fail detection with log tail
"""

import os, json, shutil, subprocess, platform, socket, time, asyncio
from pathlib import Path
from fastapi import APIRouter, Request

APPDATA     = Path(os.environ.get("APPDATA", os.path.expanduser("~"))) / "logos-app"
NETWORK_CFG = APPDATA / "network.json"
TUNNEL_LOG  = APPDATA / "logs" / "cloudflared.log"
APPDATA.mkdir(parents=True, exist_ok=True)
(APPDATA / "logs").mkdir(exist_ok=True)

router = APIRouter()

def load_network_config() -> dict:
    defaults = {"web_enabled": False, "tunnel_enabled": False,
                "tunnel_token": "",  # Set via Settings — never hardcode tokens in source
                "custom_domain": "the-collective.vip", "lan_port": 8000}
    try:
        if NETWORK_CFG.exists():
            return {**defaults, **json.loads(NETWORK_CFG.read_text())}
    except Exception:
        pass
    return defaults

def save_network_config(cfg: dict):
    NETWORK_CFG.write_text(json.dumps(cfg, indent=2))

def get_lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80)); ip = s.getsockname()[0]; s.close(); return ip
    except Exception:
        return "127.0.0.1"

def find_cloudflared():
    pf86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
    pf   = os.environ.get("ProgramFiles",      r"C:\Program Files")
    home = os.environ.get("USERPROFILE",        "")
    candidates = [
        APPDATA / "cloudflared.exe",                              # user drops it here
        Path(pf86) / "cloudflared" / "cloudflared.exe",          # MSI default
        Path(pf)   / "cloudflared" / "cloudflared.exe",
        Path(r"C:\Cloudflared\bin\cloudflared.exe"),
        Path(r"C:\Cloudflared\cloudflared.exe"),
        Path(home) / "bin" / "cloudflared.exe",
        Path(__file__).parent / "cloudflared.exe",
    ]
    for p in candidates:
        if p.exists(): return str(p)
    return shutil.which("cloudflared")

def smoke_test(cf_path: str):
    try:
        r = subprocess.run([cf_path, "--version"], capture_output=True, text=True,
            timeout=8, creationflags=0x08000000 if platform.system()=="Windows" else 0)
        if r.returncode == 0: return True, (r.stdout or r.stderr).strip()
        return False, r.stderr.strip()
    except FileNotFoundError:
        return False, f"not found at {cf_path}"
    except Exception as e:
        return False, str(e)

_proc = None
_logfh = None

def tunnel_running():
    return bool(_proc and _proc.poll() is None)

def _log_tail(n=6000):
    try:
        if TUNNEL_LOG.exists(): return TUNNEL_LOG.read_bytes()[-n:].decode("utf-8","replace")
    except Exception: pass
    return ""

async def start_tunnel(token=""):
    global _proc, _logfh
    if tunnel_running():
        return {"ok": True, "status": "already_running"}

    cfg   = load_network_config()
    token = (token or cfg.get("tunnel_token","")).strip()

    if not token:
        return {"ok": False, "error": "No tunnel token. Add it in Network settings."}
    if not token.startswith("eyJ"):
        return {"ok": False, "error":
            "Token must start with 'eyJ'. Get it from: Cloudflare Zero Trust → "
            "Networks → Tunnels → your tunnel → Configure → copy from the install command."}

    cf = find_cloudflared()
    if not cf:
        return {"ok": False, "error":
            f"cloudflared.exe not found.\n"
            f"Download: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/\n"
            f"Place cloudflared.exe in: {APPDATA}\n"
            f"Then click Start Tunnel again."}

    ok, ver = smoke_test(cf)
    if not ok:
        return {"ok": False, "error": f"cloudflared binary error: {ver}"}

    try:
        _logfh = open(TUNNEL_LOG, "ab", buffering=0)
        _logfh.write(f"\n[{time.strftime('%Y-%m-%dT%H:%M:%S')}] Starting — {ver}\n".encode())
    except Exception as e:
        return {"ok": False, "error": f"Cannot write log: {e}"}

    try:
        _proc = subprocess.Popen(
            [cf, "tunnel", "--no-autoupdate", "--loglevel", "info", "run", "--token", token],
            stdin=subprocess.DEVNULL, stdout=_logfh, stderr=subprocess.STDOUT,
            creationflags=0x08000000 if platform.system()=="Windows" else 0,
        )
    except Exception as e:
        return {"ok": False, "error": f"Launch failed: {e}"}

    await asyncio.sleep(3)
    if _proc.poll() is not None:
        tail = _log_tail()
        return {"ok": False, "error": "cloudflared exited immediately. See log below.", "log_tail": tail}

    return {"ok": True, "status": "started", "binary": cf, "version": ver, "log_path": str(TUNNEL_LOG)}

def stop_tunnel():
    global _proc, _logfh
    if _proc:
        try: _proc.terminate(); _proc.wait(timeout=5)
        except Exception:
            try: _proc.kill()
            except Exception: pass
        _proc = None
    if _logfh:
        try: _logfh.close()
        except Exception: pass
        _logfh = None

@router.get("/status")
async def network_status():
    cfg = load_network_config()
    cf  = find_cloudflared()
    ip  = get_lan_ip()
    return {
        "lan_ip": ip,
        "lan_url": f"http://{ip}:{cfg.get('lan_port',8000)}",
        "web_enabled": cfg.get("web_enabled", False),
        "tunnel_enabled": cfg.get("tunnel_enabled", False),
        "tunnel_running": tunnel_running(),
        "cloudflared_installed": cf is not None,
        "cloudflared_path": cf,
        "custom_domain": cfg.get("custom_domain", ""),
        "tunnel_token_set": bool(cfg.get("tunnel_token","").strip()),
    }

@router.get("/config")
async def get_config():
    cfg = load_network_config()
    safe = dict(cfg)
    if safe.get("tunnel_token"): safe["tunnel_token"] = "***configured***"
    return safe

@router.post("/config")
async def save_config(request: Request):
    body = await request.json()
    cfg  = load_network_config()
    if body.get("tunnel_token") and body["tunnel_token"] != "***configured***":
        cfg["tunnel_token"] = body["tunnel_token"].strip()
    for k in ["web_enabled","tunnel_enabled","custom_domain","lan_port"]:
        if k in body: cfg[k] = body[k]
    save_network_config(cfg)
    return {"saved": True}

@router.post("/tunnel/start")
async def tunnel_start(request: Request):
    body  = await request.json()
    token = body.get("token","").strip()
    if token and token != "***configured***":
        cfg = load_network_config(); cfg["tunnel_token"] = token; save_network_config(cfg)
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

@router.get("/cloudflared/check")
async def check_cf():
    cf = find_cloudflared()
    ok, ver = smoke_test(cf) if cf else (False, "")
    return {
        "installed": cf is not None, "path": cf,
        "version": ver if ok else None,
        "target_dir": str(APPDATA),
    }

@router.get("/cloudflared/download-info")
async def dl_info():
    return {
        "msi_url":    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi",
        "exe_url":    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe",
        "target_dir": str(APPDATA),
        "instructions": [
            "Option A (easiest): Download and run the MSI installer",
            f"Option B: Download .exe, rename to cloudflared.exe, place in {APPDATA}",
        ]
    }
