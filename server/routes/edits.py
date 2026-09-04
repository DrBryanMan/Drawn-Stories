from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Any, Dict
import json
from datetime import datetime
from server.db import get_db
from server.routes.volumes import (
    apply_volume_update_in_db,
    replace_volume_themes,
    sync_volume_staff_and_characters,
)
from server.helpers.scores import (
    calculate_edit_score,
    build_reason_string,
    get_level_for_score,
    CREATION_BONUS,
)
from server.helpers.notifications import (
    notify_edit_status_change,
    notify_level_up,
    notify_new_issue_subscribers,
)

router = APIRouter(prefix="/api/edits", tags=["edits"])

class EditRequestSchema(BaseModel):
    entity_type: str
    entity_id: Optional[int] = 0
    patch_data: Dict[str, Any]
    comment: Optional[str] = None
    auto_approve: Optional[bool] = False
    is_creation: Optional[bool] = False

def get_current_user(request: Request):
    user_login = request.cookies.get("login") or request.cookies.get("username")
    if not user_login:
        return None
    db = get_db()
    user = db.get_one("SELECT id, login, role FROM users WHERE login = %s", [user_login])
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
        SELECT er.*, u.login as proposer_login, u.login as proposer_username, COALESCE(u.nickname, u.login) as proposer_nickname, u.score as proposer_score, m.login as moderator_login, m.login as moderator_username, COALESCE(m.nickname, m.login) as moderator_nickname,
               COALESCE(v.name, i.name, c.name, p.name, pub.name, col.name, mc.name) as volume_name,
               COALESCE(v.name_uk, i.name_uk, c.name_uk, p.name_uk, mc.name_uk) as volume_name_uk,
               COALESCE(v.image, i.image, c.image, p.image, pub.image, col.image, mc.image) as volume_cv_img,
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
        LEFT JOIN manga_chapters mc ON er.entity_type = 'manga_chapter' AND er.entity_id = mc.id
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

        patch = d.get("patch_data", {})
        after = patch.get("after", patch) if isinstance(patch, dict) else {}
        before = patch.get("before", {}) if isinstance(patch, dict) else {}

        if d["entity_type"] == "collection":
            if not d.get("volume_name") or d["volume_name"] == "" or d.get("is_creation"):
                vol_id = after.get("volume_id") or before.get("volume_id")
                issue_num = after.get("issue_number") or before.get("issue_number")
                if not vol_id and d.get("entity_id"):
                    c_row = db.get_one("SELECT volume_id, issue_number, name FROM collections WHERE id = %s", [d["entity_id"]])
                    if c_row:
                        vol_id = c_row.get("volume_id")
                        issue_num = issue_num or c_row.get("issue_number")
                        if c_row.get("name"):
                            d["volume_name"] = c_row["name"]

                if vol_id and (not d.get("volume_name") or d.get("is_creation")):
                    v_row = db.get_one("SELECT name, name_uk FROM volumes WHERE id = %s", [vol_id])
                    if v_row:
                        v_title = v_row.get("name_uk") or v_row.get("name")
                        if v_title:
                            c_title = f"{v_title}, Книга {issue_num}" if issue_num else v_title
                            d["volume_name"] = c_title
                            d["volume_name_uk"] = c_title
                elif issue_num and not d.get("volume_name"):
                    d["volume_name"] = f"Збірник, Книга {issue_num}"

        if d.get("is_creation") and not d.get("volume_name"):
            if isinstance(after, dict):
                d["volume_name"] = after.get("name") or (f"Випуск #{after.get('issue_number')}" if after.get("issue_number") else "Нова сутність")
                d["volume_name_uk"] = after.get("name_uk")

        if not d.get("volume_cv_img") and isinstance(after, dict):
            d["volume_cv_img"] = after.get("image") or after.get("cover_img") or after.get("portret_img") or after.get("photo")

        result.append(d)
        
    return result


