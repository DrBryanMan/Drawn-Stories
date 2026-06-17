from fastapi import APIRouter, Request, HTTPException, Depends
from server.db import get_db
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/collections", tags=["collections"])

def get_current_user_id(request: Request):
    username = request.cookies.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Not logged in")
    db = get_db()
    user = db.get_one("SELECT id FROM users WHERE username = ?", [username])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user['id']

@router.get("")
async def get_collections(username: Optional[str] = None, user_id: Optional[int] = Depends(get_current_user_id)):
    db = get_db()
    
    target_user_id = user_id
    if username:
        user = db.get_one("SELECT id FROM users WHERE username = ?", [username])
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        target_user_id = user['id']

    if not target_user_id:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    query = """
    SELECT
        v.id as volume_id,
        v.name as volume_name,
        v.name_uk as volume_name_uk,
        p.name as publisher_name,
        c.id as collection_id,
        c.name as collection_name,
        c.issue_number,
        c.cv_img,
        uc.status as user_status,
        uc.barter as user_barter
    FROM volumes v
    JOIN collections c ON c.volume_id = v.id
    LEFT JOIN publishers p ON v.publisher = p.id
    LEFT JOIN user_collections uc ON uc.collection_id = c.id AND uc.user_id = ?
    WHERE v.id IN (
        SELECT DISTINCT v2.id
        FROM volumes v2
        JOIN collections c2 ON c2.volume_id = v2.id
        JOIN user_collections uc2 ON uc2.collection_id = c2.id
        WHERE uc2.user_id = ?
    )
    ORDER BY v.name_uk, v.name, c.issue_number
    """

    rows = db.get_all(query, [target_user_id, target_user_id])
    
    # Group by volume
    volumes = {}
    for row in rows:
        vid = row['volume_id']
        if vid not in volumes:
            volumes[vid] = {
                "id": vid,
                "name": row['volume_name'],
                "name_uk": row['volume_name_uk'],
                "publisher_name": row['publisher_name'],
                "items": []
            }
        volumes[vid]["items"].append({
            "id": row['collection_id'],
            "name": row['collection_name'],
            "issue_number": row['issue_number'],
            "cv_img": row['cv_img'],
            "status": row['user_status'],
            "barter": bool(row['user_barter'])
        })
        
    return list(volumes.values())

@router.post("")
async def create_collection(data: dict):
    db = get_db()
    
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="Назва збірника обов'язкова")

    columns = []
    placeholders = []
    params = []
    
    allowed_fields = [
        "name", "issue_number", "volume_id", "cv_id", "cv_slug", 
        "cv_img", "cover_date", "release_date", "description"
    ]
    
    for key, value in data.items():
        if key in allowed_fields and value is not None:
            columns.append(key)
            placeholders.append("?")
            params.append(value)
            
    if not columns:
        raise HTTPException(status_code=400, detail="Немає даних для збереження")

    sql = f"INSERT INTO collections ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
    db.execute(sql, params)
    
    new_id = db.get_one("SELECT last_insert_rowid() as id")["id"]
    return {"message": "Збірник успішно створено", "id": new_id}

class ToggleCollectionRequest(BaseModel):
    collection_id: int
    status: Optional[str] = "get"
    barter: Optional[bool] = None

@router.post("/toggle")
async def toggle_collection(req: ToggleCollectionRequest, user_id: int = Depends(get_current_user_id)):
    db = get_db()

    existing = db.get_one("SELECT status, barter FROM user_collections WHERE user_id = ? AND collection_id = ?", [user_id, req.collection_id])

    if existing:
        if req.barter is not None:
            # Update barter status
            db.execute("UPDATE user_collections SET barter = ? WHERE user_id = ? AND collection_id = ?", [int(req.barter), user_id, req.collection_id])
            return {"status": "updated", "barter": req.barter}

        if existing['status'] == req.status:
            # Remove if same status
            db.execute("DELETE FROM user_collections WHERE user_id = ? AND collection_id = ?", [user_id, req.collection_id])
            return {"status": "removed"}
        else:
            # Update status
            db.execute("UPDATE user_collections SET status = ? WHERE user_id = ? AND collection_id = ?", [req.status, user_id, req.collection_id])
            return {"status": "updated", "new_status": req.status}
    else:
        # Add new
        db.execute("INSERT INTO user_collections (user_id, collection_id, status, barter) VALUES (?, ?, ?, ?)", 
                   [user_id, req.collection_id, req.status, int(req.barter or False)])
        return {"status": "added", "new_status": req.status}
