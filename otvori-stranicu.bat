@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo.
echo === Olivo — lokalna stranica (Vite) ===
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [GREŠKA] npm nije pronađen. Instaliraj Node.js s https://nodejs.org
  echo           Zatvori i ponovo otvori CMD nakon instalacije.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Instaliram ovisnosti ^(npm install^)...
  call npm install
  if errorlevel 1 (
    echo [GREŠKA] npm install nije uspio.
    pause
    exit /b 1
  )
)

echo Brišem samo Vite predmemoriju ^(ne diram dist/^)...
if exist "node_modules\.vite\" rmdir /s /q "node_modules\.vite" 2>nul
if exist ".vite\" rmdir /s /q ".vite" 2>nul

echo.
echo Pokrećem server. Preglednik se otvara kad Vite bude spreman ^(--open^).
echo Ostavi ovaj prozor otvoren. Zaustavi: Ctrl+C
echo URL: http://localhost:5173 ^(ili drugi port ako je 5173 zauzet^)
echo.

call npm run dev -- --open

echo.
pause
