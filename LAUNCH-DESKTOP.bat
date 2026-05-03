@echo on
title The Collective - Desktop Mode

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

REM Launch Electron + Vite dev mode
@echo on
cd /d "%FRONTEND%"
npm run electron:dev

@echo off
pause
