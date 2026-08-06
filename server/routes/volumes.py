from fastapi import APIRouter, HTTPException, Request
import json
from ..db import get_db

router = APIRouter(prefix="/api/volumes", tags=["volumes"])

def get_current_user_id(request: Request):
    username = request.cookies.get("username")
    if not username:
        return None
    db = get_db()
    user = db.get_one("SELECT id FROM users WHERE username = %s", [username])
    return user['id'] if user else None

@router.get("/{volume_id}")
async def get_volume_detail(volume_id: int, request: Request):
    db = get_db()
    user_id = get_current_user_id(request)

    volume = db.get_one(
        """
        SELECT v.*, p.name as publisher_name, p.cv_slug as publisher_slug, 'volume' as type,
               (SELECT COUNT(*) FROM issues i WHERE i.volume_id = v.id) as issue_count
        FROM volumes v
        LEFT JOIN publishers p ON v.publisher = p.id
        WHERE v.id = %s
        """,
        [volume_id],
    )

    if not volume:
        raise HTTPException(status_code=404, detail="Том не знайдено")

    volume = dict(volume)
    if volume.get("synonyms"):
        try:
            volume["synonyms"] = json.loads(volume["synonyms"])
        except:
            volume["synonyms"] = [volume["synonyms"]]
    else:
        volume["synonyms"] = []

    themes = db.get_all(
        """
        SELECT id, cv_id, name, ua_name, type
        FROM (
            SELECT DISTINCT t.id, t.cv_id, t.name, t.ua_name, COALESCE(t.type, 'theme') as type
            FROM volume_themes vt
            JOIN themes t ON t.id = vt.theme_id
            WHERE vt.volume_id = %s
        ) sub
        ORDER BY
          CASE type
            WHEN 'type' THEN 0
            WHEN 'genre' THEN 1
            ELSE 2
          END,
          COALESCE(ua_name, name) ASC
        """,
        [volume_id],
    )

    is_collection_volume = any(
        ('collection' in (t.get('name') or '').lower() or
         'збірник' in (t.get('ua_name') or '').lower() or
         'збірка' in (t.get('ua_name') or '').lower())
        for t in themes
    )

    has_magazine_parent = db.get_one("SELECT 1 FROM magazine_volumes WHERE volume_id = %s", [volume_id]) is not None
    is_manga_with_mal = volume.get("mal_id") is not None
    has_manga_chapters = db.get_one("SELECT 1 FROM manga_chapters WHERE volume_id = %s", [volume_id]) is not None
    use_manga_chapters = has_magazine_parent or is_manga_with_mal or has_manga_chapters

    if use_manga_chapters:
        issues = db.get_all(
            """
            SELECT id, name, name_native, name_en, name_uk, image as cv_img, volume_id,
                   chapter_number as issue_number, release_date, synopsis as description, pages,
                   'manga_chapter' as type, 
                   (SELECT COUNT(*) FROM collection_issues ci WHERE ci.manga_chapter_id = manga_chapters.id) as collection_count
            FROM manga_chapters
            WHERE volume_id = %s
            ORDER BY CASE WHEN chapter_number ~ '^[0-9]' THEN CAST(substring(chapter_number from '^[0-9]+(\\.[0-9]+)?') AS NUMERIC) ELSE NULL END ASC NULLS LAST, chapter_number ASC
            """,
            [volume_id]
        )
        direct_issues = issues
    elif is_collection_volume:
        issues = db.get_all(
            """
            SELECT i.*, 'issue' as type, 
                   v.name as volume_name, v.name_uk as volume_name_uk,
                   v.image as volume_cv_img, v.cover_img as volume_cover_img,
                   v.id as volume_db_id, v.cv_id as volume_cv_id,
                   (SELECT COUNT(DISTINCT ci2.collection_id) FROM collection_issues ci2 WHERE ci2.issue_id = i.id) as collection_count
            FROM issues i
            LEFT JOIN volumes v ON i.volume_id = v.id
            WHERE i.id IN (
                SELECT ci.issue_id 
                FROM collection_issues ci
                JOIN collections c ON ci.collection_id = c.id
                WHERE c.volume_id = %s
            )
            """,
            [volume_id],
        )
        direct_issues = db.get_all(
            """
            SELECT i.*, 'issue' as type,
                   (SELECT COUNT(*) FROM collection_issues ci WHERE ci.issue_id = i.id) as collection_count
            FROM issues i
            WHERE i.volume_id = %s
            ORDER BY CASE WHEN i.issue_number ~ '^[0-9]' THEN CAST(substring(i.issue_number from '^[0-9]+(\\.[0-9]+)?') AS NUMERIC) ELSE NULL END ASC NULLS LAST, i.issue_number ASC
            """,
            [volume_id]
        )
    else:
        issues = db.get_all(
            """
            SELECT i.*, 'issue' as type, (SELECT COUNT(*) FROM collection_issues ci WHERE ci.issue_id = i.id) as collection_count
            FROM issues i
            WHERE i.volume_id = %s
            """,
            [volume_id],
        )
        direct_issues = issues

    convertable_count = sum(1 for i in direct_issues if i.get("collection_count", 0) == 0)

    collections = db.get_all(
        """
        SELECT c.*, 'collection' as type,
               EXISTS(SELECT 1 FROM user_volumes_collection uc WHERE uc.collection_id = c.id AND uc.user_id = %s) as is_owned
        FROM collections c
        WHERE c.volume_id = %s
        """,
        [user_id, volume_id],
    )

    # Combine and sort
    items = issues + collections
    items.sort(key=lambda x: (
        float(x.get('issue_number') or 0) if str(x.get('issue_number', '')).replace('.', '').isdigit() else 999999,
        x.get('issue_number') or '',
        x.get('cover_date') or x.get('release_date') or ''
    ))
    
    owned_count = sum(1 for c in collections if c.get('is_owned'))

    issue_dates = sorted(
        item.get("cover_date") or item.get("release_date")
        for item in items
        if item.get("cover_date") or item.get("release_date")
    )

    issue_years = sorted(
        int(d[:4])
        for d in issue_dates
        if d and len(d) >= 4 and d[:4].isdigit()
    )

    end_year = None
    if volume.get("status") in ["Ongoing", "Триває", "Виходить"]:
        end_year = "Ongoing"
    elif issue_years:
        end_year = issue_years[-1]

    volume_with_end = dict(volume)
    volume_with_end["end_year"] = end_year

    translation_parents = db.get_all(
        """
        SELECT v.*, p.name as publisher_name, vt.rel_type, 'volume' as type,
               (SELECT COUNT(*) FROM issues i WHERE i.volume_id = v.id) as issue_count,
               (SELECT COUNT(*) FROM collections c WHERE c.volume_id = v.id) as collections_count
        FROM volume_translations vt
        JOIN volumes v ON v.id = vt.parent_id
        LEFT JOIN publishers p ON p.id = v.publisher
        WHERE vt.child_id = %s
        ORDER BY
          CASE vt.rel_type
            WHEN 'source' THEN 0
            WHEN 'translation' THEN 1
            ELSE 2
          END,
          v.name ASC
        """,
        [volume_id]
    )

    translations = db.get_all(
        """
        SELECT DISTINCT v.*, p.name as publisher_name, vt.rel_type, 'volume' as type,
               (SELECT COUNT(*) FROM issues i WHERE i.volume_id = v.id) as issue_count,
               (SELECT COUNT(*) FROM collections c WHERE c.volume_id = v.id) as collections_count
        FROM volume_translations vt
        JOIN volumes v ON v.id = vt.child_id
        LEFT JOIN publishers p ON p.id = v.publisher
        WHERE vt.parent_id = %s
        ORDER BY v.lang ASC, v.name ASC
        """,
        [volume_id]
    )

    magazine_parents = db.get_all(
        """
        SELECT mm.*, 'magazine' as type
        FROM magazine_volumes vm
        JOIN manga_magazines mm ON mm.id = vm.magazine_id
        WHERE vm.volume_id = %s
        ORDER BY mm.name ASC
        """,
        [volume_id]
    )
    magazine = magazine_parents[0] if magazine_parents else None

    magazine_children = []

    characters = db.get_all(
        """
        SELECT c.id, c.cv_id, c.name, c.name_uk, c.name_ro, c.real_name, c.real_name_uk, c.image, c.cv_slug, vc.role, c.mal_id, c.hikka_slug
        FROM volume_characters vc
        JOIN characters c ON vc.character_id = c.id
        WHERE vc.volume_id = %s
        ORDER BY 
          CASE vc.role WHEN 'main' THEN 0 WHEN 'supporting' THEN 1 ELSE 2 END,
          COALESCE(c.name_uk, c.name) ASC
        """,
        [volume_id]
    )

    staff = db.get_all(
        """
        SELECT p.id, p.name, p.image, p.cv_slug, vp.role
        FROM volume_persons vp
        JOIN persons p ON vp.person_id = p.id
        WHERE vp.volume_id = %s
        ORDER BY vp.role ASC, p.name ASC
        """,
        [volume_id]
    )

    # Separate date ranges for issues and collections
    issue_only_dates = sorted(
        item.get("cover_date") or item.get("release_date")
        for item in issues
        if item.get("cover_date") or item.get("release_date")
    )
    collection_only_dates = sorted(
        item.get("cover_date") or item.get("release_date")
        for item in collections
        if item.get("cover_date") or item.get("release_date")
    )

    def first_year(dates):
        for d in dates:
            if d and len(d) >= 4 and d[:4].isdigit():
                return int(d[:4])
        return None

    def last_year(dates):
        for d in reversed(dates):
            if d and len(d) >= 4 and d[:4].isdigit():
                return int(d[:4])
        return None

    return {
        "volume": volume_with_end,
        "items": items,
        "issues": issues,
        "direct_issues": direct_issues,
        "convertable_count": convertable_count,
        "collections": collections,
        "themes": themes,
        "magazine": magazine,
        "translation_parents": translation_parents,
        "translations": translations,
        "magazine_parents": magazine_parents,
        "magazine_children": magazine_children,
        "characters": characters,
        "staff": staff,
        "stats": {
            "issues": len(issues),
            "collections": len(collections),
            "owned_collections": owned_count,
            "total_items": len(items),
            "first_release": issue_dates[0] if issue_dates else None,
            "last_release": issue_dates[-1] if issue_dates else None,
            "issue_first_year": first_year(issue_only_dates),
            "issue_last_year": last_year(issue_only_dates),
            "collection_first_year": first_year(collection_only_dates),
            "collection_last_year": last_year(collection_only_dates),
        },
    }

