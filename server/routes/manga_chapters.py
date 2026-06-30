from fastapi import APIRouter, HTTPException, Request
from ..db import get_db
from typing import Optional

router = APIRouter(prefix="/api/manga-chapters", tags=["manga-chapters"])

def get_current_user_id(request: Request):
    username = request.cookies.get("username")
    if not username:
        return None
    db = get_db()
    user = db.get_one("SELECT id FROM users WHERE username = ?", [username])
    return user['id'] if user else None

def check_moderator(request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Доступ заборонено")

@router.get("/{chapter_id}")
async def get_chapter_detail(chapter_id: int, request: Request):
    db = get_db()
    
    chapter = db.get_one(
        """
        SELECT mc.*, v.name as volume_name, v.name_uk as volume_name_uk, 'manga_chapter' as type
        FROM manga_chapters mc
        JOIN volumes v ON mc.volume_id = v.id
        WHERE mc.id = ?
        """,
        [chapter_id],
    )
    if not chapter:
        raise HTTPException(status_code=404, detail="Розділ не знайдено")

    # Отримуємо появи персонажів
    characters = db.get_all(
        """
        SELECT c.id, c.name, c.real_name, c.name_uk, c.real_name_uk, c.image, mcc.role
        FROM manga_chapter_characters mcc
        JOIN characters c ON mcc.character_id = c.id
        WHERE mcc.chapter_id = ?
        ORDER BY COALESCE(c.name_uk, c.name) ASC
        """,
        [chapter_id]
    )

    return {
        "chapter": dict(chapter),
        "appearances": {
            "characters": [dict(c) for c in characters]
        }
    }

@router.put("/{chapter_id}")
async def update_chapter(chapter_id: int, request: Request):
    check_moderator(request)
    db = get_db()
    
    data = await request.json()
    
    # Оновлення полів
    db.execute(
        """
        UPDATE manga_chapters
        SET name = ?, name_native = ?, name_en = ?, name_uk = ?,
            image = ?, chapter_number = ?, release_date = ?, synopsis = ?, pages = ?
        WHERE id = ?
        """,
        [
            data.get("name"),
            data.get("name_native"),
            data.get("name_en"),
            data.get("name_uk"),
            data.get("image"),
            data.get("chapter_number"),
            data.get("release_date"),
            data.get("synopsis"),
            data.get("pages"),
            chapter_id
        ]
    )
    return {"message": "Розділ успішно оновлено"}

@router.delete("/{chapter_id}")
async def delete_chapter(chapter_id: int, request: Request):
    check_moderator(request)
    db = get_db()
    db.execute("DELETE FROM manga_chapters WHERE id = ?", [chapter_id])
    return {"message": "Розділ успішно видалено"}

@router.post("/{chapter_id}/appearances")
async def add_appearance(chapter_id: int, request: Request):
    check_moderator(request)
    db = get_db()
    data = await request.json()
    character_id = data.get("character_id")
    role = data.get("role")
    
    if not character_id:
        raise HTTPException(status_code=400, detail="character_id обов'язковий")
        
    db.execute(
        "INSERT OR IGNORE INTO manga_chapter_characters (chapter_id, character_id, role) VALUES (?, ?, ?)",
        [chapter_id, character_id, role]
    )
    return {"message": "Появу додано"}

@router.delete("/{chapter_id}/appearances/{character_id}")
async def remove_appearance(chapter_id: int, character_id: int, request: Request):
    check_moderator(request)
    db = get_db()
    db.execute(
        "DELETE FROM manga_chapter_characters WHERE chapter_id = ? AND character_id = ?",
        [chapter_id, character_id]
    )
    return {"message": "Появу видалено"}

@router.get("/by-volume/{volume_id}")
async def get_chapters_by_volume(volume_id: int):
    db = get_db()
    chapters = db.get_all("""
        SELECT mc.*, 'manga_chapter' as type
        FROM manga_chapters mc
        WHERE mc.volume_id = ?
        ORDER BY CAST(mc.chapter_number AS REAL) ASC, mc.chapter_number ASC
    """, [volume_id])
    return [dict(ch) for ch in chapters]

@router.post("")
async def create_chapter(request: Request):
    check_moderator(request)
    db = get_db()
    
    data = await request.json()
    volume_id = data.get("volume_id")
    chapter_number = data.get("chapter_number")
    name = data.get("name")
    release_date = data.get("release_date")
    pages = data.get("pages")
    
    if not volume_id or chapter_number is None:
        raise HTTPException(status_code=400, detail="volume_id та chapter_number обов'язкові")
        
    volume_exists = db.get_one("SELECT 1 FROM volumes WHERE id = ?", [volume_id])
    if not volume_exists:
        raise HTTPException(status_code=404, detail="Том не знайдено")
        
    cursor = db.conn.execute(
        """
        INSERT INTO manga_chapters (volume_id, chapter_number, name, release_date, pages)
        VALUES (?, ?, ?, ?, ?)
        """,
        [volume_id, str(chapter_number), name, release_date, pages]
    )
    db.conn.commit()
    
    new_id = cursor.lastrowid
    
    return {
        "message": "Розділ успішно створено",
        "id": new_id,
        "volume_id": volume_id,
        "chapter_number": chapter_number,
        "name": name,
        "release_date": release_date,
        "pages": pages
    }
