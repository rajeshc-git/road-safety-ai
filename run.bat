@echo off
title VIGILIX AI - Production Launcher
mode con cols=120 lines=40 >nul 2>&1
color 0b

echo ======================================================================================
echo                             VIGILIX AI - PRODUCTION SYSTEM
echo ======================================================================================
echo.

REM == STEP 1: Verify Bun Runtime (Auto-Install if Missing) ==================
where bun >nul 2>&1
if %errorlevel% equ 0 goto :bun_ok

echo [*] Bun runtime not detected. Auto-downloading and installing Bun 1.4.2...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; irm https://bun.sh/install.ps1 | iex"
set "PATH=%USERPROFILE%\.bun\bin;%PATH%"

:bun_ok

REM == STEP 2: Fast Frontend Packages & Production dist Check ===============
if exist "frontend\node_modules" goto :node_modules_ok
echo [*] Installing frontend packages using Bun...
cd frontend
call bun install
cd ..
:node_modules_ok

if exist "frontend\dist\index.html" goto :dist_ok
echo [*] Compiling optimized frontend production bundle (dist) using Bun...
cd frontend
call bun run build
cd ..
:dist_ok

REM == STEP 3: Docker Infrastructure Check (Redis and MinIO) ==================
where docker >nul 2>&1
if %errorlevel% neq 0 goto :docker_skip

docker info >nul 2>&1
if %errorlevel% neq 0 goto :docker_skip

echo [*] Ensuring Redis and MinIO Docker containers are active...
docker compose up -d redis minio >nul 2>&1
if %errorlevel% neq 0 docker-compose up -d redis minio >nul 2>&1
echo [OK] Redis and MinIO containers verified.

:docker_skip

REM == STEP 4: Ensure Data Folders Exist =====================================
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

REM 1. Launch FastAPI Backend
start /b cmd /c "python run.py"

REM Wait for Backend AI Engine to be fully initialized & ready
echo [*] Waiting for Backend AI Engine and Cache initialization...
powershell -NoProfile -Command "$ready=$false; for ($i=0; $i -lt 35; $i++) { try { $r=Invoke-WebRequest -Uri 'http://127.0.0.1:8000/docs' -TimeoutSec 1 -UseBasicParsing; if ($r.StatusCode -eq 200) { $ready=$true; break } } catch {}; Start-Sleep -Milliseconds 500 }; if ($ready) { Write-Host '  [OK] Backend AI Engine is online and responsive.' } else { Write-Host '  [!] Launching frontend preview...' }"

REM 2. Launch Production Frontend Server via Bun
start /b cmd /c "cd frontend && bun run start"

REM Wait 1 second for frontend preview server
ping -n 2 127.0.0.1 >nul 2>&1

REM 3. Open browser automatically with backend fully ready
start http://localhost:3000

REM Keep console window open to stream live logs
:loop
ping -n 60 127.0.0.1 >nul 2>&1
goto loop