def replace_volume_themes(db, volume_id, theme_ids):
    # Delete existing themes
    db.execute("DELETE FROM volume_themes WHERE volume_id = %s", [volume_id])
        
    # Insert new themes
    for theme_id in theme_ids:
        db.execute(
            "INSERT INTO volume_themes (volume_id, theme_id) VALUES (%s, %s)",
            [volume_id, theme_id]
        )

def replace_issue_with_collection(db, issue_id, collection_id):
    reading_order_links = db.conn.execute(
        """
        SELECT reading_order_id, order_num
        FROM reading_order_issues
        WHERE issue_id = %s
        """,
        [issue_id]
    ).fetchall()

    for link in reading_order_links:
        db.conn.execute(
            """
            INSERT INTO reading_order_collections (reading_order_id, collection_id, order_num)
            VALUES (%s, %s, %s) ON CONFLICT DO NOTHING
            """,
            [link["reading_order_id"], collection_id, link["order_num"]]
        )

    db.conn.execute("DELETE FROM reading_order_issues WHERE issue_id = %s", [issue_id])
    db.conn.execute("UPDATE characters SET first_appearance = NULL WHERE first_appearance = %s", [issue_id])
    db.conn.execute("DELETE FROM issues WHERE id = %s", [issue_id])

def replace_manga_chapter_with_collection(db, chapter_id, collection_id):
    # Очищуємо зв'язки в журналах (якщо є)
    db.conn.execute("DELETE FROM magazine_issue_chapters WHERE manga_chapter_id = %s", [chapter_id])
    # Переносимо зв'язки з collection_issues
    db.conn.execute("UPDATE collection_issues SET collection_id = %s, manga_chapter_id = NULL WHERE manga_chapter_id = %s", [collection_id, chapter_id])
    # Видаляємо сам manga_chapter
    db.conn.execute("DELETE FROM manga_chapters WHERE id = %s", [chapter_id])

