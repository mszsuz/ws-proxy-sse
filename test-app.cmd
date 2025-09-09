@echo off
chcp 65001 >nul
echo [TEST] Тестирование WebSocket to SSE Proxy...
echo.

echo [SERVER] Запуск SSE сервера...
start "SSE Server" cmd /k "npx ts-node test/server/index.ts"

timeout /t 2 /nobreak > nul

echo [PROXY] Запуск WebSocket прокси...
start "WebSocket Proxy" cmd /k "npx ts-node proxy/index.ts"

timeout /t 2 /nobreak > nul

echo [CLIENT] Запуск тестового клиента...
echo.
echo [INFO] Клиент будет отправлять 5 сообщений с паузой 1 секунда между ответом и следующей отправкой...
echo.
npx ts-node test/client/index.ts

echo.
echo [DONE] Тест завершен!
echo.
pause
