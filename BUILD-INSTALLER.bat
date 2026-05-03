@echo on
title The Collective - Build Installer

REM ── Setup paths ──────────────────────────────────────────────────────────────
set ROOT=%~dp0
set FRONTEND=%ROOT%the-collective\frontend
set BACKEND=%ROOT%the-collective\backend
set OUT=%ROOT%installer

REM ── Step 1: Python deps ──────────────────────────────────────────────────────
cd /d "%BACKEND%"
pip install -r requirements.txt

REM ── Step 2: Node deps ────────────────────────────────────────────────────────
cd /d "%FRONTEND%"
npm install

REM ── Step 3: Build React ──────────────────────────────────────────────────────
npm run build

REM ── Step 4: Build installer ──────────────────────────────────────────────────
if not exist "%OUT%" mkdir "%OUT%"
npx electron-builder --win

REM ── Copy .exe to installer\ ──────────────────────────────────────────────────
@echo off
echo.
echo  Copying installer to %OUT% ...
for /r "%FRONTEND%\release" %%f in (*.exe) do (
    echo  Found: %%f
    copy /y "%%f" "%OUT%\"
)
for /r "%OUT%" %%f in (*.exe) do echo  Ready: %%f

echo.
echo  ============================================================
echo    Done. Run the .exe inside the installer\ folder.
echo  ============================================================
echo.
pause