def sync_volume_staff_and_characters(db, volume_id, data):
    # Sync staff if present
    if "staff" in data and isinstance(data["staff"], list):
        incoming_staff = data["staff"]
        db.conn.execute("DELETE FROM volume_persons WHERE volume_id = %s", [volume_id])
        for s in incoming_staff:
            person_id = s.get("person_id")
            role = s.get("role")
            if person_id and role:
                db.conn.execute(
                    "INSERT INTO volume_persons (volume_id, person_id, role) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                    [volume_id, person_id, role]
                )
        db.conn.commit()

    # Sync characters if present
    if "characters" in data and isinstance(data["characters"], list):
        incoming_characters = data["characters"]
        db.conn.execute("DELETE FROM volume_characters WHERE volume_id = %s", [volume_id])
        for c in incoming_characters:
            char_id = c.get("id") or c.get("character_id")
            role = c.get("role")
            if char_id:
                db.conn.execute(
                    "INSERT INTO volume_characters (volume_id, character_id, role) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                    [volume_id, char_id, role]
                )
        db.conn.commit()


@router.post("")
async def create_volume(data: dict):
    db = get_db()
    
    # Required fields check
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="Назва тому обов'язкова")

    # Insert fields
    columns = []
    placeholders = []
    params = []
    
    allowed_fields = [
        "name", "name_uk", "name_native", "description", "synopsis", "synopsis_ua", "start_year", 
        "status", "lang", "publisher", "image", "cover_img",
        "cv_id", "cv_slug", "hikka_slug", "mal_id", "locg_id", "locg_slug", "site_link"
    ]
    
    for key, value in data.items():
        if key in allowed_fields and value is not None:
            if value == "":
                value = None
            columns.append(key)
            placeholders.append("%s")
            params.append(value)
            
    if not columns:
        raise HTTPException(status_code=400, detail="Немає даних для збереження")

    sql = f"INSERT INTO volumes ({', '.join(columns)}) VALUES ({', '.join(placeholders)}) RETURNING id"
    new_id = db.get_one(sql, params)["id"]
    
    # Update themes if provided
    if "theme_ids" in data and isinstance(data["theme_ids"], list):
        replace_volume_themes(db, new_id, data["theme_ids"])
        
    sync_volume_staff_and_characters(db, new_id, data)
    
    return {"message": "Том успішно створено", "id": new_id}

