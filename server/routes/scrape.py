import asyncio
import json
import os
from typing import Callable, Any, Optional
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from ..db import get_db
from server.services.appearances import (
    create_scraper_instance,
    scrape_issue_appearances_logic,
    scrape_volume_appearances_logic,
    scrape_hikka_characters_logic,
    scrape_hikka_authors_logic,
    scrape_character_images_logic,
)

router = APIRouter(prefix="/api/scrape", tags=["scrape"])

def require_moderator(request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")


_PROGRESS_FILE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "scripts", "cv_issue_appearances_progress.json")
)


def _remove_issue_from_failed(issue_id: int) -> None:
    """Видаляє issue_id зі списку failed_issue_ids у файлі прогресу CLI-скрапера."""
    try:
        if not os.path.exists(_PROGRESS_FILE):
            return
        with open(_PROGRESS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        failed: list = data.get('failed_issue_ids', [])
        if issue_id not in failed:
            return
        failed.remove(issue_id)
        data['failed_issue_ids'] = failed
        tmp = _PROGRESS_FILE + ".tmp"
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp, _PROGRESS_FILE)
    except Exception:
        pass  # не критично, якщо файл відсутній або пошкоджений

def stream_scrape_sse(
    target_fn: Callable[..., bool],
    *args: Any,
    success_msg: str,
    error_msg: str,
    on_success: Optional[Callable] = None,
) -> StreamingResponse:
    """Утиліта для стрімінгу виводу синхронних скрапінг-функцій через SSE."""
    queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def log_callback(msg: str):
        loop.call_soon_threadsafe(queue.put_nowait, msg)

    async def event_generator():
        task = asyncio.create_task(
            asyncio.to_thread(target_fn, *args, log_callback)
        )

        while not task.done() or not queue.empty():
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=0.5)
                yield f"data: {msg}\n\n"
                queue.task_done()
            except asyncio.TimeoutError:
                # keep-alive comment to keep connection active
                yield ": keep-alive\n\n"

        result = task.result()
        if result:
            if on_success:
                on_success()
            yield f"data: [DONE] {success_msg}\n\n"
        else:
            yield f"data: [ERROR] {error_msg}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/issue/{issue_id}")
async def scrape_issue_appearances(issue_id: int, request: Request, _ = Depends(require_moderator)):
    db = get_db()
    scraper = create_scraper_instance()
    return stream_scrape_sse(
        scrape_issue_appearances_logic,
        db, scraper, issue_id,
        success_msg="Парсинг випуску завершено успішно!",
        error_msg="Помилка під час парсингу випуску.",
        on_success=lambda: _remove_issue_from_failed(issue_id),
    )

@router.get("/volume/{volume_id}")
async def scrape_volume_appearances(volume_id: int, request: Request, _ = Depends(require_moderator)):
    db = get_db()
    scraper = create_scraper_instance()
    return stream_scrape_sse(
        scrape_volume_appearances_logic,
        db, scraper, volume_id,
        success_msg="Парсинг тому завершено успішно!",
        error_msg="Помилка під час парсингу тому."
    )

@router.get("/manga-characters/{volume_id}")
async def scrape_manga_characters(volume_id: int, request: Request, _ = Depends(require_moderator)):
    db = get_db()
    return stream_scrape_sse(
        scrape_hikka_characters_logic,
        db, volume_id,
        success_msg="Парсинг персонажів успішно завершено!",
        error_msg="Помилка під час парсингу персонажів."
    )

@router.get("/manga-authors/{volume_id}")
async def scrape_manga_authors(volume_id: int, request: Request, _ = Depends(require_moderator)):
    db = get_db()
    return stream_scrape_sse(
        scrape_hikka_authors_logic,
        db, volume_id,
        success_msg="Парсинг авторів успішно завершено!",
        error_msg="Помилка під час парсингу авторів."
    )

@router.get("/characters-images")
async def scrape_characters_images(request: Request, _ = Depends(require_moderator)):
    db = get_db()
    scraper = create_scraper_instance()
    return stream_scrape_sse(
        scrape_character_images_logic,
        db, scraper,
        success_msg="Оновлення зображень персонажів успішно завершено!",
        error_msg="Помилка під час оновлення зображень персонажів."
    )

