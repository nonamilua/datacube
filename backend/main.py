from fastapi import FastAPI

from backend.routes.solves import router

app = FastAPI(title="namicubes")
app.include_router(router)
