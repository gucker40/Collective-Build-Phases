@echo off
setlocal
title The Collective - Desktop Mode

echo.
echo  THE COLLECTIVE  --  Desktop Mode  (Electron)
echo  ===============================================
echo.

set "ROOT=%~dp0"
set "BACKEND=%ROOT%the-collective\backend"
set "FRONTEND=%ROOT%the-collective\frontend"

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR]  Python not found. Download from python.org
    echo  Press any key to exit...
    pause >nul
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR]  Node.js not found. Download from nodejs.org
    echo  Press any key to exit...
    pause >nul
    exit /b 1
)

echo  Installing Python dependencies (first run only)...
cd /d "%BACKEND%"
pip install -r requirements.txt -q --disable-pip-version-check
if %errorlevel% neq 0 (
    echo  [ERROR]  pip install failed.
    echo  Press any key to exit...
    pause >nul
    exit /b 1
)

echo  Checking Node dependencies...
cd /d "%FRONTEND%"
if not exist node_modules (
    echo  Running npm install (downloads Electron ~80MB on first run)...
    npm install
    if %errorlevel% neq 0 (
        echo  [ERROR]  npm install failed. See error above.
        echo  Press any key to exit...
        pause >nul
        exit /b 1
    )
)

echo.
echo  Starting backend on port 8000...
start "Collective Backend" cmd /k "cd /d "%BACKEND%" && python main.py"

timeout /t 3 /nobreak >nul

echo  Launching desktop app...
echo  (Close the app window and backend window to stop)
echo.
npm run electron:dev
