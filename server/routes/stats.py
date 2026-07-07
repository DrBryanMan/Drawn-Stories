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
    
    return {
        "publishers": [dict(r) for r in popular_publishers],
        "manga": [dict(r) for r in popular_manga],
        "magazines": [dict(r) for r in popular_magazines]
    }

