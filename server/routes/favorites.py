from fastapi import APIRouter, Request, HTTPException
from server.db import get_db

router = APIRouter(prefix="/api/user/favorites", tags=["favorites"])

@router.get("/{username}")
async def get_user_favorites(username: str):
    db = get_db()
    
    user = db.get_one("SELECT id FROM users WHERE username = ?", [username])
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
    
    user_id = user["id"]
    
    # Fetch all favorites for the user
    favorites = db.get_all("""
        SELECT content_type, content_id 
        FROM user_favorites 
        WHERE user_id = ? 
        ORDER BY created_at DESC
    """, [user_id])
    
    # Group IDs by type
    grouped_ids = {}
    for f in favorites:
        ctype = f["content_type"]
        if ctype not in grouped_ids:
            grouped_ids[ctype] = []
        grouped_ids[ctype].append(f["content_id"])
        
    results = {
        "volume": [],
        "issue": [],
        "personnel": [],
        "character": []
    }
    
    for ctype, ids in grouped_ids.items():
        if not ids:
            continue
            
        placeholders = ",".join(["?"] * len(ids))
        
        if ctype == "volume":
            data = db.get_all(f"""
                SELECT v.*, p.name as publisher_name, 'volume' as type,
                (SELECT COUNT(*) FROM issues i WHERE i.volume_id = v.id) as issue_count
                FROM volumes v
                LEFT JOIN publishers p ON v.publisher = p.id
                WHERE v.id IN ({placeholders})
            """, ids)
            results["volume"] = data
        elif ctype == "issue":
            data = db.get_all(f"""
                SELECT i.*, v.name as volume_name, v.id as volume_id, 'issue' as type
                FROM issues i
                LEFT JOIN volumes v ON i.volume_id = v.id
                WHERE i.id IN ({placeholders})
            """, ids)
            results["issue"] = data
        elif ctype == "personnel":
             data = db.get_all(f"""
                SELECT *, 'personnel' as type FROM personnel WHERE id IN ({placeholders})
            """, ids)
             results["personnel"] = data
        elif ctype == "character":
             data = db.get_all(f"""
                SELECT *, 'character' as type FROM characters WHERE id IN ({placeholders})
            """, ids)
             results["character"] = data
             
    return results
