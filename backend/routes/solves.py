from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from datetime import timezone
from pydantic import AwareDatetime
from sqlalchemy import and_, func, or_
from uuid import UUID
from sqlmodel import Session, select

from backend.database import get_session
from backend.models.solve import HistoryCursor, HistoryPage, Solve, SolveCreate, SolvePage, SolveRead, SolveUpdate
from backend.models.account import Category, Cube, User
from backend.services.auth import current_user
from backend.services.cube_catalog import catalog_event, find_model
from backend.services.owned_cubes import resolve_cube

router = APIRouter(prefix="/api/solves", tags=["solves"])


@router.post("", response_model=SolveRead, status_code=201)
def save_solve(data: SolveCreate, request: Request, response: Response, user: User = Depends(current_user), session: Session = Depends(get_session)):
    # This is only a stale-account guard; ownership always comes from the session.
    if request.headers.get("x-namicubes-account") != str(user.id):
        raise HTTPException(409, "account changed sign in again")
    category = None
    if data.category_id is not None:
        category = session.get(Category, data.category_id)
        if not category or category.user_id != user.id:
            raise HTTPException(404, "event unavailable")
    cube_name = (data.cube_name or "").strip().lower()
    model_event = None
    if data.cube_model_id is not None:
        if not cube_name or not category or not find_model(category.name, data.cube_model_id):
            raise HTTPException(422, "cube model unavailable")
        model_event = catalog_event(category.name)
    existing = session.get(Solve, data.id)
    if existing:
        if existing.user_id != user.id:
            raise HTTPException(409, "solve id already used")
        cube = session.get(Cube, existing.cube_id) if existing.cube_id else None
        saved = SolveRead.model_validate(existing)
        # Older queued requests have no model ID even after their cube is linked.
        model_changed = data.cube_model_id is not None and (not cube or cube.catalog_model_id != data.cube_model_id)
        custom_changed = "custom" in data.model_fields_set and saved.custom != data.custom
        if model_changed or custom_changed or (saved.duration_ms, saved.started_at, saved.penalty, saved.category_id, cube.name if cube else "", saved.scramble) != (data.duration_ms, data.started_at, data.penalty, data.category_id, cube_name, data.scramble):
            raise HTTPException(409, "solve id already used")
        response.status_code = 200
        return saved
    cube = resolve_cube(session,user.id,cube_name,model_event,data.cube_model_id) if cube_name else None
    solve = Solve(id=data.id, duration_ms=data.duration_ms, started_at=data.started_at, penalty=data.penalty, user_id=user.id, category_id=data.category_id, cube_id=cube.id if cube else None, scramble=data.scramble, custom=data.custom)
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


@router.get("/history", response_model=HistoryPage)
def history_solves(
    limit: int = Query(50, ge=1, le=50),
    cursor_started_at: AwareDatetime | None = None,
    cursor_id: UUID | None = None,
    started_from: AwareDatetime | None = None,
    started_before: AwareDatetime | None = None,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if (cursor_started_at is None) != (cursor_id is None):
        raise HTTPException(422, "invalid history cursor")
    if started_from and started_before and started_from >= started_before:
        raise HTTPException(422, "check dates")
    query = select(Solve).where(Solve.user_id == user.id)
    if started_from:
        query = query.where(Solve.started_at >= started_from.astimezone(timezone.utc))
    if started_before:
        query = query.where(Solve.started_at < started_before.astimezone(timezone.utc))
    if cursor_started_at:
        timestamp = cursor_started_at.astimezone(timezone.utc)
        query = query.where(or_(Solve.started_at < timestamp, and_(Solve.started_at == timestamp, Solve.id < cursor_id)))
    records = session.exec(query.order_by(Solve.started_at.desc(), Solve.id.desc()).limit(limit + 1)).all()
    items = [SolveRead.model_validate(solve) for solve in records[:limit]]
    cursor = HistoryCursor(started_at=items[-1].started_at, id=items[-1].id) if len(records) > limit else None
    return HistoryPage(items=items, next_cursor=cursor)


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
