"""Shared FastAPI dependencies: who is calling."""
from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import Participant, User
from .security import read_token

bearer = HTTPBearer(auto_error=False)  # reads "Authorization: Bearer <token>"; None if missing


def _user_from_token(creds: HTTPAuthorizationCredentials | None, db: Session) -> User | None:
    data = read_token(creds.credentials if creds else None, "user")
    return db.get(User, int(data["sub"])) if data else None


def get_current_user(creds=Depends(bearer), db: Session = Depends(get_db)) -> User:
    """The logged-in account. Every route that needs one depends on this function."""
    user = _user_from_token(creds, db)
    if user is None:
        raise HTTPException(status_code=401, detail="Please sign in.", headers={"WWW-Authenticate": "Bearer"})
    return user


def get_optional_user(creds=Depends(bearer), db: Session = Depends(get_db)) -> User | None:
    """The logged-in account if there is one; guests joining by link have none."""
    return _user_from_token(creds, db)


def get_current_participant(
    code: str,
    x_participant_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Participant:
    """Who is acting inside this meeting, proven by the token they got when joining."""
    data = read_token(x_participant_token, "participant")
    digits = "".join(ch for ch in code if ch.isdigit())
    participant = db.get(Participant, int(data["sub"])) if data else None
    if participant is None or data.get("mtg") != digits or participant.meeting.meeting_code != digits:
        raise HTTPException(status_code=401, detail="Your meeting session has expired. Please join again.")
    return participant
