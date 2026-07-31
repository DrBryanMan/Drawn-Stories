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
async def get_edit_requests(
    request: Request,
    status: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None
):
    db = get_db()
    
    query = """
        SELECT er.*, u.username as proposer_username, u.score as proposer_score, m.username as moderator_username,
               COALESCE(v.name, i.name, c.name, p.name, pub.name, col.name) as volume_name,
               COALESCE(v.name_uk, i.name_uk, c.name_uk, p.name_uk) as volume_name_uk,
               COALESCE(v.image, i.image, c.image, p.image, pub.image, col.image) as volume_cv_img,
               NULL as volume_hikka_img,
               COALESCE((
                   SELECT SUM(sh.delta)
                   FROM score_history sh
                   WHERE sh.edit_id = er.id AND sh.user_id = er.user_id
               ), 0) AS score_awarded
        FROM edit_requests er
        JOIN users u ON er.user_id = u.id
        LEFT JOIN users m ON er.moderator_id = m.id
        LEFT JOIN volumes v ON er.entity_type = 'volume' AND er.entity_id = v.id
        LEFT JOIN issues i ON er.entity_type = 'issue' AND er.entity_id = i.id
        LEFT JOIN characters c ON er.entity_type = 'character' AND er.entity_id = c.id
        LEFT JOIN persons p ON er.entity_type = 'person' AND er.entity_id = p.id
        LEFT JOIN publishers pub ON er.entity_type = 'publisher' AND er.entity_id = pub.id
        LEFT JOIN collections col ON er.entity_type = 'collection' AND er.entity_id = col.id
        WHERE 1=1
    """
    params = []
    
    if status:
        query += " AND er.status = %s"
        params.append(status)

    if entity_type:
        query += " AND er.entity_type = %s"
        params.append(entity_type)

    if entity_id is not None:
        query += " AND er.entity_id = %s"
        params.append(entity_id)
        
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

