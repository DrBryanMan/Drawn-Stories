from fastapi import APIRouter, HTTPException, Request
import json
from ..db import get_db

router = APIRouter(prefix="/api/volumes", tags=["volumes"])

def get_current_user_id(request: Request):
    username = request.cookies.get("username")
    if not username:
        return None
    db = get_db()
    user = db.get_one("SELECT id FROM users WHERE username = ?", [username])
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
        WHERE v.id = ?
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
        SELECT DISTINCT t.id, t.cv_id, t.name, t.ua_name, COALESCE(t.type, 'theme') as type
        FROM volume_themes vt
        JOIN themes t ON t.id = vt.theme_id
        WHERE vt.volume_id = ?
        ORDER BY
          CASE COALESCE(t.type, 'theme')
            WHEN 'type' THEN 0
            WHEN 'genre' THEN 1
            ELSE 2
          END,
          COALESCE(t.ua_name, t.name) ASC
        """,
        [volume_id],
    )

    is_collection_volume = any(
        ('collection' in (t.get('name') or '').lower() or
         'збірник' in (t.get('ua_name') or '').lower() or
         'збірка' in (t.get('ua_name') or '').lower())
        for t in themes
    )

    if is_collection_volume:
        issues = db.get_all(
            """
            SELECT i.*, 'issue' as type, 
                   v.name as volume_name, v.name_uk as volume_name_uk,
                   v.cv_img as volume_cv_img, v.cover_img as volume_cover_img,
                   v.id as volume_db_id, v.cv_id as volume_cv_id,
                   (SELECT COUNT(DISTINCT ci2.collection_id) FROM collection_issues ci2 WHERE ci2.issue_id = i.id) as collection_count
            FROM issues i
            JOIN collection_issues ci ON i.id = ci.issue_id
            JOIN collections c ON ci.collection_id = c.id
            LEFT JOIN volumes v ON i.volume_id = v.id
            WHERE c.volume_id = ?
            GROUP BY i.id
            """,
            [volume_id],
        )
    else:
        issues = db.get_all(
            """
            SELECT i.*, 'issue' as type, (SELECT COUNT(*) FROM collection_issues ci WHERE ci.issue_id = i.id) as collection_count
            FROM issues i
            WHERE i.volume_id = ?
            GROUP BY i.id
            """,
            [volume_id],
        )

    # Get "direct" issues (those that belong to this volume directly)
    direct_issues = db.get_all(
        """
        SELECT i.*, 'issue' as type,
               (SELECT COUNT(*) FROM collection_issues ci WHERE ci.issue_id = i.id) as collection_count
        FROM issues i
        WHERE i.volume_id = ?
        ORDER BY CAST(i.issue_number AS REAL) ASC, i.issue_number ASC
        """,
        [volume_id]
    )
    
    convertable_count = sum(1 for i in direct_issues if i["collection_count"] == 0)

    collections = db.get_all(
        """
        SELECT c.*, 'collection' as type,
               EXISTS(SELECT 1 FROM user_collections uc WHERE uc.collection_id = c.id AND uc.user_id = ?) as is_owned
        FROM collections c
        WHERE c.volume_id = ?
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
        WHERE vt.child_id = ?
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
        WHERE vt.parent_id = ?
        ORDER BY v.lang ASC, v.name ASC
        """,
        [volume_id]
    )

    magazine_parents = db.get_all(
        """
        SELECT v.*, p.name as publisher_name, 'volume' as type,
               (SELECT COUNT(*) FROM issues i WHERE i.volume_id = v.id) as issue_count
        FROM volume_magazines vm
        JOIN volumes v ON v.id = vm.magazine_id
        LEFT JOIN publishers p ON p.id = v.publisher
        WHERE vm.child_id = ?
        ORDER BY v.name ASC
        """,
        [volume_id]
    )
    magazine = magazine_parents[0] if magazine_parents else None

    magazine_children = db.get_all(
        """
        SELECT v.*, p.name as publisher_name, 'volume' as type,
               (SELECT COUNT(*) FROM issues i WHERE i.volume_id = v.id) as issue_count
        FROM volume_magazines vm
        JOIN volumes v ON v.id = vm.child_id
        LEFT JOIN publishers p ON p.id = v.publisher
        WHERE vm.magazine_id = ?
        ORDER BY v.name ASC
        """,
        [volume_id]
    )

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
        "stats": {
            "issues": len(issues),
            "collections": len(collections),
            "owned_collections": owned_count,
            "total_items": len(items),
            "first_release": issue_dates[0] if issue_dates else None,
            "last_release": issue_dates[-1] if issue_dates else None,
        },
    }

def replace_volume_themes(db, volume_id, theme_ids):
    # Delete existing themes
    db.execute("DELETE FROM volume_themes WHERE volume_id = ?", [volume_id])
        
    # Insert new themes
    for theme_id in theme_ids:
        db.execute(
            "INSERT INTO volume_themes (volume_id, theme_id) VALUES (?, ?)",
            [volume_id, theme_id]
        )

def replace_issue_with_collection(db, issue_id, collection_id):
    reading_order_links = db.conn.execute(
        """
        SELECT reading_order_id, order_num
        FROM reading_order_issues
        WHERE issue_id = ?
        """,
        [issue_id]
    ).fetchall()

    for link in reading_order_links:
        db.conn.execute(
            """
            INSERT OR IGNORE INTO reading_order_collections (reading_order_id, collection_id, order_num)
            VALUES (?, ?, ?)
            """,
            [link["reading_order_id"], collection_id, link["order_num"]]
        )

    db.conn.execute("DELETE FROM reading_order_issues WHERE issue_id = ?", [issue_id])
    db.conn.execute("UPDATE characters SET first_appearance = NULL WHERE first_appearance = ?", [issue_id])
    db.conn.execute("DELETE FROM issues WHERE id = ?", [issue_id])

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
        "status", "lang", "publisher", "cv_img", "cover_img",
        "cv_id", "cv_slug", "hikka_slug", "mal_id", "locg_id", "locg_slug", "site_link"
    ]
    
    for key, value in data.items():
        if key in allowed_fields and value is not None:
            columns.append(key)
            placeholders.append("?")
            params.append(value)
            
    if not columns:
        raise HTTPException(status_code=400, detail="Немає даних для збереження")

    sql = f"INSERT INTO volumes ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
    db.execute(sql, params)
    
    # Get the last inserted ID
    new_id = db.get_one("SELECT last_insert_rowid() as id")["id"]
    
    # Update themes if provided
    if "theme_ids" in data and isinstance(data["theme_ids"], list):
        replace_volume_themes(db, new_id, data["theme_ids"])
    
    return {"message": "Том успішно створено", "id": new_id}

@router.put("/{volume_id}")
async def update_volume(volume_id: int, data: dict):
    db = get_db()
    
    # Check if volume exists
    volume = db.get_one("SELECT id FROM volumes WHERE id = ?", [volume_id])
    if not volume:
        raise HTTPException(status_code=404, detail="Том не знайдено")

    # Update fields
    fields = []
    params = []
    
    allowed_fields = [
        "name", "name_uk", "name_native", "description", "synopsis", "synopsis_ua", "start_year", 
        "status", "lang", "publisher", "cv_img", "cover_img",
        "cv_id", "cv_slug", "hikka_slug", "mal_id", "locg_id", "locg_slug", "site_link"
    ]
    
    for key, value in data.items():
        if key in allowed_fields:
            fields.append(f"{key} = ?")
            params.append(value)
            
    if fields:
        params.append(volume_id)
        db.execute(
            f"UPDATE volumes SET {', '.join(fields)} WHERE id = ?",
            params
        )
    
    # Update themes if provided
    if "theme_ids" in data and isinstance(data["theme_ids"], list):
        replace_volume_themes(db, volume_id, data["theme_ids"])
    
    return {"message": "Volume updated successfully"}

@router.post("/{volume_id}/convert-all-to-collections")
async def convert_all_to_collections(volume_id: int):
    db = get_db()
    
    # Check if volume exists
    volume = db.get_one("SELECT * FROM volumes WHERE id = ?", [volume_id])
    if not volume:
        raise HTTPException(status_code=404, detail="Том не знайдено")

    # Get issues
    issues = db.get_all("SELECT * FROM issues WHERE volume_id = ?", [volume_id])
        
    if not issues:
        raise HTTPException(status_code=400, detail="У цього тома немає випусків")

    converted = 0
    skipped = 0
    blocked = 0
    
    try:
        # We start a transaction manually
        db.conn.execute("BEGIN")
        for issue in issues:
            issue_id = issue["id"]
            issue_cv_vol_id = issue.get("cv_vol_id") or volume.get("cv_id")
            
            # Check if used in collections
            membership = db.get_one("SELECT COUNT(*) as count FROM collection_issues WHERE issue_id = ?", [issue_id])
            if membership and membership["count"] > 0:
                blocked += 1
                continue
                
            # Check if collection already exists for this issue
            issue_cv_id = issue.get("cv_id")
            if issue_cv_id:
                existing = db.get_one("SELECT id FROM collections WHERE cv_id = ?", [issue_cv_id])
                if existing:
                    replace_issue_with_collection(db, issue_id, existing["id"])
                    skipped += 1
                    continue
            
            # Insert into collections
            cursor = db.conn.execute(
                """
                INSERT INTO collections (
                    cv_vol_id, volume_id, name, cv_img, site_link, cv_id, cv_slug, 
                    publisher, issue_number, cover_date, release_date, description, pages
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    issue_cv_vol_id, issue.get("volume_id") or volume_id, issue.get("name") or "Без назви",
                    issue.get("cv_img"), issue.get("site_link"), issue.get("cv_id"), issue.get("cv_slug"),
                    volume.get("publisher"), issue.get("issue_number"), 
                    issue.get("cover_date"), issue.get("release_date"), issue.get("description"), issue.get("pages")
                ]
            )
            
            replace_issue_with_collection(db, issue_id, cursor.lastrowid)
            converted += 1
            
        if converted > 0 or skipped > 0:
            # COLLECTION_THEME_ID = 44
            db.conn.execute("INSERT OR IGNORE INTO volume_themes (volume_id, theme_id) VALUES (?, ?)", [volume_id, 44])
            
            # Handle magazine parent logic from DSA
            has_magazine_parent = db.get_one("SELECT id FROM volume_magazines WHERE child_id = ?", [volume_id])
            if has_magazine_parent:
                # TRANSLATED_THEME_ID = 51
                db.conn.execute("DELETE FROM volume_themes WHERE volume_id = ? AND theme_id = ?", [volume_id, 51])
                if not volume.get("lang"):
                    db.conn.execute("UPDATE volumes SET lang = 'ja' WHERE id = ?", [volume_id])
                    
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
    volume = db.get_one("SELECT * FROM volumes WHERE id = ?", [volume_id])
    if not volume:
        raise HTTPException(status_code=404, detail="Том не знайдено")

    # Get collections
    collections = db.get_all("SELECT * FROM collections WHERE volume_id = ?", [volume_id])
        
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
                existing_issue = db.get_one("SELECT id FROM issues WHERE cv_id = ?", [col_cv_id])
                if existing_issue:
                    skipped += 1
                    continue
            
            # Insert into issues
            db.conn.execute(
                """
                INSERT INTO issues (
                    cv_id, cv_slug, name, cv_img, cv_vol_id, volume_id, 
                    issue_number, cover_date, release_date, site_link, description, pages
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    col.get("cv_id"), col.get("cv_slug"), col.get("name") or "Без назви",
                    col.get("cv_img"), col.get("cv_vol_id") or volume.get("cv_id"), volume_id,
                    col.get("issue_number"), col.get("cover_date"), col.get("release_date"),
                    col.get("site_link"), col.get("description"), col.get("pages")
                ]
            )
            
            # Cleanup
            db.conn.execute("DELETE FROM collection_issues WHERE collection_id = ?", [col_id])
            db.conn.execute("DELETE FROM collection_themes WHERE collection_id = ?", [col_id])
            db.conn.execute("DELETE FROM series_collections WHERE collection_id = ?", [col_id])
            db.conn.execute("DELETE FROM collections WHERE id = ?", [col_id])
            converted += 1
            
        # COLLECTION_THEME_ID = 44
        db.conn.execute("DELETE FROM volume_themes WHERE volume_id = ? AND theme_id = ?", [volume_id, 44])
        
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
    volume = db.get_one("SELECT * FROM volumes WHERE id = ?", [volume_id])
    if not volume:
        raise HTTPException(status_code=404, detail="Том не знайдено")
        
    try:
        db.conn.execute("BEGIN")
        
        # 1. Themes
        db.conn.execute("DELETE FROM volume_themes WHERE volume_id = ?", [volume_id])
            
        # 2. Series links
        db.conn.execute("DELETE FROM series_volumes WHERE volume_id = ?", [volume_id])
        
        # 3. Translations/Magazines
        db.conn.execute("DELETE FROM volume_translations WHERE parent_id = ? OR child_id = ?", [volume_id, volume_id])
        db.conn.execute("DELETE FROM volume_magazines WHERE magazine_id = ? OR child_id = ?", [volume_id, volume_id])
        
        # 4. Issues and their links
        issues = db.get_all("SELECT id FROM issues WHERE volume_id = ?", [volume_id])
            
        issue_ids = [i["id"] for i in issues]
        if issue_ids:
            placeholders = ",".join("?" for _ in issue_ids)
            db.conn.execute(f"DELETE FROM collection_issues WHERE issue_id IN ({placeholders})", issue_ids)
            db.conn.execute(f"DELETE FROM reading_order_issues WHERE issue_id IN ({placeholders})", issue_ids)
            db.conn.execute(f"DELETE FROM issues WHERE id IN ({placeholders})", issue_ids)

        # 5. Collections and their links
        collections = db.get_all("SELECT id FROM collections WHERE volume_id = ?", [volume_id])
            
        col_ids = [c["id"] for c in collections]
        if col_ids:
            placeholders = ",".join("?" for _ in col_ids)
            db.conn.execute(f"DELETE FROM collection_issues WHERE collection_id IN ({placeholders})", col_ids)
            db.conn.execute(f"DELETE FROM collection_themes WHERE collection_id IN ({placeholders})", col_ids)
            db.conn.execute(f"DELETE FROM series_collections WHERE collection_id IN ({placeholders})", col_ids)
            db.conn.execute(f"DELETE FROM collections WHERE id IN ({placeholders})", col_ids)

        # 6. Finally delete the volume itself
        db.conn.execute("DELETE FROM volumes WHERE id = ?", [volume_id])
        
        db.conn.commit()
    except Exception as e:
        db.conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
        
    return {"message": "Том та всі пов'язані дані успішно видалено"}

@router.get("/issue/{issue_id}/collections-membership")
async def get_issue_collections_membership(issue_id: int):
    db = get_db()
    collections = db.get_all(
        """
        SELECT c.*, v.name as volume_name, v.id as volume_id
        FROM collection_issues ci
        JOIN collections c ON c.id = ci.collection_id
        LEFT JOIN volumes v ON c.volume_id = v.id
        WHERE ci.issue_id = ?
        ORDER BY CAST(c.issue_number AS REAL) ASC, COALESCE(c.release_date, c.cover_date) ASC
        """,
        [issue_id],
    )
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
        "INSERT INTO volume_translations (parent_id, child_id, rel_type) VALUES (?, ?, ?)",
        [volume_id, child_id, rel_type]
    )
    
    # Auto-add 'Translated' theme (ID 51) only if languages are different
    parent_vol = db.get_one("SELECT lang FROM volumes WHERE id = ?", [volume_id])
    child_vol = db.get_one("SELECT lang FROM volumes WHERE id = ?", [child_id])
    
    if parent_vol and child_vol and parent_vol['lang'] != child_vol['lang']:
        translated_theme = db.get_one("SELECT id FROM themes WHERE id = 51")
        if translated_theme:
            db.execute(
                "INSERT OR IGNORE INTO volume_themes (volume_id, theme_id) VALUES (?, ?)",
                [child_id, 51]
            )
        
    return {"message": "Переклад додано"}

@router.delete("/{volume_id}/translations/{child_id}")
async def remove_volume_translation(volume_id: int, child_id: int):
    db = get_db()
    db.execute(
        "DELETE FROM volume_translations WHERE parent_id = ? AND child_id = ?",
        [volume_id, child_id]
    )
    return {"message": "Переклад видалено"}

@router.post("/{volume_id}/magazine-children")
async def add_volume_to_magazine(volume_id: int, data: dict):
    db = get_db()
    child_id = data.get("child_id")
    
    if not child_id:
        raise HTTPException(status_code=400, detail="child_id обов'язковий")
        
    db.execute(
        "INSERT INTO volume_magazines (magazine_id, child_id) VALUES (?, ?)",
        [volume_id, child_id]
    )
    
    # Auto-add 'Magazine' theme (ID 35) to magazine if it exists
    magazine_theme = db.get_one("SELECT id FROM themes WHERE id = 35")
    if magazine_theme:
        db.execute(
            "INSERT OR IGNORE INTO volume_themes (volume_id, theme_id) VALUES (?, ?)",
            [volume_id, 35]
        )
        
    return {"message": "Том додано до журналу"}

@router.delete("/{volume_id}/magazine-children/{child_id}")
async def remove_volume_from_magazine(volume_id: int, child_id: int):
    db = get_db()
    db.execute(
        "DELETE FROM volume_magazines WHERE magazine_id = ? AND child_id = ?",
        [volume_id, child_id]
    )
    return {"message": "Том видалено з журналу"}

@router.get("/{volume_id}/collections-from-issues")
async def get_volume_collections_from_issues(volume_id: int, request: Request):
    db = get_db()
    user_id = get_current_user_id(request)
    volume = db.get_one("SELECT * FROM volumes WHERE id = ?", [volume_id])
    if not volume:
        return {"data": []}

    vol_lang = volume.get("lang")

    # Find related volumes in the same language (including current volume)
    lang_clause = "AND v.lang = ?" if vol_lang else ""
    lang_params = [vol_lang] if vol_lang else []

    related = db.get_all(
        f"""
        SELECT DISTINCT v.id FROM volume_translations vt
        JOIN volumes v ON v.id = vt.child_id
        WHERE (
            vt.parent_id = ?
            OR vt.parent_id IN (SELECT parent_id FROM volume_translations WHERE child_id = ?)
        )
        AND v.id != ?
        {lang_clause}
        """,
        [volume_id, volume_id, volume_id] + lang_params,
    )

    vol_ids = [volume_id] + [r["id"] for r in related]
    placeholders = ",".join("?" * len(vol_ids))
    
    # Get collections linked directly or via issues
    collections = db.get_all(
        f"""
        SELECT DISTINCT c.*, pv.id as parent_vol_id, pv.name as parent_vol_name, pv.lang as parent_vol_lang,
               EXISTS(SELECT 1 FROM user_collections uc WHERE uc.collection_id = c.id AND uc.user_id = ?) as is_owned
        FROM collections c
        LEFT JOIN collection_issues ci ON c.id = ci.collection_id
        LEFT JOIN issues i ON ci.issue_id = i.id
        LEFT JOIN volumes pv ON c.volume_id = pv.id
        WHERE (
            c.volume_id IN ({placeholders})
            OR i.volume_id IN ({placeholders})
        )
        { "AND (pv.lang = ? OR pv.lang IS NULL)" if vol_lang else "" }
        ORDER BY pv.name ASC, CAST(c.issue_number AS REAL) ASC, c.name ASC
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
            WHERE ci.collection_id = ? 
              AND i.volume_id IN ({placeholders})
              AND i.issue_number IS NOT NULL
            ORDER BY CAST(i.issue_number AS REAL) ASC
            """,
            [col["id"]] + vol_ids
        )
        col["is_owned"] = bool(col["is_owned"])
        col["volume_issue_numbers"] = [r["issue_number"] for r in nums]
        result.append(col)

    return {"data": result}
