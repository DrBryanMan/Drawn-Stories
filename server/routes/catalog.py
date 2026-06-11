from fastapi import APIRouter, Query
from typing import Optional, List
from pydantic import BaseModel
from ..db import get_db
from ..utils import parse_id_list
import time

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

class BookmarkItem(BaseModel):
    id: int
    type: str

@router.post("/bookmarks")
async def get_bookmarks_data(items: List[BookmarkItem]):
    db = get_db()
    results = {
        "volume": [],
        "issue": [],
        "personnel": [],
        "character": []
    }
    
    # Group by type for efficient querying
    grouped = {}
    for item in items:
        t = item.type
        if t == "person": t = "personnel" # Normalize
        if t not in grouped:
            grouped[t] = []
        grouped[t].append(item.id)
        
    for item_type, ids in grouped.items():
        if not ids:
            continue
            
        placeholders = ",".join("?" for _ in ids)
        
        if item_type == "volume":
            data = db.get_all(f"""
                SELECT v.*, p.name as publisher_name, 'volume' as type,
                       (SELECT COUNT(*) FROM issues i WHERE i.ds_vol_id = v.id OR (i.ds_vol_id IS NULL AND i.cv_vol_id = v.cv_id)) as issue_count
                FROM volumes v
                LEFT JOIN publishers p ON v.publisher = p.id
                WHERE v.id IN ({placeholders})
            """, ids)
            results["volume"] = data
        elif item_type == "issue":
            data = db.get_all(f"""
                SELECT i.*, v.name as volume_name, v.id as volume_id, 'issue' as type
                FROM issues i
                LEFT JOIN volumes v ON (i.ds_vol_id = v.id) OR (i.ds_vol_id IS NULL AND i.cv_vol_id = v.cv_id)
                WHERE i.id IN ({placeholders})
            """, ids)
            results["issue"] = data
        elif item_type == "personnel":
             data = db.get_all(f"""
                SELECT *, 'personnel' as type FROM personnel WHERE id IN ({placeholders})
            """, ids)
             results["personnel"] = data
        elif item_type == "character":
             data = db.get_all(f"""
                SELECT *, 'character' as type FROM characters WHERE id IN ({placeholders})
            """, ids)
             results["character"] = data
             
    return results

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
    limit: int = Query(20, ge=1, le=10000),
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
    magazine_ids: Optional[str] = None,
    langs: Optional[str] = None,
    sources: Optional[str] = None,
    exclude_sources: Optional[str] = None,
) -> dict:
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
        select_fields = "v.*, p.name as publisher_name, 'volume' as type, (SELECT COUNT(*) FROM issues i WHERE i.ds_vol_id = v.id OR (i.ds_vol_id IS NULL AND i.cv_vol_id = v.cv_id)) as issue_count"
        primary_sort = CATALOG_SORT_COLUMNS.get(sort, "v.created_at")
        unique_key = "v.id"
        
        if content_type == "manga":
            filter_clauses.append(f"v.id IN ({manga_id_sql})")
        elif content_type == "comics":
            filter_clauses.append(f"v.id NOT IN ({manga_id_sql})")

        if collection:
            filter_clauses.append(f"v.id IN ({collected_vol_id_sql})")

        if search:
            words = [w.strip() for w in search.split() if w.strip()]
            if words:
                search_parts = []
                for word in words:
                    part = "(v.name LIKE ? OR v.name_en LIKE ? OR v.name_uk LIKE ? OR v.name_native LIKE ?)"
                    search_parts.append(part)
                    filter_params.extend([f"%{word}%"] * 4)
                filter_clauses.append(f"({' AND '.join(search_parts)})")

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
                words = [w.strip() for w in search.split() if w.strip()]
                if words:
                    search_parts = []
                    for word in words:
                        part = "(i.name LIKE ? OR v.name LIKE ? OR v.name_en LIKE ? OR v.name_uk LIKE ? OR v.name_native LIKE ?)"
                        search_parts.append(part)
                        filter_params.extend([f"%{word}%"] * 5)
                    filter_clauses.append(f"({' AND '.join(search_parts)})")
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
                words = [w.strip() for w in search.split() if w.strip()]
                if words:
                    search_parts = []
                    for word in words:
                        part = "(c.name LIKE ? OR v.name LIKE ? OR v.name_en LIKE ? OR v.name_uk LIKE ? OR v.name_native LIKE ?)"
                        search_parts.append(part)
                        filter_params.extend([f"%{word}%"] * 5)
                    filter_clauses.append(f"({' AND '.join(search_parts)})")

        if content_type == "manga":
            filter_clauses.append(f"v.id IN ({manga_id_sql})")
        elif content_type == "comics":
            filter_clauses.append(f"v.id NOT IN ({manga_id_sql})")

    # Common Filters (Publishers, Themes, Magazines, Languages, Sources)
    source_map = {
        "hikka": "v.hikka_slug IS NOT NULL",
        "mal": "v.mal_id IS NOT NULL",
        "cv": "v.cv_id IS NOT NULL"
    }

    if sources:
        # Use OR for multiple inclusion sources (any of the selected)
        clauses = [source_map[s] for s in sources.split(',') if s in source_map]
        if clauses:
            filter_clauses.append(f"({' OR '.join(clauses)})")
    
    if exclude_sources:
        # Use AND for multiple exclusion sources (none of the selected)
        for s in exclude_sources.split(','):
            if s in source_map:
                filter_clauses.append(source_map[s].replace("IS NOT NULL", "IS NULL"))

    publisher_filter_ids = parse_id_list(publisher_ids)
    if publisher_filter_ids:
        placeholders = ",".join("?" for _ in publisher_filter_ids)
        filter_clauses.append(f"v.publisher IN ({placeholders})")
        filter_params.extend(publisher_filter_ids)

    magazine_filter_ids = parse_id_list(magazine_ids)
    if magazine_filter_ids:
        placeholders = ",".join("?" for _ in magazine_filter_ids)
        filter_clauses.append(f"v.id IN (SELECT child_id FROM volume_magazines WHERE magazine_id IN ({placeholders}))")
        filter_params.extend(magazine_filter_ids)

    if langs:
        lang_list = langs.split(',')
        placeholders = ",".join("?" for _ in lang_list)
        filter_clauses.append(f"v.lang IN ({placeholders})")
        filter_params.extend(lang_list)

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
    
    # Track the actual field name for cursor generation
    # primary_sort might contain functions or aliases, so we need a clean name
    sort_field_for_cursor = primary_sort.split('.')[-1] if '.' in primary_sort else primary_sort
    if 'COALESCE' in primary_sort:
        # Special case for date sort: date = COALESCE(i.release_date, i.cover_date)
        sort_field_for_cursor = 'release_date' # We'll try this but see below

    if cursor and not search:
        try:
            cursor_parts = cursor.split(',')
            if len(cursor_parts) >= 2:
                cursor_val = cursor_parts[0]
                cursor_id = cursor_parts[1]
                op = ">" if order_dir == "asc" else "<"
                items_clauses.append(f"({primary_sort}, {unique_key}) {op} (?, ?)")
                items_params.extend([cursor_val, int(cursor_id)])
        except Exception as e:
            print(f"Cursor error: {e}")

    items_where = f" WHERE {' AND '.join(items_clauses)}" if items_clauses else ""
    # Add v.id as an ultimate tie-breaker if unique_key (i.id) is not enough (e.g. joined duplicates)
    order_clause = f" ORDER BY {primary_sort} {order_dir.upper()}, {unique_key} {order_dir.upper()}, v.id {order_dir.upper()}"

    # If cursor is present, we start from the beginning of the result set after the cursor
    # rather than applying an offset from the original start.
    effective_offset = 0 if cursor and not search else (page - 1) * limit
    
    items = db.get_all(f"SELECT {select_fields} {base}{items_where}{order_clause} LIMIT ? OFFSET ?", items_params + [limit + 1, effective_offset])
    
    has_next = len(items) > limit
    if has_next:
        items = items[:limit]
        last_item = items[-1]
        
        # Generate next cursor based on the ACTUAL sort field used
        val = None
        if sort == "recent":
            val = last_item.get('created_at')
        elif sort == "date":
            # For date, we use the same COALESCE logic as in the query
            val = last_item.get('release_date') or last_item.get('cover_date') or last_item.get('start_year')
        elif sort == "name":
            val = last_item.get('name')
            
        sort_val = val if val is not None else ''
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

