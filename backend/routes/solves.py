from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func
from sqlmodel import Session, select

from backend.database import get_session
from backend.models.solve import Solve, SolveCreate, SolvePage, SolveRead

router = APIRouter(prefix="/api/solves", tags=["solves"])


@router.post("", response_model=SolveRead, status_code=201)
def save_solve(data: SolveCreate, response: Response, session: Session = Depends(get_session)):
    existing = session.get(Solve, data.id)
    if existing:
        saved = SolveRead.model_validate(existing)
        if (saved.duration_ms, saved.started_at, saved.penalty) != (data.duration_ms, data.started_at, data.penalty):
            raise HTTPException(409, "solve id already used")
        response.status_code = 200
        return saved
    solve = Solve.model_validate(data)
    session.add(solve)
    session.commit()
    session.refresh(solve)
    return SolveRead.model_validate(solve)


@router.get("", response_model=SolvePage)
def list_solves(limit: int = Query(10, ge=1, le=100), offset: int = Query(0, ge=0), session: Session = Depends(get_session)):
    solves = session.exec(select(Solve).order_by(Solve.started_at.desc(), Solve.id.desc()).offset(offset).limit(limit)).all()
    total = session.exec(select(func.count()).select_from(Solve)).one()
    return SolvePage(items=[SolveRead.model_validate(solve) for solve in solves], total=total)
