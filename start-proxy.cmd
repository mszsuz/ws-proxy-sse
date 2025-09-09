@echo off
chcp 65001 >nul
echo [START] Запуск WebSocket прокси сервера...
echo.
npx ts-node proxy/index.ts
pause