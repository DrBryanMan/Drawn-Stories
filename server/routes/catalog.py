from fastapi import APIRouter, Query
from typing import Optional
from ..db import get_db
from ..utils import parse_id_list
import time

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

DEFAULT_CATALOG_SORT = "recent"
DEFAULT_CATALOG_ORDER_DIR = "desc"
CATALOG_SORT_COLUMNS = {
    "name": "v.name",
    "recent": "v.created_at",
    "date": "v.start_year",
}

@router.get("")
async def get_catalog(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[str] = None, # Next cursor (e.g. "2023-01-01 12:00:00,456")
    search: Optional[str] = None,
    sort: str = Query(DEFAULT_CATALOG_SORT, pattern="^(name|recent|date)$"),
    order_dir: str = Query(DEFAULT_CATALOG_ORDER_DIR, pattern="^(asc|desc)$"),
    content_type: Optional[str] = Query(None, pattern="^(comics|manga)$"),
    view_type: str = Query("series", pattern="^(series|issues)$"),
    collection: bool = False,
    publisher_ids: Optional[str] = None,
    theme_ids: Optional[str] = None,
    exclude_theme_ids: Optional[str] = None,
):
    db = get_db()
    manga_theme_id = 36
    
    # We maintain separate lists for filter clauses and their parameters
    filter_clauses = []
    filter_params = []

    # Subqueries for high-performance ID set filtering
    manga_id_sql = f"""
        SELECT volume_id FROM volume_themes WHERE theme_id = {manga_theme_id} AND volume_id IS NOT NULL
        UNION
        SELECT v2.id FROM volumes v2 JOIN volume_themes vt2 ON vt2.cv_vol_id = v2.cv_id 
        WHERE vt2.theme_id = {manga_theme_id} AND v2.cv_id IS NOT NULL
    """
    
    collected_vol_id_sql = """
        SELECT volume_id FROM collections WHERE volume_id IS NOT NULL
        UNION
        SELECT v3.id FROM volumes v3 JOIN collections c3 ON c3.cv_vol_id = v3.cv_id 
        WHERE v3.cv_id IS NOT NULL
    """

    if view_type == "series":
        base = "FROM volumes v LEFT JOIN publishers p ON v.publisher = p.id"
        select_fields = "v.*, p.name as publisher_name, 'volume' as type"
        primary_sort = CATALOG_SORT_COLUMNS.get(sort, "v.created_at")
        unique_key = "v.id"
        
        if content_type == "manga":
            filter_clauses.append(f"v.id IN ({manga_id_sql})")
        elif content_type == "comics":
            filter_clauses.append(f"v.id NOT IN ({manga_id_sql})")

        if collection:
            filter_clauses.append(f"v.id IN ({collected_vol_id_sql})")

        if search:
            filter_clauses.append("v.name LIKE ?")
            filter_params.append(f"%{search}%")

    else:
        if not collection:
            base = """
                FROM issues i
                JOIN volumes v ON (i.ds_vol_id = v.id) OR (i.ds_vol_id IS NULL AND i.cv_vol_id = v.cv_id)
                LEFT JOIN publishers p ON v.publisher = p.id
            """
            select_fields = "i.*, v.name as volume_name, v.id as volume_id, p.name as publisher_name, v.lang, 'issue' as type"
            ISSUE_SORT_MAP = {"name": "i.name", "recent": "i.created_at", "date": "COALESCE(i.release_date, i.cover_date)"}
            primary_sort = ISSUE_SORT_MAP.get(sort, "i.created_at")
            unique_key = "i.id"
            if search:
                filter_clauses.append("(i.name LIKE ? OR v.name LIKE ?)")
                filter_params.extend([f"%{search}%", f"%{search}%"])
        else:
            base = """
                FROM collections c
                LEFT JOIN volumes v ON (c.volume_id = v.id) OR (c.volume_id IS NULL AND c.cv_vol_id = v.cv_id)
                LEFT JOIN publishers p ON v.publisher = p.id
            """
            select_fields = "c.*, v.name as volume_name, v.id as volume_id, p.name as publisher_name, v.lang, 'collection' as type"
            COLLECTION_SORT_MAP = {"name": "c.name", "recent": "c.created_at", "date": "COALESCE(c.release_date, c.cover_date)"}
            primary_sort = COLLECTION_SORT_MAP.get(sort, "c.created_at")
            unique_key = "c.id"
            if search:
                filter_clauses.append("(c.name LIKE ? OR v.name LIKE ?)")
                filter_params.extend([f"%{search}%", f"%{search}%"])

        if content_type == "manga":
            filter_clauses.append(f"v.id IN ({manga_id_sql})")
        elif content_type == "comics":
            filter_clauses.append(f"v.id NOT IN ({manga_id_sql})")

    # Common Filters (Publishers, Themes)
    publisher_filter_ids = parse_id_list(publisher_ids)
    if publisher_filter_ids:
        placeholders = ",".join("?" for _ in publisher_filter_ids)
        filter_clauses.append(f"v.publisher IN ({placeholders})")
        filter_params.extend(publisher_filter_ids)

    for theme_id in parse_id_list(theme_ids):
        filter_clauses.append("EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.theme_id = ? AND vt.volume_id = v.id)")
        filter_params.append(theme_id)

    for theme_id in parse_id_list(exclude_theme_ids):
        filter_clauses.append("NOT EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.theme_id = ? AND vt.volume_id = v.id)")
        filter_params.append(theme_id)

    # 1. Total count uses ONLY filters
    total_where = f" WHERE {' AND '.join(filter_clauses)}" if filter_clauses else ""
    total = db.get_one(f"SELECT COUNT(*) as count {base}{total_where}", filter_params)["count"]

    # 2. Items query uses filters + optional cursor
    items_clauses = list(filter_clauses)
    items_params = list(filter_params)

    if cursor and not search:
        try:
            cursor_val, cursor_id = cursor.split(',')
            op = ">" if order_dir == "asc" else "<"
            items_clauses.append(f"({primary_sort}, {unique_key}) {op} (?, ?)")
            items_params.extend([cursor_val, int(cursor_id)])
        except: pass

    items_where = f" WHERE {' AND '.join(items_clauses)}" if items_clauses else ""
    order_clause = f" ORDER BY {primary_sort} {order_dir.upper()}, {unique_key} {order_dir.upper()}"

    items = db.get_all(f"SELECT {select_fields} {base}{items_where}{order_clause} LIMIT ?", items_params + [limit + 1])
    
    has_next = len(items) > limit
    if has_next:
        items = items[:limit]
        last_item = items[-1]
        # Generate next cursor
        sort_val = last_item.get('created_at') or last_item.get('start_year') or last_item.get('release_date') or ''
        next_cursor = f"{sort_val},{last_item['id']}"
    else:
        next_cursor = None

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "next_cursor": next_cursor,
        "pages": (total + limit - 1) // limit,
    }
