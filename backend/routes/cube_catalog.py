from fastapi import APIRouter, Depends, HTTPException

from backend.models.account import EVENTS, User
from backend.services.auth import current_user
from backend.services.cube_catalog import models_for_event

router = APIRouter(prefix="/api/cube-models", tags=["cube models"])


@router.get("")
def cube_models(event: str, user: User = Depends(current_user)):
    if event not in EVENTS:
        raise HTTPException(422, "event unavailable")
    return models_for_event(event)
