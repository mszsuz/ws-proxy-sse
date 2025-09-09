@echo off
chcp 65001 >nul
echo [START] Запуск SSE сервера...
echo.
npx ts-node test/server/index.ts
pause
