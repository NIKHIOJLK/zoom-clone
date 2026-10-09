"""App settings, read from environment variables (or backend/.env) with local-dev defaults."""
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent

# Optional backend/.env file (not committed). Real environment variables win over it.
load_dotenv(BACKEND_DIR / ".env")

# Where the Next.js app runs. Used to build invite links.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

# Comma-separated list of origins allowed to call the API.
CORS_ORIGINS = [
    o.strip().rstrip("/")
    for o in os.getenv("CORS_ORIGINS", FRONTEND_URL).split(",")
    if o.strip()
]

# Absolute path, so the DB lands in backend/ no matter which folder the server starts from.
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'zoom.db'}")