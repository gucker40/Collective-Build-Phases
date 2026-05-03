@echo off
title The Collective - Build
cd /d "%~dp0"

echo.
echo  ============================================================
echo   THE COLLECTIVE - Build v2A.5
echo  ============================================================
echo.

node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 ( echo  ERROR: Node.js not found. Install from nodejs.org & pause & exit /b 1 )
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 ( echo  ERROR: Python not found. Install from python.org & pause & exit /b 1 )
for /f "tokens=*" %%v in ('node --version 2^>^&1')  do echo  Node: %%v
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo  Python: %%v
echo.

REM ── Step 1: Python venv ──────────────────────────────────────────────────────
echo [1/4] Setting up Python backend...
cd backend
if exist "venv" ( echo       Removing old venv... & rmdir /s /q venv )
python -m venv venv
if %ERRORLEVEL% NEQ 0 ( echo  ERROR: venv creation failed. & pause & exit /b 1 )
venv\Scripts\pip install -r requirements.txt --quiet --no-warn-script-location
if %ERRORLEVEL% NEQ 0 ( echo  ERROR: pip install failed. & pause & exit /b 1 )
echo       Backend ready.
cd ..

REM ── Step 2: Web frontend (MUST run before Step 3 so dist/ exists for bundling)
echo [2/4] Building web frontend...
cd frontend
if not exist "node_modules" ( call npm install --legacy-peer-deps --silent )
set VITE_MODE=web
call npm run build:vite
if %ERRORLEVEL% NEQ 0 ( echo  ERROR: Web build failed. & pause & exit /b 1 )
echo       Web frontend built to frontend/dist/
cd ..

REM ── Step 3: Electron app (bundles dist/ as resources/web-dist/ via extraResources)
echo [3/4] Building Electron app...
cd frontend
set VITE_MODE=electron
call npm run build:vite
if %ERRORLEVEL% NEQ 0 ( echo  ERROR: Electron build failed. & pause & exit /b 1 )
call npx electron-builder --win --config electron-builder.json
if %ERRORLEVEL% NEQ 0 ( echo  ERROR: electron-builder failed. & pause & exit /b 1 )
cd ..

echo.
echo  ============================================================
echo   BUILD COMPLETE
for %%f in ("dist-app\*.exe") do echo   Installer: %%~ff
echo.
echo   INSTALL STEPS:
echo   1. Run UNINSTALL.bat to wipe old installs
echo   2. Run the installer above
echo   3. Complete the Setup Wizard (keys pre-filled)
echo   4. Dev Console - Network - Start Tunnel
echo   5. Visit https://the-collective.vip
echo  ============================================================
echo.
pause
