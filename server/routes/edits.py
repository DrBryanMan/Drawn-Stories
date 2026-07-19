from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Any, Dict
import json
from datetime import datetime
from server.db import get_db
from server.routes.volumes import apply_volume_update_in_db
from server.helpers.scores import (
    calculate_edit_score,
    build_reason_string,
    get_level_for_score,
)

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
    user = db.get_one("SELECT id, username, role FROM users WHERE username = %s", [username])
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
               v.image as volume_cv_img, NULL as volume_hikka_img,
               COALESCE((
                   SELECT SUM(sh.delta)
                   FROM score_history sh
                   WHERE sh.edit_id = er.id AND sh.user_id = er.user_id
               ), 0) AS score_awarded
        FROM edit_requests er
        JOIN users u ON er.user_id = u.id
        LEFT JOIN users m ON er.moderator_id = m.id
        LEFT JOIN volumes v ON er.entity_type = 'volume' AND er.entity_id = v.id
    """
    params = []
    
    if status:
        query += " WHERE er.status = %s"
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
    vol = db.get_one("SELECT * FROM volumes WHERE id = %s", [volume_id])
    if not vol:
        return None

    # Теми з назвами
    themes = db.get_all("""
        SELECT t.id, COALESCE(t.ua_name, t.name) as name
        FROM volume_themes vt
        JOIN themes t ON t.id = vt.theme_id
        WHERE vt.volume_id = %s
    """, [volume_id])
    theme_ids = [t["id"] for t in themes]
    themes_list = [{"id": t["id"], "name": t["name"]} for t in themes]

    # Персонал
    staff = db.get_all("SELECT person_id, role FROM volume_persons WHERE volume_id = %s", [volume_id])
    staff_list = [{"person_id": s["person_id"], "role": s["role"]} for s in staff]

    # Персонажі
    chars = db.get_all("SELECT character_id, role FROM volume_characters WHERE volume_id = %s", [volume_id])
    chars_list = [{"character_id": c["character_id"], "role": c["role"]} for c in chars]

    state = dict(vol)
    for key in ["id", "created_at", "updated_at"]:
        state.pop(key, None)

    state["theme_ids"] = theme_ids
    state["themes"] = themes_list
    state["staff"] = staff_list
    state["characters"] = chars_list

    return state


def filter_patch_data(before_state: dict | None, after_data: dict) -> tuple[dict, dict]:
    # 1. Видаляємо службові/допоміжні поля фронтенду
    for key in ["image_file", "cover_img_file"]:
        after_data.pop(key, None)

    if not before_state:
        filtered_after = {k: v for k, v in after_data.items() if v not in (None, "", [], {})}
        return {}, filtered_after

    filtered_before = {}
    filtered_after = {}

    for key, after_val in after_data.items():
        before_val = before_state.get(key)

        is_equal = False

        # Порівняння списків (наприклад, theme_ids, staff, characters, themes)
        if isinstance(after_val, list) or isinstance(before_val, list):
            def get_norm_list(val):
                if not val:
                    return []
                if isinstance(val, list):
                    if val and isinstance(val[0], (int, float)):
                        return sorted([int(x) for x in val])
                    norm = []
                    for item in val:
                        if isinstance(item, dict):
                            norm.append(tuple(sorted((str(k), str(v)) for k, v in item.items() if v not in (None, ""))))
                        else:
                            norm.append(str(item))
                    return sorted(norm)
                return [str(val)]

            is_equal = get_norm_list(before_val) == get_norm_list(after_val)

        # Порівняння словників
        elif isinstance(after_val, dict) or isinstance(before_val, dict):
            def get_norm_dict(val):
                if not val:
                    return {}
                return {str(k): str(v) for k, v in val.items() if v not in (None, "")}
            is_equal = get_norm_dict(before_val) == get_norm_dict(after_val)

        # Порівняння простих полів (рядки, числа, None)
        else:
            norm_before = str(before_val).strip() if before_val is not None else ""
            norm_after = str(after_val).strip() if after_val is not None else ""
            is_equal = norm_before == norm_after

        if not is_equal:
            filtered_before[key] = before_val
            filtered_after[key] = after_val

    return filtered_before, filtered_after


def _apply_score(
    db,
    user_id: int,
    delta: int,
    reason: str,
    edit_id: int | None = None,
) -> None:
    """Нараховує/знімає бали, оновлює рівень та записує в score_history."""
    if delta == 0:
        return

    db.execute(
        "UPDATE users SET score = GREATEST(0, score + %s) WHERE id = %s",
        [delta, user_id],
    )
    row = db.get_one("SELECT score FROM users WHERE id = %s", [user_id])
    new_score = row["score"] if row else 0
    new_level = get_level_for_score(new_score)
    db.execute("UPDATE users SET level = %s WHERE id = %s", [new_level, user_id])

    db.execute(
        """
        INSERT INTO score_history (user_id, delta, reason, edit_id)
        VALUES (%s, %s, %s, %s)
        """,
        [user_id, delta, reason, edit_id],
    )

@router.get("/{edit_id}")
async def get_edit_request(edit_id: int, request: Request):
    user = get_current_user(request)
    if not user or user["role"] not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Недостатньо прав")

    db = get_db()
    query = """
        SELECT er.*, u.username as proposer_username, m.username as moderator_username,
               v.name as volume_name, v.name_uk as volume_name_uk,
               v.image as volume_cv_img, NULL as volume_hikka_img
        FROM edit_requests er
        JOIN users u ON er.user_id = u.id
        LEFT JOIN users m ON er.moderator_id = m.id
        LEFT JOIN volumes v ON er.entity_type = 'volume' AND er.entity_id = v.id
        WHERE er.id = %s
    """
    row = db.get_one(query, [edit_id])
    if not row:
        raise HTTPException(status_code=404, detail="Запит на правку не знайдено")

    d = dict(row)
    try:
        d["patch_data"] = json.loads(d["patch_data"])
    except Exception:
        d["patch_data"] = {}

    # Підвантажуємо записи балів пов'язані з цією правкою
    score_rows = db.get_all("""
        SELECT sh.delta, sh.reason, sh.created_at, u.username
        FROM score_history sh
        JOIN users u ON u.id = sh.user_id
        WHERE sh.edit_id = %s
        ORDER BY sh.created_at
    """, [edit_id])
    d["score_history"] = [dict(r) for r in score_rows]

    return d

@router.post("")
async def create_edit_request(req: EditRequestSchema, request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Необхідна авторизація")
    
    db = get_db()
    
    # Перевіримо, чи існує сутність
    if req.entity_type == "volume":
        volume = db.get_one("SELECT id FROM volumes WHERE id = %s", [req.entity_id])
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
            placeholders = ",".join(["%s"] * len(theme_ids))
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

    # Зберігаємо оригінальні theme_ids для розрахунку балів
    themes_before = before_state.get("theme_ids", []) if before_state else []
    themes_after = req.patch_data.get("theme_ids", themes_before)

    # Фільтруємо patch_data, залишаючи тільки змінені поля
    filtered_before, filtered_after = filter_patch_data(before_state, req.patch_data)

    # Зберігаємо запит у базу даних разом із знімком "before"
    full_patch = {
        "before": filtered_before,
        "after": filtered_after
    }
    patch_data_json = json.dumps(full_patch, ensure_ascii=False)
    
    cursor = db.conn.execute(
        """
        INSERT INTO edit_requests (
            entity_type, entity_id, user_id, status, patch_data, comment, 
            moderated_at, moderator_id
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        [
            req.entity_type, req.entity_id, user["id"], status, patch_data_json, 
            req.comment, moderated_at, moderator_id
        ]
    )
    new_id = cursor.fetchone()["id"]
    db.conn.commit()
    
    # Якщо авто-затверджено, відразу застосовуємо зміни
    if status == "approved":
        try:
            if req.entity_type == "volume":
                apply_volume_update_in_db(db, req.entity_id, filtered_after)
        except Exception as e:
            db.execute("DELETE FROM edit_requests WHERE id = %s", [new_id])
            raise HTTPException(status_code=500, detail=f"Помилка при застосуванні змін: {str(e)}")

        # Нараховуємо бали автору за авто-затверджену правку
        pts, parts = calculate_edit_score(
            filtered_before,
            filtered_after,
            themes_before,
            themes_after,
        )
        if pts > 0:
            reason = build_reason_string(req.entity_type, req.entity_id, parts, pts)
            _apply_score(db, user["id"], pts, reason, new_id)
            db.conn.commit()

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
    edit_req = db.get_one("SELECT * FROM edit_requests WHERE id = %s", [edit_id])
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
        SET status = 'approved', moderator_id = %s, moderated_at = %s, moderator_comment = %s
        WHERE id = %s
        """,
        [user["id"], moderated_at, req.moderator_comment if req else None, edit_id],
    )

    # Нараховуємо бали автору правки
    patch_obj_full = json.loads(edit_req["patch_data"])
    before_state = patch_obj_full.get("before") or {}
    themes_before = before_state.get("theme_ids", [])
    themes_after = patch_data.get("theme_ids", themes_before)
    pts, parts = calculate_edit_score(before_state, patch_data, themes_before, themes_after)
    if pts > 0:
        reason = build_reason_string(entity_type, entity_id, parts, pts)
        _apply_score(db, edit_req["user_id"], pts, reason, edit_id)

    # Бонус модератору за розгляд
    _apply_score(
        db,
        user["id"],
        2,
        f"Розглянуто та схвалено правку #{edit_id} (+2 б.)",
        edit_id,
    )
    db.conn.commit()

    return {"message": "Правку успішно схвалено та застосовано"}

@router.post("/{edit_id}/reject")
async def reject_edit_request(edit_id: int, req: Optional[ModerationActionSchema], request: Request):
    user = get_current_user(request)
    if not user or user["role"] not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Недостатньо прав для модерації")
        
    db = get_db()
    edit_req = db.get_one("SELECT id, status, user_id FROM edit_requests WHERE id = %s", [edit_id])
    if not edit_req:
        raise HTTPException(status_code=404, detail="Запит на правку не знайдено")

    if edit_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Цей запит вже оброблений")

    moderated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    db.execute(
        """
        UPDATE edit_requests
        SET status = 'rejected', moderator_id = %s, moderated_at = %s, moderator_comment = %s
        WHERE id = %s
        """,
        [user["id"], moderated_at, req.moderator_comment if req else None, edit_id],
    )

    # Штраф автору за відхилену правку
    _apply_score(
        db,
        edit_req["user_id"],
        -10,
        f"Відхилено правку #{edit_id} (-10 б.)",
        edit_id,
    )

    # Бонус модератору за розгляд
    _apply_score(
        db,
        user["id"],
        2,
        f"Розглянуто та відхилено правку #{edit_id} (+2 б.)",
        edit_id,
    )
    db.conn.commit()

    return {"message": "Правку відхилено"}

@router.post("/{edit_id}/close")
async def close_edit_request(edit_id: int, request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Необхідна авторизація")
        
    db = get_db()
    edit_req = db.get_one("SELECT * FROM edit_requests WHERE id = %s", [edit_id])
    if not edit_req:
        raise HTTPException(status_code=404, detail="Запит на правку не знайдено")
        
    if edit_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Можна закрити тільки ті правки, що перебувають в очікуванні")
        
    # Дозволяємо закрити лише автору правки (або адміну/модератору)
    if edit_req["user_id"] != user["id"] and user["role"] not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Недостатньо прав для закриття цієї правки")
        
    db.execute(
        "UPDATE edit_requests SET status = 'closed' WHERE id = %s",
        [edit_id]
    )
    return {"message": "Правку успішно закрито"}