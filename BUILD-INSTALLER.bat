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

REM ── Verify source folders exist ──────────────────────────────────────────────

if not exist "%BACKEND%" (
    echo  [ERROR]  Backend folder not found: %BACKEND%
    echo           Make sure you extracted the full ZIP before running this.
    goto :fail
)
if not exist "%FRONTEND%" (
    echo  [ERROR]  Frontend folder not found: %FRONTEND%
    echo           Make sure you extracted the full ZIP before running this.
    goto :fail
)

REM ── Find Python ──────────────────────────────────────────────────────────────

set "PYTHON="
for %%p in (python python3 py) do (
    if not defined PYTHON (
        where %%p >nul 2>&1
        if !errorlevel! equ 0 set "PYTHON=%%p"
    )
)
if not defined PYTHON (
    echo  [MISSING]  Python 3.10+
    echo             Download: https://www.python.org/downloads/
    echo             Check "Add Python to PATH" during install, then reopen this window.
    goto :fail
)
for /f "tokens=2 delims= " %%v in ('!PYTHON! --version 2^>^&1') do (
    echo  [OK]  Python %%v
)

REM ── Find Node.js ─────────────────────────────────────────────────────────────

REM Try PATH first, then common Windows install locations
where node >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%ProgramFiles%\nodejs\node.exe"           set "PATH=%ProgramFiles%\nodejs;%PATH%"
    if exist "%ProgramFiles(x86)%\nodejs\node.exe"      set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
    if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe"  set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
    if exist "%APPDATA%\nvm\current\node.exe"            set "PATH=%APPDATA%\nvm\current;%PATH%"
    if exist "%APPDATA%\fnm\node.exe"                   set "PATH=%APPDATA%\fnm;%PATH%"
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [MISSING]  Node.js 18+
    echo             Download the LTS version: https://nodejs.org/
    echo             After installing, close and reopen this window.
    goto :fail
)
for /f %%v in ('node --version 2^>^&1') do echo  [OK]  Node.js %%v

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [MISSING]  npm  (should come with Node.js -- try reinstalling Node)
    goto :fail
)

echo.
echo  [OK]  All prerequisites found.
echo  [OK]  Backend:  %BACKEND%
echo  [OK]  Frontend: %FRONTEND%
echo.

REM ── Step 1: Python deps ──────────────────────────────────────────────────────

echo  [1/4]  Installing Python dependencies...
cd /d "%BACKEND%"
!PYTHON! -m pip install -r requirements.txt --disable-pip-version-check
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR]  pip install failed -- see output above.
    goto :fail
)
echo  [1/4]  Done.
echo.

REM ── Step 2: Node deps ────────────────────────────────────────────────────────

echo  [2/4]  Installing Node dependencies...
echo         NOTE: First run downloads Electron (~80MB). This can take several minutes.
echo         Do not close this window.
echo.
cd /d "%FRONTEND%"
npm install
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR]  npm install failed -- see output above.
    echo.
    echo  Common fixes:
    echo    - Check your internet connection
    echo    - If Electron download timed out, run this script again (it will resume)
    echo    - Try: npm install --prefer-offline
    goto :fail
)
echo  [2/4]  Done.
echo.

REM ── Step 3: Vite build ───────────────────────────────────────────────────────

echo  [3/4]  Building frontend...
npm run build
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR]  Vite build failed -- see output above.
    goto :fail
)
echo  [3/4]  Done.
echo.

REM ── Step 4: electron-builder ─────────────────────────────────────────────────

echo  [4/4]  Building Windows installer...
echo         (30-90 seconds, downloads NSIS on first run)
echo.
if not exist "%OUT%" mkdir "%OUT%"

npx electron-builder --win
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR]  electron-builder failed -- see output above.
    echo.
    echo  Common fixes:
    echo    - Antivirus may be blocking -- try temporarily disabling it
    echo    - Check available disk space
    goto :fail
)
echo  [4/4]  Done.
echo.

REM ── Find and report the .exe ─────────────────────────────────────────────────

set "EXE="
for /r "%OUT%" %%f in (*.exe) do if not defined EXE set "EXE=%%f"
if not defined EXE (
    for /r "%FRONTEND%\release" %%f in (*.exe) do (
        if not defined EXE (
            set "EXE=%%f"
            copy /y "%%f" "%OUT%\" >nul 2>&1
        )
    )
)

echo.
echo  ============================================================
if defined EXE (
    for %%f in ("!EXE!") do echo    SUCCESS:  installer\%%~nxf
    echo.
    echo    Run that .exe to install The Collective.
) else (
    echo    Build finished but .exe not found.
    echo    Check:  %OUT%\
    echo    and:    %FRONTEND%\release\
)
echo  ============================================================
echo.
pause
exit /b 0

:fail
echo.
echo  ============================================================
echo    Build did not complete. See the error above.
echo  ============================================================
echo.
pause
exit /b 1