def apply_volume_update_in_db(db, volume_id: int, data: dict):
    # Check if volume exists
    volume = db.get_one("SELECT id FROM volumes WHERE id = %s", [volume_id])
    if not volume:
        raise HTTPException(status_code=404, detail="Том не знайдено")

    # Update fields
    fields = []
    params = []
    
    allowed_fields = [
        "name", "name_uk", "name_native", "description", "synopsis", "synopsis_ua", "start_year", 
        "status", "lang", "publisher", "image", "cover_img",
        "cv_id", "cv_slug", "hikka_slug", "mal_id", "locg_id", "locg_slug", "site_link"
    ]
    
    for key, value in data.items():
        if key in allowed_fields:
            if value == "":
                value = None
            fields.append(f"{key} = %s")
            params.append(value)
            
    if fields:
        params.append(volume_id)
        db.execute(
            f"UPDATE volumes SET {', '.join(fields)} WHERE id = %s",
            params
        )
    
    # Update themes if provided
    if "theme_ids" in data and isinstance(data["theme_ids"], list):
        replace_volume_themes(db, volume_id, data["theme_ids"])
        
    sync_volume_staff_and_characters(db, volume_id, data)

@router.put("/{volume_id}")
async def update_volume(volume_id: int, data: dict):
    db = get_db()
    apply_volume_update_in_db(db, volume_id, data)
    return {"message": "Volume updated successfully"}

