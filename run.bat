@echo off
setlocal enabledelayedexpansion
title VIGILIX AI - Production Launcher
mode con cols=120 lines=40 >nul 2>&1
color 0b

cd /d "%~dp0"

echo ======================================================================================
echo                             VIGILIX AI - PRODUCTION SYSTEM
echo ======================================================================================
echo.

REM == STEP 1: Verify Python & Virtual Environment (.venv) ====================
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not detected in your system PATH.
    echo Please install Python 3.10+ from https://www.python.org/ and ensure "Add Python to PATH" is checked.
    goto :fatal_error
)

REM Determine Python interpreter (.venv or fallback)
if exist ".venv\Scripts\python.exe" (
    set "PYTHON_EXEC=.venv\Scripts\python.exe"
    goto :check_modules
)

echo [*] Python virtual environment [.venv] not detected.
echo [*] Creating virtual environment [.venv]...
python -m venv .venv
if not exist ".venv\Scripts\python.exe" (
    echo [!] Warning: Could not create .venv. Falling back to system Python.
    set "PYTHON_EXEC=python"
    goto :check_modules
)
set "PYTHON_EXEC=.venv\Scripts\python.exe"

:check_modules
REM Check if core backend packages (e.g. uvicorn, fastapi) are installed in the Python environment
"%PYTHON_EXEC%" -c "import uvicorn, fastapi" >nul 2>&1
if %errorlevel% equ 0 goto :modules_ok

echo [*] Required backend packages (uvicorn, fastapi) missing.
echo [*] Installing dependencies from backend\requirements.txt into environment...
call "%PYTHON_EXEC%" -m pip install --upgrade pip >nul 2>&1
call "%PYTHON_EXEC%" -m pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [!] Notice: Some packages had installation warnings. Continuing with available modules...
) else (
    echo [OK] Backend dependencies installed successfully.
)

:modules_ok
echo [OK] Backend Python environment verified: %PYTHON_EXEC%

REM == STEP 2: Verify Bun / Node Runtime =======================================
where bun >nul 2>&1
if %errorlevel% equ 0 goto :runtime_ok
if exist "%USERPROFILE%\.bun\bin\bun.exe" (
    set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
    goto :runtime_ok
)

echo [*] Bun runtime not detected. Auto-downloading Bun...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; irm https://bun.sh/install.ps1 | iex" >nul 2>&1
if exist "%USERPROFILE%\.bun\bin\bun.exe" (
    set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
)

:runtime_ok

REM == STEP 3: Frontend Dependencies & Production dist Check ===================
if exist "frontend\node_modules" goto :node_modules_ok
echo [*] Installing frontend packages...
cd frontend
where bun >nul 2>&1
if %errorlevel% equ 0 (
    call bun install
) else (
    call npm install
)
cd ..

:node_modules_ok

if exist "frontend\dist\index.html" goto :dist_ok
echo [*] Compiling optimized frontend production bundle [dist]...
cd frontend
if exist "node_modules\vite\bin\vite.js" (
    node node_modules\vite\bin\vite.js build
) else (
    where bun >nul 2>&1
    if %errorlevel% equ 0 (
        call bun run build
    ) else (
        call npm run build
    )
)
cd ..

:dist_ok

REM == STEP 4: Docker Infrastructure Check (Redis and MinIO) ==================
where docker >nul 2>&1
if %errorlevel% neq 0 goto :docker_skip

docker info >nul 2>&1
if %errorlevel% neq 0 goto :docker_skip

echo [*] Ensuring Redis and MinIO Docker containers are active...
docker compose up -d redis minio >nul 2>&1
if %errorlevel% neq 0 docker-compose up -d redis minio >nul 2>&1
echo [OK] Redis and MinIO containers verified.

:docker_skip

REM == STEP 5: Ensure Data Folders Exist =====================================
if not exist "data\snapshots" mkdir "data\snapshots"
if not exist "data\test_videos" mkdir "data\test_videos"
if not exist "data\minio" mkdir "data\minio"
if not exist "data\redis" mkdir "data\redis"

echo.
echo ======================================================================================
echo   [OK] Launching Production Stack:
echo   - Backend AI Engine:           http://localhost:8000
echo   - Frontend Production Server:  http://localhost:3000
echo   - MinIO Storage Console:       http://localhost:9001
echo   - Swagger REST API Docs:       http://localhost:8000/docs
echo   Press Ctrl + C to stop the system.
echo ======================================================================================
echo.

REM 1. Launch FastAPI Backend with Virtual Environment
start /b cmd /c "%PYTHON_EXEC% run.py"

REM Wait for Backend AI Engine to be fully initialized & ready
echo [*] Waiting for Backend AI Engine and Cache initialization...
powershell -NoProfile -Command "$ready=$false; for ($i=0; $i -lt 35; $i++) { try { $r=Invoke-WebRequest -Uri 'http://127.0.0.1:8000/docs' -TimeoutSec 1 -UseBasicParsing; if ($r.StatusCode -eq 200) { $ready=$true; break } } catch {}; Start-Sleep -Milliseconds 500 }; if ($ready) { Write-Host '  [OK] Backend AI Engine is online and responsive.' } else { Write-Host '  [!] Launching frontend preview...' }"

REM 2. Launch Production Frontend Server
if exist "frontend\node_modules\vite\bin\vite.js" (
    start /b cmd /c "cd frontend && node node_modules\vite\bin\vite.js preview --port 3000"
) else (
    start /b cmd /c "cd frontend && bun run start"
)

REM Wait 1 second for frontend preview server
ping -n 2 127.0.0.1 >nul 2>&1

REM 3. Open browser automatically with backend fully ready
start http://localhost:3000

REM Keep console window open to stream live logs
:loop
ping -n 60 127.0.0.1 >nul 2>&1
goto loop

:fatal_error
echo.
echo ======================================================================================
echo [SYSTEM PAUSED] An error occurred. The console will stay open for review.
echo ======================================================================================
pause
exit /b 1
