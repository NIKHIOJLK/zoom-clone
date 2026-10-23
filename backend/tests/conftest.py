"""Test setup: a throwaway SQLite file and a fixed signing key, set before the app is imported."""
import os
import sys
import tempfile
import uuid
from pathlib import Path

import pytest

os.environ["DATABASE_URL"] = f"sqlite:///{Path(tempfile.mkdtemp()) / 'test.db'}"
os.environ["JWT_SECRET"] = "test-only-secret-" + "x" * 40
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

DEMO = {"email": "nikhil.sharma@example.com", "password": "demo1234"}


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:  # runs startup: create tables + seed
        yield c


@pytest.fixture(scope="session")
def host_headers(client):
    token = client.post("/api/auth/login", json=DEMO).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def meeting(client, host_headers):
    """A fresh instant meeting hosted by the demo user."""
    return client.post("/api/meetings/instant", json={}, headers=host_headers).json()


def join(client, code, name, passcode="", headers=None):
    return client.post(f"/api/meetings/{code}/join", json={"display_name": name, "passcode": passcode}, headers=headers or {})


def seat(participant):
    """Headers proving which participant is acting."""
    return {"X-Participant-Token": participant["participant_token"]}


def unique_email():
    return f"user-{uuid.uuid4().hex[:8]}@example.com"
