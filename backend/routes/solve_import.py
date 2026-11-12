from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlmodel import Session

from backend.database import get_session
from backend.models.account import User
from backend.models.solve_import import IMPORT_BYTES, ImportResult, SolveImport
from backend.services.rate_limits import bulk_user
from backend.services.solve_import import persist_import

router = APIRouter(prefix="/api/solves", tags=["solves"])


async def read_import_body(request: Request) -> bytes:
    content = bytearray()
    async for chunk in request.stream():
        if len(content) + len(chunk) > IMPORT_BYTES:
            raise HTTPException(413, "file exceeds 10 mib")
        content.extend(chunk)
    return bytes(content)


async def read_import(content: bytes = Depends(read_import_body)) -> SolveImport:
    try:
        return SolveImport.model_validate_json(content)
    except ValueError:
        raise HTTPException(422, "invalid import data") from None


@router.post("/import", response_model=ImportResult)
def import_solves(user: User = Depends(bulk_user), data: SolveImport = Depends(read_import), session: Session = Depends(get_session)):
    for attempt in range(2):
        try:
            return persist_import(session, user.id, data)
        except IntegrityError:
            # Concurrent identical imports can race on stable IDs or cube creation.
            # Roll back the entire attempt, then inspect the newly committed rows.
            session.rollback()
            if attempt:
                raise HTTPException(503, "import unavailable try again") from None
        except OperationalError:
            session.rollback()
            raise HTTPException(503, "import unavailable try again") from None
        except Exception:
            session.rollback()
            raise
