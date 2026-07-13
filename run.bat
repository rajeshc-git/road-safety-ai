@echo off
title Safety Stop AI - Unified Console
mode con: cols=120 lines=40
color 0b

echo ======================================================================================
echo                          SAFETY STOP AI - UNIFIED CONSOLE
echo ======================================================================================
echo.
echo   [*] Booting FastAPI Backend and Vite React Frontend concurrently...
echo   [*] Both log streams will output directly below.
echo   [*] To stop the system, simply press Ctrl + C inside this window.
echo.
echo ======================================================================================
echo.

:: 1. Launch Python FastAPI Backend in the background (outputting to this window)
start /b cmd /c "python run.py"

:: Staggered start: wait 3 seconds to let SQLite database initialize cleanly
timeout /t 3 /nobreak > nul

:: 2. Launch Vite React Frontend in the background (outputting to this window)
start /b cmd /c "cd frontend && npm run dev"

:: Keep this parent batch thread alive so the console remains active to stream logs
:loop
timeout /t 60 > nul
goto loop
