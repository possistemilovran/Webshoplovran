@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

cd /d "%~dp0"

echo === Push na GitHub ===
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [GREŠKA] Git nije u PATH-u. Instaliraj Git za Windows.
  pause
  exit /b 1
)

if not exist ".git" (
  echo [GREŠKA] Ovdje nema .git mape. Pokreni:
  echo   git init
  echo   git remote add origin https://github.com/possistemilovran/Webshoplovran.git
  pause
  exit /b 1
)

git add -A
git diff --staged --quiet
if errorlevel 1 (
  echo Nema promjena za commit.
  echo Pokušavam push (ako već ima commitova)...
  git push -u origin main 2>nul
  if errorlevel 1 git push origin main
  pause
  exit /b 0
)

set "MSG=Update %date% %time%"
git commit -m "!MSG!"
if errorlevel 1 (
  echo [UPOZORENJE] Commit nije uspio.
  pause
  exit /b 1
)

git push -u origin main 2>nul
if errorlevel 1 (
  git push origin main
)
if errorlevel 1 (
  echo [GREŠKA] Push nije uspio. Provjeri: git remote -v, prijava.
  pause
  exit /b 1
)

echo.
echo Gotovo — kod je na GitHubu (grana main). Ako je uključen GitHub Actions, Pages će se rebuildati.
pause
