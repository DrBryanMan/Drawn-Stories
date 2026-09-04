from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from server.db import get_db

router = APIRouter(prefix="/api/user/readlist", tags=["user_readlist"])

class ReadlistUpdate(BaseModel):
    volume_id: int
    list_name: Optional[str] = None  # None means remove from all reading lists
    issues_count: Optional[int] = None

class IssueReadlistUpdate(BaseModel):
    issue_id: int
    list_name: Optional[str] = None  # None means remove from all reading lists

def get_current_user_id(request: Request):
    user_login = request.cookies.get("login") or request.cookies.get("username")
    if not user_login:
        return None
    
    db = get_db()
    user = db.get_one("SELECT id FROM users WHERE login = %s", [user_login])
    return user["id"] if user else None

@router.get("/{volume_id}")
async def get_volume_readlist_status(volume_id: int, request: Request):
    user_id = get_current_user_id(request)
    if not user_id:
        return {"list_name": None, "is_favorite": False, "issues_count": None, "read_issues_count": 0}
    
    db = get_db()
    
    # Get standard reading list (exclude favorites from user_volumes_readlist if they exist there)
    readlist = db.get_one(
        "SELECT list_name, issues_count FROM user_volumes_readlist WHERE user_id = %s AND volume_id = %s AND list_name != 'favorites'",
        [user_id, volume_id]
    )
    
    # Check if it's in favorites table
    favorite = db.get_one(
        "SELECT 1 FROM user_favorites WHERE user_id = %s AND content_id = %s AND content_type = 'volume'",
        [user_id, volume_id]
    )
    
    # Auto count completed issues of this volume in user_issues_readlist
    read_issues_count = 0
    issues_count_query = db.get_one("""
        SELECT COUNT(uir.id) as count
        FROM user_issues_readlist uir
        JOIN issues i ON uir.issue_id = i.id
        WHERE uir.user_id = %s AND i.volume_id = %s AND uir.list_name = 'Completed'
    """, [user_id, volume_id])
    if issues_count_query:
        read_issues_count = issues_count_query.get("count", 0)
    
    return {
        "list_name": readlist["list_name"] if readlist else None,
        "is_favorite": bool(favorite),
        "issues_count": readlist["issues_count"] if readlist else None,
        "read_issues_count": read_issues_count
    }

@router.post("/update")
async def update_readlist(data: ReadlistUpdate, request: Request):
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Необхідно увійти в систему")
    
    db = get_db()
    
    # Check if entry already exists
    existing = db.get_one(
        "SELECT list_name, issues_count FROM user_volumes_readlist WHERE user_id = %s AND volume_id = %s",
        [user_id, data.volume_id]
    )
    
    if data.list_name is None:
        db.execute(
            "DELETE FROM user_volumes_readlist WHERE user_id = %s AND volume_id = %s",
            [user_id, data.volume_id]
        )
        db.execute("""
            DELETE FROM user_issues_readlist
            WHERE user_id = %s AND issue_id IN (SELECT id FROM issues WHERE volume_id = %s)
        """, [user_id, data.volume_id])
    else:
        if existing:
            db.execute(
                "UPDATE user_volumes_readlist SET list_name = %s, issues_count = %s WHERE user_id = %s AND volume_id = %s",
                [data.list_name, data.issues_count, user_id, data.volume_id]
            )
        else:
            db.execute(
                "INSERT INTO user_volumes_readlist (user_id, list_name, volume_id, issues_count) VALUES (%s, %s, %s, %s)",
                [user_id, data.list_name, data.volume_id, data.issues_count]
            )
            
        if data.list_name == 'Completed':
            # Mark all issues of this volume as Completed for the user
            db.execute("""
                DELETE FROM user_issues_readlist
                WHERE user_id = %s AND issue_id IN (SELECT id FROM issues WHERE volume_id = %s)
            """, [user_id, data.volume_id])
            
            db.execute("""
                INSERT INTO user_issues_readlist (user_id, list_name, issue_id)
                SELECT %s, 'Completed', id
                FROM issues
                WHERE volume_id = %s
                ON CONFLICT DO NOTHING
            """, [user_id, data.volume_id])
            
    return {"status": "ok"}

