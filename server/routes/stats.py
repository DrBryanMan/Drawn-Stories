from fastapi import APIRouter
from ..db import get_db

router = APIRouter(prefix="/api/stats", tags=["stats"])

@router.get("")
async def get_stats():
    db = get_db()
    volumes     = db.get_one("SELECT COUNT(*) as count FROM volumes")["count"]
    collections = db.get_one("SELECT COUNT(*) as count FROM collections")["count"]
    issues      = db.get_one("SELECT COUNT(*) as count FROM issues")["count"]
    publishers  = db.get_one("SELECT COUNT(*) as count FROM publishers")["count"]
    themes      = db.get_one("SELECT COUNT(*) as count FROM themes")["count"]
    characters  = db.get_one("SELECT COUNT(*) as count FROM characters")["count"]
    authors     = db.get_one("SELECT COUNT(*) as count FROM persons")["count"]
    
    return { 
        "volumes": volumes, 
        "collections": collections,
        "issues": issues, 
        "publishers": publishers,
        "themes": themes,
        "characters": characters,
        "authors": authors
    }

@router.get("/popular")
async def get_popular_content():
    db = get_db()
    manga_theme_id = 36
    
    # 1. Top 5 publishers for comics (by volumes that are not manga)
    popular_publishers = db.get_all(f"""
        SELECT p.id, p.name, p.image, p.cv_slug, COUNT(v.id) as volume_count
        FROM publishers p
        JOIN volumes v ON v.publisher = p.id
        WHERE v.id NOT IN (
            SELECT volume_id FROM volume_themes WHERE theme_id = {manga_theme_id}
        )
        GROUP BY p.id
        ORDER BY volume_count DESC, p.name ASC
        LIMIT 8
    """)
    
    # 2. Top 5 manga series by MAL rating
    popular_manga = db.get_all(f"""
        SELECT v.id, v.name, v.name_uk, v.cover_img, v.image, v.mal_score, v.mal_scored_by
        FROM volumes v
        JOIN volume_themes vt ON v.id = vt.volume_id
        WHERE vt.theme_id = {manga_theme_id} AND v.mal_score IS NOT NULL AND v.mal_score > 0
        ORDER BY v.mal_score DESC, v.mal_scored_by DESC
        LIMIT 8
    """)
    
    # 3. Top 5 magazines by series count
    popular_magazines = db.get_all("""
        SELECT mm.id, mm.name, mm.image, mm.cv_slug, COUNT(mv.volume_id) as series_count
        FROM manga_magazines mm
        LEFT JOIN magazine_volumes mv ON mm.id = mv.magazine_id
        GROUP BY mm.id
        ORDER BY series_count DESC, mm.name ASC
        LIMIT 8
    """)
    
    # 4. Top 8 popular manga series that are currently releasing (theme_id = 72)
    popular_manga_ongoing = db.get_all("""
        SELECT v.id, v.name, v.name_uk, v.cover_img, v.image, v.mal_score, v.mal_scored_by
        FROM volumes v
        JOIN volume_themes vt ON v.id = vt.volume_id
        WHERE vt.theme_id = 72 AND v.mal_score IS NOT NULL AND v.mal_score > 0
        ORDER BY v.mal_score DESC, v.mal_scored_by DESC
        LIMIT 8
    """)
    
    # 5. Top publishers for ukrainian releases (lang = 'uk')
    popular_publishers_uk = db.get_all("""
        SELECT p.id, p.name, p.image, p.cv_slug, COUNT(v.id) as volume_count
        FROM publishers p
        JOIN volumes v ON v.publisher = p.id
        WHERE v.lang = 'uk'
        GROUP BY p.id
        ORDER BY volume_count DESC, p.name ASC
        LIMIT 8
    """)
    
    return {
        "publishers": [dict(r) for r in popular_publishers_uk] if False else [dict(r) for r in popular_publishers], # Keep original
        "publishers_original": [dict(r) for r in popular_publishers],
        "publishers_uk": [dict(r) for r in popular_publishers_uk],
        "manga": [dict(r) for r in popular_manga],
        "magazines": [dict(r) for r in popular_magazines],
        "manga_ongoing": [dict(r) for r in popular_manga_ongoing]
    }

