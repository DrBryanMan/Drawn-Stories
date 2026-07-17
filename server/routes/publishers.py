from fastapi import APIRouter, Query
from typing import Optional
from ..db import get_db

router = APIRouter(prefix="/api/publishers", tags=["publishers"])

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
        where_parts.append("ULOWER(p.name) LIKE %s")
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

    sql = f"INSERT INTO publishers ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
    db.execute(sql, params)
    
    new_id = db.get_one("SELECT last_insert_rowid() as id")["id"]
    
    return {"message": "Видавництво успішно створено", "id": new_id}