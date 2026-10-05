from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from backend.database import get_session
from backend.models.account import Category, Cube, EVENTS, User
from backend.services.auth import current_user

router = APIRouter(prefix="/api/organization", tags=["organization"])


@router.get("")
def organization(user: User = Depends(current_user), session: Session = Depends(get_session)):
    categories = session.exec(select(Category).where(Category.user_id == user.id)).all()
    categories.sort(key=lambda category: EVENTS.index(category.name) if category.name in EVENTS else len(EVENTS))
    cubes = session.exec(select(Cube).where(Cube.user_id == user.id).order_by(Cube.name)).all()
    return {
        "categories": [{"id": item.id, "name": item.name} for item in categories],
        "cubes": [{"id": item.id, "name": item.name} for item in cubes],
    }
