@echo off
setlocal EnableDelayedExpansion

color 0a

cls

echo.
echo   [1;33m---------------------------------------------[0m
echo   [1;36m                zoro                      [0m        
echo   [1;33m---------------------------------------------[0m
echo   [1;34mhttps://github.com/thyitachi/zoro       [0m
echo   [1;33m---------------------------------------------[0m
echo.
echo [1;32mStarting zoro...[0m
echo.

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install --omit=dev
)
echo Running npm start...
call npm start
pause