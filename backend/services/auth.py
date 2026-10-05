import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, Response
from pwdlib import PasswordHash
from sqlmodel import Session

from backend.database import get_session
from backend.models.account import LoginSession, User

passwords = PasswordHash.recommended()
dummy_hash = passwords.hash(secrets.token_urlsafe(32))
COOKIE = "namicubes_session"
SESSION_SECONDS = 60 * 60 * 24 * 7


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def current_user(request: Request, session: Session = Depends(get_session)) -> User:
    token = request.cookies.get(COOKIE)
    login = session.get(LoginSession, token_hash(token)) if token else None
    if login:
        expiry = login.expires_at.replace(tzinfo=timezone.utc)
        if expiry > datetime.now(timezone.utc):
            user = session.get(User, login.user_id)
            if user:
                return user
    raise HTTPException(401, "sign in required")


def create_session(user: User, request: Request, response: Response, session: Session):
    old_token = request.cookies.get(COOKIE)
    old = session.get(LoginSession, token_hash(old_token)) if old_token else None
    if old:
        session.delete(old)
    token = secrets.token_urlsafe(32)
    session.add(LoginSession(token_hash=token_hash(token), user_id=user.id, expires_at=datetime.now(timezone.utc) + timedelta(seconds=SESSION_SECONDS)))
    session.commit()
    response.set_cookie(COOKIE, token, max_age=SESSION_SECONDS, httponly=True, samesite="strict", secure=os.environ.get("COOKIE_SECURE", "false").lower() == "true", path="/")