def get_entity_current_state(db, entity_type: str, entity_id: int):
    ENTITY_TABLES = {
        "volume": "volumes",
        "issue": "issues",
        "character": "characters",
        "person": "persons",
        "publisher": "publishers",
        "collection": "collections",
        "manga_chapter": "manga_chapters"
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

    elif entity_type == "issue":
        staff = db.get_all("SELECT person_id, role FROM issue_persons WHERE issue_id = %s AND story_id IS NULL", [entity_id])
        state["staff"] = [{"person_id": s["person_id"], "role": s["role"]} for s in staff]

        chars = db.get_all("SELECT character_id, role FROM issue_characters WHERE issue_id = %s", [entity_id])
        state["characters"] = [{"character_id": c["character_id"], "role": c["role"]} for c in chars]

    elif entity_type == "manga_chapter":
        chars = db.get_all("SELECT character_id, role FROM manga_chapter_characters WHERE chapter_id = %s", [entity_id])
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

        # Автоматична десеріалізація JSON рядків для спискових/структурованих полів на кшталт personas, aliases, contents, tech_info
        if key in ("personas", "aliases", "contents", "tech_info"):
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

    user_row = db.get_one("SELECT score, level FROM users WHERE id = %s", [user_id])
    old_score = user_row["score"] if user_row else 0
    old_level = user_row["level"] if (user_row and user_row.get("level")) else get_level_for_score(old_score)

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

    if new_level > old_level:
        notify_level_up(user_id=user_id, new_level=new_level, new_score=new_score)


@router.get("/{edit_id}")
async def get_edit_request(edit_id: int, request: Request):
    db = get_db()
    query = """
        SELECT er.*, u.login as proposer_login, u.login as proposer_username, COALESCE(u.nickname, u.login) as proposer_nickname, m.login as moderator_login, m.login as moderator_username, COALESCE(m.nickname, m.login) as moderator_nickname,
               COALESCE(v.name, i.name, c.name, p.name, pub.name, col.name, mc.name) as volume_name,
               COALESCE(v.name_uk, i.name_uk, c.name_uk, p.name_uk, mc.name_uk) as volume_name_uk,
               COALESCE(v.image, i.image, c.image, p.image, pub.image, col.image, mc.image) as volume_cv_img,
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
        LEFT JOIN manga_chapters mc ON er.entity_type = 'manga_chapter' AND er.entity_id = mc.id
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

    # The patch stores a publisher foreign-key ID. Supply its display name for
    # the read-only diff so the UI does not expose an internal database ID.
    patch = d["patch_data"]
    before = patch.get("before", {}) if isinstance(patch, dict) else {}
    after = patch.get("after", patch) if isinstance(patch, dict) else {}
    publisher_ids = {
        value
        for value in (before.get("publisher"), after.get("publisher"))
        if isinstance(value, int) or (isinstance(value, str) and value.isdigit())
    }
    if publisher_ids:
        publisher_rows = db.get_all(
            "SELECT id, name FROM publishers WHERE id = ANY(%s)",
            [[int(value) for value in publisher_ids]],
        )
        d["publisher_names"] = {
            str(row["id"]): row["name"] or f"#{row['id']}"
            for row in publisher_rows
        }
    else:
        d["publisher_names"] = {}

    # Підвантажуємо записи балів пов'язані з цією правкою
    score_rows = db.get_all("""
        SELECT sh.delta, sh.reason, sh.created_at, u.login, u.login as username, COALESCE(u.nickname, u.login) AS nickname
        FROM score_history sh
        JOIN users u ON u.id = sh.user_id
        WHERE sh.edit_id = %s
        ORDER BY sh.created_at
    """, [edit_id])
    d["score_history"] = [dict(r) for r in score_rows]

    if d["entity_type"] == "collection":
        if not d.get("volume_name") or d["volume_name"] == "" or d.get("is_creation"):
            vol_id = after.get("volume_id") or before.get("volume_id")
            issue_num = after.get("issue_number") or before.get("issue_number")
            if not vol_id and d.get("entity_id"):
                c_row = db.get_one("SELECT volume_id, issue_number, name FROM collections WHERE id = %s", [d["entity_id"]])
                if c_row:
                    vol_id = c_row.get("volume_id")
                    issue_num = issue_num or c_row.get("issue_number")
                    if c_row.get("name"):
                        d["volume_name"] = c_row["name"]

            if vol_id and (not d.get("volume_name") or d.get("is_creation")):
                v_row = db.get_one("SELECT name, name_uk FROM volumes WHERE id = %s", [vol_id])
                if v_row:
                    v_title = v_row.get("name_uk") or v_row.get("name")
                    if v_title:
                        c_title = f"{v_title}, Книга {issue_num}" if issue_num else v_title
                        d["volume_name"] = c_title
                        d["volume_name_uk"] = c_title
            elif issue_num and not d.get("volume_name"):
                d["volume_name"] = f"Збірник, Книга {issue_num}"

    if d.get("is_creation") and not d.get("volume_name"):
        d["volume_name"] = after.get("name") or (f"Випуск #{after.get('issue_number')}" if after.get("issue_number") else "Нова сутність")
        d["volume_name_uk"] = after.get("name_uk")

    if not d.get("volume_cv_img"):
        d["volume_cv_img"] = after.get("image") or after.get("cover_img") or after.get("portret_img") or after.get("photo")

    return d


def apply_entity_update_in_db(db, entity_type: str, entity_id: int, data: dict):
    if entity_type == "volume":
        apply_volume_update_in_db(db, entity_id, data)
        return

    ENTITY_TABLES = {
        "issue": ("issues", ["name", "name_uk", "issue_number", "image", "cover_date", "release_date", "description", "volume_id", "plot", "site_link", "pages"]),
        "character": ("characters", [
            "name", "name_uk", "name_ro", "name_native",
            "real_name", "real_name_uk",
            "publisher", "creators", "franchise", "earth", "essence", "origin",
            "gender", "birth", "death",
            "image", "portret_img", "costume_img", "portret_costume_img",
            "cv_id", "cv_slug", "mal_id", "hikka_slug"
        ]),
        "person": ("persons", [
            "name", "name_uk", "name_native", "pseudo", "occupation",
            "birth", "death", "country", "gender", "hometown", "website",
            "image", "cv_id", "cv_slug", "hikka_slug"
        ]),
        "publisher": ("publishers", [
            "name", "cv_id", "cv_slug", "image", "founded_date", "website",
            "address", "place", "country", "status", "work_type"
        ]),
        "collection": ("collections", [
            "name", "description", "synopsis", "synopsis_ua",
            "image", "isbn", "pages", "issue_number", "release_date",
            "site_link", "verification_status", "contents", "publisher", "volume_id"
        ]),

        "manga_chapter": ("manga_chapters", ["name", "name_uk", "name_en", "name_native", "chapter_number", "release_date", "synopsis", "pages", "image"])
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

    if entity_type == "collection":
        if "tech_info" in data:
            tech_raw = data["tech_info"]
            if isinstance(tech_raw, str):
                try:
                    tech_val = json.loads(tech_raw)
                except Exception:
                    tech_val = {}
            elif isinstance(tech_raw, dict):
                tech_val = tech_raw
            else:
                tech_val = {}
            fields.append("tech_info = %s::jsonb")
            params.append(json.dumps(tech_val, ensure_ascii=False))

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

    if entity_type == "manga_chapter" and "characters" in data and isinstance(data["characters"], list):
        db.execute("DELETE FROM manga_chapter_characters WHERE chapter_id = %s", [entity_id])
        for c in data["characters"]:
            char_id = c.get("id") or c.get("character_id")
            role = c.get("role", "main")
            if char_id:
                db.execute(
                    "INSERT INTO manga_chapter_characters (chapter_id, character_id, role) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                    [entity_id, char_id, role]
                )


def create_entity_in_db(db, entity_type: str, data: dict) -> int:
    """
    Створює новий запис сутності в БД для approved запиту на створення.
    Повертає ID новоствореної сутності.
    """
    def to_null(val):
        return None if val == "" else val

    if entity_type == "volume":
        if not data.get("name"):
            raise ValueError("Назва тому обов'язкова")
        allowed_fields = [
            "name", "name_uk", "name_en", "name_native", "description", "synopsis", "synopsis_ua", "start_year", 
            "status", "lang", "publisher", "image", "cover_img",
            "cv_id", "cv_slug", "hikka_slug", "mal_id", "locg_id", "locg_slug", "site_link"
        ]
        columns = []
        placeholders = []
        params = []
        for k in allowed_fields:
            if k in data and data[k] is not None:
                val = to_null(data[k])
                columns.append(k)
                placeholders.append("%s")
                params.append(val)
        if not columns:
            raise ValueError("Немає даних для збереження тому")

        sql = f"INSERT INTO volumes ({', '.join(columns)}) VALUES ({', '.join(placeholders)}) RETURNING id"
        row = db.get_one(sql, params)
        new_id = row["id"]

        if "theme_ids" in data and isinstance(data["theme_ids"], list):
            replace_volume_themes(db, new_id, data["theme_ids"])

        sync_volume_staff_and_characters(db, new_id, data)
        return new_id

    elif entity_type == "issue":
        if not data.get("issue_number") and not data.get("name"):
            raise ValueError("Номер випуску або назва обов'язкові")
        allowed_fields = [
            "name", "name_uk", "issue_number", "volume_id", "cv_id", "cv_slug", 
            "image", "cover_date", "release_date", "description", "pages", "synopsis"
        ]
        columns = []
        placeholders = []
        params = []
        for k in allowed_fields:
            if k in data and data[k] is not None:
                val = to_null(data[k])
                columns.append(k)
                placeholders.append("%s")
                params.append(val)
        if not columns:
            raise ValueError("Немає даних для збереження випуску")

        sql = f"INSERT INTO issues ({', '.join(columns)}) VALUES ({', '.join(placeholders)}) RETURNING id"
        row = db.get_one(sql, params)
        new_id = row["id"]

        volume_id = data.get("volume_id")
        if volume_id:
            vol = db.get_one("SELECT name FROM volumes WHERE id = %s", [volume_id])
            vol_name = vol["name"] if vol else None
            issue_num = str(data.get("issue_number") or data.get("name") or new_id)
            try:
                notify_new_issue_subscribers(
                    volume_id=int(volume_id),
                    issue_id=new_id,
                    issue_number=issue_num,
                    volume_name=vol_name
                )
            except Exception as err:
                print(f"Помилка відправки сповіщень для нового випуску #{new_id}: {err}")

        # Sync staff and characters for issue if provided
        if "staff" in data and isinstance(data["staff"], list):
            db.execute("DELETE FROM issue_persons WHERE issue_id = %s", [new_id])
            for s in data["staff"]:
                person_id = s.get("id") or s.get("person_id")
                role = s.get("role")
                if person_id:
                    db.conn.execute(
                        "INSERT INTO issue_persons (issue_id, person_id, role) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                        [new_id, person_id, role]
                    )
        if "characters" in data and isinstance(data["characters"], list):
            db.execute("DELETE FROM issue_characters WHERE issue_id = %s", [new_id])
            for c in data["characters"]:
                char_id = c.get("id") or c.get("character_id")
                role = c.get("role")
                if char_id:
                    db.conn.execute(
                        "INSERT INTO issue_characters (issue_id, character_id, role) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                        [new_id, char_id, role]
                    )

        return new_id

    elif entity_type == "character":
        name = to_null(data.get("name"))
        if not name:
            raise ValueError("Оригінальне ім'я обов'язкове")

        name_uk = to_null(data.get("name_uk"))
        name_ro = to_null(data.get("name_ro"))
        name_native = to_null(data.get("name_native"))
        real_name = to_null(data.get("real_name"))
        real_name_uk = to_null(data.get("real_name_uk"))

        publisher = data.get("publisher")
        if publisher == "" or publisher is None:
            publisher = None
        else:
            try:
                publisher = int(publisher)
            except Exception:
                publisher = None

        creators = to_null(data.get("creators"))
        franchise = to_null(data.get("franchise"))
        earth = to_null(data.get("earth"))
        essence = to_null(data.get("essence"))
        origin = to_null(data.get("origin"))
        pseudo = to_null(data.get("pseudo"))
        description = to_null(data.get("description"))
        bio = to_null(data.get("bio"))
        cv_id = to_null(data.get("cv_id"))

        gender = data.get("gender")
        if gender is not None and gender != "":
            try:
                gender = int(gender)
            except Exception:
                gender = None
        else:
            gender = None

        image = to_null(data.get("image"))
        portret_img = to_null(data.get("portret_img"))
        costume_img = to_null(data.get("costume_img"))
        portret_costume_img = to_null(data.get("portret_costume_img"))

        personas_raw = data.get("personas", [])
        if isinstance(personas_raw, str):
            try:
                personas = json.loads(personas_raw)
            except Exception:
                personas = []
        elif isinstance(personas_raw, list):
            personas = personas_raw
        else:
            personas = []

        aliases_raw = data.get("aliases", [])
        if isinstance(aliases_raw, str):
            try:
                aliases = json.loads(aliases_raw)
            except Exception:
                aliases = []
        elif isinstance(aliases_raw, list):
            aliases = aliases_raw
        else:
            aliases = []

        personas_json = json.dumps(personas, ensure_ascii=False)
        aliases_json = json.dumps(aliases, ensure_ascii=False)

        row = db.get_one(
            """
            INSERT INTO characters (
                name, name_uk, name_ro, name_native, real_name, real_name_uk, publisher, creators,
                franchise, earth, essence, origin,
                gender, image, portret_img, costume_img, portret_costume_img,
                personas, aliases, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, NOW())
            RETURNING id
            """,
            [
                name, name_uk, name_ro, name_native, real_name, real_name_uk, publisher, creators,
                franchise, earth, essence, origin,
                gender, image, portret_img, costume_img, portret_costume_img, personas_json, aliases_json
            ]
        )

        return row["id"]

    elif entity_type == "person":
        name = to_null(data.get("name"))
        if not name:
            raise ValueError("Ім'я персони обов'язкове")

        allowed_fields = [
            "name", "name_uk", "name_native", "pseudo", "occupation",
            "birth", "death", "country", "gender", "hometown",
            "website", "image", "cv_id", "cv_slug", "hikka_slug", "aliases"
        ]

        columns = []
        placeholders = []
        params = []
        for k in allowed_fields:
            if k in data and data[k] is not None:
                val = to_null(data[k])
                columns.append(k)
                placeholders.append("%s")
                params.append(val)
        if not columns:
            raise ValueError("Немає даних для збереження персони")

        sql = f"INSERT INTO persons ({', '.join(columns)}) VALUES ({', '.join(placeholders)}) RETURNING id"
        row = db.get_one(sql, params)
        return row["id"]

    elif entity_type == "publisher":
        name = to_null(data.get("name"))
        if not name:
            raise ValueError("Назва видавництва обов'язкова")

        allowed_fields = [
            "name", "cv_id", "cv_slug", "image", "founded_date", 
            "website", "aliases", "address", "place", "country",
            "status", "work_type"
        ]
        columns = []
        placeholders = []
        params = []
        for k in allowed_fields:
            if k in data and data[k] is not None:
                val = to_null(data[k])
                columns.append(k)
                placeholders.append("%s")
                params.append(val)
        if not columns:
            raise ValueError("Немає даних для збереження видавництва")

        sql = f"INSERT INTO publishers ({', '.join(columns)}) VALUES ({', '.join(placeholders)}) RETURNING id"
        row = db.get_one(sql, params)
        return row["id"]

    elif entity_type == "collection":
        allowed_fields = [
            "name", "description", "synopsis", "synopsis_ua", "image", 
            "isbn", "pages", "issue_number", "release_date", 
            "site_link", "verification_status", "contents", "publisher", "volume_id"
        ]

        columns = []
        placeholders = []
        params = []
        for k in allowed_fields:
            if k in data and data[k] is not None:
                val = to_null(data[k])
                columns.append(k)
                placeholders.append("%s")
                params.append(val)

        if "tech_info" in data and data["tech_info"] is not None:
            tech_raw = data["tech_info"]
            if isinstance(tech_raw, str):
                try:
                    tech_val = json.loads(tech_raw)
                except Exception:
                    tech_val = {}
            elif isinstance(tech_raw, dict):
                tech_val = tech_raw
            else:
                tech_val = {}
            columns.append("tech_info")
            placeholders.append("%s::jsonb")
            params.append(json.dumps(tech_val, ensure_ascii=False))

        if not columns:
            raise ValueError("Немає даних для збереження збірника")

        sql = f"INSERT INTO collections ({', '.join(columns)}) VALUES ({', '.join(placeholders)}) RETURNING id"
        row = db.get_one(sql, params)
        return row["id"]

    else:
        raise ValueError(f"Створення сутності типу '{entity_type}' не підтримується")


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
        "collection": "collections",
        "manga_chapter": "manga_chapters"
    }

    if req.entity_type not in ENTITY_TABLES:
        raise HTTPException(status_code=400, detail="Непідтримуваний тип сутності")

    is_creation = bool(req.is_creation)
    table = ENTITY_TABLES[req.entity_type]

    if not is_creation:
        entity = db.get_one(f"SELECT id FROM {table} WHERE id = %s", [req.entity_id])
        if not entity:
            raise HTTPException(status_code=404, detail="Сутність не знайдено")
        before_state = get_entity_current_state(db, req.entity_type, req.entity_id)
    else:
        before_state = {}

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
    # Для створення: тільки admin і moderator можуть auto_approve
    if is_creation:
        can_auto_approve = user["role"] in ("admin", "moderator")
    else:
        can_auto_approve = user["role"] in ("admin", "moderator", "editor")
    
    status = "pending"
    moderator_id = None
    moderated_at = None
    
    if req.auto_approve and can_auto_approve:
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
            moderated_at, moderator_id, is_creation, created_entity_id
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        [
            req.entity_type, req.entity_id or 0, user["id"], status, patch_data_json, 
            req.comment, moderated_at, moderator_id, is_creation, None
        ]
    )
    new_id = cursor.fetchone()["id"]
    db.conn.commit()

    created_id = None
    # Якщо авто-затверджено при створенні:
    if status == "approved":
        try:
            if is_creation:
                created_id = create_entity_in_db(db, req.entity_type, filtered_after)
                db.execute(
                    "UPDATE edit_requests SET created_entity_id = %s, entity_id = %s WHERE id = %s",
                    [created_id, created_id, new_id]
                )
            else:
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
        if is_creation:
            pts += CREATION_BONUS
            parts.insert(0, f"створено сутність (+{CREATION_BONUS} б.)")

        target_entity_id = created_id if is_creation else req.entity_id
        if pts > 0:
            reason = build_reason_string(
                req.entity_type,
                target_entity_id,
                parts,
                pts,
                action="Створено" if is_creation else "Схвалено",
                is_creation=is_creation
            )
            _apply_score(db, user["id"], pts, reason, new_id)
            db.conn.commit()

    return {
        "message": "Правку успішно створено" if status == "pending" else "Правку успішно застосовано",
        "id": new_id,
        "status": status,
        "created_entity_id": created_id if (status == "approved" and is_creation) else None
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
    is_creation = bool(edit_req.get("is_creation"))
    
    created_id = None
    # Застосовуємо зміни в транзакції
    try:
        if is_creation:
            created_id = create_entity_in_db(db, entity_type, patch_data)
        else:
            apply_entity_update_in_db(db, entity_type, entity_id, patch_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка при застосуванні змін: {str(e)}")
        
    # Оновлюємо статус запиту
    moderated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    target_entity_id = created_id if is_creation else entity_id

    db.execute(
        """
        UPDATE edit_requests
        SET status = 'approved', moderator_id = %s, moderated_at = %s, moderator_comment = %s,
            created_entity_id = %s, entity_id = %s
        WHERE id = %s
        """,
        [user["id"], moderated_at, req.moderator_comment if req else None, created_id, target_entity_id, edit_id],
    )

    # Нараховуємо бали автору правки
    patch_obj_full = json.loads(edit_req["patch_data"])
    before_state = patch_obj_full.get("before") or {}
    themes_before = before_state.get("theme_ids", [])
    themes_after = patch_data.get("theme_ids", themes_before)
    pts, parts = calculate_edit_score(before_state, patch_data, themes_before, themes_after)
    if is_creation:
        pts += CREATION_BONUS
        parts.insert(0, f"створено сутність (+{CREATION_BONUS} б.)")

    if pts > 0:
        reason = build_reason_string(
            entity_type,
            target_entity_id,
            parts,
            pts,
            action="Створено" if is_creation else "Схвалено",
            is_creation=is_creation
        )
        _apply_score(db, edit_req["user_id"], pts, reason, edit_id)

    # Бонус модератору за розгляд (якщо модератор не є автором правки)
    if user["id"] != edit_req["user_id"]:
        _apply_score(
            db,
            user["id"],
            2,
            f"Розглянуто та схвалено правку #{edit_id} (+2 б.)",
            edit_id,
        )

    # Сповіщення автору правки
    notify_edit_status_change(
        user_id=edit_req["user_id"],
        edit_id=edit_id,
        entity_type=edit_req["entity_type"],
        new_status="approved",
        moderator_comment=req.moderator_comment if req else None,
        moderator_id=user["id"]
    )

    db.conn.commit()

    return {
        "message": "Правку успішно схвалено та застосовано",
        "created_entity_id": created_id
    }


@router.post("/{edit_id}/reject")
async def reject_edit_request(edit_id: int, req: Optional[ModerationActionSchema], request: Request):
    user = get_current_user(request)
    if not user or user["role"] not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Недостатньо прав для модерації")
        
    db = get_db()
    edit_req = db.get_one("SELECT id, status, user_id, entity_type FROM edit_requests WHERE id = %s", [edit_id])
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

    # Бонус модератору за розгляд (якщо модератор не є автором правки)
    if user["id"] != edit_req["user_id"]:
        _apply_score(
            db,
            user["id"],
            2,
            f"Розглянуто та відхилено правку #{edit_id} (+2 б.)",
            edit_id,
        )

    # Сповіщення автору правки
    notify_edit_status_change(
        user_id=edit_req["user_id"],
        edit_id=edit_id,
        entity_type=edit_req["entity_type"],
        new_status="rejected",
        moderator_comment=req.moderator_comment if req else None,
        moderator_id=user["id"]
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

    # Якщо правка була схвалена, відкочуємо зміни поля "до" назад в базу даних або видаляємо створену сутність
    if was_approved:
        try:
            if edit_req.get("is_creation"):
                created_id = edit_req.get("created_entity_id") or edit_req.get("entity_id")
                ENTITY_TABLES = {
                    "volume": "volumes",
                    "issue": "issues",
                    "character": "characters",
                    "person": "persons",
                    "publisher": "publishers",
                    "collection": "collections",
                    "manga_chapter": "manga_chapters"
                }
                table = ENTITY_TABLES.get(edit_req["entity_type"])
                if table and created_id:
                    db.execute(f"DELETE FROM {table} WHERE id = %s", [created_id])
            else:
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
        msg += " та видалено створену сутність із бази даних" if edit_req.get("is_creation") else " та відкочено її зміни у базі даних"
    if awarded_score > 0:
        msg += f" (анульовано {awarded_score} б. у автора)"

    return {"message": msg}
