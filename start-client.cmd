@echo off
chcp 65001 >nul
echo [START] Запуск WebSocket клиента...
echo.
npx ts-node test/client/index.ts
pause
