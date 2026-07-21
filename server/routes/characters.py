from fastapi import APIRouter, Query, HTTPException, Request
from typing import Optional
from ..db import get_db

router = APIRouter(prefix="/api/characters", tags=["characters"])

@router.get("")
async def get_characters(
    search: Optional[str] = None,
    earth: Optional[str] = None,
    franchise: Optional[str] = None,
    sort: Optional[str] = "issues",
    order_dir: Optional[str] = "desc",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    db = get_db()
    where_parts = []
    params = []

    if search:
        s_pat = f"%{search.lower().strip()}%"
        where_parts.append("""(
            LOWER(COALESCE(c.name, '')) LIKE %s OR
            LOWER(COALESCE(c.name_uk, '')) LIKE %s OR
            LOWER(COALESCE(c.real_name, '')) LIKE %s OR
            LOWER(COALESCE(c.real_name_uk, '')) LIKE %s OR
            LOWER(COALESCE(c.name_native, '')) LIKE %s OR
            LOWER(COALESCE(c.franchise, '')) LIKE %s OR
            LOWER(COALESCE(c.earth, '')) LIKE %s OR
            LOWER(COALESCE(c.aliases::text, '')) LIKE %s
        )""")
        params.extend([s_pat] * 8)

    if earth:
        e_pat = f"%{earth.lower().strip()}%"
        where_parts.append("LOWER(COALESCE(c.earth, '')) LIKE %s")
        params.append(e_pat)

    if franchise:
        f_pat = f"%{franchise.lower().strip()}%"
        where_parts.append("LOWER(COALESCE(c.franchise, '')) LIKE %s")
        params.append(f_pat)

    where_clause = "WHERE " + " AND ".join(where_parts) if where_parts else ""

    # Sort logic
    if sort == "name":
        order_clause = f"c.name {order_dir.upper()}"
    elif sort == "recent":
        order_clause = f"c.created_at {order_dir.upper()}, c.name ASC"
    else:
        # Default to issue appearances
        order_clause = f"issue_count {order_dir.upper()}, c.name ASC"

    count_sql = f"""
        SELECT COUNT(DISTINCT c.id) as count
        FROM characters c
        {where_clause}
    """
    total_row = db.get_one(count_sql, params)
    total = total_row["count"] if total_row else 0

    offset = (page - 1) * limit

    rows = db.get_all(
        f"""
        SELECT c.id, c.cv_id, c.name, c.name_uk, c.name_ro, c.real_name, c.real_name_uk, c.name_native,
               c.earth, c.franchise, c.essence, c.aliases, c.cv_slug, c.image, c.gender,
               (SELECT COUNT(*) FROM issue_characters ic WHERE ic.character_id = c.id) as issue_count
        FROM characters c
        {where_clause}
        ORDER BY {order_clause}
        LIMIT %s OFFSET %s
        """,
        params + [limit, offset],
    )

    return { "items": rows, "total": total, "page": page, "limit": limit }


@router.get("/{character_id}")
async def get_character(character_id: int):
    db = get_db()
    char = db.get_one(
        """
        SELECT c.*,
               (SELECT COUNT(DISTINCT ic.issue_id) FROM issue_characters ic WHERE ic.character_id = c.id) as issue_count,
               (SELECT COUNT(DISTINCT i.volume_id) FROM issue_characters ic JOIN issues i ON ic.issue_id = i.id WHERE ic.character_id = c.id) as volume_count
        FROM characters c
        WHERE c.id = %s
        """,
        [character_id]
    )

    if not char:
        raise HTTPException(status_code=404, detail="Персонажа не знайдено")

    # Publisher info
    if char.get("publisher"):
        char["publisher_info"] = db.get_one(
            "SELECT id, name, image FROM publishers WHERE id = %s", [char["publisher"]]
        )

    # First appearance issue info
    if char.get("first_appearance"):
        char["first_appearance_info"] = db.get_one(
            """
            SELECT i.id, i.name, i.issue_number, i.image, i.release_date, i.cover_date,
                   v.id AS volume_id, v.name_uk AS volume_name_uk, v.name AS volume_name
            FROM issues i
            JOIN volumes v ON i.volume_id = v.id
            WHERE i.id = %s
            """,
            [char["first_appearance"]]
        )

    # Volumes where character appears
    char["volumes"] = db.get_all(
        """
        SELECT v.id, v.name, v.name_uk, v.cover_img, v.image, v.lang,
               (SELECT COUNT(*) FROM issues i2 WHERE i2.volume_id = v.id) AS issue_count,
               (SELECT COUNT(*) FROM issue_characters ic2 JOIN issues i3 ON ic2.issue_id = i3.id WHERE ic2.character_id = %s AND i3.volume_id = v.id) AS char_issue_count
        FROM volumes v
        WHERE v.id IN (
            SELECT volume_id FROM volume_characters WHERE character_id = %s
            UNION
            SELECT i.volume_id FROM issue_characters ic JOIN issues i ON ic.issue_id = i.id WHERE ic.character_id = %s
        )
        ORDER BY char_issue_count DESC, v.name_uk ASC, v.name ASC
        LIMIT 40
        """,
        [character_id, character_id, character_id]
    )

    # Issues where character appears
    char["issues"] = db.get_all(
        """
        SELECT i.id, i.name, i.issue_number, i.image, i.release_date, i.cover_date, ic.role, ic.story_num, ic.comment, ic.persona_idx,
               v.id as volume_id, v.name_uk as volume_name_uk, v.name as volume_name
        FROM issue_characters ic
        JOIN issues i ON ic.issue_id = i.id
        JOIN volumes v ON i.volume_id = v.id
        WHERE ic.character_id = %s
        ORDER BY i.created_at DESC, i.id DESC
        LIMIT 60
        """,
        [character_id]
    )

    # Manga chapters where character appears
    char["manga_chapters"] = db.get_all(
        """
        SELECT mc.id, mc.chapter_number, mc.name AS title, mcc.role,
               v.id AS volume_id, v.name_uk AS volume_name_uk, v.name AS volume_name
        FROM manga_chapter_characters mcc
        JOIN manga_chapters mc ON mcc.chapter_id = mc.id
        LEFT JOIN volumes v ON mc.volume_id = v.id
        WHERE mcc.character_id = %s
        ORDER BY mc.chapter_number ASC
        LIMIT 50
        """,
        [character_id]
    )

    # Teams associated with character
    char["teams"] = db.get_all(
        """
        SELECT DISTINCT t.id, t.name, t.name_uk, t.cv_slug
        FROM teams t
        WHERE t.id IN (
            SELECT team_id FROM issue_characters WHERE character_id = %s AND team_id IS NOT NULL
        )
        """,
        [character_id]
    )
    # Ensure personas is parsed list and hydrate issue details for first_appearance
    raw_personas = char.get("personas")
    if isinstance(raw_personas, str):
        try:
            personas_list = json.loads(raw_personas)
        except Exception:
            personas_list = []
    elif isinstance(raw_personas, list):
        personas_list = raw_personas
    else:
        personas_list = []

    for p in personas_list:
        if isinstance(p, dict) and p.get("issue_id"):
            try:
                iss_id = int(p["issue_id"])
                iss = db.get_one(
                    """
                    SELECT i.id, i.issue_number, i.name, i.image, v.name as volume_name, v.name_uk as volume_name_uk
                    FROM issues i
                    JOIN volumes v ON i.volume_id = v.id
                    WHERE i.id = %s
                    """,
                    [iss_id]
                )
                if iss:
                    vol_title = iss.get("volume_name_uk") or iss.get("volume_name") or ""
                    num_str = f"#{iss['issue_number']}" if iss.get("issue_number") else ""
                    title = f"{vol_title} {num_str}".strip()
                    if title:
                        p["first_appearance"] = title
                    p["issue_info"] = iss
            except Exception:
                pass

    char["personas"] = personas_list

    # Hydrate aliases (JSONB) with issue_info
    raw_aliases = char.get("aliases")
    if isinstance(raw_aliases, str):
        try:
            aliases_list = json.loads(raw_aliases)
        except Exception:
            aliases_list = []
    elif isinstance(raw_aliases, list):
        aliases_list = raw_aliases
    else:
        aliases_list = []

    for a in aliases_list:
        if isinstance(a, dict) and a.get("issue_id"):
            try:
                iss_id = int(a["issue_id"])
                iss = db.get_one(
                    """
                    SELECT i.id, i.issue_number, i.name, i.image, v.name as volume_name, v.name_uk as volume_name_uk
                    FROM issues i
                    JOIN volumes v ON i.volume_id = v.id
                    WHERE i.id = %s
                    """,
                    [iss_id]
                )
                if iss:
                    a["issue_info"] = iss
            except Exception:
                pass

    char["aliases"] = aliases_list

    # Earth info
    if char.get("earth"):
        earth_val = str(char["earth"])
        if earth_val.isdigit():
            char["earth_info"] = db.get_one("SELECT * FROM earths WHERE id = %s", [int(earth_val)])
        else:
            char["earth_info"] = db.get_one("SELECT * FROM earths WHERE code = %s OR name = %s OR name_uk = %s", [earth_val, earth_val, earth_val])

    # Essence info
    if char.get("essence"):
        char["essence_info"] = db.get_one("SELECT * FROM essences WHERE slug = %s", [char["essence"]])

    return char


import json

@router.put("/{character_id}")
async def update_character(character_id: int, data: dict, request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")
    
    db = get_db()
    char = db.get_one("SELECT id FROM characters WHERE id = %s", [character_id])
    if not char:
        raise HTTPException(status_code=404, detail="Персонажа не знайдено")
        
    def to_null(val):
        return None if val == "" else val

    name = to_null(data.get("name"))
    name_uk = to_null(data.get("name_uk"))
    name_ro = to_null(data.get("name_ro"))
    real_name = to_null(data.get("real_name"))
    real_name_uk = to_null(data.get("real_name_uk"))
    creators = to_null(data.get("creators"))
    franchise = to_null(data.get("franchise"))
    earth = to_null(data.get("earth"))
    essence = to_null(data.get("essence"))
    image = to_null(data.get("image"))
    portret_img = to_null(data.get("portret_img"))
    costume_img = to_null(data.get("costume_img"))
    portret_costume_img = to_null(data.get("portret_costume_img"))
    
    personas_raw = data.get("personas")
    if isinstance(personas_raw, str):
        try:
            personas = json.loads(personas_raw)
        except Exception:
            personas = []
    elif isinstance(personas_raw, list):
        personas = personas_raw
    else:
        personas = []

    personas_json = json.dumps(personas, ensure_ascii=False)

    aliases_raw = data.get("aliases")
    if isinstance(aliases_raw, str):
        try:
            aliases = json.loads(aliases_raw)
        except Exception:
            aliases = []
    elif isinstance(aliases_raw, list):
        aliases = aliases_raw
    else:
        aliases = []

    aliases_json = json.dumps(aliases, ensure_ascii=False)

    if not name:
        raise HTTPException(status_code=400, detail="Оригінальне ім'я обов'язкове")
        
    db.execute(
        """
        UPDATE characters
        SET name = %s, name_uk = %s, name_ro = %s, real_name = %s, real_name_uk = %s, creators = %s, 
            franchise = %s, earth = %s, essence = %s, image = %s, portret_img = %s, costume_img = %s, portret_costume_img = %s,
            personas = %s::jsonb, aliases = %s::jsonb, date_last_updated = NOW()
        WHERE id = %s
        """,
        [name, name_uk, name_ro, real_name, real_name_uk, creators, franchise, earth, essence, image, portret_img, costume_img, portret_costume_img, personas_json, aliases_json, character_id]
    )
    return {"message": "Персонаж успішно оновлений"}


@router.delete("/{character_id}")
async def delete_character(character_id: int, request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")
    
    db = get_db()
    char = db.get_one("SELECT id FROM characters WHERE id = %s", [character_id])
    if not char:
        raise HTTPException(status_code=404, detail="Персонажа не знайдено")
        
    # Видаляємо зв'язки з випусками та томами
    db.execute("DELETE FROM issue_characters WHERE character_id = %s", [character_id])
    db.execute("DELETE FROM volume_characters WHERE character_id = %s", [character_id])
    # Видаляємо самого персонажа
    db.execute("DELETE FROM characters WHERE id = %s", [character_id])
    return {"message": "Персонаж успішно видалений"}


@router.post("")
async def create_character(data: dict, request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")
    
    db = get_db()
    
    def to_null(val):
        return None if val == "" else val

    name = to_null(data.get("name"))
    if not name:
        raise HTTPException(status_code=400, detail="Оригінальне ім'я обов'язкове")

    name_uk = to_null(data.get("name_uk"))
    name_ro = to_null(data.get("name_ro"))
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
        INSERT INTO characters (name, name_uk, name_ro, real_name, real_name_uk, publisher, creators,
                                franchise, earth, essence, gender, image, portret_img, costume_img, portret_costume_img,
                                personas, aliases, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, NOW())
        RETURNING id
        """,
        [name, name_uk, name_ro, real_name, real_name_uk, publisher, creators, franchise, earth, essence, gender, image, portret_img, costume_img, portret_costume_img, personas_json, aliases_json]
    )

    return {"message": "Персонаж успішно створений", "id": row["id"]}
