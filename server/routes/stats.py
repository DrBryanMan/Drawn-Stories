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
