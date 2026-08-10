import os
import sys
import re
import asyncio
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter(prefix="/api/parser", tags=["parser"])

# ── Авторизація модератора ───────────────────────────────────────────────────
def require_moderator(request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")

# ── Моделі запитів ────────────────────────────────────────────────────────────
class ParserCVRequest(BaseModel):
    cv_id: int = Field(..., gt=0, description="ComicVine ID (має бути більше 0)")

class ParserCVVolRequest(BaseModel):
    cv_vol_id: int = Field(..., gt=0, description="ComicVine Volume ID (має бути більше 0)")

class ParserSlugRequest(BaseModel):
    slug: str = Field(..., min_length=1, description="Слаґ або посилання на сторінку")

# ── Допоміжні функції ────────────────────────────────────────────────────────
def strip_ansi_codes(text: str) -> str:
    """Видаляє ANSI escape-коди кольорів з тексту."""
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    return ansi_escape.sub('', text)

def is_meaningful(line: str) -> bool:
    """Перевіряє, чи є рядок змістовним (не є пустотою чи лінією розділювачем)."""
    val = line.strip()
    if not val:
        return False
    # Рядки, які повністю складаються з розділювачів, рамок або зірочок
    if re.match(r'^[─═┌└│┐┘├┤┬┴┼\s\-\=\*]+$', val):
        return False
    return True

def extract_cv_id(slug_or_url: str) -> Optional[int]:
    """Витягує числове ID з ComicVine слага або посилання."""
    val = slug_or_url.strip()
    if not val:
        return None
    if val.isdigit():
        return int(val)
    
    # 4005-XXXX або 4040-XXXX
    match = re.search(r'(?:4005|4040)-(\d+)', val)
    if match:
        return int(match.group(1))
        
    # /characters/XXXX/ або /people/XXXX/
    match = re.search(r'/(?:characters|people|volume|issue)/(\d+)/?$', val)
    if match:
        return int(match.group(1))
        
    # /XXXX/ в кінці посилання
    match = re.search(r'/(\d+)/?$', val)
    if match:
        return int(match.group(1))
        
    # -XXXX в кінці
    match = re.search(r'-(\d+)/?$', val)
    if match:
        return int(match.group(1))
        
    return None

def extract_hikka_slug(slug_or_url: str) -> str:
    """Витягує слаґ з Hikka посилання або повертає слаґ як є."""
    val = slug_or_url.strip()
    # Приклад: https://hikka.io/manga/berserk-fb9fbd/chapters або подібне
    match = re.search(r'/manga/([^/]+)', val)
    if match:
        return match.group(1)
    return val

async def run_parser_script(script_name: str, args: list) -> dict:
    """Запускає локальний скрипт парсингу асинхронно та аналізує stdout."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    script_path = os.path.abspath(os.path.join(script_dir, "..", "scripts", script_name))
    
    if not os.path.exists(script_path):
        return {"ok": False, "message": f"Скрипт {script_name} не знайдено на сервері."}
        
    db_path = os.path.abspath(os.path.join(script_dir, "..", "comicsdb.db"))
    
    # Створюємо команду запуску через той самий інтерпретатор
    cmd = [sys.executable, script_path] + args + ["--db", db_path]
    
    print(f"[parser] Running: {' '.join(cmd)}")
    
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        
        stdout_bytes, stderr_bytes = await process.communicate()
        
        stdout = stdout_bytes.decode('utf-8', errors='replace')
        stderr = stderr_bytes.decode('utf-8', errors='replace')
        
        print(f"[parser] Exit code: {process.returncode}")
        
        # Очищаємо весь stdout від ANSI-кодів та фільтруємо незмістовні лінії
        clean_lines = []
        for line in stdout.split('\n'):
            cleaned = strip_ansi_codes(line).strip()
            if is_meaningful(cleaned):
                clean_lines.append(cleaned)
        
        log_output = "\n".join(clean_lines)
        
        if process.returncode == 0:
            return {"ok": True, "message": log_output or "Виконано успішно."}
        else:
            # Перевіряємо специфічні помилки
            if "вже є в базі" in stdout or "Вже існує" in stdout or "вже присутня" in stdout or "already exists" in stdout.lower():
                return {"ok": False, "message": log_output or "Цей запис вже є в базі даних."}
            if "не знайдено" in stdout or "not found" in stdout.lower():
                return {"ok": False, "message": log_output or "Запис не знайдено на ComicVine/Hikka."}
                
            err_msg = log_output
            if not err_msg:
                err_lines = [strip_ansi_codes(line).strip() for line in stderr.split('\n') if line.strip()]
                err_msg = "\n".join([l for l in err_lines if is_meaningful(l)])
                if not err_msg:
                    err_msg = "Невідома помилка під час виконання скрипта."
                
            return {"ok": False, "message": err_msg}
            
    except Exception as e:
        print(f"[parser] Subprocess exception: {e}")
        return {"ok": False, "message": f"Виняток сервера: {str(e)}"}

# ── POST /api/parser/add-issue ────────────────────────────────────────────────
@router.post("/add-issue", dependencies=[Depends(require_moderator)])
async def add_issue(req: ParserCVRequest):
    res = await run_parser_script("add_parser.py", ["issue", str(req.cv_id)])
    if not res["ok"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res

# ── POST /api/parser/add-volume ───────────────────────────────────────────────
@router.post("/add-volume", dependencies=[Depends(require_moderator)])
async def add_volume(req: ParserCVRequest):
    res = await run_parser_script("add_parser.py", ["volume", str(req.cv_id)])
    if not res["ok"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res

# ── POST /api/parser/add-volume-issues ────────────────────────────────────────
@router.post("/add-volume-issues", dependencies=[Depends(require_moderator)])
async def add_volume_issues(req: ParserCVVolRequest):
    res = await run_parser_script("add_parser.py", ["volume-issues", str(req.cv_vol_id)])
    if not res["ok"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res

# ── POST /api/parser/add-manga ────────────────────────────────────────────────
@router.post("/add-manga", dependencies=[Depends(require_moderator)])
async def add_manga(req: ParserSlugRequest):
    manga_slug = extract_hikka_slug(req.slug)
    if not manga_slug:
        raise HTTPException(status_code=400, detail="Некоректний слаґ або посилання Hikka.")
    
    res = await run_parser_script("hikka_manga_parser.py", ["slug", manga_slug])
    if not res["ok"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res

# ── POST /api/parser/add-character ────────────────────────────────────────────
@router.post("/add-character", dependencies=[Depends(require_moderator)])
async def add_character(req: ParserSlugRequest):
    cv_id = extract_cv_id(req.slug)
    if cv_id is None:
        raise HTTPException(status_code=400, detail="Не вдалося розпізнати ComicVine ID персонажа.")
        
    res = await run_parser_script("cv_characters_api_parser.py", ["--id", str(cv_id)])
    if not res["ok"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res

# ── POST /api/parser/add-person ───────────────────────────────────────────────
@router.post("/add-person", dependencies=[Depends(require_moderator)])
async def add_person(req: ParserSlugRequest):
    cv_id = extract_cv_id(req.slug)
    if cv_id is None:
        raise HTTPException(status_code=400, detail="Не вдалося розпізнати ComicVine ID персони.")
        
    res = await run_parser_script("cv_persons_api_parser.py", ["--id", str(cv_id)])
    if not res["ok"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res

# ── POST /api/parser/add-publisher-volumes ────────────────────────────────────
@router.post("/add-publisher-volumes", dependencies=[Depends(require_moderator)])
async def add_publisher_volumes(req: ParserCVRequest):
    res = await run_parser_script("cv_publisher_volumes_scrapper.py", ["--publisher-id", str(req.cv_id)])
    if not res["ok"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res

# ── POST /api/parser/update-manga-meta ─────────────────────────────────────────
@router.post("/update-manga-meta", dependencies=[Depends(require_moderator)])
async def update_manga_meta():
    res = await run_parser_script("update_manga_scores_and_names.py", [])
    if not res["ok"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res

# ── GET /api/parser/stream/update-manga-meta ──────────────────────────────────
@router.get("/stream/update-manga-meta", dependencies=[Depends(require_moderator)])
async def stream_update_manga_meta():
    async def event_generator():
        script_dir = os.path.dirname(os.path.abspath(__file__))
        script_path = os.path.abspath(os.path.join(script_dir, "..", "scripts", "update_manga_scores_and_names.py"))
        
        if not os.path.exists(script_path):
            yield "data: [ERROR] Скрипт update_manga_scores_and_names.py не знайдено.\n\n"
            return

        cmd = [sys.executable, "-u", script_path]

        env = {**os.environ, "PYTHONUNBUFFERED": "1"}

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=env
        )

        yield "data: [SYSTEM] Запуск оновлення назв та оцінок манґи...\n\n"

        while True:
            line = await process.stdout.readline()
            if not line:
                break
            decoded_line = line.decode('utf-8', errors='replace').rstrip('\r\n')
            if decoded_line:
                yield f"data: {decoded_line}\n\n"

        await process.wait()

        if process.returncode == 0:
            yield "data: [DONE] Оновлення оцінок та назв манґи успішно завершено!\n\n"
        else:
            yield f"data: [ERROR] Скрипт завершився з помилкою (код {process.returncode})\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── GET /api/parser/stream/hikka-manga/missing ─────────────────────────────────
@router.get("/stream/hikka-manga/missing", dependencies=[Depends(require_moderator)])
async def stream_hikka_manga_missing():
    async def event_generator():
        script_dir = os.path.dirname(os.path.abspath(__file__))
        script_path = os.path.abspath(os.path.join(script_dir, "..", "scripts", "hikka_manga_parser.py"))
        
        if not os.path.exists(script_path):
            yield "data: [ERROR] Скрипт hikka_manga_parser.py не знайдено.\n\n"
            return

        cmd = [sys.executable, "-u", script_path, "missing"]
        env = {**os.environ, "PYTHONUNBUFFERED": "1"}

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=env
        )

        yield "data: [SYSTEM] Запуск парсингу останніх доданих тайтлів (missing)...\n\n"

        while True:
            line = await process.stdout.readline()
            if not line:
                break
            decoded_line = line.decode('utf-8', errors='replace').rstrip('\r\n')
            if decoded_line:
                yield f"data: {decoded_line}\n\n"

        await process.wait()

        if process.returncode == 0:
            yield "data: [DONE] Парсинг нових тайтлів успішно завершено!\n\n"
        else:
            yield f"data: [ERROR] Скрипт завершився з помилкою (код {process.returncode})\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── GET /api/parser/stream/hikka-manga/ongoing ─────────────────────────────────
@router.get("/stream/hikka-manga/ongoing", dependencies=[Depends(require_moderator)])
async def stream_hikka_manga_ongoing():
    async def event_generator():
        script_dir = os.path.dirname(os.path.abspath(__file__))
        script_path = os.path.abspath(os.path.join(script_dir, "..", "scripts", "hikka_manga_parser.py"))
        
        if not os.path.exists(script_path):
            yield "data: [ERROR] Скрипт hikka_manga_parser.py не знайдено.\n\n"
            return

        cmd = [sys.executable, "-u", script_path, "ongoing"]
        env = {**os.environ, "PYTHONUNBUFFERED": "1"}

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=env
        )

        yield "data: [SYSTEM] Запуск перевірки онгоінгів у базі...\n\n"

        while True:
            line = await process.stdout.readline()
            if not line:
                break
            decoded_line = line.decode('utf-8', errors='replace').rstrip('\r\n')
            if decoded_line:
                yield f"data: {decoded_line}\n\n"

        await process.wait()

        if process.returncode == 0:
            yield "data: [DONE] Перевірку онгоінгів успішно завершено!\n\n"
        else:
            yield f"data: [ERROR] Скрипт завершився з помилкою (код {process.returncode})\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")




