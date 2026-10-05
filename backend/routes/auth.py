from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from backend.database import get_session
from backend.models.account import Category, EVENTS, LoginSession, User
from backend.services.auth import COOKIE, create_session, current_user, dummy_hash, passwords, token_hash

router = APIRouter(prefix="/api/auth", tags=["accounts"])


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def lowercase(cls, value):
        return value.lower()


class UserRead(BaseModel):
    id: int
    username: str


@router.post("/register", response_model=UserRead, status_code=201)
def register(data: Credentials, request: Request, response: Response, session: Session = Depends(get_session)):
    user = User(username=data.username, password_hash=passwords.hash(data.password))
    session.add(user)
    try:
        session.flush()
        for name in EVENTS:
            session.add(Category(user_id=user.id, name=name))
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "username unavailable")
    session.refresh(user)
    create_session(user, request, response, session)
    return UserRead(id=user.id, username=user.username)


@router.post("/login", response_model=UserRead)
def login(data: Credentials, request: Request, response: Response, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.username == data.username)).first()
    valid = passwords.verify(data.password, user.password_hash if user else dummy_hash)
    if not user or not valid:
        raise HTTPException(401, "invalid credentials")
    create_session(user, request, response, session)
    return UserRead(id=user.id, username=user.username)


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(current_user)):
    return UserRead(id=user.id, username=user.username)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, session: Session = Depends(get_session)):
    token = request.cookies.get(COOKIE)
    login = session.get(LoginSession, token_hash(token)) if token else None
    if login:
        session.delete(login)
        session.commit()
    response.delete_cookie(COOKIE, path="/", httponly=True, samesite="strict")
