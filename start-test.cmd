@echo off
echo Starting WebSocket to SSE Proxy Test Environment...
echo.
echo This will start:
echo - SSE Server (port 8081)
echo - Proxy Server (port 3001) 
echo - WebSocket Client (test)
echo.
echo Press any key to start all components...
pause

cd /d "%~dp0"

echo.
echo Starting SSE Server...
start "SSE Server" cmd /k "npx ts-node test/server/index.ts"

timeout /t 2 /nobreak >nul

echo Starting Proxy Server...
start "Proxy Server" cmd /k "npx ts-node proxy/index.ts"

timeout /t 2 /nobreak >nul

echo Starting WebSocket Client...
start "WebSocket Client" cmd /k "npx ts-node test/client/index.ts"

echo.
echo All components started in separate windows.
echo.
echo To stop all components, close the opened windows.
echo.
pause
