@echo off
REM Keep window open even on error
if NOT "%KEEP_OPEN%"=="1" (
    set KEEP_OPEN=1
    cmd /k "%~f0"
    exit
)

title The Collective - Desktop Mode
echo.
echo  THE COLLECTIVE -- Desktop Mode
echo  ================================
echo.

set "ROOT=%~dp0"
set "BACKEND=%ROOT%the-collective\backend"
set "FRONTEND=%ROOT%the-collective\frontend"

if not exist "%BACKEND%\requirements.txt" (
    echo [ERROR] Cannot find backend. Extract the full ZIP first.
    goto :end
)

REM Install Python deps using the correct python -m pip
echo [1/3] Installing Python dependencies...
cd /d "%BACKEND%"
python -m pip install -r requirements.txt -q
if %errorlevel% neq 0 (
    echo [ERROR] pip install failed.
    goto :end
)
echo [1/3] Done.

REM Install Node deps
echo [2/3] Checking Node dependencies...
cd /d "%FRONTEND%"
npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    goto :end
)

REM Verify Electron binary is present, download if missing
if not exist "node_modules\electron\dist\electron.exe" (
    echo Electron binary missing -- downloading now...
    node node_modules\electron\install.js
    if %errorlevel% neq 0 (
        echo [ERROR] Electron binary download failed.
        echo         Check your internet connection and try again.
        goto :end
    )
)
echo [2/3] Done.

REM Start backend in a new persistent window
echo [3/3] Starting backend on port 8000...
start "Collective Backend" cmd /k "cd /d "%BACKEND%" && python main.py"
timeout /t 3 /nobreak >nul

REM Launch Electron + Vite
echo Launching desktop app...
npm run electron:dev

:end
echo.
echo  Script finished. You can close this window.