@router.post("/add-volume-all")
async def add_volume_all(req: ToggleCollectionRequest, user_id: int = Depends(get_current_user_id)):
    # Wait, the request has collection_id but we need volume_id. 
    # Let's use a different model or repurpose. 
    # To avoid breaking things, let's just use volume_id in a new model.
    pass

class AddVolumeAllRequest(BaseModel):
    volume_id: int

@router.post("/add-all-from-volume")
async def add_all_from_volume(req: AddVolumeAllRequest, user_id: int = Depends(get_current_user_id)):
    db = get_db()
    
    # Check if volume exists
    volume = db.get_one("SELECT id FROM volumes WHERE id = ?", [req.volume_id])
    if not volume:
        raise HTTPException(status_code=404, detail="Volume not found")

    # Find all collections for this volume
    collections = db.get_all("SELECT id FROM collections WHERE volume_id = ?", [req.volume_id])
    
    if not collections:
        return {"status": "ok", "added": 0}
        
    added_count = 0
    for col in collections:
        try:
            # We use INSERT OR IGNORE to skip collections already in the user's collection
            # because of the UNIQUE constraint on (user_id, collection_id)
            db.execute("INSERT OR IGNORE INTO user_collections (user_id, collection_id) VALUES (?, ?)", [user_id, col['id']])
            added_count += 1
        except Exception as e:
            print(f"Error adding collection {col['id']}: {e}")
            
    return {"status": "ok", "added": added_count}


@router.get("/{collection_id}")
async def get_collection_detail(collection_id: int, request: Request):
    db = get_db()
    
    # Визначаємо поточного користувача (для перевірки, чи додано в його колекцію)
    user_id = None
    username = request.cookies.get("username")
    if username:
        user = db.get_one("SELECT id FROM users WHERE username = ?", [username])
        if user:
            user_id = user['id']

    # 1. Отримуємо деталі збірника
    collection = db.get_one(
        """
        SELECT c.*, 
               v.name as volume_name, 
               v.name_uk as volume_name_uk,
               p.name as publisher_name,
               uc.status as user_status,
               uc.barter as user_barter,
               EXISTS(SELECT 1 FROM user_collections uc2 WHERE uc2.collection_id = c.id AND uc2.user_id = ? AND uc2.status = 'get') as is_owned
        FROM collections c
        LEFT JOIN volumes v ON c.volume_id = v.id
        LEFT JOIN publishers p ON c.publisher = p.id
        LEFT JOIN user_collections uc ON uc.collection_id = c.id AND uc.user_id = ?
        WHERE c.id = ?
        """,
        [user_id, user_id, collection_id]
    )
    
    if not collection:
        raise HTTPException(status_code=404, detail="Збірник не знайдено")
        
    collection = dict(collection)
    
    # 2. Отримуємо випуски, що входять до збірника
    issues = db.get_all(
        """
        SELECT i.*, ci.order_num, ci.chapter_title
        FROM collection_issues ci
        JOIN issues i ON ci.issue_id = i.id
        WHERE ci.collection_id = ?
        ORDER BY ci.order_num
        """,
        [collection_id]
    )
    
    # 3. Отримуємо теми збірника
    themes = db.get_all(
        """
        SELECT DISTINCT t.id, t.cv_id, t.name, t.ua_name, COALESCE(t.type, 'theme') as type
        FROM collection_themes ct
        JOIN themes t ON t.id = ct.theme_id
        WHERE ct.collection_id = ?
        ORDER BY
          CASE COALESCE(t.type, 'theme')
            WHEN 'type' THEN 0
            WHEN 'genre' THEN 1
            ELSE 2
          END,
          COALESCE(t.ua_name, t.name) ASC
        """,
        [collection_id]
    )
    
    return {
        "collection": collection,
        "issues": [dict(issue) for issue in issues],
        "themes": [dict(theme) for theme in themes]
    }