def get_entity_current_state(db, entity_type: str, entity_id: int):
    ENTITY_TABLES = {
        "volume": "volumes",
        "issue": "issues",
        "character": "characters",
        "person": "persons",
        "publisher": "publishers",
        "collection": "collections"
    }
    table = ENTITY_TABLES.get(entity_type)
    if not table:
        return None

    row = db.get_one(f"SELECT * FROM {table} WHERE id = %s", [entity_id])
    if not row:
        return None

    state = dict(row)
    for key in ["id", "created_at", "updated_at"]:
        state.pop(key, None)

    if entity_type == "volume":
        themes = db.get_all("""
            SELECT t.id, COALESCE(t.ua_name, t.name) as name
            FROM volume_themes vt
            JOIN themes t ON t.id = vt.theme_id
            WHERE vt.volume_id = %s
        """, [entity_id])
        state["theme_ids"] = [t["id"] for t in themes]
        state["themes"] = [{"id": t["id"], "name": t["name"]} for t in themes]

        staff = db.get_all("SELECT person_id, role FROM volume_persons WHERE volume_id = %s", [entity_id])
        state["staff"] = [{"person_id": s["person_id"], "role": s["role"]} for s in staff]

        chars = db.get_all("SELECT character_id, role FROM volume_characters WHERE volume_id = %s", [entity_id])
        state["characters"] = [{"character_id": c["character_id"], "role": c["role"]} for c in chars]

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

        # Автоматична десеріалізація JSON рядків для спискових полів на кшталт personas або aliases
        if key in ("personas", "aliases"):
            if isinstance(before_val, str):
                try:
                    before_val = json.loads(before_val)
                except Exception:
                    pass
            if isinstance(after_val, str):
                try:
                    after_val = json.loads(after_val)
                except Exception:
                    pass

        # Порівняння списків (наприклад, theme_ids, staff, characters, themes, personas)
        if isinstance(after_val, list) or isinstance(before_val, list):
            def get_norm_list(val):
                if not val:
                    return []
                if isinstance(val, str):
                    try:
                        val = json.loads(val)
                    except Exception:
                        return [val.strip()]
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

        # Спеціальна нормалізація для origin (походження)
        elif key == "origin":
            ORIGIN_KEYS = {
                "human": ["human", "людина"],
                "mutant": ["mutant", "мутант"],
                "alien": ["alien", "прибулець"],
                "cyborg": ["cyborg", "кіборг"],
                "robot": ["robot", "робот"],
                "android": ["android", "андроїд"],
                "deity": ["deity", "божество"],
                "demon": ["demon", "демон"],
                "magic": ["magic", "магічна істота", "magical being"],
                "atlantian": ["atlantian", "атлант", "atlantean"],
                "amazon": ["amazon", "амазонка"],
                "inhuman": ["inhuman", "нелюд"],
                "symbiote": ["symbiote", "симбіот"],
                "vampire": ["vampire", "вампір"],
                "zombie": ["zombie", "зомбі"],
                "clone": ["clone", "клон"],
                "meta": ["meta", "мета-людина", "metahuman"],
            }
            def get_norm_origin(v):
                if not v:
                    return ""
                s = str(v).strip().lower()
                for k, aliases in ORIGIN_KEYS.items():
                    if s == k or s in aliases:
                        return k
                return s
            is_equal = get_norm_origin(before_val) == get_norm_origin(after_val)

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
    db = get_db()
    query = """
        SELECT er.*, u.username as proposer_username, m.username as moderator_username,
               COALESCE(v.name, i.name, c.name, p.name, pub.name, col.name) as volume_name,
               COALESCE(v.name_uk, i.name_uk, c.name_uk, p.name_uk) as volume_name_uk,
               COALESCE(v.image, i.image, c.image, p.image, pub.image, col.image) as volume_cv_img,
               NULL as volume_hikka_img
        FROM edit_requests er
        JOIN users u ON er.user_id = u.id
        LEFT JOIN users m ON er.moderator_id = m.id
        LEFT JOIN volumes v ON er.entity_type = 'volume' AND er.entity_id = v.id
        LEFT JOIN issues i ON er.entity_type = 'issue' AND er.entity_id = i.id
        LEFT JOIN characters c ON er.entity_type = 'character' AND er.entity_id = c.id
        LEFT JOIN persons p ON er.entity_type = 'person' AND er.entity_id = p.id
        LEFT JOIN publishers pub ON er.entity_type = 'publisher' AND er.entity_id = pub.id
        LEFT JOIN collections col ON er.entity_type = 'collection' AND er.entity_id = col.id
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

def apply_entity_update_in_db(db, entity_type: str, entity_id: int, data: dict):
    if entity_type == "volume":
        apply_volume_update_in_db(db, entity_id, data)
        return

    ENTITY_TABLES = {
        "issue": ("issues", ["name", "name_uk", "issue_number", "cover_img", "image", "publication_date", "description", "synopsis"]),
        "character": ("characters", [
            "name", "name_uk", "name_ro", "name_native",
            "real_name", "real_name_uk",
            "creators", "franchise", "earth", "essence", "origin",
            "image", "portret_img", "costume_img", "portret_costume_img",
            "pseudo", "description", "bio", "cv_id",
        ]),
        "person": ("persons", ["name", "name_uk", "name_native", "pseudo", "occupation", "birth", "birth_place", "website", "image", "cv_id"]),
        "publisher": ("publishers", ["name", "name_uk", "country", "website", "image", "logo", "cv_id"]),
        "collection": ("collections", ["name", "name_uk", "description", "image", "cover_img"])
    }

    if entity_type not in ENTITY_TABLES:
        return

    table, allowed_fields = ENTITY_TABLES[entity_type]
    fields = []
    params = []
    for key, value in data.items():
        if key in allowed_fields:
            if value == "":
                value = None
            fields.append(f"{key} = %s")
            params.append(value)

    if entity_type == "character":
        if "personas" in data:
            personas_raw = data["personas"]
            if isinstance(personas_raw, str):
                try:
                    personas = json.loads(personas_raw)
                except Exception:
                    personas = []
            elif isinstance(personas_raw, list):
                personas = personas_raw
            else:
                personas = []
            fields.append("personas = %s::jsonb")
            params.append(json.dumps(personas, ensure_ascii=False))

        if "aliases" in data:
            aliases_raw = data["aliases"]
            if isinstance(aliases_raw, str):
                try:
                    aliases = json.loads(aliases_raw)
                except Exception:
                    aliases = []
            elif isinstance(aliases_raw, list):
                aliases = aliases_raw
            else:
                aliases = []
            fields.append("aliases = %s::jsonb")
            params.append(json.dumps(aliases, ensure_ascii=False))

    if fields:
        params.append(entity_id)
        db.execute(f"UPDATE {table} SET {', '.join(fields)} WHERE id = %s", params)

@router.post("")
async def create_edit_request(req: EditRequestSchema, request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Необхідна авторизація")
    
    db = get_db()
    
    ENTITY_TABLES = {
        "volume": "volumes",
        "issue": "issues",
        "character": "characters",
        "person": "persons",
        "publisher": "publishers",
        "collection": "collections"
    }

    if req.entity_type not in ENTITY_TABLES:
        raise HTTPException(status_code=400, detail="Непідтримуваний тип сутності")

    table = ENTITY_TABLES[req.entity_type]
    entity = db.get_one(f"SELECT id FROM {table} WHERE id = %s", [req.entity_id])
    if not entity:
        raise HTTPException(status_code=404, detail="Сутність не знайдено")

    # Збережемо поточний стан "До"
    before_state = get_entity_current_state(db, req.entity_type, req.entity_id)

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

    # Якщо авто-затверджено при створенні:
    if status == "approved":
        try:
            apply_entity_update_in_db(db, req.entity_type, req.entity_id, filtered_after)
        except Exception as e:
            db.execute("DELETE FROM edit_requests WHERE id = %s", [new_id])
            raise HTTPException(status_code=500, detail=f"Помилка при застосуванні змін: {str(e)}")

        pts, parts = calculate_edit_score(
            filtered_before,
            filtered_after,
            themes_before,
            themes_after,
            entity_type=req.entity_type
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
        apply_entity_update_in_db(db, entity_type, entity_id, patch_data)
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

@router.delete("/{edit_id}")
async def delete_edit_request(edit_id: int, request: Request):
    user = get_current_user(request)
    if not user or user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Видаляти правки може тільки адміністратор")

    db = get_db()
    edit_req = db.get_one("SELECT * FROM edit_requests WHERE id = %s", [edit_id])
    if not edit_req:
        raise HTTPException(status_code=404, detail="Запит на правку не знайдено")

    proposer_id = edit_req["user_id"]
    was_approved = edit_req["status"] == "approved"

    # Якщо правка була схвалена, відкочуємо зміни поля "до" назад в базу даних
    if was_approved:
        try:
            patch_obj = json.loads(edit_req["patch_data"])
            before_data = patch_obj.get("before", {})
            if before_data:
                apply_entity_update_in_db(db, edit_req["entity_type"], edit_req["entity_id"], before_data)
        except Exception as err:
            raise HTTPException(status_code=500, detail=f"Помилка відкочування змін у БД: {str(err)}")

    # Рахуємо бали, якщо за цієї правку давали бали пропозиціонеру
    score_row = db.get_one(
        """
        SELECT COALESCE(SUM(delta), 0) as total_awarded
        FROM score_history
        WHERE edit_id = %s AND user_id = %s AND delta > 0
        """,
        [edit_id, proposer_id]
    )
    awarded_score = score_row["total_awarded"] if score_row else 0

    if awarded_score > 0:
        reason = f"Видалено правку #{edit_id} (відкочено зміни та анульовано {awarded_score} б.)"
        _apply_score(db, proposer_id, -awarded_score, reason, edit_id)

    db.execute("DELETE FROM edit_requests WHERE id = %s", [edit_id])
    db.conn.commit()

    msg = f"Правку #{edit_id} успішно видалено"
    if was_approved:
        msg += " та відкочено її зміни у базі даних"
    if awarded_score > 0:
        msg += f" (анульовано {awarded_score} б. у автора)"

    return {"message": msg}