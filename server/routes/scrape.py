import asyncio
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from ..db import get_db
from server.services.appearances import create_scraper_instance, scrape_issue_appearances_logic, scrape_volume_appearances_logic

router = APIRouter(prefix="/api/scrape", tags=["scrape"])

def require_moderator(request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")

@router.get("/issue/{issue_id}")
async def scrape_issue_appearances(issue_id: int, request: Request, _ = Depends(require_moderator)):
    db = get_db()
    queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def log_callback(msg: str):
        loop.call_soon_threadsafe(queue.put_nowait, msg)

    async def event_generator():
        scraper = create_scraper_instance()
        
        # Run synchronous scraping in a separate thread to prevent blocking the event loop
        task = asyncio.create_task(
            asyncio.to_thread(
                scrape_issue_appearances_logic,
                db, scraper, issue_id, log_callback
            )
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
            yield "data: [DONE] Парсинг завершено успішно!\n\n"
        else:
            yield "data: [ERROR] Помилка під час парсингу випуску.\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/volume/{volume_id}")
async def scrape_volume_appearances(volume_id: int, request: Request, _ = Depends(require_moderator)):
    db = get_db()
    queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def log_callback(msg: str):
        loop.call_soon_threadsafe(queue.put_nowait, msg)

    async def event_generator():
        scraper = create_scraper_instance()
        
        # Run synchronous scraping in a separate thread to prevent blocking the event loop
        task = asyncio.create_task(
            asyncio.to_thread(
                scrape_volume_appearances_logic,
                db, scraper, volume_id, log_callback
            )
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
            yield "data: [DONE] Парсинг тому завершено успішно!\n\n"
        else:
            yield "data: [ERROR] Помилка під час парсингу тому.\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
