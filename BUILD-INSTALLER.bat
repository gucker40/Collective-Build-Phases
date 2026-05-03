@echo off
setlocal enabledelayedexpansion
title The Collective - Build Installer

echo.
echo  ============================================================
echo    THE COLLECTIVE  Phase 4  --  Build Installer
echo  ============================================================
echo.

set "ROOT=%~dp0"
set "APP=%ROOT%the-collective"
set "FRONTEND=%APP%\frontend"
set "BACKEND=%APP%\backend"
set "OUT=%ROOT%installer"

REM ── Prerequisite checks ──────────────────────────────────────────────────────

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [MISSING]  Python 3.10+
    echo             Download: https://www.python.org/downloads/
    echo             Make sure to check "Add Python to PATH" during install.
    echo.
    echo  Press any key to exit...
    pause >nul
    exit /b 1
)
for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo  [OK]  Python %PYVER%

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [MISSING]  Node.js 18+
    echo             Download: https://nodejs.org/  (choose LTS version)
    echo             Restart this window after installing.
    echo.
    echo  Press any key to exit...
    pause >nul
    exit /b 1
)
for /f "tokens=1" %%v in ('node --version 2^>^&1') do set NODEVER=%%v
echo  [OK]  Node.js %NODEVER%

echo  [OK]  Paths verified:
echo         Backend:  %BACKEND%
echo         Frontend: %FRONTEND%
echo.

REM ── Step 1: Python deps ──────────────────────────────────────────────────────

echo  [1/4]  Installing Python dependencies...
echo         (This may take a minute on first run)
echo.
cd /d "%BACKEND%"
if %errorlevel% neq 0 (
    echo  [ERROR]  Could not navigate to backend folder: %BACKEND%
    echo  Press any key to exit...
    pause >nul
    exit /b 1
)

pip install -r requirements.txt --disable-pip-version-check
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR]  pip install failed. See error above.
    echo           Common fix: run as Administrator, or check your internet connection.
    echo.
    echo  Press any key to exit...
    pause >nul
    exit /b 1
)
echo.
echo  [1/4]  Python dependencies OK.
echo.

REM ── Step 2: Node deps ────────────────────────────────────────────────────────

echo  [2/4]  Installing Node dependencies...
echo         (First run downloads Electron ~80MB -- this takes a few minutes)
echo.
cd /d "%FRONTEND%"
if %errorlevel% neq 0 (
    echo  [ERROR]  Could not navigate to frontend folder: %FRONTEND%
    echo  Press any key to exit...
    pause >nul
    exit /b 1
)

npm install
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR]  npm install failed. See error above.
    echo.
    echo  Common causes:
    echo    - No internet connection
    echo    - Electron binary download timed out (try again)
    echo    - npm registry temporarily unavailable (try again)
    echo.
    echo  Press any key to exit...
    pause >nul
    exit /b 1
)
echo.
echo  [2/4]  Node dependencies OK.
echo.

REM ── Step 3: Build React frontend ─────────────────────────────────────────────

echo  [3/4]  Building frontend (Vite)...
echo.
npm run build
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR]  Vite build failed. See error above.
    echo.
    echo  Press any key to exit...
    pause >nul
    exit /b 1
)
echo.
echo  [3/4]  Frontend build OK.
echo.

REM ── Step 4: Electron builder ─────────────────────────────────────────────────

echo  [4/4]  Building Windows installer (electron-builder)...
echo         (This takes 30-90 seconds)
echo.

if not exist "%OUT%" mkdir "%OUT%"

npx electron-builder --win
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR]  electron-builder failed. See error above.
    echo.
    echo  Common causes:
    echo    - NSIS not bundled yet (electron-builder downloads it automatically)
    echo    - Antivirus blocking the build -- try disabling temporarily
    echo    - Disk space low
    echo.
    echo  Press any key to exit...
    pause >nul
    exit /b 1
)
echo.
echo  [4/4]  Installer build OK.
echo.

REM ── Locate and copy the .exe ─────────────────────────────────────────────────

set "FOUND="

REM Check the configured output dir first
for /r "%OUT%" %%f in (*.exe) do (
    if not defined FOUND set "FOUND=%%f"
)

REM Fallback: check frontend/release if output dir was overridden
if not defined FOUND (
    for /r "%FRONTEND%\release" %%f in (*.exe) do (
        if not defined FOUND (
            set "FOUND=%%f"
            copy /y "%%f" "%OUT%\" >nul 2>&1
        )
    )
)

echo.
echo  ============================================================
if defined FOUND (
    for %%f in ("!FOUND!") do set "EXENAME=%%~nxf"
    echo    BUILD SUCCESSFUL
    echo.
    echo    Installer: installer\!EXENAME!
    echo.
    echo    Run that file to install The Collective on this machine.
) else (
    echo    Build completed but installer .exe was not found.
    echo    Check the frontend\release\ folder manually.
)
echo  ============================================================
echo.
echo  Press any key to exit...
pause >nul
