@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js not found on PATH. && pause && exit /b 1)
start "" http://127.0.0.1:8080/
node server.js
pause
