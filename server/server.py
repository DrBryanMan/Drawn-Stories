import os
import sys
import time
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.db import init_db, close_db
from server.routes import stats, catalog, volumes, publishers, themes, auth, user_readlist, favorites, collections, issues, events, reading_orders, images, characters, personnel, scrape

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB and show status
    init_db()
    print("[Server] Server successfully started and ready to accept connections")
    yield
    # Shutdown: Close DB
    close_db()
    print("[Server] Server stopped")

app = FastAPI(title="Drawn Stories API", lifespan=lifespan)

# ── Custom Request Logger Middleware ─────────────────
def should_log_request(path: str, accept_header: str) -> bool:
    # Always log API requests
    if path.startswith("/api/"):
        return True
    # Log page requests (SPA routes usually accept text/html)
    if "text/html" in accept_header:
        return True
    # Exclude common static file extensions
    exts = (".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".json", ".map")
    if any(path.endswith(ext) for ext in exts):
        return False
    # Exclude static/images/admin paths that aren't page loads
    if path.startswith(("/static/", "/images/")):
        return False
    return True

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start_time) * 1000
    
    path = request.url.path
    accept = request.headers.get("accept", "")
    
    if should_log_request(path, accept):
        client_host = request.client.host if request.client else "unknown"
        time_str = datetime.now().strftime("%H:%M:%S")
        print(f"[{time_str}] {client_host} - {request.method} {path} -> {response.status_code} ({duration_ms:.1f}ms)")
        
    return response

# ── Paths ───────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
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
app.include_router(collections.router)
app.include_router(issues.router)
app.include_router(events.router)
app.include_router(reading_orders.router)
app.include_router(images.router)
app.include_router(characters.router)
app.include_router(personnel.router)
app.include_router(scrape.router)

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# ── Static files & SPA fallback ──────────────────────
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/admin", StaticFiles(directory=os.path.join(BASE_DIR, "admin")), name="admin")
app.mount("/images", StaticFiles(directory=os.path.join(SERVER_DIR, "images")), name="images")

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
    print("[Server] Starting Drawn Stories API server on http://localhost:8000 ...")
    uvicorn.run(app, host="0.0.0.0", port=8000, access_log=False, log_level="warning")
