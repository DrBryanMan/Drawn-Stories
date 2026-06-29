from fastapi import APIRouter, HTTPException, Request
from ..db import get_db

router = APIRouter(prefix="/api/magazines", tags=["magazines"])

@router.post("/convert-from-volume/{volume_id}")
async def convert_from_volume(volume_id: int):
    db = get_db()
    
    # 1. Check if volume exists
    volume = db.get_one("SELECT * FROM volumes WHERE id = ?", [volume_id])
    if not volume:
        raise HTTPException(status_code=404, detail="Том не знайдено")
        
    # 2. Check if volume is indeed a manga magazine (has themes 35 and 36)
    # Theme 35 = Magazine, Theme 36 = Manga
    has_mag_theme = db.get_one("SELECT 1 FROM volume_themes WHERE volume_id = ? AND theme_id = 35", [volume_id])
    has_manga_theme = db.get_one("SELECT 1 FROM volume_themes WHERE volume_id = ? AND theme_id = 36", [volume_id])
    
    if not has_mag_theme or not has_manga_theme:
        raise HTTPException(status_code=400, detail="Том не є журналом манґи (не має тем журналу та манґи)")

    # Check if already converted
    existing = db.get_one("SELECT id FROM manga_magazines WHERE cv_id = ? OR name = ?", [volume.get("cv_id"), volume.get("name")])
    if existing:
         raise HTTPException(status_code=400, detail="Цей журнал вже сконвертовано")

    try:
        db.conn.execute("BEGIN")
        
        # 3. Insert into manga_magazines
        cursor = db.conn.execute("""
            INSERT INTO manga_magazines (
                cv_id, cv_slug, image, name, name_native, publisher, start_year
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            volume.get("cv_id"), volume.get("cv_slug"), volume.get("cv_img"),
            volume.get("name") or "Без назви", volume.get("name_native"),
            volume.get("publisher"), volume.get("start_year")
        ])
        new_mag_id = cursor.lastrowid
        
        # 4. Migrate issues of this volume into magazine_issues
        issues = db.get_all("SELECT * FROM issues WHERE volume_id = ?", [volume_id])
        for iss in issues:
            cursor_iss = db.conn.execute("""
                INSERT INTO magazine_issues (
                    cv_id, cv_slug, image, release_date, cover_date, issue_number, name, magazine_id, pages
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                iss.get("cv_id"), iss.get("cv_slug"), iss.get("cv_img"),
                iss.get("release_date"), iss.get("cover_date"), iss.get("issue_number"),
                iss.get("name"), new_mag_id, iss.get("pages")
            ])
            new_iss_id = cursor_iss.lastrowid
            
        # Find and migrate links from magazine_chapters if they exist
            chapters = db.get_all("SELECT * FROM magazine_chapters WHERE mag_issue_id = ?", [iss["id"]])
            for ch in chapters:
                ch_issue = db.get_one("SELECT volume_id FROM issues WHERE id = ?", [ch["issue_id"]])
                if ch_issue and ch_issue["volume_id"]:
                    db.conn.execute("""
                        INSERT OR IGNORE INTO magazine_issue_chapters (
                            magazine_issue_id, manga_id, manga_chapter_id, order_num
                        ) VALUES (?, ?, ?, ?)
                    """, [new_iss_id, ch_issue["volume_id"], ch["issue_id"], ch["sort_order"]])

        # Migrate volume-magazine relations (manga series associated with this magazine)
        # Old relation structure linked old volume_id of magazine to child_id (volume of manga)
        # We copy this relationship into the updated structure:
        # magazine_id = new_mag_id (from manga_magazines), volume_id = old child_id (from volumes)
        db.conn.execute("""
            INSERT OR IGNORE INTO volume_magazines (magazine_id, volume_id)
            SELECT ?, volume_id FROM (
                SELECT volume_id FROM volume_magazines WHERE magazine_id = ?
            )
        """, [new_mag_id, volume_id])

        # 5. Clean up old volume data
        # Delete volume themes
        db.conn.execute("DELETE FROM volume_themes WHERE volume_id = ?", [volume_id])
        # Delete volume relations & translations
        db.conn.execute("DELETE FROM volume_translations WHERE parent_id = ? OR child_id = ?", [volume_id, volume_id])
        db.conn.execute("DELETE FROM volume_magazines WHERE magazine_id = ? OR volume_id = ?", [volume_id, volume_id])
        # Delete issues
        issue_ids = [iss["id"] for iss in issues]
        if issue_ids:
             placeholders = ",".join("?" for _ in issue_ids)
             db.conn.execute(f"DELETE FROM collection_issues WHERE issue_id IN ({placeholders})", issue_ids)
             db.conn.execute(f"DELETE FROM reading_order_issues WHERE issue_id IN ({placeholders})", issue_ids)
             db.conn.execute(f"DELETE FROM issues WHERE id IN ({placeholders})", issue_ids)
        # Finally delete volume
        db.conn.execute("DELETE FROM volumes WHERE id = ?", [volume_id])
        
        db.conn.commit()
    except Exception as e:
        db.conn.rollback()
        raise HTTPException(status_code=400, detail=f"Помилка при конвертації: {str(e)}")
        
    return {"message": "Журнал успішно сконвертовано та відокремлено від томів", "id": new_mag_id}

