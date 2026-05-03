@echo on
title The Collective - Web Mode

set ROOT=%~dp0
set FRONTEND=%ROOT%the-collective\frontend
set BACKEND=%ROOT%the-collective\backend

REM Install Python deps
cd /d "%BACKEND%"
pip install -r requirements.txt -q

REM Install Node deps if needed
cd /d "%FRONTEND%"
if not exist node_modules npm install

REM Start backend in separate window
start "Collective Backend" cmd /k "cd /d "%BACKEND%" && python main.py"

REM Give backend time to start
@echo off
timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"

REM Start Vite dev server (this window stays open)
@echo on
cd /d "%FRONTEND%"
npm run dev

@echo off
pause
