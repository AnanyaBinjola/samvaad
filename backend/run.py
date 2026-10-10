#!/usr/bin/env python3
"""
Entry point script for launching the Samvaad FastAPI backend.
Usage:
    .venv/bin/python backend/run.py
"""
import sys
from pathlib import Path

# Ensure the Samvaad project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import uvicorn
from backend.config import BACKEND_HOST, BACKEND_PORT

if __name__ == "__main__":
    print(f"=== Launching Samvaad Backend Server on http://{BACKEND_HOST}:{BACKEND_PORT} ===")
    uvicorn.run(
        "backend.main:app",
        host=BACKEND_HOST,
        port=BACKEND_PORT,
        reload=True,
        app_dir=str(ROOT_DIR),
    )