@router.get("/ukrainian-tab")
async def get_ukrainian_tab_data(limit: int = 8):
    db = get_db()
    
    # 1. Announcements (release_date > CURRENT_DATE)
    announcements_cols = db.get_all("""
        SELECT c.id, c.name, c.issue_number, c.release_date, c.image as image, 'collection' as type,
               v.name as volume_name, v.name_uk as volume_name_uk, v.id as volume_id
        FROM collections c
        JOIN volumes v ON c.volume_id = v.id
        WHERE v.lang = 'uk' AND c.release_date > DATE('now')
    """)
    announcements_issues = db.get_all("""
        SELECT i.id, i.name, i.issue_number, i.release_date, i.image, 'issue' as type,
               v.name as volume_name, v.name_uk as volume_name_uk, v.id as volume_id
        FROM issues i
        JOIN volumes v ON i.volume_id = v.id
        WHERE v.lang = 'uk' AND i.release_date > DATE('now')
    """)
    announcements = [dict(r) for r in announcements_cols] + [dict(r) for r in announcements_issues]
    announcements.sort(key=lambda x: x.get("release_date") or "", reverse=False)
    announcements = announcements[:limit]
    
    # 2. New Releases (release_date <= CURRENT_DATE or null) - Limit 10
    new_releases_cols = db.get_all("""
        SELECT c.id, c.name, c.issue_number, c.release_date, c.image as image, 'collection' as type,
               v.name as volume_name, v.name_uk as volume_name_uk, v.id as volume_id, c.created_at
        FROM collections c
        JOIN volumes v ON c.volume_id = v.id
        WHERE v.lang = 'uk' AND (c.release_date <= DATE('now') OR c.release_date IS NULL OR c.release_date = '')
    """)
    new_releases_issues = db.get_all("""
        SELECT i.id, i.name, i.issue_number, i.release_date, i.image, 'issue' as type,
               v.name as volume_name, v.name_uk as volume_name_uk, v.id as volume_id, i.created_at
        FROM issues i
        JOIN volumes v ON i.volume_id = v.id
        WHERE v.lang = 'uk' AND (i.release_date <= DATE('now') OR i.release_date IS NULL OR i.release_date = '')
    """)
    new_releases = [dict(r) for r in new_releases_cols] + [dict(r) for r in new_releases_issues]
    new_releases.sort(key=lambda x: (x.get("release_date") or "", x.get("created_at") or ""), reverse=True)
    new_releases = new_releases[:10]
    
    # 3. Recent Ukrainian Series (volumes with lang = 'uk') - Limit 8
    recent_series = db.get_all("""
        SELECT v.id, v.name, v.name_uk, v.cover_img, v.image, v.start_year, p.name as publisher_name, v.mal_score, 'volume' as type
        FROM volumes v
        LEFT JOIN publishers p ON v.publisher = p.id
        WHERE v.lang = 'uk'
        ORDER BY v.created_at DESC, v.id DESC
        LIMIT 8
    """)
    
    # 4. Recent Ukrainian Collections (collections, where volume has lang = 'uk') - Limit 8
    recent_collections = db.get_all("""
        SELECT c.id, c.name, c.issue_number, c.release_date, c.image as image, 'collection' as type,
               v.name as volume_name, v.name_uk as volume_name_uk, v.id as volume_id
        FROM collections c
        JOIN volumes v ON c.volume_id = v.id
        WHERE v.lang = 'uk'
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT 8
    """)
    
    return {
        "announcements": announcements,
        "new_releases": new_releases,
        "recent_series": [dict(r) for r in recent_series],
        "recent_collections": [dict(r) for r in recent_collections]
    }




