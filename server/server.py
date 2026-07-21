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
from server.routes import stats, catalog, volumes, publishers, themes, auth, user_readlist, favorites, collections, issues, events, reading_orders, images, characters, personnel, scrape, wanted, magazines, manga_chapters, parser, edits, ratings, earths, essences
# Monkey patch Starlette Request to automatically decode URL-encoded username cookie
import urllib.parse
original_cookies_property = Request.cookies

@property
def patched_cookies(self) -> dict[str, str]:
    if not hasattr(self, "_cookies"):
        # Отримуємо оригінальний розпарсений словник кук
        cookies_header = self.headers.get("cookie", "")
        # Викликаємо оригінальний механізм парсингу
        cookies_dict = original_cookies_property.__get__(self)
        if cookies_dict and "username" in cookies_dict:
            try:
                cookies_dict["username"] = urllib.parse.unquote(cookies_dict["username"])
            except Exception:
                pass
        self._cookies = cookies_dict
    return self._cookies

Request.cookies = patched_cookies

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB and show status
    init_db()
    print("\033[92m[Сервер] Базу даних ініціалізовано, сервер успішно запущено і готовий приймати підключення\033[0m")
    yield
    # Shutdown: Close DB
    close_db()
    print("\033[93m[Сервер] Роботу сервера завершено\033[0m")

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
        
        # Color codes
        grey = "\033[90m"
        cyan = "\033[36m"
        reset = "\033[0m"
        white = "\033[97m"
        magenta = "\033[35m"
        
        # Method color
        method_colors = {
            "GET": "\033[92m",      # Green
            "POST": "\033[94m",     # Blue
            "PUT": "\033[93m",      # Yellow
            "PATCH": "\033[33m",     # Orange/Brown
            "DELETE": "\033[91m",    # Red
        }
        method_color = method_colors.get(request.method, white)
        
        # Status code color
        status = response.status_code
        if 200 <= status < 300:
            status_color = "\033[92m"  # Green
        elif 300 <= status < 400:
            status_color = "\033[36m"  # Cyan
        elif 400 <= status < 500:
            status_color = "\033[93m"  # Yellow
        else:
            status_color = "\033[91m"  # Red
            
        print(
            f"{grey}[{time_str}]{reset} "
            f"{cyan}{client_host:15}{reset} | "
            f"{method_color}{request.method:<6}{reset} "
            f"{white}{path}{reset} -> "
            f"{status_color}{status}{reset} "
            f"{grey}({duration_ms:.1f}ms){reset}"
        )
        
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
app.include_router(wanted.router)
app.include_router(magazines.router)
app.include_router(manga_chapters.router)
app.include_router(parser.router)
app.include_router(edits.router)
app.include_router(ratings.router)
app.include_router(earths.router)
app.include_router(essences.router)

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# ── Static files & SPA fallback ──────────────────────
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/admin", StaticFiles(directory=os.path.join(BASE_DIR, "admin")), name="admin")
app.mount("/images", StaticFiles(directory=os.path.join(SERVER_DIR, "images")), name="images")

# ── Favicon & PWA icons ──────────────────────────────
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

_STATIC_FILES = {
    "favicon.ico":        "image/x-icon",
    "apple-touch-icon.png": "image/png",
    "icon-192.png":       "image/png",
    "icon-512.png":       "image/png",
    "logo.png":           "image/png",
}

@app.get("/favicon.ico", include_in_schema=False)
@app.get("/apple-touch-icon.png", include_in_schema=False)
@app.get("/icon-192.png", include_in_schema=False)
@app.get("/icon-512.png", include_in_schema=False)
@app.get("/logo.png", include_in_schema=False)
async def serve_public_static(request: Request):
    filename = request.url.path.lstrip("/")
    media_type = _STATIC_FILES.get(filename, "application/octet-stream")
    file_path = os.path.join(PUBLIC_DIR, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type=media_type)
    return Response(status_code=404)

@app.get("/wanted")
async def read_wanted(request: Request):
    # Serve the standalone wanted.html page
    if "text/html" in request.headers.get("accept", ""):
        wanted_path = os.path.join(BASE_DIR, "public", "wanted.html")
        if os.path.exists(wanted_path):
            return FileResponse(wanted_path)
    return Response(status_code=404)

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
    import asyncio
    import sys
    import warnings

    if sys.platform == "win32":
        # Enable virtual terminal processing (ANSI escape codes) in Windows CMD/PowerShell
        import os
        os.system("")
        # Fix Ctrl+C hang by switching to SelectorEventLoop on Windows (suppress Python 3.12+ deprecation warnings)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=DeprecationWarning)
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    print("\033[96m[Сервер] Запуск сервера Drawn Stories API на http://localhost:8000 ...\033[0m")
    try:
        uvicorn.run(app, host="0.0.0.0", port=8000, access_log=False, log_level="warning")
    except KeyboardInterrupt:
        print("\n\033[93m[Сервер] Сервер зупинено користувачем (KeyboardInterrupt)\033[0m")
