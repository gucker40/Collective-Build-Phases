@echo off
echo.
echo  ████████╗██╗  ██╗███████╗     ██████╗ ██████╗ ██╗     ██╗     ███████╗ ██████╗████████╗██╗██╗   ██╗███████╗
echo  ╚══██╔══╝██║  ██║██╔════╝    ██╔════╝██╔═══██╗██║     ██║     ██╔════╝██╔════╝╚══██╔══╝██║██║   ██║██╔════╝
echo     ██║   ███████║█████╗      ██║     ██║   ██║██║     ██║     █████╗  ██║        ██║   ██║██║   ██║█████╗
echo     ██║   ██╔══██║██╔══╝      ██║     ██║   ██║██║     ██║     ██╔══╝  ██║        ██║   ██║╚██╗ ██╔╝██╔══╝
echo     ██║   ██║  ██║███████╗    ╚██████╗╚██████╔╝███████╗███████╗███████╗╚██████╗   ██║   ██║ ╚████╔╝ ███████╗
echo     ╚═╝   ╚═╝  ╚═╝╚══════╝     ╚═════╝ ╚═════╝ ╚══════╝╚══════╝╚══════╝ ╚═════╝   ╚═╝   ╚═╝  ╚═══╝  ╚══════╝
echo.
echo  Phase 4 - Web Dev Mode Launcher
echo  ════════════════════════════════════════════════════════════
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

REM Install backend deps if needed
echo  [1/4] Checking Python dependencies...
cd /d "%ROOT%\backend"
pip install -r requirements.txt -q --disable-pip-version-check
if %errorlevel% neq 0 (
    echo  [ERROR] pip install failed. Check requirements.txt
    pause
    exit /b 1
)
echo  [1/4] OK

REM Install frontend deps if needed
echo  [2/4] Checking Node dependencies...
cd /d "%ROOT%\frontend"
if not exist node_modules (
    echo  [2/4] Running npm install...
    npm install --silent
    if %errorlevel% neq 0 (
        echo  [ERROR] npm install failed.
        pause
        exit /b 1
    )
)
echo  [2/4] OK

REM Start backend in new window
echo  [3/4] Starting backend on port 8000...
start "The Collective - Backend" cmd /k "cd /d "%ROOT%\backend" && python main.py"

REM Wait a moment for backend to initialize
timeout /t 3 /nobreak >nul

REM Start frontend dev server and open browser
echo  [4/4] Starting frontend on port 5173...
echo.
echo  ════════════════════════════════════════════════════════════
echo   Opening http://localhost:5173 in your browser...
echo   Backend logs are in the other terminal window.
echo   Close both windows to stop the app.
echo  ════════════════════════════════════════════════════════════
echo.
start "" "http://localhost:5173"
cd /d "%ROOT%\frontend"
npm run dev
