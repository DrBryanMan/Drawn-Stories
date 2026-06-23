from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from server.db import get_db

router = APIRouter(prefix="/api/user/readlist", tags=["user_readlist"])

class ReadlistUpdate(BaseModel):
    volume_id: int
    list_name: Optional[str] = None  # None means remove from all reading lists

class IssueReadlistUpdate(BaseModel):
    issue_id: int
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
    
    # Get standard reading list (exclude favorites from user_volumes_readlist if they exist there)
    readlist = db.get_one(
        "SELECT list_name FROM user_volumes_readlist WHERE user_id = ? AND volume_id = ? AND list_name != 'favorites'",
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
        "DELETE FROM user_volumes_readlist WHERE user_id = ? AND volume_id = ?",
        [user_id, data.volume_id]
    )
    
    # If a new list is specified (and it's not 'favorites'), add it
    if data.list_name and data.list_name != 'favorites':
        try:
            db.execute(
                "INSERT INTO user_volumes_readlist (user_id, list_name, volume_id) VALUES (?, ?, ?)",
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

# ── Issue readlist routes ──────────────────────────────────────

@router.get("/issue/{issue_id}")
async def get_issue_readlist_status(issue_id: int, request: Request):
    user_id = get_current_user_id(request)
    if not user_id:
        return {"list_name": None, "is_favorite": False, "collection_status": None, "collection_barter": False}
    
    db = get_db()
    
    readlist = db.get_one(
        "SELECT list_name FROM user_issues_readlist WHERE user_id = ? AND issue_id = ?",
        [user_id, issue_id]
    )
    
    favorite = db.get_one(
        "SELECT 1 FROM user_favorites WHERE user_id = ? AND content_id = ? AND content_type = 'issue'",
        [user_id, issue_id]
    )
    
    collection = db.get_one(
        "SELECT status, barter FROM user_issues_collection WHERE user_id = ? AND issue_id = ?",
        [user_id, issue_id]
    )
    
    return {
        "list_name": readlist["list_name"] if readlist else None,
        "is_favorite": bool(favorite),
        "collection_status": collection["status"] if collection else None,
        "collection_barter": bool(collection["barter"]) if collection else False
    }

@router.post("/issue/update")
async def update_issue_readlist(data: IssueReadlistUpdate, request: Request):
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Необхідно увійти в систему")
    
    db = get_db()
    
    # Remove from all standard reading lists for issues
    db.execute(
        "DELETE FROM user_issues_readlist WHERE user_id = ? AND issue_id = ?",
        [user_id, data.issue_id]
    )
    
    # If a new list is specified, add it
    if data.list_name:
        try:
            db.execute(
                "INSERT INTO user_issues_readlist (user_id, list_name, issue_id) VALUES (?, ?, ?)",
                [user_id, data.list_name, data.issue_id]
            )
        except Exception as e:
            pass
            
    return {"status": "ok"}

@router.post("/issue/toggle-favorite")
async def toggle_issue_favorite(data: IssueReadlistUpdate, request: Request):
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Необхідно увійти в систему")
    
    db = get_db()
    
    existing = db.get_one(
        "SELECT 1 FROM user_favorites WHERE user_id = ? AND content_id = ? AND content_type = 'issue'",
        [user_id, data.issue_id]
    )
    
    if existing:
        db.execute(
            "DELETE FROM user_favorites WHERE user_id = ? AND content_id = ? AND content_type = 'issue'",
            [user_id, data.issue_id]
        )
        return {"status": "removed", "is_favorite": False}
    else:
        db.execute(
            "INSERT INTO user_favorites (user_id, content_type, content_id) VALUES (?, 'issue', ?)",
            [user_id, data.issue_id]
        )
        return {"status": "added", "is_favorite": True}

@router.get("/user/{username}")
async def get_user_readlist(username: str, content_type: str = "volume"):
    db = get_db()
    
    user = db.get_one("SELECT id FROM users WHERE username = ?", [username])
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
    
    user_id = user["id"]
    
    if content_type == "volume":
        items = db.get_all("""
            SELECT 
                v.*, 
                p.name as publisher_name, 
                ur.list_name,
                ur.created_at as added_at,
                'volume' as type,
                (SELECT COUNT(*) FROM issues i WHERE i.volume_id = v.id) as issue_count
            FROM user_volumes_readlist ur
            JOIN volumes v ON ur.volume_id = v.id
            LEFT JOIN publishers p ON v.publisher = p.id
            WHERE ur.user_id = ? AND ur.list_name != 'favorites'
            ORDER BY ur.created_at DESC
        """, [user_id])
    elif content_type == "issue":
        items = db.get_all("""
            SELECT 
                i.*, 
                v.name as volume_name, 
                ur.list_name,
                ur.created_at as added_at,
                'issue' as type
            FROM user_issues_readlist ur
            JOIN issues i ON ur.issue_id = i.id
            LEFT JOIN volumes v ON i.volume_id = v.id
            WHERE ur.user_id = ? AND ur.list_name != 'favorites'
            ORDER BY ur.created_at DESC
        """, [user_id])
    else:
        raise HTTPException(status_code=400, detail="Неправильний тип контенту")
    
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
