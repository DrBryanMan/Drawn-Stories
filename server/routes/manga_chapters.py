from fastapi import APIRouter, HTTPException, Request
from ..db import get_db
from typing import Optional

router = APIRouter(prefix="/api/manga-chapters", tags=["manga-chapters"])

def get_current_user_id(request: Request):
    username = request.cookies.get("username")
    if not username:
        return None
    db = get_db()
    user = db.get_one("SELECT id FROM users WHERE username = %s", [username])
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
        WHERE mc.id = %s
        """,
        [chapter_id],
    )
    if not chapter:
        raise HTTPException(status_code=404, detail="Розділ не знайдено")

    # Навігація: попередній та наступний розділи в межах тому
    prev_chapter = None
    next_chapter = None

    if chapter.get("volume_id"):
        volume_id = chapter["volume_id"]
        siblings = db.get_all(
            """
            SELECT id, chapter_number, name, name_uk, name_en, image
            FROM manga_chapters
            WHERE volume_id = %s
            ORDER BY CASE WHEN chapter_number ~ '^[0-9]' THEN CAST(substring(chapter_number from '^[0-9]+(?:\\.[0-9]+)?') AS NUMERIC) ELSE NULL END ASC NULLS LAST, chapter_number ASC, id ASC
            """,
            [volume_id],
        )

        current_idx = next(
            (i for i, s in enumerate(siblings) if s["id"] == chapter_id), None
        )

        if current_idx is not None:
            if current_idx > 0:
                prev_chapter = dict(siblings[current_idx - 1])
            if current_idx < len(siblings) - 1:
                next_chapter = dict(siblings[current_idx + 1])

    # Отримуємо появи персонажів
    characters = db.get_all(
        """
        SELECT c.id, c.name, c.real_name, c.name_uk, c.real_name_uk, c.image, mcc.role
        FROM manga_chapter_characters mcc
        JOIN characters c ON mcc.character_id = c.id
        WHERE mcc.chapter_id = %s
        ORDER BY COALESCE(c.name_uk, c.name) ASC
        """,
        [chapter_id]
    )

    return {
        "chapter": dict(chapter),
        "prev_chapter": prev_chapter,
        "next_chapter": next_chapter,
        "appearances": {
            "characters": [dict(c) for c in characters]
        }
    }

@router.put("/{chapter_id}")
async def update_chapter(chapter_id: int, request: Request):
    check_moderator(request)
    db = get_db()
    
    data = await request.json()
    
    def to_null(val):
        return None if val == "" else val
    
    # Оновлення полів
    db.execute(
        """
        UPDATE manga_chapters
        SET name = %s, name_native = %s, name_en = %s, name_uk = %s,
            image = %s, chapter_number = %s, release_date = %s, synopsis = %s, pages = %s
        WHERE id = %s
        """,
        [
            to_null(data.get("name")),
            to_null(data.get("name_native")),
            to_null(data.get("name_en")),
            to_null(data.get("name_uk")),
            to_null(data.get("image")),
            to_null(data.get("chapter_number")),
            to_null(data.get("release_date")),
            to_null(data.get("synopsis")),
            to_null(data.get("pages")),
            chapter_id
        ]
    )

    # Синхронізація персонажів (якщо передано)
    if "characters" in data and isinstance(data["characters"], list):
        chapter = db.get_one("SELECT volume_id FROM manga_chapters WHERE id = %s", [chapter_id])
        volume_id = chapter["volume_id"] if chapter else None

        db.execute("DELETE FROM manga_chapter_characters WHERE chapter_id = %s", [chapter_id])
        for c in data["characters"]:
            char_id = c.get("id") or c.get("character_id")
            role = c.get("role", "main")
            if char_id:
                db.execute(
                    "INSERT INTO manga_chapter_characters (chapter_id, character_id, role) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                    [chapter_id, char_id, role]
                )
                if volume_id:
                    db.execute(
                        "INSERT INTO volume_characters (volume_id, character_id, role) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                        [volume_id, char_id, "minor"]
                    )

    return {"message": "Розділ успішно оновлено"}

@router.delete("/{chapter_id}")
async def delete_chapter(chapter_id: int, request: Request):
    check_moderator(request)
    db = get_db()
    db.execute("DELETE FROM manga_chapters WHERE id = %s", [chapter_id])
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

    chapter = db.get_one("SELECT volume_id FROM manga_chapters WHERE id = %s", [chapter_id])
    volume_id = chapter["volume_id"] if chapter else None

    db.execute(
        "INSERT INTO manga_chapter_characters (chapter_id, character_id, role) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
        [chapter_id, character_id, role]
    )
    if volume_id:
        db.execute(
            "INSERT INTO volume_characters (volume_id, character_id, role) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
            [volume_id, character_id, "minor"]
        )
    return {"message": "Появу додано"}

@router.delete("/{chapter_id}/appearances/{character_id}")
async def remove_appearance(chapter_id: int, character_id: int, request: Request):
    check_moderator(request)
    db = get_db()
    db.execute(
        "DELETE FROM manga_chapter_characters WHERE chapter_id = %s AND character_id = %s",
        [chapter_id, character_id]
    )
    return {"message": "Появу видалено"}

@router.get("/by-volume/{volume_id}")
async def get_chapters_by_volume(volume_id: int):
    db = get_db()
    chapters = db.get_all("""
        SELECT mc.*, 'manga_chapter' as type
        FROM manga_chapters mc
        WHERE mc.volume_id = %s
        ORDER BY CASE WHEN mc.chapter_number ~ '^[0-9]' THEN CAST(substring(mc.chapter_number from '^[0-9]+(\\.[0-9]+)?') AS NUMERIC) ELSE NULL END ASC NULLS LAST, mc.chapter_number ASC
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
        
    volume_exists = db.get_one("SELECT 1 FROM volumes WHERE id = %s", [volume_id])
    if not volume_exists:
        raise HTTPException(status_code=404, detail="Том не знайдено")
        
    cursor = db.conn.execute(
        """
        INSERT INTO manga_chapters (volume_id, chapter_number, name, release_date, pages)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
        """,
        [volume_id, str(chapter_number), name, release_date, pages]
    )
    new_id = cursor.fetchone()["id"]
    db.conn.commit()
    
    return {
        "message": "Розділ успішно створено",
        "id": new_id,
        "volume_id": volume_id,
        "chapter_number": chapter_number,
        "name": name,
        "release_date": release_date,
        "pages": pages
    }

