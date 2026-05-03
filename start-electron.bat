@echo off
echo.
echo  THE COLLECTIVE - Electron Desktop Launcher
echo  ════════════════════════════════════════════
echo.

REM Check Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Python not found. Install Python 3.10+ from python.org
    pause
    exit /b 1
)

REM Check Node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found. Install Node 18+ from nodejs.org
    pause
    exit /b 1
)

set ROOT=%~dp0the-collective

REM Install backend deps
echo  [1/4] Checking Python dependencies...
cd /d "%ROOT%\backend"
pip install -r requirements.txt -q --disable-pip-version-check
echo  [1/4] OK

REM Install frontend deps
echo  [2/4] Checking Node dependencies...
cd /d "%ROOT%\frontend"
if not exist node_modules (
    echo  Running npm install - first time setup...
    npm install
)
echo  [2/4] OK

REM Start backend in new window
echo  [3/4] Starting backend...
start "The Collective - Backend" cmd /k "cd /d "%ROOT%\backend" && python main.py"

timeout /t 3 /nobreak >nul

REM Launch Electron dev mode (starts Vite + Electron together)
echo  [4/4] Launching Electron app...
echo.
cd /d "%ROOT%\frontend"
npm run electron:dev
