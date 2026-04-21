@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo === Push na GitHub: artikli i kolekcije (urednik-artikli) ===
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

REM Katalog + override prijevoda artikala + slike + log CRUD-a; imageLocalMap ako ga ručno/skriptom osvježiš.
git add "src/data/storeCatalog.json" "public/editor-archived-overrides.json" "public/uploads" "public/media-library.json" "src/data/imageLocalMap.json" 2>nul
if exist "public\editor-artikli-log.txt" git add "public/editor-artikli-log.txt"
if exist "public\shopify-images" git add "public/shopify-images" 2>nul

git diff --staged --quiet
if %errorlevel% equ 0 (
  echo Nema promjena u tim datotekama za commit ^(ili su već sve commitane^).
  pause
  exit /b 0
)

git commit -m "Artikli: katalog, kolekcije, overridei, slike"
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

echo Gotovo — promjene artikala su na GitHubu.
pause