@router.post("/{volume_id}/convert-all-to-collections")
async def convert_all_to_collections(volume_id: int):
    db = get_db()
    
    # Check if volume exists
    volume = db.get_one("SELECT * FROM volumes WHERE id = %s", [volume_id])
    if not volume:
        raise HTTPException(status_code=404, detail="Том не знайдено")

    has_magazine_parent = db.get_one("SELECT 1 FROM magazine_volumes WHERE volume_id = %s", [volume_id]) is not None
    is_manga_with_mal = volume.get("mal_id") is not None
    has_manga_chapters = db.get_one("SELECT 1 FROM manga_chapters WHERE volume_id = %s", [volume_id]) is not None
    use_manga_chapters = has_magazine_parent or is_manga_with_mal or has_manga_chapters

    if use_manga_chapters:
        items = db.get_all(
            """
            SELECT id, name, name_native, name_en, name_uk, image as cv_img, volume_id,
                   chapter_number as issue_number, release_date, synopsis as description, pages,
                   NULL as cv_id, NULL as cv_slug
            FROM manga_chapters
            WHERE volume_id = %s
            """,
            [volume_id]
        )
    else:
        items = db.get_all("SELECT * FROM issues WHERE volume_id = %s", [volume_id])
        
    if not items:
        raise HTTPException(status_code=400, detail="У цього тома немає випусків або розділів для конвертації")

    converted = 0
    skipped = 0
    blocked = 0
    
    try:
        # We start a transaction manually
        db.conn.execute("BEGIN")
        for item in items:
            item_id = item["id"]
            item_cv_vol_id = item.get("cv_vol_id") or volume.get("cv_id")
            
            # Check if used in collections
            if use_manga_chapters:
                membership = db.get_one("SELECT COUNT(*) as count FROM collection_issues WHERE manga_chapter_id = %s", [item_id])
            else:
                membership = db.get_one("SELECT COUNT(*) as count FROM collection_issues WHERE issue_id = %s", [item_id])

            if membership and membership["count"] > 0:
                blocked += 1
                continue
                
            # Check if collection already exists for this issue
            item_cv_id = item.get("cv_id")
            if item_cv_id:
                existing = db.get_one("SELECT id FROM collections WHERE cv_id = %s", [item_cv_id])
                if existing:
                    if use_manga_chapters:
                        replace_manga_chapter_with_collection(db, item_id, existing["id"])
                    else:
                        replace_issue_with_collection(db, item_id, existing["id"])
                    skipped += 1
                    continue
            
            # Insert into collections
            cursor = db.conn.execute(
                """
                INSERT INTO collections (
                    cv_vol_id, volume_id, name, image, site_link, cv_id, cv_slug, 
                    publisher, issue_number, cover_date, release_date, description, pages
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                [
                    item_cv_vol_id, item.get("volume_id") or volume_id, item.get("name") or "Без назви",
                    item.get("image"), item.get("site_link"), item.get("cv_id"), item.get("cv_slug"),
                    volume.get("publisher"), item.get("issue_number"), 
                    item.get("cover_date") or item.get("release_date"), item.get("release_date"), item.get("description"), item.get("pages")
                ]
            )
            new_col_id = cursor.fetchone()["id"]
            
            if use_manga_chapters:
                replace_manga_chapter_with_collection(db, item_id, new_col_id)
            else:
                replace_issue_with_collection(db, item_id, new_col_id)
            converted += 1
            
        if converted > 0 or skipped > 0:
            # COLLECTION_THEME_ID = 44
            db.conn.execute("INSERT INTO volume_themes (volume_id, theme_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", [volume_id, 44])
            
            # Handle magazine parent logic from DSA
            has_magazine_parent = db.get_one("SELECT id FROM magazine_volumes WHERE volume_id = %s", [volume_id])
            if has_magazine_parent:
                # TRANSLATED_THEME_ID = 51
                db.conn.execute("DELETE FROM volume_themes WHERE volume_id = %s AND theme_id = %s", [volume_id, 51])
                if not volume.get("lang"):
                    db.conn.execute("UPDATE volumes SET lang = 'ja' WHERE id = %s", [volume_id])
                    
        db.conn.commit()
    except Exception as e:
        db.conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
        
    return {
        "message": f"Конвертовано: {converted}, видалено дублікатів: {skipped}, пропущено: {blocked}",
        "converted": converted,
        "skipped": skipped,
        "blocked": blocked
    }

@router.post("/{volume_id}/convert-all-collections-to-issues")
async def convert_all_collections_to_issues(volume_id: int):
    db = get_db()
    
    # Check if volume exists
    volume = db.get_one("SELECT * FROM volumes WHERE id = %s", [volume_id])
    if not volume:
        raise HTTPException(status_code=404, detail="Том не знайдено")

    # Get collections
    collections = db.get_all("SELECT * FROM collections WHERE volume_id = %s", [volume_id])
        
    if not collections:
        raise HTTPException(status_code=400, detail="У цього тома немає збірників")

    converted = 0
    skipped = 0
    
    try:
        db.conn.execute("BEGIN")
        for col in collections:
            col_id = col["id"]
            col_cv_id = col.get("cv_id")
            
            if col_cv_id:
                existing_issue = db.get_one("SELECT id FROM issues WHERE cv_id = %s", [col_cv_id])
                if existing_issue:
                    skipped += 1
                    continue
            
            # Insert into issues
            db.conn.execute(
                """
                INSERT INTO issues (
                    cv_id, cv_slug, name, image, cv_vol_id, volume_id, 
                    issue_number, cover_date, release_date, site_link, description, pages
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                [
                    col.get("cv_id"), col.get("cv_slug"), col.get("name") or "Без назви",
                    col.get("image"), col.get("cv_vol_id") or volume.get("cv_id"), volume_id,
                    col.get("issue_number"), col.get("cover_date"), col.get("release_date"),
                    col.get("site_link"), col.get("description"), col.get("pages")
                ]
            )
            
            # Cleanup
            db.conn.execute("DELETE FROM collection_issues WHERE collection_id = %s", [col_id])
            db.conn.execute("DELETE FROM collection_themes WHERE collection_id = %s", [col_id])
            db.conn.execute("DELETE FROM series_collections WHERE collection_id = %s", [col_id])
            db.conn.execute("DELETE FROM collections WHERE id = %s", [col_id])
            converted += 1
            
        # COLLECTION_THEME_ID = 44
        db.conn.execute("DELETE FROM volume_themes WHERE volume_id = %s AND theme_id = %s", [volume_id, 44])
        
        db.conn.commit()
    except Exception as e:
        db.conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
        
    return {
        "message": f"Конвертовано: {converted}, пропущено: {skipped}",
        "converted": converted,
        "skipped": skipped
    }

@router.delete("/{volume_id}")
async def delete_volume(volume_id: int):
    db = get_db()
    
    # Check if volume exists
    volume = db.get_one("SELECT * FROM volumes WHERE id = %s", [volume_id])
    if not volume:
        raise HTTPException(status_code=404, detail="Том не знайдено")
        
    try:
        db.conn.execute("BEGIN")
        
        # 1. Themes
        db.conn.execute("DELETE FROM volume_themes WHERE volume_id = %s", [volume_id])
            
        # 2. Series links
        db.conn.execute("DELETE FROM series_volumes WHERE volume_id = %s", [volume_id])
        
        # 3. Translations/Magazines
        db.conn.execute("DELETE FROM volume_translations WHERE parent_id = %s OR child_id = %s", [volume_id, volume_id])
        db.conn.execute("DELETE FROM magazine_volumes WHERE volume_id = %s", [volume_id])
        
        # 4. Issues and their links
        issues = db.get_all("SELECT id FROM issues WHERE volume_id = %s", [volume_id])
            
        issue_ids = [i["id"] for i in issues]
        if issue_ids:
            placeholders = ",".join("%s" for _ in issue_ids)
            db.conn.execute(f"DELETE FROM collection_issues WHERE issue_id IN ({placeholders})", issue_ids)
            db.conn.execute(f"DELETE FROM reading_order_issues WHERE issue_id IN ({placeholders})", issue_ids)
            db.conn.execute(f"DELETE FROM issues WHERE id IN ({placeholders})", issue_ids)

        # 5. Collections and their links
        collections = db.get_all("SELECT id FROM collections WHERE volume_id = %s", [volume_id])
            
        col_ids = [c["id"] for c in collections]
        if col_ids:
            placeholders = ",".join("%s" for _ in col_ids)
            db.conn.execute(f"DELETE FROM collection_issues WHERE collection_id IN ({placeholders})", col_ids)
            db.conn.execute(f"DELETE FROM collection_themes WHERE collection_id IN ({placeholders})", col_ids)
            db.conn.execute(f"DELETE FROM series_collections WHERE collection_id IN ({placeholders})", col_ids)
            db.conn.execute(f"DELETE FROM collections WHERE id IN ({placeholders})", col_ids)

        # 6. Finally delete the volume itself
        db.conn.execute("DELETE FROM volumes WHERE id = %s", [volume_id])
        
        db.conn.commit()
    except Exception as e:
        db.conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
        
    return {"message": "Том та всі пов'язані дані успішно видалено"}

@router.get("/issue/{issue_id}/collections-membership")
async def get_issue_collections_membership(issue_id: int, type: str = "issue"):
    db = get_db()
    if type == "manga_chapter":
        query = """
            SELECT c.*, v.name as volume_name, v.id as volume_id
            FROM collection_issues ci
            JOIN collections c ON c.id = ci.collection_id
            LEFT JOIN volumes v ON c.volume_id = v.id
            WHERE ci.manga_chapter_id = %s
            ORDER BY CASE WHEN c.issue_number ~ '^[0-9]' THEN CAST(substring(c.issue_number from '^[0-9]+(\\.[0-9]+)?') AS NUMERIC) ELSE NULL END ASC NULLS LAST, COALESCE(c.release_date, c.cover_date) ASC
        """
    else:
        query = """
            SELECT c.*, v.name as volume_name, v.id as volume_id
            FROM collection_issues ci
            JOIN collections c ON c.id = ci.collection_id
            LEFT JOIN volumes v ON c.volume_id = v.id
            WHERE ci.issue_id = %s
            ORDER BY CASE WHEN c.issue_number ~ '^[0-9]' THEN CAST(substring(c.issue_number from '^[0-9]+(\\.[0-9]+)?') AS NUMERIC) ELSE NULL END ASC NULLS LAST, COALESCE(c.release_date, c.cover_date) ASC
        """
    collections = db.get_all(query, [issue_id])
    return {"data": collections}

# ── Relations ─────────────────────────────────────────────────────────────

@router.post("/{volume_id}/translations")
async def add_volume_translation(volume_id: int, data: dict):
    db = get_db()
    child_id = data.get("child_id")
    rel_type = data.get("rel_type", "translation")
    
    if not child_id:
        raise HTTPException(status_code=400, detail="child_id обов'язковий")
        
    db.execute(
        "INSERT INTO volume_translations (parent_id, child_id, rel_type) VALUES (%s, %s, %s)",
        [volume_id, child_id, rel_type]
    )
    
    # Auto-add 'Translated' theme (ID 51) only if languages are different
    parent_vol = db.get_one("SELECT lang FROM volumes WHERE id = %s", [volume_id])
    child_vol = db.get_one("SELECT lang FROM volumes WHERE id = %s", [child_id])
    
    if parent_vol and child_vol and parent_vol['lang'] != child_vol['lang']:
        translated_theme = db.get_one("SELECT id FROM themes WHERE id = 51")
        if translated_theme:
            db.execute(
                "INSERT INTO volume_themes (volume_id, theme_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                [child_id, 51]
            )
        
    return {"message": "Переклад додано"}

@router.delete("/{volume_id}/translations/{child_id}")
async def remove_volume_translation(volume_id: int, child_id: int):
    db = get_db()
    db.execute(
        "DELETE FROM volume_translations WHERE parent_id = %s AND child_id = %s",
        [volume_id, child_id]
    )
    return {"message": "Переклад видалено"}

@router.post("/{volume_id}/magazine-children")
async def add_volume_to_magazine(volume_id: int, data: dict):
    db = get_db()
    child_id = data.get("child_id")
    
    if not child_id:
        raise HTTPException(status_code=400, detail="child_id обов'язковий")
        
    volume = db.get_one("SELECT * FROM volumes WHERE id = %s", [volume_id])
    if not volume:
        raise HTTPException(status_code=404, detail="Том-журнал не знайдено")
        
    magazine = db.get_one("SELECT id FROM manga_magazines WHERE cv_id = %s OR name = %s", [volume.get("cv_id"), volume.get("name")])
    if not magazine:
        raise HTTPException(status_code=400, detail="Цей журнал ще не сконвертовано в нову структуру журналів. Спочатку конвертуйте його.")
        
    db.execute(
        "INSERT INTO magazine_volumes (magazine_id, volume_id) VALUES (%s, %s)",
        [magazine["id"], child_id]
    )
    
    # Auto-add 'Magazine' theme (ID 35) to magazine if it exists
    magazine_theme = db.get_one("SELECT id FROM themes WHERE id = 35")
    if magazine_theme:
        db.execute(
            "INSERT INTO volume_themes (volume_id, theme_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            [volume_id, 35]
        )
        
    return {"message": "Том додано до журналу"}

@router.delete("/{volume_id}/magazine-children/{child_id}")
async def remove_volume_from_magazine(volume_id: int, child_id: int):
    db = get_db()
    
    # 1. Try to delete assuming volume_id is a direct magazine_id from manga_magazines
    db.execute(
        "DELETE FROM magazine_volumes WHERE magazine_id = %s AND volume_id = %s",
        [volume_id, child_id]
    )
    
    # 2. Backward compatibility: if volume_id is a legacy volume_id from volumes, find its corresponding magazine and delete
    volume = db.get_one("SELECT * FROM volumes WHERE id = %s", [volume_id])
    if volume:
        magazine = db.get_one("SELECT id FROM manga_magazines WHERE cv_id = %s OR name = %s", [volume.get("cv_id"), volume.get("name")])
        if magazine:
            db.execute(
                "DELETE FROM magazine_volumes WHERE magazine_id = %s AND volume_id = %s",
                [magazine["id"], child_id]
            )
            
    return {"message": "Том видалено з журналу"}

@router.get("/{volume_id}/collections-from-issues")
async def get_volume_collections_from_issues(volume_id: int, request: Request):
    db = get_db()
    user_id = get_current_user_id(request)
    volume = db.get_one("SELECT * FROM volumes WHERE id = %s", [volume_id])
    if not volume:
        return {"data": []}

    vol_lang = volume.get("lang")

    # Find related volumes in the same language (including current volume)
    lang_clause = "AND v.lang = %s" if vol_lang else ""
    lang_params = [vol_lang] if vol_lang else []

    related = db.get_all(
        f"""
        SELECT DISTINCT v.id FROM volume_translations vt
        JOIN volumes v ON v.id = vt.child_id
        WHERE (
            vt.parent_id = %s
            OR vt.parent_id IN (SELECT parent_id FROM volume_translations WHERE child_id = %s)
        )
        AND v.id != %s
        {lang_clause}
        """,
        [volume_id, volume_id, volume_id] + lang_params,
    )

    vol_ids = [volume_id] + [r["id"] for r in related]
    placeholders = ",".join(["%s"] * len(vol_ids))
    
    # Get collections linked directly or via issues
    collections = db.get_all(
        f"""
        SELECT * FROM (
            SELECT DISTINCT c.*, pv.id as parent_vol_id, pv.name as parent_vol_name, pv.lang as parent_vol_lang,
                   EXISTS(SELECT 1 FROM user_volumes_collection uc WHERE uc.collection_id = c.id AND uc.user_id = %s) as is_owned
            FROM collections c
            LEFT JOIN collection_issues ci ON c.id = ci.collection_id
            LEFT JOIN issues i ON ci.issue_id = i.id
            LEFT JOIN volumes pv ON c.volume_id = pv.id
            WHERE (
                c.volume_id IN ({placeholders})
                OR i.volume_id IN ({placeholders})
            )
            { "AND (pv.lang = %s OR pv.lang IS NULL)" if vol_lang else "" }
        ) sub
        ORDER BY parent_vol_name ASC, CASE WHEN issue_number ~ '^[0-9]' THEN CAST(substring(issue_number from '^[0-9]+(\\.[0-9]+)?') AS NUMERIC) ELSE NULL END ASC NULLS LAST, name ASC
        """,
        [user_id] + vol_ids + vol_ids + ([vol_lang] if vol_lang else [])
    )

    # For each collection, find the issue numbers from THIS volume context
    result = []
    for col in collections:
        nums = db.get_all(
            f"""
            SELECT i.issue_number FROM collection_issues ci
            JOIN issues i ON ci.issue_id = i.id
            WHERE ci.collection_id = %s 
              AND i.volume_id IN ({placeholders})
              AND i.issue_number IS NOT NULL
            ORDER BY CASE WHEN i.issue_number ~ '^[0-9]' THEN CAST(substring(i.issue_number from '^[0-9]+(\\.[0-9]+)?') AS NUMERIC) ELSE NULL END ASC NULLS LAST
            """,
            [col["id"]] + vol_ids
        )
        col["is_owned"] = bool(col["is_owned"])
        col["volume_issue_numbers"] = [r["issue_number"] for r in nums]
        result.append(col)

    return {"data": result}


@router.get("/{volume_id}/characters")
async def get_volume_characters(volume_id: int):
    db = get_db()
    
    # Check if volume exists
    volume = db.get_one("SELECT name, name_uk FROM volumes WHERE id = %s", [volume_id])
    if not volume:
        raise HTTPException(status_code=404, detail="Том не знайдено")
        
    rows = db.get_all(
        """
        SELECT c.id, c.cv_id, c.name, c.name_uk, c.name_ro, c.real_name, c.real_name_uk, c.image, c.cv_slug, vc.role, c.mal_id, c.hikka_slug
        FROM volume_characters vc
        JOIN characters c ON vc.character_id = c.id
        WHERE vc.volume_id = %s
        ORDER BY 
          CASE vc.role WHEN 'main' THEN 0 WHEN 'supporting' THEN 1 ELSE 2 END,
          COALESCE(c.name_uk, c.name) ASC
        """,
        [volume_id]
    )
    return {"volume": volume, "items": rows}


@router.get("/{volume_id}/edit-history")
async def get_volume_edit_history(volume_id: int):
    db = get_db()
    volume = db.get_one("SELECT id FROM volumes WHERE id = %s", [volume_id])
    if not volume:
        raise HTTPException(status_code=404, detail="Том не знайдено")
        
    query = """
        SELECT er.*, u.username as proposer_username, COALESCE(u.nickname, u.username) as proposer_nickname,
               m.username as moderator_username, COALESCE(m.nickname, m.username) as moderator_nickname
        FROM edit_requests er
        JOIN users u ON er.user_id = u.id
        LEFT JOIN users m ON er.moderator_id = m.id
        WHERE er.entity_type = 'volume' AND er.entity_id = %s
        ORDER BY er.created_at DESC
    """
    rows = db.get_all(query, [volume_id])
    
    result = []
    for r in rows:
        d = dict(r)
        try:
            d["patch_data"] = json.loads(d["patch_data"])
        except Exception:
            d["patch_data"] = {}
        result.append(d)
        
    return {"data": result}