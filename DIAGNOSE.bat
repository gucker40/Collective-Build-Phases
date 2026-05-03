@echo off
echo ============================================================
echo  THE COLLECTIVE -- DIAGNOSTICS
echo ============================================================
echo.

echo -- Working directory --
cd
echo.

echo -- Folder structure --
if exist "the-collective\backend"  (echo [FOUND] the-collective\backend) else (echo [MISSING] the-collective\backend)
if exist "the-collective\frontend" (echo [FOUND] the-collective\frontend) else (echo [MISSING] the-collective\frontend)
if exist "the-collective\frontend\package.json" (echo [FOUND] the-collective\frontend\package.json) else (echo [MISSING] the-collective\frontend\package.json)
if exist "the-collective\frontend\node_modules" (echo [FOUND] the-collective\frontend\node_modules) else (echo [MISSING] the-collective\frontend\node_modules -- npm install needed)
if exist "the-collective\backend\requirements.txt" (echo [FOUND] the-collective\backend\requirements.txt) else (echo [MISSING] the-collective\backend\requirements.txt)
echo.

echo -- Python --
where python 2>&1
python --version 2>&1
echo.

echo -- pip --
where pip 2>&1
pip --version 2>&1
echo.

echo -- Node.js --
where node 2>&1
node --version 2>&1
echo.

echo -- npm --
where npm 2>&1
npm --version 2>&1
echo.

echo -- npx --
where npx 2>&1
npx --version 2>&1
echo.

echo -- package.json scripts --
if exist "the-collective\frontend\package.json" (
    type "the-collective\frontend\package.json"
)
echo.

echo ============================================================
echo  Copy everything above and share it if you need help.
echo ============================================================
echo.
pause
