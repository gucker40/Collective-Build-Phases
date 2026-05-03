@echo off
setlocal enabledelayedexpansion
title The Collective - Build Installer

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║        THE COLLECTIVE  —  Phase 4  Build Tool           ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

set "ROOT=%~dp0"
set "APP=%ROOT%the-collective"
set "FRONTEND=%APP%\frontend"
set "BACKEND=%APP%\backend"
set "OUT=%ROOT%installer"

REM ── Prerequisite checks ─────────────────────────────────────

echo  Checking prerequisites...
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo  [MISSING]  Python 3.10+  ^|  https://www.python.org/downloads/
    echo             Install Python, make sure "Add to PATH" is checked.
    echo.
    pause & exit /b 1
)
for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo  [OK]  Python %PYVER%

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [MISSING]  Node.js 18+  ^|  https://nodejs.org/
    echo             Install Node.js LTS and reopen this window.
    echo.
    pause & exit /b 1
)
for /f "tokens=1" %%v in ('node --version 2^>^&1') do set NODEVER=%%v
echo  [OK]  Node.js %NODEVER%

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [MISSING]  npm not found. Reinstall Node.js.
    pause & exit /b 1
)

echo.

REM ── Python dependencies ─────────────────────────────────────

echo  [1/4]  Installing Python dependencies...
cd /d "%BACKEND%"
pip install -r requirements.txt -q --disable-pip-version-check
if %errorlevel% neq 0 (
    echo  [ERROR]  pip install failed. Check your Python environment.
    pause & exit /b 1
)
echo  [1/4]  Done.

REM ── Node dependencies ────────────────────────────────────────

echo  [2/4]  Installing Node dependencies...
cd /d "%FRONTEND%"
npm install --silent
if %errorlevel% neq 0 (
    echo  [ERROR]  npm install failed.
    pause & exit /b 1
)
echo  [2/4]  Done.

REM ── Build React frontend ─────────────────────────────────────

echo  [3/4]  Building frontend...
npm run build
if %errorlevel% neq 0 (
    echo  [ERROR]  Vite build failed. Check the output above.
    pause & exit /b 1
)
echo  [3/4]  Done.

REM ── Electron builder ─────────────────────────────────────────

echo  [4/4]  Building Windows installer (this takes ~60 seconds)...
npx electron-builder --win --config ../../../electron-builder.json 2>nul
if %errorlevel% neq 0 (
    REM Fallback: use local electron-builder.json
    npx electron-builder --win
    if %errorlevel% neq 0 (
        echo  [ERROR]  electron-builder failed. See output above.
        pause & exit /b 1
    )
)
echo  [4/4]  Done.

REM ── Copy installer to root ────────────────────────────────────

echo.
echo  Locating installer...

if not exist "%OUT%" mkdir "%OUT%"

REM Search for the .exe in the release folder
set "FOUND="
for /r "%FRONTEND%\release" %%f in (*.exe) do (
    if not defined FOUND (
        set "FOUND=%%f"
    )
)

if not defined FOUND (
    echo  [WARN]  Could not find .exe in %FRONTEND%\release
    echo          Check %FRONTEND%\release\ manually.
) else (
    copy /y "!FOUND!" "%OUT%\" >nul
    for %%f in ("!FOUND!") do set "EXENAME=%%~nxf"
    echo.
    echo  ╔══════════════════════════════════════════════════════════╗
    echo  ║                  BUILD SUCCESSFUL                       ║
    echo  ╠══════════════════════════════════════════════════════════╣
    echo  ║                                                          ║
    echo  ║   installer\!EXENAME!
    echo  ║                                                          ║
    echo  ║   Run that file to install The Collective.              ║
    echo  ╚══════════════════════════════════════════════════════════╝
)

echo.
pause