@router.get("")
async def list_chapters(
    search: Optional[str] = None,
    volume_id: Optional[int] = None,
    magazine_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    sort_by: str = "created_at",
    order: str = "desc"
):
    db = get_db()
    conditions = []
    params = []

    if volume_id:
        conditions.append("mc.volume_id = ?")
        params.append(volume_id)

    if magazine_id:
        conditions.append("mv.magazine_id = ?")
        params.append(magazine_id)

    if search:
        conditions.append("""(
            mc.name LIKE %s OR mc.name_uk LIKE %s OR mc.name_en LIKE %s OR mc.name_native LIKE %s
            OR v.name LIKE %s OR v.name_uk LIKE %s OR v.name_en LIKE %s
        )""")
        s = f"%{search}%"
        params += [s, s, s, s, s, s, s]

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    # Sanitize sort fields
    allowed_sorts = {
        "created_at": "mc.created_at",
        "release_date": "mc.release_date"
    }
    sort_column = allowed_sorts.get(sort_by, "mc.created_at")
    sort_order = "DESC" if order.lower() == "desc" else "ASC"

    base_join = """
        FROM manga_chapters mc
        JOIN volumes v ON mc.volume_id = v.id
        LEFT JOIN magazine_volumes mv ON mv.volume_id = v.id
        LEFT JOIN manga_magazines mm ON mm.id = mv.magazine_id
    """

    chapters = db.get_all(f"""
        SELECT mc.*, v.name as volume_name, v.name_uk as volume_name_uk,
               v.image as volume_cv_img, NULL as volume_hikka_img, v.cover_img as volume_cover_img,
               mm.id as magazine_id, mm.name as magazine_name
        {base_join}
        {where}
        ORDER BY {sort_column} {sort_order}, mc.id {sort_order}
        LIMIT %s OFFSET %s
    """, params + [limit, offset])

    total_query = db.get_one(f"""
        SELECT COUNT(DISTINCT mc.id) as count
        {base_join}
        {where}
    """, params)
    total = total_query["count"] if total_query else 0

    return {
        "items": [dict(ch) for ch in chapters],
        "total": total
    }
