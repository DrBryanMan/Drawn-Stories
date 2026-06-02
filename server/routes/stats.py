from fastapi import APIRouter
from ..db import get_db

router = APIRouter(prefix="/api/stats", tags=["stats"])

@router.get("")
async def get_stats():
    db = get_db()
    volumes    = db.get_one("SELECT COUNT(*) as count FROM volumes")["count"]
    issues     = db.get_one("SELECT COUNT(*) as count FROM issues")["count"]
    characters = db.get_one("SELECT COUNT(*) as count FROM characters")["count"]
    return { "volumes": volumes, "issues": issues, "characters": characters }
