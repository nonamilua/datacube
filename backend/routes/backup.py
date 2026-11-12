from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlmodel import Session

from backend.database import get_session
from backend.models.account import User
from backend.models.backup import NativeBackup, RestoreResult
from backend.models.solve_import import IMPORT_BYTES
from backend.services.backup import export_backup, restore_backup
from backend.services.rate_limits import bulk_user

router = APIRouter(prefix="/api/solves", tags=["solves"])


async def read_native_body(request: Request) -> bytes:
    return await request.body()


def read_backup(content: bytes = Depends(read_native_body)) -> NativeBackup:
    try:
        return NativeBackup.model_validate_json(content.removeprefix(b"\xef\xbb\xbf"))
    except ValidationError as error:
        # Large files go directly to this endpoint for format detection. Keep the
        # legacy size error for files that do not identify themselves as Datacube.
        if len(content) > IMPORT_BYTES and any(
            item["loc"] == ("format",) or item["type"] == "json_invalid"
            for item in error.errors(include_input=False, include_context=False, include_url=False)
        ):
            raise HTTPException(413, "file exceeds 10 mib") from None
        raise HTTPException(422, "invalid datacube backup") from None


@router.get("/backup", response_model=NativeBackup)
def download_backup(response: Response, user: User = Depends(bulk_user), session: Session = Depends(get_session)):
    response.headers["Content-Disposition"] = f'attachment; filename="datacube-backup-{user.username}.json"'
    response.headers["Cache-Control"] = "no-store"
    return export_backup(session, user.id)


@router.post("/restore/preview", response_model=RestoreResult)
def preview_restore(user: User = Depends(bulk_user), backup: NativeBackup = Depends(read_backup), session: Session = Depends(get_session)):
    return restore_backup(session, user.id, backup, preview=True)


@router.post("/restore", response_model=RestoreResult)
def save_restore(user: User = Depends(bulk_user), backup: NativeBackup = Depends(read_backup), session: Session = Depends(get_session)):
    for attempt in range(2):
        try:
            return restore_backup(session, user.id, backup)
        except IntegrityError:
            session.rollback()
            if attempt:
                raise HTTPException(503, "import unavailable try again") from None
        except OperationalError:
            session.rollback()
            raise HTTPException(503, "import unavailable try again") from None
