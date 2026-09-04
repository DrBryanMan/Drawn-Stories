from fastapi import APIRouter, Query, HTTPException, Request
from typing import Optional
from ..db import get_db

router = APIRouter(prefix="/api/publishers", tags=["publishers"])

def require_moderator(request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")

def require_admin(request: Request):
    role = request.cookies.get("role")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Потрібні права адміністратора")

@router.delete("/{publisher_id}")
async def delete_publisher(publisher_id: int, request: Request):
    require_admin(request)
    db = get_db()
    pub = db.get_one("SELECT id FROM publishers WHERE id = %s", [publisher_id])
    if not pub:
        raise HTTPException(status_code=404, detail="Видавництво не знайдено")
    db.execute("UPDATE volumes SET publisher = NULL WHERE publisher = %s", [publisher_id])
    db.execute("DELETE FROM publishers WHERE id = %s", [publisher_id])
    return {"message": "Видавництво успішно видалено з БД"}

@router.get("/{publisher_id}")
async def get_publisher(publisher_id: int):
    db = get_db()

    pub = db.get_one(
        """
        SELECT p.id, p.cv_id, p.name, p.cv_slug, p.image,
               p.founded_date, p.status, p.work_type,
               p.website, p.aliases, p.address, p.place, p.country,
               p.created_at,
               (SELECT COUNT(*) FROM volumes v WHERE v.publisher = p.id) AS volume_count
        FROM publishers p
        WHERE p.id = %s
        """,
        [publisher_id]
    )

    if not pub:
        raise HTTPException(status_code=404, detail="Видавництво не знайдено")

    # 1. Latest Volumes
    pub["latest_volumes"] = db.get_all(
        """
        SELECT v.id, v.name, v.name_uk, v.cover_img, v.image, v.lang,
               (SELECT COUNT(*) FROM issues i WHERE i.volume_id = v.id) AS issue_count
        FROM volumes v
        WHERE v.publisher = %s
        ORDER BY v.created_at DESC, v.id DESC
        LIMIT 5
        """,
        [publisher_id]
    )

    # 2. Latest Issues
    pub["latest_issues"] = db.get_all(
        """
        SELECT i.id, i.name, i.image, i.issue_number, i.release_date, i.cover_date,
               v.id as volume_id, v.name_uk as volume_name_uk, v.name as volume_name
        FROM issues i
        JOIN volumes v ON i.volume_id = v.id
        WHERE v.publisher = %s
        ORDER BY i.created_at DESC, i.id DESC
        LIMIT 5
        """,
        [publisher_id]
    )

    # 3. Latest Collections
    pub["latest_collections"] = db.get_all(
        """
        SELECT c.id, c.name, c.image, c.issue_number, c.release_date,
               v.id as volume_id, v.name_uk as volume_name_uk, v.name as volume_name
        FROM collections c
        LEFT JOIN volumes v ON c.volume_id = v.id
        WHERE c.publisher = %s OR (c.publisher IS NULL AND v.publisher = %s)
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT 5
        """,
        [publisher_id, publisher_id]
    )

    return pub

@router.put("/{publisher_id}")
async def update_publisher(publisher_id: int, data: dict, request: Request):
    require_moderator(request)
    db = get_db()

    # Check if publisher exists
    pub = db.get_one("SELECT id FROM publishers WHERE id = %s", [publisher_id])
    if not pub:
        raise HTTPException(status_code=404, detail="Видавництво не знайдено")

    def to_null(val):
        return None if val == "" else val

    name = to_null(data.get("name"))
    if not name:
        raise HTTPException(status_code=400, detail="Назва видавництва обов'язкова")

    db.execute(
        """
        UPDATE publishers
        SET name = %s,
            cv_id = %s,
            cv_slug = %s,
            image = %s,
            founded_date = %s,
            website = %s,
            aliases = %s,
            address = %s,
            place = %s,
            country = %s,
            status = %s,
            work_type = %s
        WHERE id = %s
        """,
        [
            name,
            to_null(data.get("cv_id")),
            to_null(data.get("cv_slug")),
            to_null(data.get("image")),
            to_null(data.get("founded_date")),
            to_null(data.get("website")),
            to_null(data.get("aliases")),
            to_null(data.get("address")),
            to_null(data.get("place")),
            to_null(data.get("country")),
            to_null(data.get("status")),
            to_null(data.get("work_type")),
            publisher_id,
        ],
    )

    return {"message": "Видавництво успішно оновлено"}


@router.get("")
async def get_publishers(
    search: Optional[str] = None,
    ids: Optional[str] = None,
    sort: Optional[str] = "volumes",
    order_dir: Optional[str] = "desc",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=10000),
):
    db = get_db()
    where_parts = []
    params = []

    if search:
        where_parts.append("LOWER(p.name) LIKE %s")
        params.append(f"%{search.lower()}%")
    
    if ids:
        id_list = [id.strip() for id in ids.split(",") if id.strip().isdigit()]
        if id_list:
            placeholders = ",".join(["%s"] * len(id_list))
            where_parts.append(f"p.id IN ({placeholders})")
            params.extend(id_list)

    where_clause = "WHERE " + " AND ".join(where_parts) if where_parts else ""

    # Sort logic
    if sort == "name":
        order_clause = f"p.name {order_dir.upper()}"
    elif sort == "founded":
        order_clause = f"p.founded_date {order_dir.upper()}, p.name ASC"
    elif sort == "date_added":
        order_clause = f"p.created_at {order_dir.upper()}, p.name ASC"
    else:
        # Default to volume_count
        order_clause = f"volume_count {order_dir.upper()}, p.name ASC"

    # Get total count
    count_sql = f"""
        SELECT COUNT(DISTINCT p.id) as count
        FROM publishers p
        {where_clause}
    """
    total_row = db.get_one(count_sql, params)
    total = total_row["count"] if total_row else 0

    offset = (page - 1) * limit

    rows = db.get_all(
        f"""
        SELECT p.id, p.cv_id, p.name, p.cv_slug, p.image, p.founded_date, p.status, p.work_type,
               (SELECT COUNT(*) FROM volumes v WHERE v.publisher = p.id) as volume_count
        FROM publishers p
        {where_clause}
        ORDER BY {order_clause}
        LIMIT %s OFFSET %s
        """,
        params + [limit, offset],
    )

    # Skip heavy details for high-limit requests (fuzzy search loading)
    if limit <= 100:
        for row in rows:
            row["latest_releases"] = db.get_all(
                """
                SELECT v.id, v.name, v.name_uk, v.cover_img, v.image, v.lang,
                       (SELECT COUNT(*) FROM issues i WHERE i.volume_id = v.id) as issue_count
                FROM volumes v
                WHERE v.publisher = %s
                ORDER BY v.created_at DESC, v.id DESC
                LIMIT 3
                """,
                [row["id"]]
            )
    else:
        for row in rows:
            row["latest_releases"] = []

    return { "items": rows, "total": total, "page": page, "limit": limit }

@router.post("")
async def create_publisher(data: dict):
    db = get_db()
    
    if not data.get("name"):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Назва видавництва обов'язкова")

    columns = []
    placeholders = []
    params = []
    
    allowed_fields = [
        "name", "cv_id", "cv_slug", "image", "founded_date", 
        "website", "aliases", "address", "place", "country",
        "status", "work_type"
    ]
    
    for key, value in data.items():
        if key in allowed_fields and value is not None:
            columns.append(key)
            placeholders.append("%s")
            params.append(value)
            
    if not columns:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Немає даних для збереження")

    sql = f"INSERT INTO publishers ({', '.join(columns)}) VALUES ({', '.join(placeholders)}) RETURNING id"
    row = db.get_one(sql, params)
    new_id = row["id"] if row else None
    
    return {"message": "Видавництво успішно створено", "id": new_id}
