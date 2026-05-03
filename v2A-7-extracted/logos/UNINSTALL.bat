@echo off
title Logos - Full Uninstaller
color 0C
cd /d "%~dp0"

echo.
echo  ============================================================
echo   THE COLLECTIVE - FULL UNINSTALLER
echo   Removes Logos AND the old "The Collective" install
echo  ============================================================
echo.
echo  This deletes:
echo    - The Collective app (new install)
echo    - The Collective app (old install)  
echo    - ALL user data for both
echo    - cloudflared Windows service
echo    - All shortcuts and registry entries
echo.
set /p CONFIRM="  Type YES to continue: "
if /i NOT "%CONFIRM%"=="YES" (
  echo   Cancelled.
  pause & exit /b 0
)

echo.
echo  Stopping all processes...

taskkill /F /IM "Logos.exe"             >nul 2>&1
taskkill /F /IM "logos-app.exe"         >nul 2>&1
taskkill /F /IM "The Collective.exe"    >nul 2>&1
taskkill /F /IM "the-collective.exe"    >nul 2>&1
taskkill /F /IM cloudflared.exe         >nul 2>&1
taskkill /F /IM python.exe              >nul 2>&1
taskkill /F /IM pythonw.exe             >nul 2>&1

for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000 "') do (
  taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo  Removing cloudflared service...
sc stop cloudflared   >nul 2>&1
sc delete cloudflared >nul 2>&1

echo  Uninstalling Logos...
set "UNI_LOGOS=%LOCALAPPDATA%\Programs\The Collective\Uninstall Logos.exe"
if exist "%UNI_LOGOS%" start /wait "" "%UNI_LOGOS%" /S
if exist "%LOCALAPPDATA%\Programs\Logos" rmdir /s /q "%LOCALAPPDATA%\Programs\Logos" >nul 2>&1

echo  Uninstalling The Collective (old)...
set "UNI_TC=%LOCALAPPDATA%\Programs\The Collective\Uninstall The Collective.exe"
if exist "%UNI_TC%" start /wait "" "%UNI_TC%" /S
if exist "%LOCALAPPDATA%\Programs\The Collective" rmdir /s /q "%LOCALAPPDATA%\Programs\The Collective" >nul 2>&1

echo  Wiping Logos data...
if exist "%APPDATA%\logos-app" rmdir /s /q "%APPDATA%\logos-app" >nul 2>&1

echo  Wiping The Collective data (old)...
if exist "%APPDATA%\the-collective" rmdir /s /q "%APPDATA%\the-collective" >nul 2>&1

echo  Removing shortcuts...
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Logos" rmdir /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Logos" >nul 2>&1
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Logos.lnk" del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Logos.lnk" >nul 2>&1
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\The Collective" rmdir /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\The Collective" >nul 2>&1
if exist "%USERPROFILE%\Desktop\Logos.lnk" del /f /q "%USERPROFILE%\Desktop\Logos.lnk" >nul 2>&1
if exist "%USERPROFILE%\Desktop\The Collective.lnk" del /f /q "%USERPROFILE%\Desktop\The Collective.lnk" >nul 2>&1

echo  Cleaning registry...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\logos-app" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\the-collective" /f >nul 2>&1
reg delete "HKCU\Software\logos-app" /f >nul 2>&1
reg delete "HKCU\Software\the-collective" /f >nul 2>&1
reg delete "HKCU\Software\Electron" /f >nul 2>&1

echo.
echo  ============================================================
echo   COMPLETE. Both Logos and The Collective are fully removed.
echo   User data, shortcuts, services, and registry all cleared.
echo   Run build.bat for a fresh install.
echo  ============================================================
echo.
pause
