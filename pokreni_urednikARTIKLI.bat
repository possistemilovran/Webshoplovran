@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo.
echo === Olivo — Urednik-ARTIKLI (/editor) ===
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [GREŠKA] npm nije pronađen. Instaliraj Node.js s https://nodejs.org
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

if not exist "node_modules\vite\bin\vite.js" (
  echo [GREŠKA] Nema Vite-a. Pokreni: npm install
  pause
  exit /b 1
)

echo.
echo === Oslobadanje portova za Vite (5173–5195) ===
echo Gasim procese koji SLUSAJU na tim portovima — ne diram ostale usluge.
echo.

where powershell >nul 2>nul
if errorlevel 1 goto :PORT_FALLBACK

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "foreach ($p in 5173..5195) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"
goto :PORT_DONE

:PORT_FALLBACK
echo PowerShell nije u PATH — koristim netstat + taskkill ^(manje pouzdano^).
for %%P in (5173 5174 5175 5176 5177 5178 5179 5180 5181 5182 5183 5184 5185 5186 5187 5188 5189 5190 5191 5192 5193 5194 5195) do (
  for /f "tokens=5" %%A in ('netstat -ano 2^>nul ^| findstr ":%%P " ^| findstr LISTENING') do (
    taskkill /F /PID %%A >nul 2>&1
  )
)

:PORT_DONE
timeout /t 1 /nobreak >nul

echo.
echo Pokrecem Vite. Preglednik otvara Urednik-ARTIKLI na /editor.
echo Ostavi ovaj prozor otvoren. Zaustavi: Ctrl+C
echo.

set "OLIVO_OPEN_EDITOR=1"
call npm run dev
set "OLIVO_OPEN_EDITOR="

echo.
pause
