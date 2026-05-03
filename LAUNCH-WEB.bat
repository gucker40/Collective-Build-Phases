@echo off
setlocal enabledelayedexpansion
title The Collective - Web Mode

echo.
echo  THE COLLECTIVE  —  Web Mode  (no install required)
echo  ════════════════════════════════════════════════════
echo.

set "ROOT=%~dp0"
set "BACKEND=%ROOT%the-collective\backend"
set "FRONTEND=%ROOT%the-collective\frontend"

REM Prerequisite checks
where python >nul 2>&1 || (echo  [ERROR] Python not found. Get it at python.org & pause & exit /b 1)
where node   >nul 2>&1 || (echo  [ERROR] Node.js not found. Get it at nodejs.org  & pause & exit /b 1)

REM Install Python deps
echo  Installing Python dependencies (first run only)...
cd /d "%BACKEND%"
pip install -r requirements.txt -q --disable-pip-version-check

REM Install Node deps
echo  Checking Node dependencies (first run only)...
cd /d "%FRONTEND%"
if not exist node_modules (
    echo  Running npm install...
    npm install --silent
)

REM Start backend in a separate window
echo  Starting backend on port 8000...
start "Collective Backend" cmd /k "cd /d "%BACKEND%" && python main.py"

REM Give backend 3 seconds to initialize
timeout /t 3 /nobreak >nul

REM Start Vite dev server and open browser
echo  Starting frontend on port 5173...
echo.
echo  ════════════════════════════════════════════════════
echo   App will open at:  http://localhost:5173
echo   Close this window and the backend window to stop.
echo  ════════════════════════════════════════════════════
echo.
start "" "http://localhost:5173"
npm run dev
