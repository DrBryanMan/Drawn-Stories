from fastapi import APIRouter, Query, HTTPException, Request
from typing import Optional
from ..db import get_db

router = APIRouter(prefix="/api/earths", tags=["earths"])


def to_null(val):
    return None if val == "" else val


@router.get("")
async def get_earths(
    search: Optional[str] = None,
    publisher_id: Optional[int] = None,
    sort: Optional[str] = "name",
    order_dir: Optional[str] = "asc",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    db = get_db()
    where_parts = []
    params = []

    if search:
        where_parts.append("(LOWER(e.name) LIKE %s OR LOWER(e.name_uk) LIKE %s OR LOWER(e.code) LIKE %s)")
        search_pattern = f"%{search.lower()}%"
        params.extend([search_pattern, search_pattern, search_pattern])

    if publisher_id:
        where_parts.append("e.publisher_id = %s")
        params.append(publisher_id)

    where_clause = "WHERE " + " AND ".join(where_parts) if where_parts else ""

    if sort == "code":
        order_clause = f"e.code {order_dir.upper()}"
    elif sort == "recent":
        order_clause = f"e.created_at {order_dir.upper()}, e.id DESC"
    else:
        order_clause = f"e.name {order_dir.upper()}"

    count_sql = f"""
        SELECT COUNT(*) as count
        FROM earths e
        {where_clause}
    """
    total_row = db.get_one(count_sql, params)
    total = total_row["count"] if total_row else 0

    offset = (page - 1) * limit

    rows = db.get_all(
        f"""
        SELECT e.*, p.name AS publisher_name
        FROM earths e
        LEFT JOIN publishers p ON e.publisher_id = p.id
        {where_clause}
        ORDER BY {order_clause}
        LIMIT %s OFFSET %s
        """,
        params + [limit, offset],
    )

    return {"items": rows, "total": total, "page": page, "limit": limit}


@router.get("/{earth_id}")
async def get_earth(earth_id: int):
    db = get_db()
    earth = db.get_one(
        """
        SELECT e.*, p.name AS publisher_name, p.image AS publisher_image
        FROM earths e
        LEFT JOIN publishers p ON e.publisher_id = p.id
        WHERE e.id = %s
        """,
        [earth_id],
    )

    if not earth:
        raise HTTPException(status_code=404, detail="Землю не знайдено")

    # Персонажі цієї Землі (підтримка зберігання як int так і text)
    earth_str = str(earth_id)
    char_count_row = db.get_one(
        """
        SELECT COUNT(*) AS count
        FROM characters
        WHERE earth = %s OR earth = %s
        """,
        [earth_str, str(earth["code"]) if earth.get("code") else earth_str],
    )
    earth["characters_count"] = char_count_row["count"] if char_count_row else 0

    earth["characters"] = db.get_all(
        """
        SELECT id, cv_id, name, name_uk, real_name, image
        FROM characters
        WHERE earth = %s OR earth = %s
        ORDER BY name ASC
        LIMIT 30
        """,
        [earth_str, str(earth["code"]) if earth.get("code") else earth_str],
    )

    return earth


@router.post("")
async def create_earth(data: dict, request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")

    db = get_db()
    name = to_null(data.get("name"))
    if not name:
        raise HTTPException(status_code=400, detail="Назва Землі обов'язкова")

    code = to_null(data.get("code"))
    name_uk = to_null(data.get("name_uk"))
    publisher_id = data.get("publisher_id")
    description = to_null(data.get("description"))
    image = to_null(data.get("image"))

    row = db.get_one(
        """
        INSERT INTO earths (code, name, name_uk, publisher_id, description, image)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        [code, name, name_uk, publisher_id, description, image],
    )

    return {"message": "Землю успішно створено", "id": row["id"]}


@router.put("/{earth_id}")
async def update_earth(earth_id: int, data: dict, request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")

    db = get_db()
    earth = db.get_one("SELECT id FROM earths WHERE id = %s", [earth_id])
    if not earth:
        raise HTTPException(status_code=404, detail="Землю не знайдено")

    name = to_null(data.get("name"))
    if not name:
        raise HTTPException(status_code=400, detail="Назва Землі обов'язкова")

    code = to_null(data.get("code"))
    name_uk = to_null(data.get("name_uk"))
    publisher_id = data.get("publisher_id")
    description = to_null(data.get("description"))
    image = to_null(data.get("image"))

    db.execute(
        """
        UPDATE earths
        SET code = %s, name = %s, name_uk = %s, publisher_id = %s, description = %s, image = %s
        WHERE id = %s
        """,
        [code, name, name_uk, publisher_id, description, image, earth_id],
    )

    return {"message": "Землю успішно оновлено"}


@router.delete("/{earth_id}")
async def delete_earth(earth_id: int, request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")

    db = get_db()
    earth = db.get_one("SELECT id FROM earths WHERE id = %s", [earth_id])
    if not earth:
        raise HTTPException(status_code=404, detail="Землю не знайдено")

    db.execute("DELETE FROM earths WHERE id = %s", [earth_id])
    return {"message": "Землю успішно видалено"}
