from fastapi import APIRouter, Query
from typing import Optional
from ..db import get_db

router = APIRouter(prefix="/api/themes", tags=["themes"])

@router.get("")
async def get_themes(
    search: Optional[str] = None,
    ids: Optional[str] = None,
    limit: int = Query(60, ge=1, le=100),
):
    db = get_db()
    where_parts = []
    params = []

    if search:
        where_parts.append("(t.name LIKE ? OR t.ua_name LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])

    if ids:
        id_list = [id.strip() for id in ids.split(",") if id.strip().isdigit()]
        if id_list:
            placeholders = ",".join(["?"] * len(id_list))
            where_parts.append(f"t.id IN ({placeholders})")
            params.extend(id_list)

    where_clause = "WHERE " + " AND ".join(where_parts) if where_parts else ""

    rows = db.get_all(
        f"""
        SELECT t.id, t.cv_id, t.name, t.ua_name, COALESCE(t.type, 'theme') as type, COUNT(vt.id) as volume_count
        FROM themes t
        LEFT JOIN volume_themes vt ON vt.theme_id = t.id
        {where_clause}
        GROUP BY t.id
        ORDER BY
          CASE COALESCE(t.type, 'theme')
            WHEN 'type' THEN 0
            WHEN 'genre' THEN 1
            ELSE 2
          END,
          volume_count DESC,
          COALESCE(t.ua_name, t.name) ASC
        LIMIT ?
        """,
        params + [limit],
    )

    return { "items": rows }
