"""Sign up and log in. Both return a JWT the frontend sends as `Authorization: Bearer <token>`."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import AuthOut, LoginRequest, SignupRequest, UserOut
from ..security import create_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _auth_response(user: User) -> AuthOut:
    return AuthOut(access_token=create_token("user", user.id), user=UserOut.model_validate(user))


@router.post("/signup", response_model=AuthOut, status_code=201)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User.id).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(name=payload.name, email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return _auth_response(user)


@router.post("/login", response_model=AuthOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    # same message for "no such email" and "wrong password", so emails can't be probed
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return _auth_response(user)
