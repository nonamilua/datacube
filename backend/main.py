from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from backend.routes.solves import router
from backend.routes.auth import router as auth_router
from backend.routes.organization import router as organization_router

app = FastAPI(title="namicubes")
app.include_router(router)
app.include_router(auth_router)
app.include_router(organization_router)


@app.middleware("http")
async def protect_writes(request: Request, call_next):
    # Cross-origin sites cannot send this header without a CORS preflight.
    # No cross-origin access is enabled; Vite proxies same-origin requests.
    if request.url.path.startswith("/api/") and request.method not in ("GET", "HEAD", "OPTIONS"):
        if request.headers.get("x-namicubes-request") != "1":
            return JSONResponse({"detail": "request header required"}, status_code=403)
    return await call_next(request)
