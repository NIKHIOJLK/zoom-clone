"""Shared FastAPI dependencies."""
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import User


def get_current_user(db: Session = Depends(get_db)) -> User:
    """No login per the assignment: the first seeded user is always 'logged in'.

    Every route that needs "the current user" depends on this one function,
    so adding real auth later means changing only this file.
    """
    user = db.query(User).order_by(User.id).first()
    if not user:
        raise HTTPException(status_code=500, detail="No default user found. Seed the database.")
    return user
