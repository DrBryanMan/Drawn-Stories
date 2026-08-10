from fastapi import APIRouter, HTTPException, Query
from ..db import get_db
from ..helpers.themes import ASIAN_COMICS_THEME_IDS
from typing import Optional

router = APIRouter(prefix="/api/releases", tags=["releases"])

@router.get("/calendar")
async def get_releases_calendar(
    start_date: str = Query(..., description="Початкова дата у форматі YYYY-MM-DD"),
    end_date: str = Query(..., description="Кінцева дата у форматі YYYY-MM-DD"),
    publisher_id: Optional[int] = Query(None, description="ID видавництва"),
    release_type: str = Query("issues", description="Тип результатів: 'issues' або 'collections'"),
    category: str = Query("comics", description="Категорія контенту: 'comics' або 'manga'")
):
    db = get_db()

    # 1. Отримуємо список всіх видавництв для фільтра-дропдауна
    publishers = db.get_all("""
        SELECT p.id, p.name, p.country,
               COUNT(DISTINCT v.id) as series_count
        FROM publishers p
        LEFT JOIN volumes v ON v.publisher = p.id
        GROUP BY p.id, p.name, p.country
        ORDER BY p.name ASC
    """)

    results = []

    # 2. Отримуємо випуски (Issues) якщо розглядаються випуски
    asian_ids_sql = ",".join(str(tid) for tid in ASIAN_COMICS_THEME_IDS)
    if release_type == "issues":
        sql = f"""
            SELECT 
                i.id,
                'issue' as item_type,
                FALSE as is_collection,
                i.name,
                i.issue_number,
                COALESCE(i.release_date, i.cover_date) as release_date,
                i.cover_date,
                i.image,
                i.volume_id,
                v.name as volume_name,
                v.name_uk as volume_name_uk,
                p.id as publisher_id,
                p.name as publisher_name,
                EXISTS (
                    SELECT 1 FROM volume_themes vt 
                    WHERE vt.volume_id = v.id AND vt.theme_id IN ({asian_ids_sql})
                ) as is_manga
            FROM issues i
            LEFT JOIN volumes v ON i.volume_id = v.id
            LEFT JOIN publishers p ON v.publisher = p.id
            WHERE COALESCE(i.release_date, i.cover_date) >= %s 
              AND COALESCE(i.release_date, i.cover_date) <= %s
        """
        params = [start_date, end_date]

        if publisher_id:
            sql += " AND p.id = %s"
            params.append(publisher_id)

        if category == "manga":
            sql += f""" AND EXISTS (
                SELECT 1 FROM volume_themes vt 
                WHERE vt.volume_id = v.id AND vt.theme_id IN ({asian_ids_sql})
            )"""
        elif category == "comics":
            sql += f""" AND NOT EXISTS (
                SELECT 1 FROM volume_themes vt 
                WHERE vt.volume_id = v.id AND vt.theme_id IN ({asian_ids_sql})
            )"""

        sql += " ORDER BY COALESCE(i.release_date, i.cover_date) ASC, v.name ASC, i.issue_number ASC"
        results = db.get_all(sql, params)

    # 3. Отримуємо збірники (Collections) якщо розглядаються збірники
    elif release_type == "collections":
        sql = f"""
            SELECT 
                c.id,
                'collection' as item_type,
                TRUE as is_collection,
                c.name,
                c.issue_number,
                COALESCE(c.release_date, c.cover_date) as release_date,
                c.cover_date,
                c.image,
                c.volume_id,
                v.name as volume_name,
                v.name_uk as volume_name_uk,
                COALESCE(c.publisher, v.publisher) as publisher_id,
                p.name as publisher_name,
                EXISTS (
                    SELECT 1 FROM volume_themes vt 
                    WHERE vt.volume_id = v.id AND vt.theme_id IN ({asian_ids_sql})
                ) as is_manga
            FROM collections c
            LEFT JOIN volumes v ON c.volume_id = v.id
            LEFT JOIN publishers p ON p.id = COALESCE(c.publisher, v.publisher)
            WHERE COALESCE(c.release_date, c.cover_date) >= %s 
              AND COALESCE(c.release_date, c.cover_date) <= %s
        """
        params = [start_date, end_date]

        if publisher_id:
            sql += " AND COALESCE(c.publisher, v.publisher) = %s"
            params.append(publisher_id)

        if category == "manga":
            sql += f""" AND EXISTS (
                SELECT 1 FROM volume_themes vt 
                WHERE vt.volume_id = v.id AND vt.theme_id IN ({asian_ids_sql})
            )"""
        elif category == "comics":
            sql += f""" AND NOT EXISTS (
                SELECT 1 FROM volume_themes vt 
                WHERE vt.volume_id = v.id AND vt.theme_id IN ({asian_ids_sql})
            )"""

        sql += " ORDER BY COALESCE(c.release_date, c.cover_date) ASC, c.name ASC"
        results = db.get_all(sql, params)

    # Форматуємо результат
    formatted_items = []
    for item in results:
        formatted_items.append({
            "id": item["id"],
            "type": item["item_type"],
            "is_collection": bool(item.get("is_collection")),
            "name": item.get("name"),
            "issue_number": item.get("issue_number"),
            "release_date": str(item["release_date"]) if item.get("release_date") else None,
            "image": item.get("image"),
            "volume_id": item.get("volume_id"),
            "volume_name": item.get("volume_name"),
            "volume_name_uk": item.get("volume_name_uk"),
            "publisher_id": item.get("publisher_id"),
            "publisher_name": item.get("publisher_name"),
            "category": "manga" if item.get("is_manga") else "comics"
        })

    return {
        "items": formatted_items,
        "total": len(formatted_items),
        "publishers": [dict(p) for p in publishers]
    }
