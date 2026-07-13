"""
Safety Stop AI — Entry Point
Run this file to start the application.
"""

import sys
import os
import socket
import time
import uvicorn

# Resolve the root path properly
ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

# Insert both so both "import config" (inside backend) and "import backend.config" (here) work
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, ROOT_DIR)

try:
    # Try importing via module path so IDE linters find it successfully
    from backend.config import HOST, PORT
except ImportError:
    # Fallback to default values if import fails for any reason
    HOST = "0.0.0.0"
    PORT = 8000

def _free_port(port: int):
    """Force kill any existing processes blocking the port on Windows."""
    try:
        import subprocess
        subprocess.run(
            ["powershell", "-Command",
             f"Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | "
             f"ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }}"],
            capture_output=True, timeout=8
        )
    except Exception:
        pass

def _port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0

if __name__ == "__main__":
    if _port_in_use(PORT):
        print(f"  [!] Port {PORT} in use — resolving...")
        _free_port(PORT)
        time.sleep(1.5)

    print("=" * 60)
    print("  Safety Stop AI — Real-Time Compliance Monitor")
    print("  Version 1.0.0")
    print("=" * 60)
    print(f"  Backend API:  http://localhost:{PORT}")
    print(f"  API Docs:     http://localhost:{PORT}/docs")
    print(f"  Frontend:     http://localhost:3000 (run 'npm run dev')")
    print("=" * 60)

    uvicorn.run(
        "app:app",
        host=HOST,
        port=PORT,
        reload=False,
        log_level="info",
        app_dir=BACKEND_DIR
    )