@router.get("/issues/{issue_id}")
async def get_magazine_issue_detail(issue_id: int):
    db = get_db()
    
    # Get issue details
    issue = db.get_one("""
        SELECT mi.*, mm.name as magazine_name, mm.id as magazine_db_id
        FROM magazine_issues mi
        JOIN manga_magazines mm ON mi.magazine_id = mm.id
        WHERE mi.id = ?
    """, [issue_id])
    
    if not issue:
        raise HTTPException(status_code=404, detail="Випуск журналу не знайдено")
        
    # Get chapters (horizontal cards info)
    chapters = db.get_all("""
        SELECT mic.order_num, mic.label,
               v.name as manga_name, v.name_uk as manga_name_uk, v.cv_img as manga_cover, v.id as manga_volume_id,
               i.id as chapter_id, i.issue_number as chapter_number, i.name as chapter_name
        FROM magazine_issue_chapters mic
        JOIN volumes v ON mic.manga_id = v.id
        JOIN issues i ON mic.manga_chapter_id = i.id
        WHERE mic.magazine_issue_id = ?
        ORDER BY mic.order_num ASC
    """, [issue_id])
    
    return {
        "issue": issue,
        "chapters": chapters
    }

@router.get("/{id}")
async def get_magazine_detail(id: int):
    db = get_db()
    
    # Get magazine
    magazine = db.get_one("""
        SELECT mm.*, p.name as publisher_name, p.cv_slug as publisher_slug
        FROM manga_magazines mm
        LEFT JOIN publishers p ON mm.publisher = p.id
        WHERE mm.id = ?
    """, [id])
    
    if not magazine:
        raise HTTPException(status_code=404, detail="Журнал не знайдено")
        
    # Get recent issues (Limit to 6)
    issues = db.get_all("""
        SELECT * FROM magazine_issues
        WHERE magazine_id = ?
        ORDER BY CAST(issue_number AS REAL) DESC, issue_number DESC, release_date DESC, cover_date DESC
        LIMIT 6
    """, [id])
    
    # Get count of total issues
    issues_count = db.get_one("SELECT COUNT(*) as count FROM magazine_issues WHERE magazine_id = ?", [id])["count"]
    
    # Get active series (volumes connected through updated volume_magazines where theme is 72 or 74)
    # Limit to 6
    series = db.get_all("""
        SELECT DISTINCT v.*, p.name as publisher_name
        FROM volumes v
        JOIN volume_magazines vm ON v.id = vm.volume_id
        LEFT JOIN publishers p ON v.publisher = p.id
        WHERE vm.magazine_id = ?
          AND EXISTS (
              SELECT 1 FROM volume_themes vt 
              WHERE vt.volume_id = v.id AND vt.theme_id IN (72, 74)
          )
        ORDER BY v.name ASC
        LIMIT 6
    """, [id])

    # Get count of total series
    series_count = db.get_one("""
        SELECT COUNT(DISTINCT v.id) as count
        FROM volumes v
        JOIN volume_magazines vm ON v.id = vm.volume_id
        WHERE vm.magazine_id = ?
          AND EXISTS (
              SELECT 1 FROM volume_themes vt 
              WHERE vt.volume_id = v.id AND vt.theme_id IN (72, 74)
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
        WHERE magazine_id = ?
        ORDER BY CAST(issue_number AS REAL) DESC, issue_number DESC, release_date DESC, cover_date DESC
        LIMIT ? OFFSET ?
    """, [id, limit, offset])
    
    total = db.get_one("SELECT COUNT(*) as count FROM magazine_issues WHERE magazine_id = ?", [id])["count"]
    
    return {
        "items": issues,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.get("/{id}/all-series")
async def get_all_magazine_series(id: int, page: int = 1, limit: int = 24):
    db = get_db()
    offset = (page - 1) * limit
    
    series = db.get_all("""
        SELECT DISTINCT v.*, p.name as publisher_name
        FROM volumes v
        JOIN volume_magazines vm ON v.id = vm.volume_id
        LEFT JOIN publishers p ON v.publisher = p.id
        WHERE vm.magazine_id = ?
          AND EXISTS (
              SELECT 1 FROM volume_themes vt 
              WHERE vt.volume_id = v.id AND vt.theme_id IN (72, 74)
          )
        ORDER BY v.name ASC
        LIMIT ? OFFSET ?
    """, [id, limit, offset])
    
    total = db.get_one("""
        SELECT COUNT(DISTINCT v.id) as count
        FROM volumes v
        JOIN volume_magazines vm ON v.id = vm.volume_id
        WHERE vm.magazine_id = ?
          AND EXISTS (
              SELECT 1 FROM volume_themes vt 
              WHERE vt.volume_id = v.id AND vt.theme_id IN (72, 74)
          )
    """, [id])["count"]
    
    return {
        "items": series,
        "total": total,
        "page": page,
        "limit": limit
    }

