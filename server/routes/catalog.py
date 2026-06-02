from fastapi import APIRouter, Query
from typing import Optional
from ..db import get_db
from ..utils import parse_id_list

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

DEFAULT_CATALOG_SORT = "recent"
DEFAULT_CATALOG_ORDER_DIR = "desc"
CATALOG_SORT_COLUMNS = {
    "name": "v.name",
    "recent": "v.created_at",
    "date": "v.start_year",
    "date_release": "v.start_year",
}

@router.get("")
async def get_catalog(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    sort: str = Query(DEFAULT_CATALOG_SORT, pattern="^(name|recent|date|date_release)$"),
    order_dir: str = Query(DEFAULT_CATALOG_ORDER_DIR, pattern="^(asc|desc)$"),
    content_type: str = Query("comics", pattern="^(comics|manga)$"),
    collection: bool = False,
    publisher_ids: Optional[str] = None,
    theme_ids: Optional[str] = None,
    exclude_theme_ids: Optional[str] = None,
):
    offset = (page - 1) * limit
    db = get_db()

    theme_cte = """
    WITH manga_volumes AS (
      SELECT volume_id
      FROM volume_themes
      WHERE theme_id = 36
        AND volume_id IS NOT NULL
      UNION
      SELECT v.id
      FROM volume_themes vt
      JOIN volumes v ON v.cv_id = vt.cv_vol_id
      WHERE vt.theme_id = 36
        AND vt.cv_vol_id IS NOT NULL
    ),
    collection_volumes AS (
      SELECT volume_id
      FROM volume_themes
      WHERE theme_id = 44
        AND volume_id IS NOT NULL
      UNION
      SELECT v.id
      FROM volume_themes vt
      JOIN volumes v ON v.cv_id = vt.cv_vol_id
      WHERE vt.theme_id = 44
        AND vt.cv_vol_id IS NOT NULL
    )
    """
    base = """
    FROM volumes v
    LEFT JOIN publishers p ON v.publisher = p.id
    LEFT JOIN manga_volumes mv ON mv.volume_id = v.id
    LEFT JOIN collection_volumes cv ON cv.volume_id = v.id
    """
    where_clauses = []
    params = []

    if search:
        where_clauses.append("v.name LIKE ?")
        params.append(f"%{search}%")

    publisher_filter_ids = parse_id_list(publisher_ids)
    if publisher_filter_ids:
        placeholders = ",".join("?" for _ in publisher_filter_ids)
        where_clauses.append(f"v.publisher IN ({placeholders})")
        params.extend(publisher_filter_ids)

    for theme_id in parse_id_list(theme_ids):
        where_clauses.append("""
        EXISTS (
          SELECT 1
          FROM volume_themes vt
          WHERE vt.theme_id = ?
            AND vt.volume_id = v.id
        )
        """)
        params.append(theme_id)

    for theme_id in parse_id_list(exclude_theme_ids):
        where_clauses.append("""
        NOT EXISTS (
          SELECT 1
          FROM volume_themes vt
          WHERE vt.theme_id = ?
            AND vt.volume_id = v.id
        )
        """)
        params.append(theme_id)

    if content_type == "manga":
        where_clauses.append("mv.volume_id IS NOT NULL")
    else:
        where_clauses.append("mv.volume_id IS NULL")

    if collection:
        where_clauses.append("cv.volume_id IS NOT NULL")

    where_clause = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    sort_column = CATALOG_SORT_COLUMNS.get(sort, CATALOG_SORT_COLUMNS[DEFAULT_CATALOG_SORT])
    order_clause = f" ORDER BY {sort_column} {order_dir.upper()}"

    volumes = db.get_all(f"{theme_cte} SELECT v.*, p.name as publisher_name {base}{where_clause}{order_clause} LIMIT ? OFFSET ?", params + [limit, offset])
    total = db.get_one(f"{theme_cte} SELECT COUNT(*) as count {base}{where_clause}", params)["count"]

    return {
        "items": volumes,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }
