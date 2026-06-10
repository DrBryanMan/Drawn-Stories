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
    limit: int = Query(20, ge=1, le=100),
):
    db = get_db()
    where_parts = []
    params = []

    if search:
        where_parts.append("p.name LIKE ?")
        params.append(f"%{search}%")
    
    if ids:
        id_list = [id.strip() for id in ids.split(",") if id.strip().isdigit()]
        if id_list:
            placeholders = ",".join(["?"] * len(id_list))
            where_parts.append(f"p.id IN ({placeholders})")
            params.extend(id_list)

    where_clause = "WHERE " + " AND ".join(where_parts) if where_parts else ""

    # Sort logic
    if sort == "name":
        order_clause = f"p.name {order_dir.upper()}"
    elif sort == "founded":
        order_clause = f"p.founded_at {order_dir.upper()}, p.name ASC"
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
        SELECT p.id, p.cv_id, p.name, p.cv_slug, p.image, p.founded_at, COUNT(v.id) as volume_count
        FROM publishers p
        LEFT JOIN volumes v ON v.publisher = p.id
        {where_clause}
        GROUP BY p.id
        ORDER BY {order_clause}
        LIMIT ? OFFSET ?
        """,
        params + [limit, offset],
    )

    for row in rows:
        row["latest_releases"] = db.get_all(
            """
            SELECT v.id, v.name, v.name_uk, v.cover_img, v.cv_img, v.lang,
                   (SELECT COUNT(*) FROM issues i WHERE i.ds_vol_id = v.id OR (i.ds_vol_id IS NULL AND i.cv_vol_id = v.cv_id)) as issue_count
            FROM volumes v
            WHERE v.publisher = ?
            ORDER BY v.created_at DESC, v.id DESC
            LIMIT 3
            """,
            [row["id"]]
        )

    return { "items": rows, "total": total, "page": page, "limit": limit }
