# 🛡️ VIGILIX AI — Real-Time Safety & Compliance Monitor

<div align="center">

[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)

[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org/)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.x-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)](https://opencv.org/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Google-00C7B7?style=for-the-badge&logo=google&logoColor=white)](https://google.github.io/mediapipe/)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

[![Redis](https://img.shields.io/badge/Redis-7.0-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![MinIO](https://img.shields.io/badge/MinIO-S3_Storage-C72C48?style=for-the-badge&logo=minio&logoColor=white)](https://min.io/)
[![WebRTC](https://img.shields.io/badge/WebRTC-Low_Latency-333333?style=for-the-badge&logo=webrtc&logoColor=white)](https://webrtc.org/)

</div>

---

**VIGILIX AI** is an enterprise-grade compliance monitoring and safety intelligence system powered by **YOLOv8**, **ByteTrack**, **MediaPipe**, **PaddleOCR**, **WebRTC**, **Redis**, and **MinIO**. It processes multi-camera feeds in real-time to detect stop-line violations (road traffic perspective) and driver fatigue/distraction (DMS cabin perspective).

---

## 💻 Tech Stack & Infrastructure
* **Backend:** FastAPI (Python), Uvicorn, SQLite, PyTorch, YOLOv8, MediaPipe, PaddleOCR, `aiortc` (WebRTC).
* **Distributed Event Bus & Caching:** **Redis** Pub/Sub for real-time telemetry streaming and fast state caching.
* **Evidence Object Storage:** **MinIO** (S3-compatible) for centralized storage of violation snapshots and cropped license plate evidence.
* **Low-Latency Streaming:** **WebRTC** (<150ms latency) with automatic fallback to MJPEG/WebSocket.
* **Frontend:** React 19, Vite, custom responsive glassmorphic dashboard.
* **Hardware-Aware:** Auto-detects NVIDIA GPUs via PyTorch CUDA support, falling back gracefully to optimized CPU threads.
* **Dual Run Configurations:** Start instantly with Docker Compose or via a manual step-by-step local installation.

---

## 🚀 Option 1: Running with Docker (Recommended)

Running the system via Docker starts the entire microservice stack (Backend, Frontend, Redis, and MinIO) with unified networking and persistent volume mounts.

### 📋 Prerequisites
* Install [Docker](https://www.docker.com/products/docker-desktop/)
* Install [Docker Compose](https://docs.docker.com/compose/install/)

### 🛠️ Execution Steps
1. Open a terminal in the project root folder.
2. Build and launch the containers:
   ```bash
   docker-compose up --build
   ```
3. Once running, access the services:
   * **Interactive Dashboard (Frontend):** [http://localhost:3000](http://localhost:3000)
   * **REST API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
   * **Backend REST API:** [http://localhost:8000](http://localhost:8000)
   * **MinIO Storage Console:** [http://localhost:9001](http://localhost:9001) *(User: `minioadmin` / Pass: `minioadmin123`)*
   * **Redis Server:** `localhost:6379`

### 💾 Data Persistence
The SQLite database, MinIO object buckets (`./data/minio`), Redis dumps (`./data/redis`), and camera configurations are automatically bound and persisted locally inside the `./data` directory in your workspace.

---

## 🐍 Option 2: Running without Docker (Local Setup)

If you prefer running the code directly on your host machine, follow these steps to configure Python and Node.js.

### 📋 Prerequisites
Ensure you have the following installed:
1. **Python 3.10 or 3.11**
2. **Bun 1.4.2+** *(or Node.js 18+ & npm)*

---

### 📦 Step 1: Install Dependencies

#### 1. Python Backend
Open a terminal in the project root folder and install Python dependencies:
```bash
pip install -r backend/requirements.txt
```

#### 2. Frontend (Bun)
Navigate to the `frontend/` directory, install packages, and compile the production bundle:
```bash
cd frontend
bun install
bun run build
```

---

### ⚡ Step 2: Run the System

#### A. One-Click Autonomous Startup (Windows)
Double-click the **`run.bat`** script in the project root directory. This:
* Auto-installs missing Python backend dependencies and Bun if needed.
* Auto-compiles the optimized `frontend/dist` production bundle.
* Auto-starts background **Redis** and **MinIO** Docker containers if Docker is available.
* Starts the FastAPI backend AI engine (serving the production SPA directly on port `8000`).
* Starts the high-speed production frontend server on port `3000`.
* Automatically launches [http://localhost:3000](http://localhost:3000) in your default web browser.

#### B. Manual Startup (All Platforms)
Run both servers concurrently in separate terminals:

1. **Start the AI Backend + Unified Dashboard:**
   From the **project root folder**, run:
   ```bash
   python run.py
   ```
   *Serves the backend AI engine, WebRTC video feeds, and the compiled production SPA at [http://localhost:8000](http://localhost:8000).*

2. **Start the Production Frontend Server:**
   Open a **separate terminal window**, navigate to `frontend/` and run:
   ```bash
   cd frontend
   bun run start
   ```
   *Serves the high-performance production build at [http://localhost:3000](http://localhost:3000).*

---

## 🛑 How to Stop the System

* **Docker:** Press `Ctrl + C` in the docker terminal, or run:
  ```bash
  docker-compose down
  ```
* **One-Click Startup (`run.bat`):** Simply close the opened terminal command prompt windows.
* **Manual Local Run:** Go to each active terminal window and press `Ctrl + C`.

---

## ⚡ Hardware Acceleration & NVIDIA GPUs
The backend runs AI inference much faster on an NVIDIA GPU. 
* By default, the system checks for CUDA availability via PyTorch. 
* If PyTorch is running in CPU-only mode but an NVIDIA GPU is available on the system, the startup logs will print a helpful prompt instructing you how to install the CUDA-supported PyTorch wheel:
  ```bash
  pip install torch --index-url https://download.pytorch.org/whl/cu121
  ```

---

**Developed by:** Rajesh Choudhury
