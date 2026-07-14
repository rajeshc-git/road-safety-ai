# 🛡️ Safety Stop AI — Real-Time Compliance Monitor

<div align="center">

[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)

[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org/)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.x-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)](https://opencv.org/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Google-00C7B7?style=for-the-badge&logo=google&logoColor=white)](https://google.github.io/mediapipe/)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

[![Git LFS](https://img.shields.io/badge/Git_LFS-Enabled-orange?style=for-the-badge&logo=git-lfs&logoColor=white)](https://git-lfs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-07405E?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-blueviolet?style=for-the-badge)](https://github.com/ultralytics/ultralytics)

</div>

---

Safety Stop AI is a state-of-the-art compliance monitoring system powered by **YOLOv8**, **ByteTrack**, and **MediaPipe**. It processes camera feeds to detect stop line violations (traffic mode) and monitor driver fatigue and distractions (DMS driver mode) in real-time.

---

## 💻 Tech Stack & Features
* **Backend:** FastAPI (Python), Uvicorn, SQLite, PyTorch, YOLOv8, MediaPipe, PaddleOCR.
* **Frontend:** React, Vite, Tailwind-like custom Vanilla CSS dashboard.
* **Hardware-Aware:** Auto-detects NVIDIA GPUs via PyTorch CUDA support, falling back gracefully to optimized CPU threads.
* **Dual Run Configurations:** Start instantly with Docker Compose or via a manual step-by-step local installation.

---

## 🚀 Option 1: Running with Docker (Recommended)

Running the system via Docker isolates dependencies and sets up both the backend and frontend services seamlessly on a unified virtual network.

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

### 💾 Data Persistence
The SQLite database, recorded snapshots, and camera configuration are automatically bound and persisted locally inside the `./data` directory in your workspace.

---

## 🐍 Option 2: Running without Docker (Local Setup)

If you prefer running the code directly on your host machine, follow these steps to configure Python and Node.js.

### 📋 Prerequisites
Ensure you have the following installed:
1. **Python 3.10 or 3.11**
2. **Node.js 18+** & **npm**

---

### 📦 Step 1: Install Dependencies

#### 1. Python Backend
Open a terminal in the project root folder and install Python dependencies:
```bash
pip install -r backend/requirements.txt
```

#### 2. Node Frontend
Navigate to the `frontend/` directory and install JavaScript packages:
```bash
cd frontend
npm install
```

---

### ⚡ Step 2: Run the System

#### A. One-Click Startup (Windows)
Double-click the **`run.bat`** script in the project root directory. This:
* Starts the FastAPI backend engine on port `8000`.
* Launches the Vite frontend development server on port `3000`.
* Spawns separate, color-coded terminal windows for easy log observation.

#### B. Manual Startup (All Platforms)
Run both servers concurrently in separate terminals:

1. **Start the AI Backend:**
   From the **project root folder**, run:
   ```bash
   python run.py
   ```
   *This initializes the database, configures GPU/CPU detection, and starts the API server on port `8000`.*

2. **Start the React Frontend:**
   Open a **separate terminal window**, navigate to `frontend/` and run:
   ```bash
   cd frontend
   npm run dev
   ```
   *This starts the Vite development server (accessible at http://localhost:3000).*

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
