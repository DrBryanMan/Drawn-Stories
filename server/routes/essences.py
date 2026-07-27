import json
from fastapi import APIRouter, Query, HTTPException, Request
from typing import Optional
from ..db import get_db

router = APIRouter(prefix="/api/essences", tags=["essences"])


def to_null(val):
    return None if val == "" else val


def parse_json_field(val):
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return []
    elif isinstance(val, list):
        return val
    return []


@router.get("")
async def get_essences(
    search: Optional[str] = None,
    franchise: Optional[str] = None,
    earth: Optional[int] = None,
    sort: Optional[str] = "name",
    order_dir: Optional[str] = "asc",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    db = get_db()
    where_parts = []
    params = []

    if search:
        where_parts.append("(LOWER(e.essence_name) LIKE %s OR LOWER(e.essence_name_uk) LIKE %s OR LOWER(e.person_name) LIKE %s OR LOWER(e.person_name_uk) LIKE %s OR LOWER(e.slug) LIKE %s)")
        search_pattern = f"%{search.lower()}%"
        params.extend([search_pattern, search_pattern, search_pattern, search_pattern, search_pattern])

    if franchise:
        where_parts.append("LOWER(e.franchise) = %s")
        params.append(franchise.lower())

    if earth:
        where_parts.append("e.earth = %s")
        params.append(earth)

    where_clause = "WHERE " + " AND ".join(where_parts) if where_parts else ""

    if sort == "recent":
        order_clause = f"e.created_at {order_dir.upper()}"
    else:
        order_clause = f"e.essence_name {order_dir.upper()}"

    count_sql = f"""
        SELECT COUNT(*) as count
        FROM essences e
        {where_clause}
    """
    total_row = db.get_one(count_sql, params)
    total = total_row["count"] if total_row else 0

    offset = (page - 1) * limit

    rows = db.get_all(
        f"""
        SELECT e.*,
               (SELECT COUNT(*) FROM essence_characters ec WHERE ec.essence_slug = e.slug) AS characters_count
        FROM essences e
        {where_clause}
        ORDER BY {order_clause}
        LIMIT %s OFFSET %s
        """,
        params + [limit, offset],
    )

    for r in rows:
        r["other_essences"] = parse_json_field(r.get("other_essences"))

    return {"items": rows, "total": total, "page": page, "limit": limit}


@router.get("/{slug}")
async def get_essence(slug: str):
    db = get_db()
    essence = db.get_one("SELECT * FROM essences WHERE slug = %s", [slug])

    if not essence:
        raise HTTPException(status_code=404, detail="Сутність не знайдено")

    if essence.get("essence_slug"):
        essence["essence_slug_exists"] = bool(db.get_one("SELECT slug FROM essences WHERE slug = %s", [essence["essence_slug"]]))

    raw_other = parse_json_field(essence.get("other_essences"))
    processed_other = []
    if raw_other and isinstance(raw_other, list):
        for o_item in raw_other:
            if isinstance(o_item, dict):
                o_slug = to_null(o_item.get("slug"))
                o_name = to_null(o_item.get("name"))
                o_name_uk = to_null(o_item.get("name_uk"))
                o_image = to_null(o_item.get("image"))
                o_char_id = o_item.get("character_id")
                if o_char_id != "" and o_char_id is not None:
                    try:
                        o_char_id = int(o_char_id)
                    except Exception:
                        o_char_id = None
                else:
                    o_char_id = None
            else:
                o_slug = str(o_item)
                o_name = str(o_item)
                o_name_uk = None
                o_image = None
                o_char_id = None

            found_char = None
            if o_char_id:
                found_char = db.get_one("SELECT id, name, name_uk, real_name, real_name_uk, image, essence FROM characters WHERE id = %s", [o_char_id])

            target_ess_slug = o_slug
            if not target_ess_slug and found_char and found_char.get("essence"):
                target_ess_slug = found_char.get("essence")

            found_ess = None
            if target_ess_slug:
                found_ess = db.get_one("SELECT slug, essence_name, essence_name_uk, image FROM essences WHERE slug = %s", [target_ess_slug])

            char_name_en = o_name or (found_char.get("name") or found_char.get("real_name") if found_char else None)
            char_name_uk = o_name_uk or (found_char.get("name_uk") or found_char.get("real_name_uk") if found_char else None)

            ess_name_en = (found_ess.get("essence_name") if found_ess else None) or target_ess_slug
            ess_name_uk = (found_ess.get("essence_name_uk") if found_ess else None) or target_ess_slug

            item_dict = {
                "slug": o_slug,
                "name": o_name,
                "name_uk": o_name_uk,
                "character_id": o_char_id if (found_char or o_char_id) else None,
                "character_name": char_name_uk or char_name_en or (found_ess.get("essence_name_uk") or found_ess.get("essence_name") if found_ess else o_slug),
                "character_name_en": char_name_en,
                "character_name_uk": char_name_uk,
                "essence_slug": target_ess_slug,
                "essence_name": ess_name_uk or ess_name_en,
                "essence_name_en": ess_name_en,
                "essence_name_uk": ess_name_uk,
                "image": o_image or (found_char.get("image") if found_char else None) or (found_ess.get("image") if found_ess else None),
                "exists": bool(found_char or found_ess)
            }
            processed_other.append(item_dict)
    essence["other_essences"] = processed_other

    # Основний персонаж для сутності (якщо вказано character_id)
    if essence.get("character_id"):
        char_info = db.get_one(
            "SELECT id, name, name_uk, real_name, real_name_uk, image, earth, franchise FROM characters WHERE id = %s",
            [essence["character_id"]]
        )
        essence["character_info"] = char_info

        if char_info:
            earth_val = str(char_info.get("earth") or "").strip()
            if earth_val:
                if earth_val.isdigit():
                    essence["character_earth_info"] = db.get_one("SELECT * FROM earths WHERE id = %s", [int(earth_val)])
                else:
                    essence["character_earth_info"] = db.get_one("SELECT * FROM earths WHERE code = %s OR name = %s OR name_uk = %s", [earth_val, earth_val, earth_val])

    # Пов'язана Земля для Сутності
    if essence.get("earth"):
        essence["earth_info"] = db.get_one(
            "SELECT id, code, name, name_uk, image FROM earths WHERE id = %s", [essence["earth"]]
        )

    # Список альтернативних версій персонажів з essence_characters
    chars = db.get_all(
        """
        SELECT ec.id AS relation_id, ec.essence_type, ec.category,
               ec.display_name, ec.display_name_uk, ec.image AS custom_image,
               ec.display_order,
               ec.description AS relation_description, ec.description_uk AS relation_description_uk,
               ec.character_id, ec.target_essence_slug,
               c.name AS char_name, c.name_uk AS char_name_uk, c.image AS char_image,
               c.earth AS char_earth, c.franchise AS char_franchise,
               es.essence_name AS ess_name, es.essence_name_uk AS ess_name_uk,
               es.image AS ess_image, es.franchise AS ess_franchise
        FROM essence_characters ec
        LEFT JOIN characters c ON ec.character_id = c.id
        LEFT JOIN essences es ON ec.target_essence_slug = es.slug
        WHERE ec.essence_slug = %s
        ORDER BY CASE WHEN ec.display_order = 0 THEN 999999 ELSE ec.display_order END ASC, ec.id ASC
        """,
        [slug],
    )

    for item in chars:
        item["image"] = item.get("custom_image") or item.get("char_image") or item.get("ess_image")
        
        # Прапорець наявності цільового запису в БД
        if item.get("essence_type") == "essence":
            item["target_exists"] = bool(item.get("ess_name"))
        else:
            item["target_exists"] = bool(item.get("character_id") and item.get("char_name"))

        earth_val = str(item.get("char_earth") or "").strip()
        franchise_val = item.get("char_franchise") or item.get("ess_franchise")
        item["franchise"] = franchise_val
        if earth_val:
            item["earth_code"] = earth_val
            if earth_val.isdigit():
                item["earth_info"] = db.get_one("SELECT * FROM earths WHERE id = %s", [int(earth_val)])
            else:
                item["earth_info"] = db.get_one("SELECT * FROM earths WHERE code = %s OR name = %s OR name_uk = %s", [earth_val, earth_val, earth_val])

    essence["characters"] = chars
    return essence


@router.post("")
async def create_essence(data: dict, request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")

    db = get_db()

    essence_name = to_null(data.get("essence_name"))
    if not essence_name:
        raise HTTPException(status_code=400, detail="Назва сутності обов'язкова")

    slug = data.get("slug")
    if not slug:
        slug = slugify(essence_name)

    slug = slug.strip().lower()

    existing = db.get_one("SELECT slug FROM essences WHERE slug = %s", [slug])
    if existing:
        raise HTTPException(status_code=400, detail=f"Сутність із слагом '{slug}' вже існує")

    image = to_null(data.get("image"))
    logo = to_null(data.get("logo"))
    essence_name_uk = to_null(data.get("essence_name_uk"))
    person_name = to_null(data.get("person_name"))
    person_name_uk = to_null(data.get("person_name_uk"))
    essence_slug = to_null(data.get("essence_slug"))
    franchise = to_null(data.get("franchise"))
    description = to_null(data.get("description"))

    character_id = data.get("character_id")
    if character_id == "" or character_id is None:
        character_id = None
    else:
        try:
            character_id = int(character_id)
        except Exception:
            character_id = None

    other_essences = parse_json_field(data.get("other_essences"))
    other_essences_json = json.dumps(other_essences, ensure_ascii=False)

    db.execute(
        """
        INSERT INTO essences (slug, image, logo, essence_name, essence_name_uk, person_name, person_name_uk, essence_slug, franchise, description, character_id, other_essences)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
        """,
        [slug, image, logo, essence_name, essence_name_uk, person_name, person_name_uk, essence_slug, franchise, description, character_id, other_essences_json],
    )

    return {"message": "Сутність успішно створено", "slug": slug}


@router.put("/{slug}")
async def update_essence(slug: str, data: dict, request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")

    db = get_db()
    existing = db.get_one("SELECT slug FROM essences WHERE slug = %s", [slug])
    if not existing:
        raise HTTPException(status_code=404, detail="Сутність не знайдено")

    essence_name = to_null(data.get("essence_name"))
    if not essence_name:
        raise HTTPException(status_code=400, detail="Назва сутності обов'язкова")

    new_slug = to_null(data.get("slug")) or slug
    new_slug = new_slug.strip().lower()

    if new_slug != slug:
        conflict = db.get_one("SELECT slug FROM essences WHERE slug = %s AND slug != %s", [new_slug, slug])
        if conflict:
            raise HTTPException(status_code=400, detail=f"Слаг '{new_slug}' вже використовується іншою сутністю")

    image = to_null(data.get("image"))
    logo = to_null(data.get("logo"))
    essence_name_uk = to_null(data.get("essence_name_uk"))
    person_name = to_null(data.get("person_name"))
    person_name_uk = to_null(data.get("person_name_uk"))
    essence_slug = to_null(data.get("essence_slug"))
    franchise = to_null(data.get("franchise"))
    description = to_null(data.get("description"))

    character_id = data.get("character_id")
    if character_id == "" or character_id is None:
        character_id = None
    else:
        try:
            character_id = int(character_id)
        except Exception:
            character_id = None

    other_essences = parse_json_field(data.get("other_essences"))
    other_essences_json = json.dumps(other_essences, ensure_ascii=False)

    db.execute(
        """
        UPDATE essences
        SET slug = %s, image = %s, logo = %s, essence_name = %s, essence_name_uk = %s, person_name = %s,
            person_name_uk = %s, essence_slug = %s, franchise = %s, description = %s, character_id = %s, other_essences = %s::jsonb
        WHERE slug = %s
        """,
        [new_slug, image, logo, essence_name, essence_name_uk, person_name, person_name_uk, essence_slug, franchise, description, character_id, other_essences_json, slug],
    )

    return {"message": "Сутність успішно оновлено", "slug": new_slug}


@router.delete("/{slug}")
async def delete_essence(slug: str, request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")

    db = get_db()
    existing = db.get_one("SELECT slug FROM essences WHERE slug = %s", [slug])
    if not existing:
        raise HTTPException(status_code=404, detail="Сутність не знайдено")

    db.execute("DELETE FROM essences WHERE slug = %s", [slug])
    return {"message": "Сутність успішно видалено"}


@router.post("/{slug}/characters")
async def add_or_update_essence_character(slug: str, data: dict, request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")

    db = get_db()
    essence = db.get_one("SELECT slug FROM essences WHERE slug = %s", [slug])
    if not essence:
        raise HTTPException(status_code=404, detail="Сутність не знайдено")

    essence_type = data.get("essence_type") or "character"
    category = data.get("category") or "alter"

    character_id = data.get("character_id")
    target_essence_slug = to_null(data.get("target_essence_slug"))

    if character_id == "" or character_id is None:
        character_id = None
    else:
        try:
            character_id = int(character_id)
        except Exception:
            character_id = None

    if essence_type == "essence" and not target_essence_slug:
        raise HTTPException(status_code=400, detail="Для типу 'essence' слаг цільової сутності обов'язковий")
    if essence_type in ("character", "team") and not character_id:
        raise HTTPException(status_code=400, detail="Для персонажа/команди character_id є обов'язковим")

    display_name = to_null(data.get("display_name"))
    display_name_uk = to_null(data.get("display_name_uk"))
    description = to_null(data.get("description"))
    image = to_null(data.get("image"))

    display_order = data.get("display_order")
    try:
        display_order = int(display_order) if display_order is not None and display_order != "" else 0
    except Exception:
        display_order = 0

    existing_rel = None
    if character_id:
        existing_rel = db.get_one(
            "SELECT id FROM essence_characters WHERE essence_slug = %s AND character_id = %s",
            [slug, character_id],
        )
    elif target_essence_slug:
        existing_rel = db.get_one(
            "SELECT id FROM essence_characters WHERE essence_slug = %s AND target_essence_slug = %s",
            [slug, target_essence_slug],
        )

    if existing_rel:
        db.execute(
            """
            UPDATE essence_characters
            SET essence_type = %s, category = %s, display_name = %s, display_name_uk = %s, description = %s,
                character_id = %s, target_essence_slug = %s, image = %s, display_order = %s
            WHERE id = %s
            """,
            [essence_type, category, display_name, display_name_uk, description, character_id, target_essence_slug, image, display_order, existing_rel["id"]],
        )
        return {"message": "Версію оновлено"}
    else:
        db.execute(
            """
            INSERT INTO essence_characters (essence_slug, character_id, target_essence_slug, essence_type, category, display_name, display_name_uk, description, image, display_order)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [slug, character_id, target_essence_slug, essence_type, category, display_name, display_name_uk, description, image, display_order],
        )
        return {"message": "Версію додано"}


@router.put("/{slug}/characters/{relation_id}")
async def update_essence_character_by_id(slug: str, relation_id: int, data: dict, request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")

    db = get_db()
    existing_rel = db.get_one("SELECT id FROM essence_characters WHERE id = %s AND essence_slug = %s", [relation_id, slug])
    if not existing_rel:
        raise HTTPException(status_code=404, detail="Запис версії не знайдено")

    essence_type = data.get("essence_type") or "character"
    category = data.get("category") or "alter"
    character_id = data.get("character_id")
    target_essence_slug = to_null(data.get("target_essence_slug"))

    if character_id == "" or character_id is None:
        character_id = None
    else:
        try:
            character_id = int(character_id)
        except Exception:
            character_id = None

    display_name = to_null(data.get("display_name"))
    display_name_uk = to_null(data.get("display_name_uk"))
    description = to_null(data.get("description"))
    image = to_null(data.get("image"))

    display_order = data.get("display_order")
    try:
        display_order = int(display_order) if display_order is not None and display_order != "" else 0
    except Exception:
        display_order = 0

    db.execute(
        """
        UPDATE essence_characters
        SET essence_type = %s, category = %s, display_name = %s, display_name_uk = %s, description = %s,
            character_id = %s, target_essence_slug = %s, image = %s, display_order = %s
        WHERE id = %s
        """,
        [essence_type, category, display_name, display_name_uk, description, character_id, target_essence_slug, image, display_order, relation_id],
    )
    return {"message": "Запис версії успішно оновлено"}


@router.delete("/{slug}/characters/{relation_id}")
async def remove_essence_character(slug: str, relation_id: int, request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")

    db = get_db()
    db.execute("DELETE FROM essence_characters WHERE id = %s OR (essence_slug = %s AND character_id = %s)", [relation_id, slug, relation_id])
    return {"message": "Версію видалено"}
