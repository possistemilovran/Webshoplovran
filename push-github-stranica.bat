@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo === Push na GitHub: samo stranica (urednik-stranica) ===
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [GREŠKA] Git nije u PATH-u.
  pause
  exit /b 1
)

if not exist ".git" (
  echo [GREŠKA] Ovdje nema .git mape.
  pause
  exit /b 1
)

REM Urednik stranice zapisuje: prijevode u arhivu, slideshow, uploadane slike, sink medijske biblioteke.
git add "public/editor-archived-locale-overrides.json" "public/about-slideshow" "public/media-library.json" "public/uploads" 2>nul

git diff --staged --quiet
if %errorlevel% equ 0 (
  echo Nema promjena u tim datotekama za commit ^(ili su već sve commitane^).
  pause
  exit /b 0
)

git commit -m "Stranica: prijevodi/slideshow/uploadi"
if errorlevel 1 (
  echo [UPOZORENJE] Commit nije uspio.
  pause
  exit /b 1
)

git push -u origin main 2>nul
if errorlevel 1 git push origin main
if errorlevel 1 (
  echo [GREŠKA] Push nije uspio.
  pause
  exit /b 1
)

echo Gotovo — promjene stranice su na GitHubu.
pause
