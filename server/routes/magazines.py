from fastapi import APIRouter, HTTPException, Request
from ..db import get_db
from typing import Optional

def check_moderator(request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Доступ заборонено")

router = APIRouter(prefix="/api/magazines", tags=["magazines"])

@router.get("/recent")
async def get_recent_magazines(limit: int = 8):
    db = get_db()
    magazines = db.get_all("""
        SELECT mm.*, p.name as publisher_name,
               (SELECT COUNT(*) FROM magazine_volumes vm WHERE vm.magazine_id = mm.id) as series_count
        FROM manga_magazines mm
        LEFT JOIN publishers p ON p.id = mm.publisher
        ORDER BY mm.created_at DESC, mm.id DESC
        LIMIT %s
    """, [limit])
    return {"items": [dict(m) for m in magazines]}

@router.get("/recent-issues")
async def get_recent_magazine_issues(limit: int = 8):
    db = get_db()
    issues = db.get_all("""
        SELECT mi.*, mm.name as magazine_name
        FROM magazine_issues mi
        JOIN manga_magazines mm ON mi.magazine_id = mm.id
        ORDER BY mi.created_at DESC, mi.id DESC
        LIMIT %s
    """, [limit])
    return {"items": [dict(iss) for iss in issues]}

@router.get("/weekly-chapters")
async def get_weekly_chapters(date_min: str, date_max: str):
    db = get_db()
    chapters = db.get_all("""
        SELECT 
            mc.id as chapter_id,
            mc.chapter_number,
            mc.name as chapter_name,
            v.id as manga_id,
            v.name as manga_name,
            v.name_uk as manga_name_uk,
            v.image as manga_cover,
            mi.id as issue_id,
            mi.release_date as issue_release_date,
            mm.id as magazine_id,
            mm.name as magazine_name,
            mm.label as magazine_label
        FROM magazine_issue_chapters mic
        JOIN magazine_issues mi ON mic.magazine_issue_id = mi.id
        JOIN manga_magazines mm ON mi.magazine_id = mm.id
        JOIN manga_chapters mc ON mic.manga_chapter_id = mc.id
        JOIN volumes v ON mic.manga_id = v.id
        WHERE mi.release_date >= %s AND mi.release_date <= %s
        ORDER BY mi.release_date ASC, mic.order_num ASC
    """, [date_min, date_max])
    return {"items": [dict(c) for c in chapters]}

@router.get("/issues-catalog")
async def list_magazine_issues_catalog(
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    sort: str = "recent",
    order_dir: str = "desc"
):
    db = get_db()
    conditions = []
    params = []
    
    if search:
        conditions.append("(mi.name LIKE %s OR mm.name LIKE %s OR mi.issue_number LIKE %s)")
        params += [f"%{search}%", f"%{search}%", f"%{search}%"]
        
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    
    SORT_COLUMNS = {
        "recent": "mi.created_at",
        "date": "mi.release_date",
        "name": "mm.name",
    }
    sort_col = SORT_COLUMNS.get(sort, SORT_COLUMNS["recent"])
    safe_dir = "DESC" if order_dir.lower() == "desc" else "ASC"
    
    order_by = f"ORDER BY {sort_col} {safe_dir}"
    if sort == "name":
         order_by += f", mi.issue_number {safe_dir}"
    else:
         order_by += ", mi.id DESC"
         
    issues = db.get_all(f"""
        SELECT mi.*, mm.name as magazine_name
        FROM magazine_issues mi
        JOIN manga_magazines mm ON mi.magazine_id = mm.id
        {where}
        {order_by}
        LIMIT %s OFFSET %s
    """, params + [limit, offset])
    
    total_query = db.get_one(f"""
        SELECT COUNT(*) as count
        FROM magazine_issues mi
        JOIN manga_magazines mm ON mi.magazine_id = mm.id
        {where}
    """, params)
    total = total_query["count"] if total_query else 0
    
    return {"items": [dict(iss) for iss in issues], "total": total}




@router.post("/convert-from-volume/{volume_id}")
async def convert_from_volume(volume_id: int):
    db = get_db()
    
    # 1. Check if volume exists
    volume = db.get_one("SELECT * FROM volumes WHERE id = %s", [volume_id])
    if not volume:
        raise HTTPException(status_code=404, detail="Том не знайдено")
        
    # 2. Check if volume is indeed a manga magazine (has themes 35 and 36)
    # Theme 35 = Magazine, Theme 36 = Manga
    has_mag_theme = db.get_one("SELECT 1 FROM volume_themes WHERE volume_id = %s AND theme_id = 35", [volume_id])
    has_manga_theme = db.get_one("SELECT 1 FROM volume_themes WHERE volume_id = %s AND theme_id = 36", [volume_id])
    
    if not has_mag_theme or not has_manga_theme:
        raise HTTPException(status_code=400, detail="Том не є журналом манґи (не має тем журналу та манґи)")

    # Check if already converted (only by cv_id — same names can exist for different editions)
    existing = db.get_one("SELECT id FROM manga_magazines WHERE cv_id = %s", [volume.get("cv_id")])
    if existing:
         raise HTTPException(status_code=400, detail="Цей журнал вже сконвертовано")

    try:
        db.conn.execute("BEGIN")
        
        # 3. Insert into manga_magazines
        cursor = db.conn.execute("""
            INSERT INTO manga_magazines (
                cv_id, cv_slug, image, name, name_native, publisher, start_year
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, [
            volume.get("cv_id"), volume.get("cv_slug"), volume.get("image"),
            volume.get("name") or "Без назви", volume.get("name_native"),
            volume.get("publisher"), volume.get("start_year")
        ])
        new_mag_id = cursor.fetchone()["id"]
        
        # 4. Migrate issues of this volume into magazine_issues
        issues = db.get_all("SELECT * FROM issues WHERE volume_id = %s", [volume_id])
        for iss in issues:
            cursor_iss = db.conn.execute("""
                INSERT INTO magazine_issues (
                    cv_id, cv_slug, image, release_date, cover_date, issue_number, name, magazine_id, pages
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, [
                iss.get("cv_id"), iss.get("cv_slug"), iss.get("image"),
                iss.get("release_date"), iss.get("cover_date"), iss.get("issue_number"),
                iss.get("name"), new_mag_id, iss.get("pages")
            ])
            new_iss_id = cursor_iss.fetchone()["id"]
            
        # Find and migrate links from magazine_chapters if they exist
            chapters = db.get_all("SELECT * FROM magazine_chapters WHERE mag_issue_id = %s", [iss["id"]])
            for ch in chapters:
                ch_issue = db.get_one("SELECT volume_id FROM issues WHERE id = %s", [ch["issue_id"]])
                if ch_issue and ch_issue["volume_id"]:
                    db.conn.execute("""
                        INSERT INTO magazine_issue_chapters (
                            magazine_issue_id, manga_id, manga_chapter_id, order_num
                        ) VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING
                    """, [new_iss_id, ch_issue["volume_id"], ch["issue_id"], ch["sort_order"]])

        # Migrate volume-magazine relations (manga series associated with this magazine)
        # Old relation structure linked old volume_id of magazine to child_id (volume of manga)
        # We copy this relationship into the updated structure:
        # magazine_id = new_mag_id (from manga_magazines), volume_id = old child_id (from volumes)
        db.conn.execute("""
            INSERT INTO magazine_volumes (magazine_id, volume_id)
            SELECT %s, volume_id FROM magazine_volumes WHERE magazine_id = %s
            ON CONFLICT DO NOTHING
        """, [new_mag_id, volume_id])

        # 5. Clean up old volume data
        # Delete volume themes
        db.conn.execute("DELETE FROM volume_themes WHERE volume_id = %s", [volume_id])
        # Delete volume relations & translations
        db.conn.execute("DELETE FROM volume_translations WHERE parent_id = %s OR child_id = %s", [volume_id, volume_id])
        db.conn.execute("DELETE FROM magazine_volumes WHERE magazine_id = %s OR volume_id = %s", [volume_id, volume_id])
        # Delete issues
        issue_ids = [iss["id"] for iss in issues]
        if issue_ids:
             placeholders = ",".join("%s" for _ in issue_ids)
             db.conn.execute(f"DELETE FROM collection_issues WHERE issue_id IN ({placeholders})", issue_ids)
             db.conn.execute(f"DELETE FROM reading_order_issues WHERE issue_id IN ({placeholders})", issue_ids)
             db.conn.execute(f"DELETE FROM issues WHERE id IN ({placeholders})", issue_ids)
        # Finally delete volume
        db.conn.execute("DELETE FROM volumes WHERE id = %s", [volume_id])
        
        db.conn.commit()
    except Exception as e:
        db.conn.rollback()
        raise HTTPException(status_code=400, detail=f"Помилка при конвертації: {str(e)}")
        
    return {"message": "Журнал успішно сконвертовано та відокремлено від томів", "id": new_mag_id}

@router.get("")
async def list_magazines(
    search: Optional[str] = None,
    id: Optional[int] = None,
    cv_id: Optional[int] = None,
    publisher_ids: Optional[str] = None,
    formats: Optional[str] = None,
    demographics: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    sort: str = "series",
    order_dir: str = "desc",
):
    db = get_db()
    conditions = []
    params = []

    if id:
        conditions.append("mm.id = ?")
        params.append(id)
    elif cv_id:
        conditions.append("mm.cv_id = ?")
        params.append(cv_id)
    elif search:
        conditions.append("(mm.name LIKE %s OR mm.name_native LIKE %s)")
        params += [f"%{search}%", f"%{search}%"]

    if publisher_ids:
        pub_ids = [int(pid.strip()) for pid in publisher_ids.split(",") if pid.strip().isdigit()]
        if pub_ids:
            placeholders = ",".join("%s" for _ in pub_ids)
            conditions.append(f"mm.publisher IN ({placeholders})")
            params += pub_ids

    if formats:
        fmts = [f.strip() for f in formats.split(",") if f.strip()]
        if fmts:
            placeholders = ",".join("%s" for _ in fmts)
            conditions.append(f"mm.format IN ({placeholders})")
            params += fmts

    if demographics:
        demos = [d.strip() for d in demographics.split(",") if d.strip()]
        if demos:
            placeholders = ",".join("%s" for _ in demos)
            conditions.append(f"mm.demographic IN ({placeholders})")
            params += demos

    # Validate order direction to prevent SQL injection
    safe_dir = "DESC" if order_dir.lower() == "desc" else "ASC"

    SORT_COLUMNS = {
        "name":   "mm.name",
        "recent": "mm.created_at",
        "date":   "mm.start_year",
        "series": "(SELECT COUNT(*) FROM magazine_volumes vm WHERE vm.magazine_id = mm.id)",
    }
    sort_col = SORT_COLUMNS.get(sort, SORT_COLUMNS["series"])
    order_by = f"{sort_col} {safe_dir}"
    # Always keep name as a secondary sort for stable ordering
    if sort != "name":
        order_by += ", mm.name ASC"

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    magazines = db.get_all(f"""
        SELECT mm.*, p.name as publisher_name,
               (SELECT COUNT(*) FROM magazine_volumes vm WHERE vm.magazine_id = mm.id) as series_count,
               (SELECT COUNT(*) FROM magazine_volumes vm 
                JOIN volume_themes vt ON vm.volume_id = vt.volume_id 
                WHERE vm.magazine_id = mm.id AND vt.theme_id = 72) as series_ongoing_count,
               (SELECT COUNT(*) FROM magazine_issues mi WHERE mi.magazine_id = mm.id) as issues_count
        FROM manga_magazines mm
        LEFT JOIN publishers p ON p.id = mm.publisher
        {where}
        ORDER BY {order_by}
        LIMIT %s OFFSET %s
    """, params + [limit, offset])

    total_query = db.get_one(f"""
        SELECT COUNT(*) as count
        FROM manga_magazines mm
        {where}
    """, params)
    total = total_query["count"] if total_query else 0

    items = []
    for m in magazines:
        mag_dict = dict(m)
        popular = db.get_all("""
            SELECT v.id, v.name, v.name_uk, v.cover_img, v.image, v.mal_score
            FROM volumes v
            JOIN magazine_volumes vm ON v.id = vm.volume_id
            WHERE vm.magazine_id = %s
            ORDER BY COALESCE(v.mal_score, 0) DESC, v.id ASC
            LIMIT 5
        """, [mag_dict["id"]])
        mag_dict["popular_series"] = [dict(s) for s in popular]
        items.append(mag_dict)

    return {"items": items, "total": total}

@router.post("/{magazine_id}/volumes")
async def add_volume_to_magazine_direct(magazine_id: int, data: dict):
    db = get_db()
    volume_id = data.get("volume_id")
    if not volume_id:
        raise HTTPException(status_code=400, detail="volume_id обов'язковий")

    magazine = db.get_one("SELECT id FROM manga_magazines WHERE id = %s", [magazine_id])
    if not magazine:
        raise HTTPException(status_code=404, detail="Журнал не знайдено")

    db.execute(
        "INSERT INTO magazine_volumes (magazine_id, volume_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        [magazine_id, volume_id]
    )
    return {"message": "Том додано до журналу"}

@router.delete("/{magazine_id}/volumes/{volume_id}")
async def remove_volume_from_magazine_direct(magazine_id: int, volume_id: int):
    db = get_db()
    db.execute(
        "DELETE FROM magazine_volumes WHERE magazine_id = %s AND volume_id = %s",
        [magazine_id, volume_id]
    )
    return {"message": "Том видалено з журналу"}

@router.get("/issues/{issue_id}")
async def get_magazine_issue_detail(issue_id: int):
    db = get_db()
    
    # Get issue details
    issue = db.get_one("""
        SELECT mi.*, mm.name as magazine_name, mm.id as magazine_db_id
        FROM magazine_issues mi
        JOIN manga_magazines mm ON mi.magazine_id = mm.id
        WHERE mi.id = %s
    """, [issue_id])
    
    if not issue:
        raise HTTPException(status_code=404, detail="Випуск журналу не знайдено")
        
    # Get chapters (horizontal cards info)
    chapters = db.get_all("""
        SELECT mic.order_num, mic.label,
               v.name as manga_name, v.name_uk as manga_name_uk, v.image as manga_volume_cover, v.cover_img as manga_banner, v.id as manga_volume_id,
               mc.id as chapter_id, mc.chapter_number, mc.name as chapter_name, mc.pages, mc.image as chapter_cover
        FROM magazine_issue_chapters mic
        JOIN volumes v ON mic.manga_id = v.id
        JOIN manga_chapters mc ON mic.manga_chapter_id = mc.id
        WHERE mic.magazine_issue_id = %s
        ORDER BY mic.order_num ASC
    """, [issue_id])

    # Get navigation siblings in the magazine
    prev_issue = None
    next_issue = None
    magazine_id = issue["magazine_id"]
    
    siblings = db.get_all("""
        SELECT id, issue_number, name, image, release_date, cover_date
        FROM magazine_issues
        WHERE magazine_id = %s
        ORDER BY CAST(issue_number AS REAL) ASC, issue_number ASC, release_date ASC, cover_date ASC
    """, [magazine_id])
    
    current_idx = next(
        (i for i, s in enumerate(siblings) if s["id"] == issue_id), None
    )
    
    if current_idx is not None:
        if current_idx > 0:
            prev_issue = dict(siblings[current_idx - 1])
        if current_idx < len(siblings) - 1:
            next_issue = dict(siblings[current_idx + 1])

    return {
        "issue": issue,
        "chapters": [dict(ch) for ch in chapters],
        "prev_issue": prev_issue,
        "next_issue": next_issue,
        "all_issues": [dict(s) for s in siblings]
    }


@router.post("/issues/{issue_id}/chapters")
async def add_chapter_to_magazine_issue(issue_id: int, request: Request):
    check_moderator(request)
    db = get_db()
    
    data = await request.json()
    manga_id = data.get("manga_id")
    manga_chapter_id = data.get("manga_chapter_id")
    order_num = data.get("order_num")
    label = data.get("label")
    
    if not manga_id or not manga_chapter_id:
        raise HTTPException(status_code=400, detail="manga_id та manga_chapter_id обов'язкові")
        
    issue_row = db.get_one("SELECT magazine_id FROM magazine_issues WHERE id = %s", [issue_id])
    if not issue_row:
        raise HTTPException(status_code=404, detail="Випуск журналу не знайдено")
    magazine_id = issue_row["magazine_id"]
        
    existing = db.get_one(
        "SELECT 1 FROM magazine_issue_chapters WHERE magazine_issue_id = %s AND manga_chapter_id = %s",
        [issue_id, manga_chapter_id]
    )
    if existing:
        raise HTTPException(status_code=400, detail="Цей розділ вже додано до випуску")
        
    if order_num is None:
        max_order_row = db.get_one(
            "SELECT MAX(order_num) as max_order FROM magazine_issue_chapters WHERE magazine_issue_id = %s",
            [issue_id]
        )
        order_num = (max_order_row["max_order"] or 0) + 1
        
    db.execute(
        """
        INSERT INTO magazine_issue_chapters (magazine_issue_id, manga_id, manga_chapter_id, order_num, label)
        VALUES (%s, %s, %s, %s, %s)
        """,
        [issue_id, manga_id, manga_chapter_id, order_num, label]
    )
    
    # Auto-link series to magazine if not exists
    mag_vol_exists = db.get_one(
        "SELECT 1 FROM magazine_volumes WHERE magazine_id = %s AND volume_id = %s",
        [magazine_id, manga_id]
    )
    if not mag_vol_exists:
        db.execute(
            "INSERT INTO magazine_volumes (magazine_id, volume_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            [magazine_id, manga_id]
        )
    
    return {"message": "Розділ додано", "order_num": order_num}

@router.delete("/issues/{issue_id}/chapters/{chapter_id}")
async def remove_chapter_from_magazine_issue(issue_id: int, chapter_id: int, request: Request):
    check_moderator(request)
    db = get_db()
    
    deleted = db.get_one(
        "SELECT order_num FROM magazine_issue_chapters WHERE magazine_issue_id = %s AND manga_chapter_id = %s",
        [issue_id, chapter_id]
    )
    if deleted:
        db.execute(
            "DELETE FROM magazine_issue_chapters WHERE magazine_issue_id = %s AND manga_chapter_id = %s",
            [issue_id, chapter_id]
        )
        db.execute(
            "UPDATE magazine_issue_chapters SET order_num = order_num - 1 WHERE magazine_issue_id = %s AND order_num > %s",
            [issue_id, deleted["order_num"]]
        )
        
    return {"message": "Розділ видалено з випуску"}

@router.put("/issues/{issue_id}/chapters/{chapter_id}")
async def update_chapter_in_magazine_issue(issue_id: int, chapter_id: int, request: Request):
    check_moderator(request)
    db = get_db()
    data = await request.json()
    
    order_num = data.get("order_num")
    label = data.get("label")
    
    db.execute(
        """
        UPDATE magazine_issue_chapters
        SET order_num = COALESCE(%s, order_num),
            label = %s
        WHERE magazine_issue_id = %s AND manga_chapter_id = %s
        """,
        [order_num, label, issue_id, chapter_id]
    )
    return {"message": "Зв'язок оновлено успішно"}

@router.put("/issues/{issue_id}/reorder-chapters")
async def reorder_magazine_issue_chapters(issue_id: int, data: dict, request: Request):
    check_moderator(request)
    db = get_db()
    
    items = data.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="items обов'язкові")
        
    try:
        db.conn.execute("BEGIN")
        for index, item in enumerate(items, 1):
            ch_id = item.get("id")
            db.conn.execute(
                """
                UPDATE magazine_issue_chapters
                SET order_num = %s
                WHERE magazine_issue_id = %s AND manga_chapter_id = %s
                """,
                [index, issue_id, ch_id]
            )
        db.conn.commit()
    except Exception as e:
        db.conn.rollback()
        raise HTTPException(status_code=400, detail=f"Помилка сортування: {str(e)}")
        
    return {"message": "Порядок розділів оновлено"}

@router.get("/{id}")
async def get_magazine_detail(id: int):
    db = get_db()
    
    # Get magazine
    magazine = db.get_one("""
        SELECT mm.*, p.name as publisher_name, p.cv_slug as publisher_slug
        FROM manga_magazines mm
        LEFT JOIN publishers p ON mm.publisher = p.id
        WHERE mm.id = %s
    """, [id])
    
    if not magazine:
        raise HTTPException(status_code=404, detail="Журнал не знайдено")
        
    # Get recent issues (Limit to 6)
    issues = db.get_all("""
        SELECT * FROM magazine_issues
        WHERE magazine_id = %s
        ORDER BY CAST(issue_number AS REAL) DESC, issue_number DESC, release_date DESC, cover_date DESC
        LIMIT 6
    """, [id])
    
    # Get count of total issues
    issues_count = db.get_one("SELECT COUNT(*) as count FROM magazine_issues WHERE magazine_id = %s", [id])["count"]
    
    # Get active series (volumes connected through updated magazine_volumes where theme is 72)
    # Limit to 6
    series = db.get_all("""
        SELECT DISTINCT v.*, p.name as publisher_name
        FROM volumes v
        JOIN magazine_volumes vm ON v.id = vm.volume_id
        LEFT JOIN publishers p ON v.publisher = p.id
        WHERE vm.magazine_id = %s
          AND EXISTS (
              SELECT 1 FROM volume_themes vt 
              WHERE vt.volume_id = v.id AND vt.theme_id = 72
          )
        ORDER BY v.name ASC
        LIMIT 6
    """, [id])

    # Get count of total series
    series_count = db.get_one("""
        SELECT COUNT(DISTINCT v.id) as count
        FROM volumes v
        JOIN magazine_volumes vm ON v.id = vm.volume_id
        WHERE vm.magazine_id = %s
          AND EXISTS (
              SELECT 1 FROM volume_themes vt 
              WHERE vt.volume_id = v.id AND vt.theme_id = 72
          )
    """, [id])["count"]
        
    return {
        "magazine": magazine,
        "issues": issues,
        "issues_count": issues_count,
        "series": series,
        "series_count": series_count
    }

@router.get("/{id}/all-issues")
async def get_all_magazine_issues(id: int, page: int = 1, limit: int = 24):
    db = get_db()
    offset = (page - 1) * limit
    
    issues = db.get_all("""
        SELECT * FROM magazine_issues
        WHERE magazine_id = %s
        ORDER BY CAST(issue_number AS REAL) DESC, issue_number DESC, release_date DESC, cover_date DESC
        LIMIT %s OFFSET %s
    """, [id, limit, offset])
    
    total = db.get_one("SELECT COUNT(*) as count FROM magazine_issues WHERE magazine_id = %s", [id])["count"]
    
    return {
        "items": issues,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.get("/{id}/all-series")
async def get_all_magazine_series(id: int, page: int = 1, limit: int = 24, ongoing: Optional[bool] = None):
    db = get_db()
    offset = (page - 1) * limit
    
    query_where = "WHERE vm.magazine_id = %s"
    params = [id]
    
    if ongoing:
        query_where += """
          AND EXISTS (
              SELECT 1 FROM volume_themes vt 
              WHERE vt.volume_id = v.id AND vt.theme_id = 72
          )
        """
        
    series = db.get_all(f"""
        SELECT DISTINCT v.*, p.name as publisher_name
        FROM volumes v
        JOIN magazine_volumes vm ON v.id = vm.volume_id
        LEFT JOIN publishers p ON v.publisher = p.id
        {query_where}
        ORDER BY v.name ASC
        LIMIT %s OFFSET %s
    """, params + [limit, offset])
    
    total = db.get_one(f"""
        SELECT COUNT(DISTINCT v.id) as count
        FROM volumes v
        JOIN magazine_volumes vm ON v.id = vm.volume_id
        {query_where}
    """, params)["count"]
    
    return {
        "items": [dict(s) for s in series],
        "total": total,
        "page": page,
        "limit": limit
    }
