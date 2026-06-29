from fastapi import APIRouter, Request, HTTPException, Depends, Query
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
async def get_collections(username: Optional[str] = None, content_type: str = "collection", user_id: Optional[int] = Depends(get_current_user_id)):
    db = get_db()
    
    target_user_id = user_id
    if username:
        user = db.get_one("SELECT id FROM users WHERE username = ?", [username])
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        target_user_id = user['id']

    if not target_user_id:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    if content_type == "collection":
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
            uc.barter as user_barter,
            uc.created_at as added_at
        FROM volumes v
        JOIN collections c ON c.volume_id = v.id
        LEFT JOIN publishers p ON v.publisher = p.id
        LEFT JOIN user_volumes_collection uc ON uc.collection_id = c.id AND uc.user_id = ?
        WHERE v.id IN (
            SELECT DISTINCT v2.id
            FROM volumes v2
            JOIN collections c2 ON c2.volume_id = v2.id
            JOIN user_volumes_collection uc2 ON uc2.collection_id = c2.id
            WHERE uc2.user_id = ?
        )
        ORDER BY uc.created_at DESC, c.issue_number DESC
        """
        rows = db.get_all(query, [target_user_id, target_user_id])
    elif content_type == "issue":
        query = """
        SELECT
            v.id as volume_id,
            v.name as volume_name,
            v.name_uk as volume_name_uk,
            p.name as publisher_name,
            i.id as issue_id,
            i.name as issue_name,
            i.issue_number,
            i.cv_img,
            uc.status as user_status,
            uc.barter as user_barter,
            uc.created_at as added_at
        FROM volumes v
        JOIN issues i ON i.volume_id = v.id
        LEFT JOIN publishers p ON v.publisher = p.id
        LEFT JOIN user_issues_collection uc ON uc.issue_id = i.id AND uc.user_id = ?
        WHERE v.id IN (
            SELECT DISTINCT v2.id
            FROM volumes v2
            JOIN issues i2 ON i2.volume_id = v2.id
            JOIN user_issues_collection uc2 ON uc2.issue_id = i2.id
            WHERE uc2.user_id = ?
        )
        ORDER BY uc.created_at DESC, CAST(i.issue_number AS REAL) DESC, i.issue_number DESC
        """
        rows = db.get_all(query, [target_user_id, target_user_id])
    else:
        raise HTTPException(status_code=400, detail="Invalid content type")
    
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
            "id": row['issue_id'] if content_type == 'issue' else row['collection_id'],
            "name": row['issue_name'] if content_type == 'issue' else row['collection_name'],
            "issue_number": row['issue_number'],
            "cv_img": row['cv_img'],
            "status": row['user_status'],
            "barter": bool(row['user_barter']),
            "added_at": row['added_at']
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
        "name", "issue_number", "volume_id", "cv_vol_id", "cv_id", "cv_slug", 
        "cv_img", "cover_date", "release_date", "description", "contents"
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

class ToggleIssueCollectionRequest(BaseModel):
    issue_id: int
    status: Optional[str] = "get"
    barter: Optional[bool] = None

@router.post("/toggle")
async def toggle_collection(req: ToggleCollectionRequest, user_id: int = Depends(get_current_user_id)):
    db = get_db()

    existing = db.get_one("SELECT status, barter FROM user_volumes_collection WHERE user_id = ? AND collection_id = ?", [user_id, req.collection_id])

    if existing:
        if req.barter is not None:
            # Update barter status
            db.execute("UPDATE user_volumes_collection SET barter = ? WHERE user_id = ? AND collection_id = ?", [int(req.barter), user_id, req.collection_id])
            return {"status": "updated", "barter": req.barter}

        if existing['status'] == req.status:
            # Remove if same status
            db.execute("DELETE FROM user_volumes_collection WHERE user_id = ? AND collection_id = ?", [user_id, req.collection_id])
            return {"status": "removed"}
        else:
            # Update status
            db.execute("UPDATE user_volumes_collection SET status = ? WHERE user_id = ? AND collection_id = ?", [req.status, user_id, req.collection_id])
            return {"status": "updated", "new_status": req.status}
    else:
        # Add new
        db.execute("INSERT INTO user_volumes_collection (user_id, collection_id, status, barter) VALUES (?, ?, ?, ?)", 
                   [user_id, req.collection_id, req.status, int(req.barter or False)])
        return {"status": "added", "new_status": req.status}

@router.post("/issue/toggle")
async def toggle_issue_collection(req: ToggleIssueCollectionRequest, user_id: int = Depends(get_current_user_id)):
    db = get_db()

    existing = db.get_one("SELECT status, barter FROM user_issues_collection WHERE user_id = ? AND issue_id = ?", [user_id, req.issue_id])

    if existing:
        if req.barter is not None:
            # Update barter status
            db.execute("UPDATE user_issues_collection SET barter = ? WHERE user_id = ? AND issue_id = ?", [int(req.barter), user_id, req.issue_id])
            return {"status": "updated", "barter": req.barter}

        if existing['status'] == req.status:
            # Remove if same status
            db.execute("DELETE FROM user_issues_collection WHERE user_id = ? AND issue_id = ?", [user_id, req.issue_id])
            return {"status": "removed"}
        else:
            # Update status
            db.execute("UPDATE user_issues_collection SET status = ? WHERE user_id = ? AND issue_id = ?", [req.status, user_id, req.issue_id])
            return {"status": "updated", "new_status": req.status}
    else:
        # Add new
        db.execute("INSERT INTO user_issues_collection (user_id, issue_id, status, barter) VALUES (?, ?, ?, ?)", 
                   [user_id, req.issue_id, req.status, int(req.barter or False)])
        return {"status": "added", "new_status": req.status}

@router.post("/add-volume-all")
async def add_volume_all(req: ToggleCollectionRequest, user_id: int = Depends(get_current_user_id)):
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
            db.execute("INSERT OR IGNORE INTO user_volumes_collection (user_id, collection_id) VALUES (?, ?)", [user_id, col['id']])
            added_count += 1
        except Exception as e:
            print(f"Error adding collection {col['id']}: {e}")
            
    return {"status": "ok", "added": added_count}

@router.post("/issue/add-all-from-volume")
async def add_all_issues_from_volume(req: AddVolumeAllRequest, user_id: int = Depends(get_current_user_id)):
    db = get_db()
    
    # Check if volume exists
    volume = db.get_one("SELECT id FROM volumes WHERE id = ?", [req.volume_id])
    if not volume:
        raise HTTPException(status_code=404, detail="Volume not found")

    # Find all issues for this volume
    issues = db.get_all("SELECT id FROM issues WHERE volume_id = ?", [req.volume_id])
    
    if not issues:
        return {"status": "ok", "added": 0}
        
    added_count = 0
    for issue in issues:
        try:
            # We use INSERT OR IGNORE to skip issues already in the user's collection
            # because of the UNIQUE constraint on (user_id, issue_id)
            db.execute("INSERT OR IGNORE INTO user_issues_collection (user_id, issue_id, status) VALUES (?, ?, 'get')", [user_id, issue['id']])
            added_count += 1
        except Exception as e:
            print(f"Error adding issue {issue['id']}: {e}")
            
    return {"status": "ok", "added": added_count}


@router.post("/{collection_id}/issues")
async def add_issue_to_collection(collection_id: int, data: dict):
    db = get_db()
    issue_id = data.get("issue_id")
    manga_chapter_id = data.get("manga_chapter_id")
    
    if not issue_id and not manga_chapter_id:
        raise HTTPException(status_code=400, detail="issue_id or manga_chapter_id is required")
    
    # Check if already exists
    if issue_id:
        existing = db.get_one("SELECT 1 FROM collection_issues WHERE collection_id = ? AND issue_id = ?", [collection_id, issue_id])
    else:
        existing = db.get_one("SELECT 1 FROM collection_issues WHERE collection_id = ? AND manga_chapter_id = ?", [collection_id, manga_chapter_id])
        
    if existing:
        return {"message": "Випуск/розділ вже є у збірнику"}
    
    # Get next order_num
    last_order = db.get_one("SELECT MAX(order_num) as max_order FROM collection_issues WHERE collection_id = ?", [collection_id])
    next_order = (last_order['max_order'] or 0) + 1
    
    if issue_id:
        db.execute(
            "INSERT INTO collection_issues (collection_id, issue_id, manga_chapter_id, order_num) VALUES (?, ?, NULL, ?)",
            [collection_id, issue_id, next_order]
        )
    else:
        db.execute(
            "INSERT INTO collection_issues (collection_id, issue_id, manga_chapter_id, order_num) VALUES (?, NULL, ?, ?)",
            [collection_id, manga_chapter_id, next_order]
        )
    
    return {"message": "Елемент додано", "order_num": next_order}

@router.put("/{collection_id}/reorder-issues")
async def reorder_collection_issues(collection_id: int, data: dict):
    db = get_db()
    items = data.get("items")
    # Підтримка старого формату (про всяк випадок)
    issue_ids = data.get("issue_ids")
    
    if items is not None:
        if not isinstance(items, list):
            raise HTTPException(status_code=400, detail="items must be a list")
        for index, item in enumerate(items):
            item_id = item.get("id")
            item_type = item.get("type")
            if item_type == "manga_chapter":
                db.execute(
                    "UPDATE collection_issues SET order_num = ? WHERE collection_id = ? AND manga_chapter_id = ?",
                    [index + 1, collection_id, item_id]
                )
            else:
                db.execute(
                    "UPDATE collection_issues SET order_num = ? WHERE collection_id = ? AND issue_id = ?",
                    [index + 1, collection_id, item_id]
                )
    elif issue_ids is not None:
        if not isinstance(issue_ids, list):
            raise HTTPException(status_code=400, detail="issue_ids must be a list")
        for index, issue_id in enumerate(issue_ids):
            db.execute(
                "UPDATE collection_issues SET order_num = ? WHERE collection_id = ? AND issue_id = ?",
                [index + 1, collection_id, issue_id]
            )
    else:
        raise HTTPException(status_code=400, detail="items or issue_ids is required")
    
    return {"message": "Порядок оновлено"}

@router.delete("/{collection_id}/issues")
async def clear_collection_issues(collection_id: int):
    db = get_db()

    collection = db.get_one("SELECT id FROM collections WHERE id = ?", [collection_id])
    if not collection:
        raise HTTPException(status_code=404, detail="Збірник не знайдено")

    count = db.get_one("SELECT COUNT(*) as cnt FROM collection_issues WHERE collection_id = ?", [collection_id])["cnt"]
    db.execute("DELETE FROM collection_issues WHERE collection_id = ?", [collection_id])

    return {"message": f"Видалено {count} зв'язків", "deleted": count}

def replace_collection_themes(db, collection_id, theme_ids):
    # Delete existing themes
    db.execute("DELETE FROM collection_themes WHERE collection_id = ?", [collection_id])
        
    # Insert new themes
    for theme_id in theme_ids:
        db.execute(
            "INSERT INTO collection_themes (collection_id, theme_id) VALUES (?, ?)",
            [collection_id, theme_id]
        )

@router.put("/{collection_id}")
async def update_collection(collection_id: int, data: dict):
    db = get_db()
    
    # Check if collection exists
    collection = db.get_one("SELECT id FROM collections WHERE id = ?", [collection_id])
    if not collection:
        raise HTTPException(status_code=404, detail="Збірник не знайдено")

    # Update fields
    fields = []
    params = []
    
    allowed_fields = [
        "name", "issue_number", "volume_id", "cv_vol_id", "cv_id", "cv_slug", 
        "cv_img", "cover_date", "release_date", "description", "synopsis_ua",
        "synopsis", "contents", "publisher", "isbn", "pages", "site_link"
    ]
    
    for key, value in data.items():
        if key in allowed_fields:
            fields.append(f"{key} = ?")
            params.append(value)
            
    if fields:
        params.append(collection_id)
        db.execute(
            f"UPDATE collections SET {', '.join(fields)} WHERE id = ?",
            params
        )
    
    # Update themes if provided
    if "theme_ids" in data and isinstance(data["theme_ids"], list):
        replace_collection_themes(db, collection_id, data["theme_ids"])
    
    return {"message": "Collection updated successfully"}

@router.delete("/{collection_id}")
async def delete_collection(collection_id: int):
    db = get_db()
    
    # Check if collection exists
    collection = db.get_one("SELECT * FROM collections WHERE id = ?", [collection_id])
    if not collection:
        raise HTTPException(status_code=404, detail="Збірник не знайдено")
        
    try:
        db.conn.execute("BEGIN")
        
        # 1. Themes
        db.conn.execute("DELETE FROM collection_themes WHERE collection_id = ?", [collection_id])
            
        # 2. Issue links
        db.conn.execute("DELETE FROM collection_issues WHERE collection_id = ?", [collection_id])
        
        # 3. Series links
        db.conn.execute("DELETE FROM series_collections WHERE collection_id = ?", [collection_id])
        
        # 4. User collections
        db.conn.execute("DELETE FROM user_volumes_collection WHERE collection_id = ?", [collection_id])

        # 5. Finally delete the collection itself
        db.conn.execute("DELETE FROM collections WHERE id = ?", [collection_id])
        
        db.conn.commit()
    except Exception as e:
        db.conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
        
    return {"message": "Збірник та всі пов'язані дані успішно видалено"}

@router.put("/{collection_id}/reorder-issues")
async def reorder_collection_issues(collection_id: int, data: dict):
    db = get_db()
    issue_ids = data.get("issue_ids", [])
    
    if not issue_ids:
        return {"message": "No issues to reorder"}
        
    try:
        db.conn.execute("BEGIN")
        for index, issue_id in enumerate(issue_ids):
            db.execute(
                "UPDATE collection_issues SET order_num = ? WHERE collection_id = ? AND issue_id = ?",
                [index + 1, collection_id, issue_id]
            )
        db.conn.commit()
    except Exception as e:
        db.conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
        
    return {"message": "Порядок випусків оновлено"}

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
               EXISTS(SELECT 1 FROM user_volumes_collection uc2 WHERE uc2.collection_id = c.id AND uc2.user_id = ? AND uc2.status = 'get') as is_owned
        FROM collections c
        LEFT JOIN volumes v ON c.volume_id = v.id
        LEFT JOIN publishers p ON c.publisher = p.id
        LEFT JOIN user_volumes_collection uc ON uc.collection_id = c.id AND uc.user_id = ?
        WHERE c.id = ?
        """,
        [user_id, user_id, collection_id]
    )
    
    if not collection:
        raise HTTPException(status_code=404, detail="Збірник не знайдено")
        
    collection = dict(collection)
    
    # 2. Отримуємо випуски та розділи манги, що входять до збірника
    issues = db.get_all(
        """
        SELECT 
            ci.order_num, ci.chapter_title,
            COALESCE(i.id, mc.id) as id,
            CASE WHEN ci.manga_chapter_id IS NOT NULL THEN 'manga_chapter' ELSE 'issue' END as type,
            COALESCE(i.name, mc.name) as name,
            COALESCE(i.name_uk, mc.name_uk) as name_uk,
            COALESCE(i.cv_img, mc.image) as cv_img,
            COALESCE(i.issue_number, mc.chapter_number) as issue_number,
            COALESCE(i.release_date, mc.release_date) as release_date,
            COALESCE(i.description, mc.synopsis) as description,
            COALESCE(i.pages, mc.pages) as pages,
            COALESCE(i.volume_id, mc.volume_id) as volume_id,
            v.name as volume_name, 
            v.name_uk as volume_name_uk
        FROM collection_issues ci
        LEFT JOIN issues i ON ci.issue_id = i.id
        LEFT JOIN manga_chapters mc ON ci.manga_chapter_id = mc.id
        LEFT JOIN volumes v ON COALESCE(i.volume_id, mc.volume_id) = v.id
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

    # 4. Пряма кількість зв'язків у collection_issues (незалежно від типу — issues або manga_chapters)
    raw_links_count = db.get_one(
        "SELECT COUNT(*) as cnt FROM collection_issues WHERE collection_id = ?",
        [collection_id]
    )["cnt"]

    # 5. Отримуємо усі збірники цього ж тому
    related_collections = []
    if collection.get('volume_id'):
        related_collections = db.get_all(
            """
            SELECT id, name, issue_number, cv_img
            FROM collections
            WHERE volume_id = ?
            ORDER BY CAST(issue_number AS FLOAT) ASC, issue_number ASC
            """,
            [collection['volume_id']]
        )
    
    return {
        "collection": {**collection, "collection_issues_count": raw_links_count},
        "issues": [dict(issue) for issue in issues],
        "themes": [dict(theme) for theme in themes],
        "related_collections": [dict(rc) for rc in related_collections]
    }

@router.get("/{collection_id}/candidates")
async def get_collection_candidates(
    collection_id: int,
    name: Optional[str] = None,
    volume_name: Optional[str] = None,
    issue_number: Optional[str] = None,
    volume_id: Optional[int] = None,
    cv_vol_id: Optional[int] = None,
    hikka_slug: Optional[str] = None,
    exact: bool = False,
    limit: int = Query(100, ge=1, le=500)
):
    db = get_db()
    
    # 1. Шукаємо спочатку в issues
    clauses_issues = []
    params_issues = []
    
    if volume_id:
        clauses_issues.append("i.volume_id = ?")
        params_issues.append(volume_id)
    if hikka_slug:
        clauses_issues.append("ULOWER(v.hikka_slug) LIKE ?")
        params_issues.append(f"%{hikka_slug.lower()}%")
    if cv_vol_id:
        clauses_issues.append("v.cv_id = ?")
        params_issues.append(cv_vol_id)
        
    if name:
        if exact:
            clauses_issues.append("ULOWER(i.name) = ?")
            params_issues.append(name.lower())
        else:
            words = [w.strip() for w in name.split() if w.strip()]
            if words:
                name_parts = []
                for word in words:
                    name_parts.append("(ULOWER(i.name) LIKE ? OR ULOWER(i.name_uk) LIKE ?)")
                    params_issues.extend([f"%{word.lower()}%", f"%{word.lower()}%"])
                clauses_issues.append(f"({' AND '.join(name_parts)})")
                
    if volume_name:
        if exact:
            clauses_issues.append("(ULOWER(v.name) = ? OR ULOWER(v.name_uk) = ?)")
            params_issues.extend([volume_name.lower(), volume_name.lower()])
        else:
            words = [w.strip() for w in volume_name.split() if w.strip()]
            if words:
                vol_parts = []
                for word in words:
                    vol_parts.append("(ULOWER(v.name) LIKE ? OR ULOWER(v.name_uk) LIKE ?)")
                    params_issues.extend([f"%{word.lower()}%", f"%{word.lower()}%"])
                clauses_issues.append(f"({' AND '.join(vol_parts)})")
                
    if issue_number:
        clauses_issues.append("i.issue_number = ?")
        params_issues.append(issue_number)
        
    where_issues = f" WHERE {' AND '.join(clauses_issues)}" if clauses_issues else ""
    
    results = db.get_all(
        f"""
        SELECT 
            i.id, 
            i.name, 
            i.name_uk, 
            i.cv_img, 
            i.issue_number,
            i.volume_id,
            v.name as volume_name, 
            v.name_uk as volume_name_uk
        FROM issues i
        LEFT JOIN volumes v ON i.volume_id = v.id
        {where_issues}
        ORDER BY i.volume_id DESC, CAST(i.issue_number AS FLOAT) ASC, i.issue_number ASC
        LIMIT ?
        """,
        params_issues + [limit]
    )
    
    is_manga = False
    
    # 2. Якщо нічого не знайшли, шукаємо в manga_chapters
    if not results:
        clauses_manga = []
        params_manga = []
        
        if volume_id:
            clauses_manga.append("mc.volume_id = ?")
            params_manga.append(volume_id)
        if hikka_slug:
            clauses_manga.append("ULOWER(v.hikka_slug) LIKE ?")
            params_manga.append(f"%{hikka_slug.lower()}%")
        if cv_vol_id:
            clauses_manga.append("v.cv_id = ?")
            params_manga.append(cv_vol_id)
            
        if name:
            if exact:
                clauses_manga.append("ULOWER(mc.name) = ?")
                params_manga.append(name.lower())
            else:
                words = [w.strip() for w in name.split() if w.strip()]
                if words:
                    name_parts = []
                    for word in words:
                        name_parts.append("(ULOWER(mc.name) LIKE ? OR ULOWER(mc.name_uk) LIKE ?)")
                        params_manga.extend([f"%{word.lower()}%", f"%{word.lower()}%"])
                    clauses_manga.append(f"({' AND '.join(name_parts)})")
                    
        if volume_name:
            if exact:
                clauses_manga.append("(ULOWER(v.name) = ? OR ULOWER(v.name_uk) = ?)")
                params_manga.extend([volume_name.lower(), volume_name.lower()])
            else:
                words = [w.strip() for w in volume_name.split() if w.strip()]
                if words:
                    vol_parts = []
                    for word in words:
                        vol_parts.append("(ULOWER(v.name) LIKE ? OR ULOWER(v.name_uk) LIKE ?)")
                        params_manga.extend([f"%{word.lower()}%", f"%{word.lower()}%"])
                    clauses_manga.append(f"({' AND '.join(vol_parts)})")
                    
        if issue_number:
            clauses_manga.append("mc.chapter_number = ?")
            params_manga.append(issue_number)
            
        where_manga = f" WHERE {' AND '.join(clauses_manga)}" if clauses_manga else ""
        
        results = db.get_all(
            f"""
            SELECT 
                mc.id, 
                mc.name, 
                mc.name_uk, 
                mc.image as cv_img, 
                mc.chapter_number as issue_number,
                mc.volume_id,
                v.name as volume_name, 
                v.name_uk as volume_name_uk
            FROM manga_chapters mc
            LEFT JOIN volumes v ON mc.volume_id = v.id
            {where_manga}
            ORDER BY mc.volume_id DESC, CAST(mc.chapter_number AS FLOAT) ASC, mc.chapter_number ASC
            LIMIT ?
            """,
            params_manga + [limit]
        )
        is_manga = True
        
    return {
        "is_manga": is_manga,
        "data": [dict(r) for r in results]
    }

