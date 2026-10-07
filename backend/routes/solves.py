from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func
from uuid import UUID
from sqlmodel import Session, select

from backend.database import get_session
from backend.models.solve import Solve, SolveCreate, SolvePage, SolveRead, SolveUpdate
from backend.models.account import Category, Cube, User
from backend.services.auth import current_user

router = APIRouter(prefix="/api/solves", tags=["solves"])


@router.post("", response_model=SolveRead, status_code=201)
def save_solve(data: SolveCreate, request: Request, response: Response, user: User = Depends(current_user), session: Session = Depends(get_session)):
    # This is only a stale-account guard; ownership always comes from the session.
    if request.headers.get("x-namicubes-account") != str(user.id):
        raise HTTPException(409, "account changed sign in again")
    if data.category_id is not None:
        category = session.get(Category, data.category_id)
        if not category or category.user_id != user.id:
            raise HTTPException(404, "event unavailable")
    cube_name = (data.cube_name or "").strip().lower()
    existing = session.get(Solve, data.id)
    if existing:
        if existing.user_id != user.id:
            raise HTTPException(409, "solve id already used")
        cube = session.get(Cube, existing.cube_id) if existing.cube_id else None
        saved = SolveRead.model_validate(existing)
        if (saved.duration_ms, saved.started_at, saved.penalty, saved.category_id, cube.name if cube else "", saved.scramble) != (data.duration_ms, data.started_at, data.penalty, data.category_id, cube_name, data.scramble):
            raise HTTPException(409, "solve id already used")
        response.status_code = 200
        return saved
    cube = session.exec(select(Cube).where(Cube.user_id == user.id, Cube.name == cube_name)).first() if cube_name else None
    if cube_name and not cube:
        cube = Cube(user_id=user.id, name=cube_name)
        session.add(cube)
        session.flush()
    solve = Solve(id=data.id, duration_ms=data.duration_ms, started_at=data.started_at, penalty=data.penalty, user_id=user.id, category_id=data.category_id, cube_id=cube.id if cube else None, scramble=data.scramble)
    session.add(solve)
    session.commit()
    session.refresh(solve)
    return SolveRead.model_validate(solve)


@router.get("", response_model=SolvePage)
def list_solves(limit: int = Query(10, ge=1, le=100), offset: int = Query(0, ge=0), user: User = Depends(current_user), session: Session = Depends(get_session)):
    solves = session.exec(select(Solve).where(Solve.user_id == user.id).order_by(Solve.started_at.desc(), Solve.id.desc()).offset(offset).limit(limit)).all()
    total = session.exec(select(func.count()).select_from(Solve).where(Solve.user_id == user.id)).one()
    return SolvePage(items=[SolveRead.model_validate(solve) for solve in solves], total=total)


@router.get("/all", response_model=SolvePage)
def all_solves(user: User = Depends(current_user), session: Session = Depends(get_session)):
    solves = session.exec(select(Solve).where(Solve.user_id == user.id).order_by(Solve.started_at.desc(), Solve.id.desc())).all()
    return SolvePage(items=[SolveRead.model_validate(solve) for solve in solves], total=len(solves))


@router.delete("/{solve_id}", status_code=204)
def delete_solve(solve_id: UUID, request: Request, user: User = Depends(current_user), session: Session = Depends(get_session)):
    if request.headers.get("x-namicubes-account") != str(user.id):
        raise HTTPException(409, "account changed sign in again")
    solve = session.exec(select(Solve).where(Solve.id == solve_id, Solve.user_id == user.id)).first()
    if not solve:
        raise HTTPException(404, "solve unavailable")
    session.delete(solve)
    session.commit()


@router.patch("/{solve_id}", response_model=SolveRead)
def update_solve(solve_id: UUID, data: SolveUpdate, request: Request, user: User = Depends(current_user), session: Session = Depends(get_session)):
    if request.headers.get("x-namicubes-account") != str(user.id):
        raise HTTPException(409, "account changed sign in again")
    solve = session.exec(select(Solve).where(Solve.id == solve_id, Solve.user_id == user.id)).first()
    if not solve:
        raise HTTPException(404, "solve unavailable")
    solve.penalty = data.penalty
    if "custom" in data.model_fields_set:
        solve.custom = data.custom
    session.add(solve)
    session.commit()
    session.refresh(solve)
    return SolveRead.model_validate(solve)
