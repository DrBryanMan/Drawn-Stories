import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.db import init_db, close_db
from server.routes import stats, catalog, volumes, publishers, themes, auth, user_readlist, favorites

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB
    init_db()
    yield
    # Shutdown: Close DB
    close_db()

app = FastAPI(title="Drawn Stories API", lifespan=lifespan)

# ── Paths ───────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "public", "src")

# ── Routes ──────────────────────────────────────────
app.include_router(stats.router)
app.include_router(catalog.router)
app.include_router(volumes.router)
app.include_router(publishers.router)
app.include_router(themes.router)
app.include_router(auth.router)
app.include_router(user_readlist.router)
app.include_router(favorites.router)

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# ── Static files & SPA fallback ──────────────────────
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/admin", StaticFiles(directory=os.path.join(BASE_DIR, "admin")), name="admin")

@app.get("/{full_path:path}")
async def read_index(request: Request, full_path: str):
    # Only serve index.html for HTML requests (SPA fallback)
    if "text/html" in request.headers.get("accept", ""):
        index_path = os.path.join(BASE_DIR, "public", "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
    return Response(status_code=404)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