@router.get("/volumes")
async def search_volumes_for_picker(
    search: Optional[str] = None,
    id: Optional[int] = None,
    cv_id: Optional[int] = None,
    mal_id: Optional[int] = None,
    hikka_slug: Optional[str] = None,
    theme_id: Optional[int] = None,
    limit: int = Query(50, ge=1, le=100)
):
    db = get_db()
    clauses = []
    params = []

    if id:
        clauses.append("v.id = ?")
        params.append(id)
    if cv_id:
        clauses.append("v.cv_id = ?")
        params.append(cv_id)
    if mal_id:
        clauses.append("v.mal_id = ?")
        params.append(mal_id)
    if hikka_slug:
        clauses.append("v.hikka_slug LIKE ?")
        params.append(f"%{hikka_slug}%")
    if theme_id:
        clauses.append("EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.theme_id = ? AND vt.volume_id = v.id)")
        params.append(theme_id)
    if search:
        clauses.append("(v.name LIKE ? OR v.name_uk LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])

    if not clauses:
        return {"items": [], "total": 0}

    where = " WHERE " + " AND ".join(clauses)
    query = f"""
        SELECT v.*, p.name as publisher_name, 'volume' as type
        FROM volumes v
        LEFT JOIN publishers p ON v.publisher = p.id
        {where}
        ORDER BY v.name ASC
        LIMIT ?
    """
    items = db.get_all(query, params + [limit])
    return {"items": items, "total": len(items)}

@router.get("/volumes/suggestions")
async def get_volume_suggestions(
    theme_id: Optional[int] = None,
    limit: int = Query(10, ge=1, le=50)
):
    db = get_db()
    
    # If theme_id is 35 (Magazine), order by number of children in volume_magazines
    if theme_id == 35:
        query = f"""
            SELECT v.*, p.name as publisher_name, 'volume' as type,
                   (SELECT COUNT(*) FROM volume_magazines vm WHERE vm.magazine_id = v.id) as children_count
            FROM volumes v
            JOIN volume_themes vt ON v.id = vt.volume_id
            LEFT JOIN publishers p ON v.publisher = p.id
            WHERE vt.theme_id = 35
            ORDER BY children_count DESC, v.name ASC
            LIMIT ?
        """
        items = db.get_all(query, [limit])
    else:
        # Default suggestions: just latest volumes with this theme
        where = ""
        params = []
        if theme_id:
            where = "JOIN volume_themes vt ON v.id = vt.volume_id WHERE vt.theme_id = ?"
            params.append(theme_id)
            
        query = f"""
            SELECT v.*, p.name as publisher_name, 'volume' as type
            FROM volumes v
            LEFT JOIN publishers p ON v.publisher = p.id
            {where}
            ORDER BY v.created_at DESC
            LIMIT ?
        """
        items = db.get_all(query, params + [limit])
        
    return {"items": items, "total": len(items)}
