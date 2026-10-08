"""App settings, read from environment variables with local-dev defaults."""
import os

# Where the Next.js app runs. Used to build invite links.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

# Comma-separated list of origins allowed to call the API.
CORS_ORIGINS = [
    o.strip().rstrip("/")
    for o in os.getenv("CORS_ORIGINS", FRONTEND_URL).split(",")
    if o.strip()
]

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./zoom.db")
