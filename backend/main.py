from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from backend.routes.solves import router
from backend.routes.auth import router as auth_router
from backend.routes.organization import router as organization_router
from backend.routes.cube_catalog import router as cube_catalog_router
from backend.routes.solve_import import router as import_router
from backend.routes.backup import router as backup_router
from backend.services.rate_limits import limit_auth

app = FastAPI(title="datacube")
app.include_router(router)
app.include_router(import_router)
app.include_router(backup_router)
app.include_router(auth_router)
app.include_router(organization_router)
app.include_router(cube_catalog_router)


@app.middleware("http")
async def protect_writes(request: Request, call_next):
    path = request.scope["path"].removeprefix(request.scope.get("root_path", "").rstrip("/"))
    # Cross-origin sites cannot send this header without a CORS preflight.
    # No cross-origin access is enabled; Vite proxies same-origin requests.
    if path.startswith("/api/") and request.method not in ("GET", "HEAD", "OPTIONS"):
        if request.headers.get("x-namicubes-request") != "1":
            return JSONResponse({"detail": "request header required"}, status_code=403)
    if request.method == "POST" and path in ("/api/auth/register", "/api/auth/login"):
        try:
            limit_auth(request, signup=path == "/api/auth/register")
        except HTTPException as error:
            return JSONResponse({"detail": error.detail}, status_code=error.status_code, headers=error.headers)
    return await call_next(request)
