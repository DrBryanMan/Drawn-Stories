from fastapi import APIRouter, Query
from typing import Optional
from ..db import get_db

router = APIRouter(prefix="/api/characters", tags=["characters"])

@router.get("")
async def get_characters(
    search: Optional[str] = None,
    sort: Optional[str] = "issues",
    order_dir: Optional[str] = "desc",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    db = get_db()
    where_parts = []
    params = []

    if search:
        where_parts.append("ULOWER(c.name) LIKE ?")
        params.append(f"%{search.lower()}%")

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
        SELECT c.id, c.cv_id, c.name, c.real_name, c.cv_slug, c.image, c.gender,
               (SELECT COUNT(*) FROM issue_characters ic WHERE ic.character_id = c.id) as issue_count
        FROM characters c
        {where_clause}
        ORDER BY {order_clause}
        LIMIT ? OFFSET ?
        """,
        params + [limit, offset],
    )

    return { "items": rows, "total": total, "page": page, "limit": limit }
