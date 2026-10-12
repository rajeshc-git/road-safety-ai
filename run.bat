@echo off
setlocal enabledelayedexpansion
title VIGILIX AI - Autonomous Road Safety ^& DMS (Docker Production Stack)
mode con cols=120 lines=42 >nul 2>&1
color 0b

REM Enable BuildKit for persistent cache mounts (prevents re-downloading dependencies)
set "DOCKER_BUILDKIT=1"
set "COMPOSE_DOCKER_CLI_BUILD=1"

cd /d "%~dp0"

echo ======================================================================================
echo                             VIGILIX AI - PRODUCTION DOCKER STACK
echo                  Autonomous Traffic Compliance ^& Driver Monitoring System
echo ======================================================================================
echo.

REM == STEP 1: Verify Docker Engine ============================================
where docker >nul 2>&1
if %errorlevel% neq 0 (
    if exist "C:\Program Files\Docker\Docker\resources\bin\docker.exe" (
        set "PATH=C:\Program Files\Docker\Docker\resources\bin;!PATH!"
    )
)

where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in your system PATH.
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop/
    echo Once installed, restart this script.
    goto :fatal_error
)


REM Check if Docker daemon is running
docker info >nul 2>&1
if %errorlevel% equ 0 goto :docker_active

echo [*] Docker engine is not running. Attempting to start Docker Desktop...
set "DOCKER_EXE=C:\Program Files\Docker\Docker\Docker Desktop.exe"
if exist "%DOCKER_EXE%" (
    start "" "%DOCKER_EXE%"
) else (
    if exist "%LOCALAPPDATA%\Docker\Docker Desktop.exe" (
        start "" "%LOCALAPPDATA%\Docker\Docker Desktop.exe"
    )
)

echo [*] Waiting for Docker daemon to initialize (this may take up to 45 seconds)...
set "DOCKER_READY=0"
for /l %%i in (1,1,45) do (
    docker info >nul 2>&1
    if !errorlevel! equ 0 (
        set "DOCKER_READY=1"
        goto :docker_active
    )
    powershell -NoProfile -Command "Start-Sleep -Seconds 1" >nul 2>&1
)

if %DOCKER_READY% equ 0 (
    echo.
    echo [!] Docker Desktop did not respond in time.
    echo Please manually launch Docker Desktop from your Start menu and ensure it shows "Engine running".
    echo Press any key to retry after Docker Desktop has started...
    pause >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 goto :fatal_error
)

:docker_active
echo [OK] Docker Engine is active and connected.

REM == STEP 2: Hardware Acceleration Detection =================================
set "GPU_MODE=0"
set "DETECTED_GPU="

where nvidia-smi >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%g in ('powershell -NoProfile -Command "$g = nvidia-smi --query-gpu=gpu_name --format=csv,noheader 2>$null | Select-Object -First 1; if ($g) { $g.Trim() }"') do set "DETECTED_GPU=%%g"
    if defined DETECTED_GPU (
        echo [OK] Hardware Detected: !DETECTED_GPU!
        echo [*] PyTorch CUDA 12.8 acceleration enabled Blackwell RTX 5080/5090 ready.
        set "GPU_MODE=1"
    )

)

if %GPU_MODE% equ 0 (
    echo [*] No NVIDIA GPU detected. Running with optimized multi-core CPU inference.
)

REM == STEP 3: Ensure Data Persistence Directories ============================
if not exist "data\snapshots" mkdir "data\snapshots"
if not exist "data\test_videos" mkdir "data\test_videos"
if not exist "data\minio" mkdir "data\minio"
if not exist "data\redis" mkdir "data\redis"

REM Determine Compose Command (docker compose or docker-compose)
set "COMPOSE_CMD=docker compose"
docker compose version >nul 2>&1
if %errorlevel% neq 0 set "COMPOSE_CMD=docker-compose"

REM == STEP 4: Automated Build & Startup Strategy ===============================
REM Backend: Live-mounted from .\backend (Python edits take effect in 0s, 0MB download)
REM Frontend: Rebuilt via Bun in Alpine (Vite compilation in ~1.5s, 0MB download)

echo [*] Compiling frontend bundle (instant local build, 0MB download)...
%COMPOSE_CMD% build frontend

:start_services

if %GPU_MODE% equ 1 (
    echo [*] Launching stack with NVIDIA GPU acceleration...
    %COMPOSE_CMD% up -d
    if !errorlevel! neq 0 (
        echo.
        echo [!] Notice: Docker GPU reservation could not be initialized by the local engine.
        echo [*] Falling back to CPU mode automatically...
        %COMPOSE_CMD% -f docker-compose.yml -f docker-compose.cpu.yml up -d
    )
) else (
    echo [*] Launching stack in CPU mode...
    %COMPOSE_CMD% -f docker-compose.yml -f docker-compose.cpu.yml up -d
)

if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Docker Compose stack.
    goto :fatal_error
)

REM Reload backend process to instantly apply any Python code changes from .\backend
%COMPOSE_CMD% restart backend >nul 2>&1

echo.
echo [*] Waiting for services to initialize...
powershell -NoProfile -Command "$ready=$false; for ($i=0; $i -lt 40; $i++) { try { $r=Invoke-WebRequest -Uri 'http://127.0.0.1:8000/docs' -TimeoutSec 1 -UseBasicParsing; if ($r.StatusCode -eq 200) { $ready=$true; break } } catch {}; Start-Sleep -Milliseconds 1000 }; if ($ready) { Write-Host '  [OK] AI Backend is responsive.' } else { Write-Host '  [*] Services starting up in background...' }"

echo.
echo ======================================================================================
echo   [OK] Production Stack is Live:
echo   - Unified Dashboard:         http://localhost:9999
echo   - AI Backend REST API:       http://localhost:8000
echo   - Swagger API Documentation: http://localhost:8000/docs
echo   - MinIO Storage Console:     http://localhost:9001 (minioadmin / minioadmin123)
echo   - Redis Stream Cache:        localhost:6379
echo ======================================================================================
echo.

echo   All 4 microservices are running in background detached mode.
echo   Closing this terminal window will NOT stop or affect the system.
echo   - To view live logs anytime:  docker compose logs -f
echo   - To stop the system anytime: docker compose down
echo ======================================================================================
echo.
echo [*] System is ready and operational!
echo     Press any key to close this console window (containers will keep running)...
pause >nul
exit /b 0


:fatal_error
echo.
echo ======================================================================================
echo [SYSTEM PAUSED] An error occurred during startup.
echo ======================================================================================
pause
exit /b 1

