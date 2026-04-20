@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo [GREŠKA] npm nije pronađen. Instaliraj Node.js s https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo.
  echo Instaliram ovisnosti ^(npm install^)...
  call npm install
  if errorlevel 1 (
    echo [GREŠKA] npm install nije uspio.
    pause
    exit /b 1
  )
)

if not exist "node_modules\vite\bin\vite.js" (
  echo [GREŠKA] Nema Vite-a. Pokreni: npm install
  pause
  exit /b 1
)

echo Zatvaram stare Vite procese na portovima 5173–5190 ako su ostali...
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach ($p in 5173..5190) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }" 2>nul

echo.
echo Pokrecem Vite ^(Olivo^). Ostavi ovaj prozor otvoren.
echo Za 4 sekunde otvara se: http://127.0.0.1:5173/editor
echo ^(Vite obicno slusa na 5173 nakon sto su portovi oslobodeni.^)
echo.

start "" cmd /c "timeout /t 4 /nobreak >nul && start http://127.0.0.1:5173/editor"

call npm run dev

echo.
pause
