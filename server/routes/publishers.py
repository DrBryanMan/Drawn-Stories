from fastapi import APIRouter, Query
from typing import Optional
from ..db import get_db

router = APIRouter(prefix="/api/publishers", tags=["publishers"])

@router.get("")
async def get_publishers(
    search: Optional[str] = None,
    ids: Optional[str] = None,
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

    rows = db.get_all(
        f"""
        SELECT p.id, p.cv_id, p.name, p.cv_slug, COUNT(v.id) as volume_count
        FROM publishers p
        LEFT JOIN volumes v ON v.publisher = p.id
        {where_clause}
        GROUP BY p.id
        ORDER BY volume_count DESC, p.name ASC
        LIMIT ?
        """,
        params + [limit],
    )

    return { "items": rows }
