"""FastAPI entry point. Run with:  uvicorn app.main:app --reload"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS
from . import realtime
from .database import Base, SessionLocal, engine, upgrade_schema
from .routers import auth, meetings, users
from .seed import seed, set_demo_passwords


@asynccontextmanager
async def lifespan(app: FastAPI):
    # On startup: create tables if missing, add new columns, then insert sample data once.
    Base.metadata.create_all(bind=engine)
    upgrade_schema()
    db = SessionLocal()
    try:
        seed(db)
        set_demo_passwords(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Zoom Clone API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(meetings.router)
app.include_router(realtime.router)  # WebSocket: live events + WebRTC signaling


@app.get("/", tags=["health"])
def health():
    return {"status": "ok"}
