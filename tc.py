"""
The Collective — Python launcher / diagnostics.
Usage:
  python tc.py diagnose     print system info and save to tc-diagnose.txt
  python tc.py web          start backend + open http://localhost:5173
  python tc.py desktop      start backend + launch Electron dev window
  python tc.py build        build the Windows installer
"""
import sys, os, subprocess, shutil, time, platform, json
from pathlib import Path

_WIN = os.name == "nt"   # npm/npx are .cmd files on Windows — need shell=True

ROOT     = Path(__file__).resolve().parent
BACKEND  = ROOT / "the-collective" / "backend"
FRONTEND = ROOT / "the-collective" / "frontend"
INSTALLER_OUT = ROOT / "installer"
LOG_FILE = ROOT / "tc-log.txt"

# ── helpers ───────────────────────────────────────────────────────────────────

def log(msg=""):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

def run(cmd, cwd=None, env=None, check=True):
    """Run a command, streaming output to console and log file."""
    log(f"\n>> {' '.join(str(c) for c in cmd)}")
    with open(LOG_FILE, "a", encoding="utf-8") as logf:
        proc = subprocess.Popen(
            cmd, cwd=cwd, env=env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace",
            shell=_WIN,   # required on Windows for npm.cmd / npx.cmd
        )
        for line in proc.stdout:
            line = line.rstrip()
            print(line)
            logf.write(line + "\n")
        proc.wait()
    if check and proc.returncode != 0:
        raise RuntimeError(f"Command failed with exit code {proc.returncode}")
    return proc.returncode

def find_python():
    for candidate in ["python", "python3", "py"]:
        if shutil.which(candidate):
            result = subprocess.run([candidate, "--version"],
                                    capture_output=True, text=True, shell=_WIN)
            if result.returncode == 0:
                return candidate, result.stdout.strip() + result.stderr.strip()
    return None, None

def find_node():
    if shutil.which("node"):
        r = subprocess.run(["node", "--version"], capture_output=True, text=True, shell=_WIN)
        return r.stdout.strip()
    return None

def find_npm():
    # On Windows npm is npm.cmd — shutil.which finds it but subprocess needs shell=True
    if shutil.which("npm") or shutil.which("npm.cmd"):
        r = subprocess.run(["npm", "--version"], capture_output=True, text=True, shell=_WIN)
        if r.returncode == 0:
            return r.stdout.strip()
    return None

# ── commands ──────────────────────────────────────────────────────────────────

def cmd_diagnose():
    out = LOG_FILE.parent / "tc-diagnose.txt"
    lines = []
    def p(s=""):
        print(s); lines.append(s)

    p("=" * 60)
    p("  THE COLLECTIVE — DIAGNOSTICS")
    p("=" * 60)
    p(f"Date:      {time.strftime('%Y-%m-%d %H:%M:%S')}")
    p(f"OS:        {platform.system()} {platform.release()} {platform.machine()}")
    p(f"Script:    {__file__}")
    p(f"ROOT:      {ROOT}")
    p()

    p("── Folder check ─────────────────────────────────────────")
    for folder, label in [
        (BACKEND,  "the-collective/backend"),
        (FRONTEND, "the-collective/frontend"),
        (BACKEND  / "requirements.txt", "backend/requirements.txt"),
        (FRONTEND / "package.json",     "frontend/package.json"),
        (FRONTEND / "node_modules",     "frontend/node_modules (installed?)"),
    ]:
        status = "FOUND   " if Path(folder).exists() else "MISSING "
        p(f"  [{status}] {label}")
    p()

    p("── Python ───────────────────────────────────────────────")
    py, pyver = find_python()
    p(f"  Command: {py or 'NOT FOUND'}")
    p(f"  Version: {pyver or 'N/A'}")
    if py:
        r = subprocess.run([py, "-m", "pip", "--version"],
                           capture_output=True, text=True)
        p(f"  pip:     {(r.stdout + r.stderr).strip()}")
        # Check if aiosqlite is importable
        r2 = subprocess.run([py, "-c", "import aiosqlite; print('aiosqlite OK')"],
                            capture_output=True, text=True, cwd=str(BACKEND))
        p(f"  aiosqlite: {(r2.stdout + r2.stderr).strip()}")
    p()

    p("── Node / npm ───────────────────────────────────────────")
    node_ver = find_node()
    npm_ver  = find_npm()
    p(f"  node: {node_ver or 'NOT FOUND'}")
    p(f"  npm:  {npm_ver  or 'NOT FOUND'}")
    npx = shutil.which("npx")
    p(f"  npx:  {npx or 'NOT FOUND'}")
    # Check if electron binary downloaded
    electron_bin = FRONTEND / "node_modules" / "electron" / "dist" / "electron.exe"
    p(f"  Electron binary: {'FOUND' if electron_bin.exists() else 'NOT FOUND (run npm install first)'}")
    p()

    p("── package.json scripts ─────────────────────────────────")
    pkg = FRONTEND / "package.json"
    if pkg.exists():
        with open(pkg) as f:
            data = json.load(f)
        for k, v in data.get("scripts", {}).items():
            p(f"  {k}: {v}")
    else:
        p("  package.json not found")
    p()
    p("=" * 60)

    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    p()
    p(f"Saved to: {out}")
    if _WIN:
        p("Opening in Notepad...")
        os.startfile(str(out))

