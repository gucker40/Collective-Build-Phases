@echo off
REM Keep this window open even if the script errors out
if NOT "%KEEP_OPEN%"=="1" (
    set KEEP_OPEN=1
    cmd /k "%~f0"
    exit
)

title The Collective - Build Installer
echo.
echo  ============================================================
echo    THE COLLECTIVE  Phase 4  --  Build Installer
echo  ============================================================
echo.

set "ROOT=%~dp0"
set "FRONTEND=%ROOT%the-collective\frontend"
set "BACKEND=%ROOT%the-collective\backend"
set "OUT=%ROOT%installer"

REM ── Verify folders ───────────────────────────────────────────────────────────
if not exist "%BACKEND%\requirements.txt" (
    echo [ERROR] Cannot find: %BACKEND%\requirements.txt
    echo         Make sure you fully extracted the ZIP before running this.
    goto :end
)
if not exist "%FRONTEND%\package.json" (
    echo [ERROR] Cannot find: %FRONTEND%\package.json
    echo         Make sure you fully extracted the ZIP before running this.
    goto :end
)

REM ── Verify tools ─────────────────────────────────────────────────────────────
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Download from https://www.python.org/
    echo         Check "Add Python to PATH" during install.
    goto :end
)
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Download LTS from https://nodejs.org/
    goto :end
)
echo [OK] Tools found:
python --version
node --version
npm --version
echo.

REM ── Step 1: Python deps (use python -m pip, not bare pip) ────────────────────
echo [1/4] Installing Python dependencies...
cd /d "%BACKEND%"
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Python dependency install failed. See above.
    goto :end
)
echo [1/4] Done.
echo.

REM ── Step 2: Node deps ────────────────────────────────────────────────────────
echo [2/4] Installing Node dependencies...
echo       (First run downloads Electron ~80MB -- may take several minutes)
cd /d "%FRONTEND%"
npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed. See above.
    goto :end
)
REM Ensure Electron binary downloaded
echo Verifying Electron binary...
node node_modules\electron\install.js 2>nul
npx electron --version
echo [2/4] Done.
echo.

REM ── Step 3: Build React ──────────────────────────────────────────────────────
echo [3/4] Building frontend...
npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Vite build failed. See above.
    goto :end
)
echo [3/4] Done.
echo.

REM ── Step 4: Build installer ──────────────────────────────────────────────────
echo [4/4] Building Windows installer...
echo       (Downloads NSIS on first run -- another 30-60 seconds)
if not exist "%OUT%" mkdir "%OUT%"
npx electron-builder --win
if %errorlevel% neq 0 (
    echo [ERROR] electron-builder failed. See above.
    goto :end
)
echo [4/4] Done.
echo.

REM ── Copy .exe to installer\ ──────────────────────────────────────────────────
echo Copying installer...
for /r "%FRONTEND%\release" %%f in (*Setup*.exe) do (
    copy /y "%%f" "%OUT%\" >nul
    echo.
    echo  ============================================================
    echo    SUCCESS:  installer\%%~nxf
    echo    Run that .exe to install The Collective.
    echo  ============================================================
)

:end
echo.
echo  Script finished. You can close this window.
