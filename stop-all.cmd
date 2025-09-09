@echo off
chcp 65001 >nul
echo [STOP] Остановка всех компонентов...
echo.

echo [INFO] Поиск процессов Node.js...
tasklist | findstr "node.exe"

echo.
echo [KILL] Закрытие всех процессов Node.js...
for /f "tokens=2" %%i in ('tasklist ^| findstr "node.exe"') do (
    echo Закрытие процесса PID: %%i
    taskkill /f /pid %%i >nul 2>&1
)

echo.
echo [OK] Все процессы остановлены!
echo.
pause
