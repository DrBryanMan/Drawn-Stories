from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Any, Dict
import json
from datetime import datetime
from server.db import get_db
from server.routes.volumes import apply_volume_update_in_db

router = APIRouter(prefix="/api/edits", tags=["edits"])

class EditRequestSchema(BaseModel):
    entity_type: str
    entity_id: int
    patch_data: Dict[str, Any]
    comment: Optional[str] = None
    auto_approve: Optional[bool] = False

def get_current_user(request: Request):
    username = request.cookies.get("username")
    if not username:
        return None
    db = get_db()
    user = db.get_one("SELECT id, username, role FROM users WHERE username = ?", [username])
    return user

@router.get("")
async def get_edit_requests(request: Request, status: Optional[str] = None):
    user = get_current_user(request)
    if not user or user["role"] not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Недостатньо прав")
        
    db = get_db()
    
    query = """
        SELECT er.*, u.username as proposer_username, m.username as moderator_username,
               v.name as volume_name, v.name_uk as volume_name_uk,
               v.cv_img as volume_cv_img, v.hikka_img as volume_hikka_img
        FROM edit_requests er
        JOIN users u ON er.user_id = u.id
        LEFT JOIN users m ON er.moderator_id = m.id
        LEFT JOIN volumes v ON er.entity_type = 'volume' AND er.entity_id = v.id
    """
    params = []
    
    if status:
        query += " WHERE er.status = ?"
        params.append(status)
        
    query += " ORDER BY er.created_at DESC"
    
    requests = db.get_all(query, params)
    
    result = []
    for r in requests:
        d = dict(r)
        try:
            d["patch_data"] = json.loads(d["patch_data"])
        except:
            d["patch_data"] = {}
        result.append(d)
        
    return result

def get_volume_current_state(db, volume_id: int):
    vol = db.get_one("SELECT * FROM volumes WHERE id = ?", [volume_id])
    if not vol:
        return None
    
    # Теми з назвами
    themes = db.get_all("""
        SELECT t.id, COALESCE(t.ua_name, t.name) as name 
        FROM volume_themes vt
        JOIN themes t ON t.id = vt.theme_id
        WHERE vt.volume_id = ?
    """, [volume_id])
    theme_ids = [t["id"] for t in themes]
    themes_list = [{"id": t["id"], "name": t["name"]} for t in themes]
    
    # Персонал
    staff = db.get_all("SELECT person_id, role FROM volume_persons WHERE volume_id = ?", [volume_id])
    staff_list = [{"person_id": s["person_id"], "role": s["role"]} for s in staff]
    
    # Персонажі
    chars = db.get_all("SELECT character_id, role FROM volume_characters WHERE volume_id = ?", [volume_id])
    chars_list = [{"character_id": c["character_id"], "role": c["role"]} for c in chars]
    
    state = dict(vol)
    for key in ["id", "created_at", "updated_at"]:
        state.pop(key, None)
        
    state["theme_ids"] = theme_ids
    state["themes"] = themes_list
    state["staff"] = staff_list
    state["characters"] = chars_list
    
    return state

