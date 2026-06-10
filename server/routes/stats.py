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
    
    return { 
        "volumes": volumes, 
        "collections": collections,
        "issues": issues, 
        "publishers": publishers,
        "themes": themes,
        "characters": 0,
        "authors": 0
    }