def cmd_web():
    py, _ = find_python()
    if not py:
        log("[ERROR] Python not found. Install from python.org")
        return 1

    log("[1/3] Installing Python dependencies...")
    run([py, "-m", "pip", "install", "-r", "requirements.txt",
         "--disable-pip-version-check"], cwd=BACKEND)
    log("[1/3] Done.")

    if not find_npm():
        log("[ERROR] npm not found. Install Node.js from nodejs.org")
        return 1

    log("[2/3] Installing Node dependencies (first run downloads ~80MB)...")
    run(["npm", "install"], cwd=FRONTEND)
    log("[2/3] Done.")

    log("[3/3] Starting backend on port 8000...")
    subprocess.Popen(
        [py, "main.py"], cwd=BACKEND,
        creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == "nt" else 0
    )
    time.sleep(3)

    log("Opening http://localhost:5173 ...")
    if _WIN:
        os.startfile("http://localhost:5173")

    log("Starting Vite dev server... (close this window to stop)")
    run(["npm", "run", "dev"], cwd=FRONTEND, check=False)
    return 0

def cmd_desktop():
    py, _ = find_python()
    if not py:
        log("[ERROR] Python not found. Install from python.org")
        return 1

    log("[1/3] Installing Python dependencies...")
    run([py, "-m", "pip", "install", "-r", "requirements.txt",
         "--disable-pip-version-check"], cwd=BACKEND)
    log("[1/3] Done.")

    if not find_npm():
        log("[ERROR] npm not found. Install Node.js from nodejs.org")
        return 1

    log("[2/3] Installing Node dependencies...")
    run(["npm", "install"], cwd=FRONTEND)

    # Ensure Electron binary
    electron_bin = FRONTEND / "node_modules" / "electron" / "dist" / "electron.exe"
    if not electron_bin.exists():
        install_js = FRONTEND / "node_modules" / "electron" / "install.js"
        if install_js.exists():
            log("Downloading Electron binary...")
            run(["node", str(install_js)], cwd=FRONTEND)
    log("[2/3] Done.")

    log("[3/3] Starting backend...")
    subprocess.Popen(
        [py, "main.py"], cwd=BACKEND,
        creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == "nt" else 0
    )
    time.sleep(3)

    log("Launching Electron app...")
    run(["npm", "run", "electron:dev"], cwd=FRONTEND, check=False)
    return 0

def cmd_build():
    py, _ = find_python()
    if not py:
        log("[ERROR] Python not found. Install from python.org")
        return 1
    if not find_npm():
        log("[ERROR] npm not found. Install Node.js from nodejs.org")
        return 1

    INSTALLER_OUT.mkdir(exist_ok=True)

    log("[1/4] Installing Python dependencies...")
    run([py, "-m", "pip", "install", "-r", "requirements.txt",
         "--disable-pip-version-check"], cwd=BACKEND)
    log("[1/4] Done.")

    log("[2/4] Installing Node dependencies (first run downloads ~80MB)...")
    run(["npm", "install"], cwd=FRONTEND)
    log("[2/4] Done.")

    log("[3/4] Building React frontend...")
    run(["npm", "run", "build"], cwd=FRONTEND)
    log("[3/4] Done.")

    log("[4/4] Building Windows installer (downloads NSIS on first run)...")
    run(["npx", "electron-builder", "--win"], cwd=FRONTEND)
    log("[4/4] Done.")

    # Find and report the .exe
    exes = list((FRONTEND / "release").glob("**/*.exe")) + \
           list(INSTALLER_OUT.glob("*.exe"))
    if exes:
        for exe in exes[:1]:
            dest = INSTALLER_OUT / exe.name
            if exe != dest:
                shutil.copy2(exe, dest)
            log()
            log("=" * 60)
            log(f"  SUCCESS: installer\\{exe.name}")
            log("  Run that .exe to install The Collective.")
            log("=" * 60)
    else:
        log("[WARN] Build finished but no .exe found.")
        log(f"       Check: {FRONTEND / 'release'}")

    log(f"\nFull log saved to: {LOG_FILE}")
    return 0

# ── entry point ───────────────────────────────────────────────────────────────

COMMANDS = {"diagnose": cmd_diagnose, "web": cmd_web,
            "desktop": cmd_desktop, "build": cmd_build}

if __name__ == "__main__":
    # Clear log on fresh run
    with open(LOG_FILE, "w") as f:
        f.write(f"tc.py log — {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")

    cmd = sys.argv[1] if len(sys.argv) > 1 else None
    if cmd not in COMMANDS:
        print(__doc__)
        print(f"Available: {', '.join(COMMANDS)}")
        input("\nPress Enter to exit...")
        sys.exit(1)

    try:
        result = COMMANDS[cmd]()
        log(f"\nDone. Log: {LOG_FILE}")
    except Exception as e:
        log(f"\n[FATAL ERROR] {e}")
        log(f"Full log: {LOG_FILE}")
        import traceback
        log(traceback.format_exc())

    input("\nPress Enter to close...")