@router.post("/toggle-favorite")
async def toggle_favorite(data: ReadlistUpdate, request: Request):
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Необхідно увійти в систему")
    
    db = get_db()
    
    existing = db.get_one(
        "SELECT 1 FROM user_favorites WHERE user_id = %s AND content_id = %s AND content_type = 'volume'",
        [user_id, data.volume_id]
    )
    
    if existing:
        db.execute(
            "DELETE FROM user_favorites WHERE user_id = %s AND content_id = %s AND content_type = 'volume'",
            [user_id, data.volume_id]
        )
        return {"status": "removed", "is_favorite": False}
    else:
        db.execute(
            "INSERT INTO user_favorites (user_id, content_type, content_id) VALUES (%s, 'volume', %s)",
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
        "SELECT list_name FROM user_issues_readlist WHERE user_id = %s AND issue_id = %s",
        [user_id, issue_id]
    )
    
    favorite = db.get_one(
        "SELECT 1 FROM user_favorites WHERE user_id = %s AND content_id = %s AND content_type = 'issue'",
        [user_id, issue_id]
    )
    
    collection = db.get_one(
        "SELECT status, barter FROM user_issues_collection WHERE user_id = %s AND issue_id = %s",
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
        "DELETE FROM user_issues_readlist WHERE user_id = %s AND issue_id = %s",
        [user_id, data.issue_id]
    )
    
    # If a new list is specified, add it
    if data.list_name:
        try:
            db.execute(
                "INSERT INTO user_issues_readlist (user_id, list_name, issue_id) VALUES (%s, %s, %s)",
                [user_id, data.list_name, data.issue_id]
            )
        except Exception as e:
            pass

    # Dynamic status sync for the parent volume
    # Find parent volume ID
    issue_info = db.get_one("SELECT volume_id FROM issues WHERE id = %s", [data.issue_id])
    if issue_info and issue_info.get("volume_id"):
        vol_id = issue_info["volume_id"]
        
        # Get count of user's reading statuses of issues in this volume
        issue_statuses = db.get_all("""
            SELECT uir.list_name, COUNT(uir.id) as count
            FROM user_issues_readlist uir
            JOIN issues i ON uir.issue_id = i.id
            WHERE uir.user_id = %s AND i.volume_id = %s
            GROUP BY uir.list_name
        """, [user_id, vol_id])
        
        status_counts = {r["list_name"]: r["count"] for r in issue_statuses}
        
        if not status_counts:
            # No issues have statuses anymore -> remove volume from readlist
            db.execute(
                "DELETE FROM user_volumes_readlist WHERE user_id = %s AND volume_id = %s",
                [user_id, vol_id]
            )
        else:
            # Logical transition:
            # - If any is "Reading", or there are multiple different states -> volume is "Reading"
            # - If all are "Completed" -> volume is "Completed" (BUT only if all issues of the volume are completed)
            # - If all are "Planned" -> volume is "Planned"
            target_status = "Planned"
            if "Reading" in status_counts or (len(status_counts) > 1):
                target_status = "Reading"
            elif "Completed" in status_counts and len(status_counts) == 1:
                # Check if total issues count of volume equals read completed issues
                vol_stats = db.get_one("""
                    SELECT (SELECT COUNT(*) FROM issues WHERE volume_id = %s) as total_issues
                """, [vol_id])
                total_issues = vol_stats.get("total_issues", 0) if vol_stats else 0
                completed_count = status_counts.get("Completed", 0)
                
                if total_issues > 0 and completed_count >= total_issues:
                    target_status = "Completed"
                else:
                    target_status = "Reading"
            elif "Planned" in status_counts and len(status_counts) == 1:
                target_status = "Planned"
                
            # Check if volume status already exists
            existing_vol = db.get_one(
                "SELECT 1 FROM user_volumes_readlist WHERE user_id = %s AND volume_id = %s",
                [user_id, vol_id]
            )
            if existing_vol:
                db.execute(
                    "UPDATE user_volumes_readlist SET list_name = %s WHERE user_id = %s AND volume_id = %s",
                    [target_status, user_id, vol_id]
                )
            else:
                db.execute(
                    "INSERT INTO user_volumes_readlist (user_id, list_name, volume_id) VALUES (%s, %s, %s)",
                    [user_id, target_status, vol_id]
                )
            
    return {"status": "ok"}

@router.post("/issue/toggle-favorite")
async def toggle_issue_favorite(data: IssueReadlistUpdate, request: Request):
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Необхідно увійти в систему")
    
    db = get_db()
    
    existing = db.get_one(
        "SELECT 1 FROM user_favorites WHERE user_id = %s AND content_id = %s AND content_type = 'issue'",
        [user_id, data.issue_id]
    )
    
    if existing:
        db.execute(
            "DELETE FROM user_favorites WHERE user_id = %s AND content_id = %s AND content_type = 'issue'",
            [user_id, data.issue_id]
        )
        return {"status": "removed", "is_favorite": False}
    else:
        db.execute(
            "INSERT INTO user_favorites (user_id, content_type, content_id) VALUES (%s, 'issue', %s)",
            [user_id, data.issue_id]
        )
        return {"status": "added", "is_favorite": True}

@router.get("/user/{username}")
async def get_user_readlist(username: str, content_type: str = "volume"):
    db = get_db()
    
    user = db.get_one("SELECT id FROM users WHERE LOWER(nickname) = LOWER(%s) OR LOWER(login) = LOWER(%s)", [username, username])
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
            WHERE ur.user_id = %s AND ur.list_name != 'favorites'
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
            WHERE ur.user_id = %s AND ur.list_name != 'favorites'
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