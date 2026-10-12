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

## 🚀 1-Click Launch with Docker (Zero Host Dependencies)

The entire microservice stack (Backend with PyTorch CUDA, React Frontend, Redis, MinIO) runs fully containerized. You do **not** need Python, `.venv`, Bun/Node, or CUDA Toolkit installed on your host machine.

### 📋 Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed on Windows / Linux / macOS.
* *(Optional)* Any NVIDIA GPU (RTX 50xx, 40xx, 30xx, 20xx, GTX 16xx) with standard NVIDIA display drivers.

### ⚡ Quick Start
1. Double-click **`run.bat`** (or execute `./run.bat` in a terminal).
2. The launcher automatically:
   - Detects Docker (and starts Docker Desktop if inactive).
   - Detects any NVIDIA GPU and enables PyTorch CUDA 12.4 container acceleration.
   - Falls back gracefully to optimized multi-threaded CPU inference if no NVIDIA GPU is available.
   - Builds and starts all 4 microservices via Docker Compose.
   - Opens your browser directly at [http://localhost:3000](http://localhost:3000).

### 🌐 Service Endpoints
* **Unified Dashboard (Frontend):** [http://localhost:9999](http://localhost:9999)

* **AI Engine REST API:** [http://localhost:8000](http://localhost:8000)
* **Interactive API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **MinIO Storage Console:** [http://localhost:9001](http://localhost:9001) *(Credentials: `minioadmin` / `minioadmin123`)*
* **Redis Stream Cache:** `localhost:6379`

### 💾 Data Persistence
All violation snapshots (`./data/snapshots`), camera configs, SQLite database (`./data/safety_stop.db`), MinIO objects (`./data/minio`), and Redis records (`./data/redis`) are mounted and persisted locally in the `./data` folder.


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
