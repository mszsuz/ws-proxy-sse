@echo off
chcp 65001 >nul
echo [START] Запуск всех компонентов WebSocket to SSE Proxy...
echo.

echo [SERVER] Запуск SSE сервера...
start "SSE Server" cmd /k "npx ts-node test/server/index.ts"

timeout /t 2 /nobreak > nul

echo [PROXY] Запуск WebSocket прокси...
start "WebSocket Proxy" cmd /k "npx ts-node proxy/index.ts"

timeout /t 2 /nobreak > nul

echo [CLIENT] Запуск WebSocket клиента...
start "WebSocket Client" cmd /k "npx ts-node test/client/index.ts"

echo.
echo [OK] Все компоненты запущены в отдельных окнах!
echo.
echo Для остановки закройте все окна или используйте stop-all.cmd
pause
