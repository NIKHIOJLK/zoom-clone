"""Passwords (bcrypt) and signed tokens (JWT).

Two kinds of token, told apart by the "typ" claim:
  user        -> proves which account is logged in (sent as `Authorization: Bearer <token>`)
  participant -> proves which participant you are in one meeting (sent as `X-Participant-Token`);
                 guests get one too, so they can chat and mute themselves without an account
"""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import JWT_EXPIRE_DAYS, JWT_SECRET

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    # bcrypt adds a random salt and is deliberately slow, so leaked hashes are hard to crack
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def create_token(kind: str, subject: int, **claims) -> str:
    payload = {
        "typ": kind,
        "sub": str(subject),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
        **claims,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def read_token(token: str | None, kind: str) -> dict | None:
    """The token's claims if the signature is valid, it hasn't expired and it's the right kind."""
    if not token:
        return None
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    return data if data.get("typ") == kind else None
