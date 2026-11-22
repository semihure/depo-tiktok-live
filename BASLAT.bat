@echo off
chcp 65001 >nul
cd /d "%~dp0"
title DEPO - baslatici
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi. https://nodejs.org adresinden LTS surumunu kur, bilgisayari yeniden baslat.
  pause
  exit /b 1
)
rem TikTok baglantisi Node 20+ ister
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODEMAJOR=%%v
if %NODEMAJOR% LSS 20 (
  echo UYARI: Node.js surumu %NODEMAJOR% eski. TikTok baglantisi icin Node 20 veya ustu gerekir: https://nodejs.org adresinden LTS kur. Demo yine calisir.
  pause
)
if not exist node_modules (
  echo Ilk acilis: gerekli paketler kuruluyor, 1-2 dakika surebilir...
  call npm install --no-audit --no-fund
)
start "DEPO SUNUCU - yayin boyunca kapatma" cmd /k node server.js
timeout /t 2 /nobreak >nul
set URL=http://localhost:3200/?clean
set EDGE="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set CHROME="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist %CHROME% (
  start "" %CHROME% --app=%URL% --window-size=540,960 --autoplay-policy=no-user-gesture-required
) else if exist %EDGE% (
  start "" %EDGE% --app=%URL% --window-size=540,960 --autoplay-policy=no-user-gesture-required
) else (
  start "" %URL%
)
start "" http://localhost:3200
