@echo off
setlocal EnableExtensions
chcp 65001 >nul

rem ========================================
rem  Olivo — Vite + urednik (/editor)  v2
rem  - Oslobodi 5173 (i uobicajeni „skok“ Vitea)
rem  - Uvijek isti port: 5173 + strictPort
rem  - Pokretanje: node ...\vite.js (bez npm argumenata)
rem  - Preglednik: OLIVO_OPEN_EDITOR=1 + vite.config server.open
rem ========================================

cd /d "%~dp0"

title Olivo — urednik v2

echo.
echo ========================================
echo   Olivo — pokretanje urednika  (v2)
echo ========================================
echo.

if not exist "package.json" (
  echo [GREŠKA] Nema package.json u: %CD%
  echo.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [GREŠKA] node nije u PATH-u. Instaliraj Node.js LTS.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo [INFO] Nema node_modules — pokrecem npm install...
  where npm >nul 2>&1
  if errorlevel 1 (
    echo [GREŠKA] npm nije u PATH-u.
    pause
    exit /b 1
  )
  call npm install
  if errorlevel 1 (
    echo [GREŠKA] npm install nije uspio.
    pause
    exit /b 1
  )
)

if not exist "node_modules\vite\bin\vite.js" (
  echo [GREŠKA] I dalje nema Vite-a. Provjeri npm install.
  pause
  exit /b 1
)

set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
echo [1/3] Gasim procese koji SLUSAJU na portovima 5173–5195...
if exist "%PS%" (
  "%PS%" -NoProfile -ExecutionPolicy Bypass -Command ^
    "foreach ($p in 5173..5195) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }" 2>nul
) else (
  echo       (PowerShell nije na ocekivanom putu — preskacem.)
)

echo [2/3] Pauza 1 s da OS otpusti portove...
timeout /t 1 /nobreak >nul

echo [3/3] Vite na http://127.0.0.1:5173  — otvara se /editor
echo       Zaustavi server: Ctrl+C
echo       Ako se preglednik ne otvori: http://127.0.0.1:5173/editor
echo.

set "OLIVO_OPEN_EDITOR=1"
call node "%~dp0node_modules\vite\bin\vite.js" --port 5173 --strictPort
set "OLIVO_OPEN_EDITOR="

echo.
pause
endlocal