@router.post("")
async def create_edit_request(req: EditRequestSchema, request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Необхідна авторизація")
    
    db = get_db()
    
    # Перевіримо, чи існує сутність
    if req.entity_type == "volume":
        volume = db.get_one("SELECT id FROM volumes WHERE id = ?", [req.entity_id])
        if not volume:
            raise HTTPException(status_code=404, detail="Том не знайдено")
    else:
        raise HTTPException(status_code=400, detail="Непідтримуваний тип сутності")

    # Збережемо поточний стан "До"
    before_state = None
    if req.entity_type == "volume":
        before_state = get_volume_current_state(db, req.entity_id)

    # Збагатимо after_state назвами тем
    if "theme_ids" in req.patch_data and isinstance(req.patch_data["theme_ids"], list):
        theme_ids = req.patch_data["theme_ids"]
        after_themes = []
        if theme_ids:
            placeholders = ",".join(["?"] * len(theme_ids))
            themes_db = db.get_all(f"""
                SELECT id, COALESCE(ua_name, name) as name 
                FROM themes 
                WHERE id IN ({placeholders})
            """, theme_ids)
            after_themes = [{"id": t["id"], "name": t["name"]} for t in themes_db]
        req.patch_data["themes"] = after_themes

    # Перевіряємо роль та авто-затвердження
    is_privileged = user["role"] in ("admin", "moderator", "editor")
    
    status = "pending"
    moderator_id = None
    moderated_at = None
    
    if req.auto_approve and is_privileged:
        status = "approved"
        moderator_id = user["id"]
        moderated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    # Зберігаємо запит у базу даних разом із знімком "before"
    full_patch = {
        "before": before_state,
        "after": req.patch_data
    }
    patch_data_json = json.dumps(full_patch, ensure_ascii=False)
    
    cursor = db.conn.execute(
        """
        INSERT INTO edit_requests (
            entity_type, entity_id, user_id, status, patch_data, comment, 
            moderated_at, moderator_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            req.entity_type, req.entity_id, user["id"], status, patch_data_json, 
            req.comment, moderated_at, moderator_id
        ]
    )
    db.conn.commit()
    new_id = cursor.lastrowid
    
    # Якщо авто-затверджено, відразу застосовуємо зміни
    if status == "approved":
        try:
            if req.entity_type == "volume":
                apply_volume_update_in_db(db, req.entity_id, req.patch_data)
        except Exception as e:
            # Якщо виникла помилка під час застосування, відкочуємо статус або видаляємо запит
            db.execute("DELETE FROM edit_requests WHERE id = ?", [new_id])
            raise HTTPException(status_code=500, detail=f"Помилка при застосуванні змін: {str(e)}")
            
    return {
        "message": "Правку успішно створено" if status == "pending" else "Правку успішно застосовано",
        "id": new_id,
        "status": status
    }

class ModerationActionSchema(BaseModel):
    moderator_comment: Optional[str] = None

@router.post("/{edit_id}/approve")
async def approve_edit_request(edit_id: int, req: Optional[ModerationActionSchema], request: Request):
    user = get_current_user(request)
    if not user or user["role"] not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Недостатньо прав для модерації")
        
    db = get_db()
    edit_req = db.get_one("SELECT * FROM edit_requests WHERE id = ?", [edit_id])
    if not edit_req:
        raise HTTPException(status_code=404, detail="Запит на правку не знайдено")
        
    if edit_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Цей запит вже оброблений")
        
    patch_obj = json.loads(edit_req["patch_data"])
    patch_data = patch_obj.get("after", patch_obj)
    entity_id = edit_req["entity_id"]
    entity_type = edit_req["entity_type"]
    
    # Застосовуємо зміни в транзакції
    try:
        if entity_type == "volume":
            apply_volume_update_in_db(db, entity_id, patch_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка при застосуванні змін: {str(e)}")
        
    # Оновлюємо статус запиту
    moderated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    db.execute(
        """
        UPDATE edit_requests 
        SET status = 'approved', moderator_id = ?, moderated_at = ?, moderator_comment = ?
        WHERE id = ?
        """,
        [user["id"], moderated_at, req.moderator_comment if req else None, edit_id]
    )
    
    return {"message": "Правку успішно схвалено та застосовано"}

@router.post("/{edit_id}/reject")
async def reject_edit_request(edit_id: int, req: Optional[ModerationActionSchema], request: Request):
    user = get_current_user(request)
    if not user or user["role"] not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Недостатньо прав для модерації")
        
    db = get_db()
    edit_req = db.get_one("SELECT id, status FROM edit_requests WHERE id = ?", [edit_id])
    if not edit_req:
        raise HTTPException(status_code=404, detail="Запит на правку не знайдено")
        
    if edit_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Цей запит вже оброблений")
        
    moderated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    db.execute(
        """
        UPDATE edit_requests 
        SET status = 'rejected', moderator_id = ?, moderated_at = ?, moderator_comment = ?
        WHERE id = ?
        """,
        [user["id"], moderated_at, req.moderator_comment if req else None, edit_id]
    )
    
    return {"message": "Правку відхилено"}
