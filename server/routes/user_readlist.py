from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from server.db import get_db

router = APIRouter(prefix="/api/user/readlist", tags=["user_readlist"])

class ReadlistUpdate(BaseModel):
    volume_id: int
    list_name: Optional[str] = None  # None means remove from all reading lists

def get_current_user_id(request: Request):
    username = request.cookies.get("username")
    if not username:
        return None
    
    db = get_db()
    user = db.get_one("SELECT id FROM users WHERE username = ?", [username])
    return user["id"] if user else None

@router.get("/{volume_id}")
async def get_volume_readlist_status(volume_id: int, request: Request):
    user_id = get_current_user_id(request)
    if not user_id:
        return {"list_name": None, "is_favorite": False}
    
    db = get_db()
    
    # Get standard reading list (exclude favorites from user_readlists if they exist there)
    readlist = db.get_one(
        "SELECT list_name FROM user_readlists WHERE user_id = ? AND volume_id = ? AND list_name != 'favorites'",
        [user_id, volume_id]
    )
    
    # Check if it's in favorites table
    favorite = db.get_one(
        "SELECT 1 FROM user_favorites WHERE user_id = ? AND content_id = ? AND content_type = 'volume'",
        [user_id, volume_id]
    )
    
    return {
        "list_name": readlist["list_name"] if readlist else None,
        "is_favorite": bool(favorite)
    }

@router.post("/update")
async def update_readlist(data: ReadlistUpdate, request: Request):
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Необхідно увійти в систему")
    
    db = get_db()
    
    # First, remove from all standard reading lists
    db.execute(
        "DELETE FROM user_readlists WHERE user_id = ? AND volume_id = ?",
        [user_id, data.volume_id]
    )
    
    # If a new list is specified (and it's not 'favorites'), add it
    if data.list_name and data.list_name != 'favorites':
        try:
            db.execute(
                "INSERT INTO user_readlists (user_id, list_name, volume_id) VALUES (?, ?, ?)",
                [user_id, data.list_name, data.volume_id]
            )
        except Exception as e:
            pass
            
    return {"status": "ok"}

@router.post("/toggle-favorite")
async def toggle_favorite(data: ReadlistUpdate, request: Request):
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Необхідно увійти в систему")
    
    db = get_db()
    
    existing = db.get_one(
        "SELECT 1 FROM user_favorites WHERE user_id = ? AND content_id = ? AND content_type = 'volume'",
        [user_id, data.volume_id]
    )
    
    if existing:
        db.execute(
            "DELETE FROM user_favorites WHERE user_id = ? AND content_id = ? AND content_type = 'volume'",
            [user_id, data.volume_id]
        )
        return {"status": "removed", "is_favorite": False}
    else:
        db.execute(
            "INSERT INTO user_favorites (user_id, content_type, content_id) VALUES (?, 'volume', ?)",
            [user_id, data.volume_id]
        )
        return {"status": "added", "is_favorite": True}

@router.get("/user/{username}")
async def get_user_readlist(username: str):
    db = get_db()
    
    user = db.get_one("SELECT id FROM users WHERE username = ?", [username])
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
    
    user_id = user["id"]
    
    items = db.get_all("""
        SELECT 
            v.*, 
            p.name as publisher_name, 
            ur.list_name,
            'volume' as type,
            (SELECT COUNT(*) FROM issues i WHERE i.ds_vol_id = v.id OR (i.ds_vol_id IS NULL AND i.cv_vol_id = v.cv_id)) as issue_count
        FROM user_readlists ur
        JOIN volumes v ON ur.volume_id = v.id
        LEFT JOIN publishers p ON v.publisher = p.id
        WHERE ur.user_id = ? AND ur.list_name != 'favorites'
        ORDER BY ur.created_at DESC
    """, [user_id])
    
    # Group items by list_name
    lists = {}
    for item in items:
        lname = item["list_name"]
        if lname not in lists:
            lists[lname] = []
        lists[lname].append(item)
        
    return {
        "username": username,
        "lists": lists
    }
