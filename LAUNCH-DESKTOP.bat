@echo off
setlocal enabledelayedexpansion
title The Collective - Desktop Mode

echo.
echo  THE COLLECTIVE  --  Desktop Mode  (Electron)
echo  ===============================================
echo.

set "ROOT=%~dp0"
set "BACKEND=%ROOT%the-collective\backend"
set "FRONTEND=%ROOT%the-collective\frontend"

REM ── Verify folders exist ─────────────────────────────────────────────────────

if not exist "%BACKEND%" (
    echo  [ERROR]  Cannot find: %BACKEND%
    echo           Extract the full ZIP before running this file.
    goto :fail
)
if not exist "%FRONTEND%" (
    echo  [ERROR]  Cannot find: %FRONTEND%
    echo           Extract the full ZIP before running this file.
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
    echo  [MISSING]  Python 3.10+  --  https://www.python.org/downloads/
    echo             Check "Add Python to PATH" during install.
    goto :fail
)

REM ── Find Node.js ─────────────────────────────────────────────────────────────

where node >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%ProgramFiles%\nodejs\node.exe"           set "PATH=%ProgramFiles%\nodejs;%PATH%"
    if exist "%ProgramFiles(x86)%\nodejs\node.exe"      set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
    if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe"  set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
    if exist "%APPDATA%\nvm\current\node.exe"            set "PATH=%APPDATA%\nvm\current;%PATH%"
)
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [MISSING]  Node.js 18+  --  https://nodejs.org/  (LTS version)
    goto :fail
)

REM ── Install dependencies ─────────────────────────────────────────────────────

echo  Installing Python dependencies...
cd /d "%BACKEND%"
!PYTHON! -m pip install -r requirements.txt -q --disable-pip-version-check
if %errorlevel% neq 0 (
    echo  [ERROR]  pip install failed. Check your internet connection.
    goto :fail
)

echo  Checking Node dependencies...
cd /d "%FRONTEND%"
if not exist node_modules (
    echo  Running npm install  (first run downloads ~80MB, may take a few minutes)...
    npm install
    if %errorlevel% neq 0 (
        echo  [ERROR]  npm install failed. Check your internet connection.
        goto :fail
    )
)

REM ── Launch ───────────────────────────────────────────────────────────────────

echo.
echo  Starting backend on port 8000...
start "Collective Backend" cmd /k "cd /d "%BACKEND%" && !PYTHON! main.py"
timeout /t 3 /nobreak >nul

echo  Launching desktop app...
echo  (Close this window and the backend window to stop)
echo.
npm run electron:dev
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR]  Electron failed to start. See output above.
    goto :fail
)
goto :end

:fail
echo.
pause
exit /b 1

:end
pause
