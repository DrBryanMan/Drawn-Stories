from fastapi import APIRouter, Query
from typing import Optional, List
from pydantic import BaseModel
from ..db import get_db
from ..utils import parse_id_list
from ..helpers.themes import THEME_COLLECTION, THEME_MAGAZINE, ASIAN_COMICS_THEME_IDS
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
            
        placeholders = ",".join("%s" for _ in ids)
        
        if item_type == "volume":
            data = db.get_all(f"""
                SELECT v.*, p.name as publisher_name, 'volume' as type,
                       (SELECT COUNT(*) FROM issues i WHERE i.volume_id = v.id) as issue_count,
                       (SELECT COUNT(*) FROM collections c WHERE c.volume_id = v.id) as collection_count,
                       (SELECT COUNT(*) FROM issues i WHERE i.volume_id = v.id AND NOT EXISTS (SELECT 1 FROM collection_issues ci WHERE ci.issue_id = i.id)) as unconverted_issue_count,
                       (SELECT COUNT(*) FROM volume_translations vt WHERE vt.parent_id = v.id) as translation_count
                FROM volumes v
                LEFT JOIN publishers p ON v.publisher = p.id
                WHERE v.id IN ({placeholders})
            """, ids)
            results["volume"] = data
        elif item_type == "issue":
            data = db.get_all(f"""
                SELECT i.*, v.name as volume_name, v.id as volume_id, 'issue' as type
                FROM issues i
                LEFT JOIN volumes v ON i.volume_id = v.id
                WHERE i.id IN ({placeholders})
            """, ids)
            results["issue"] = data
        elif item_type == "personnel":
             data = db.get_all(f"""
                SELECT *, 'personnel' as type FROM persons WHERE id IN ({placeholders})
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
    person_ids: Optional[str] = None,
    mode: Optional[str] = None,
    theme_ids: Optional[str] = None,
    exclude_theme_ids: Optional[str] = None,
    magazine_ids: Optional[str] = None,
    langs: Optional[str] = None,
    sources: Optional[str] = None,
    exclude_sources: Optional[str] = None,
    date_min: Optional[str] = None,
    date_max: Optional[str] = None,
) -> dict:
    if mode == "volumes":
        view_type = "series"
    elif mode == "issues":
        view_type = "issues"

    db = get_db()
    
    # We maintain separate lists for filter clauses and their parameters
    filter_clauses = []
    filter_params = []

    # Subqueries for high-performance ID set filtering
    asian_ids_sql = ",".join(str(tid) for tid in ASIAN_COMICS_THEME_IDS)
    manga_id_sql = f"SELECT volume_id FROM volume_themes WHERE theme_id IN ({asian_ids_sql}) AND volume_id IS NOT NULL"
    collection_id_sql = f"SELECT volume_id FROM volume_themes WHERE theme_id = {THEME_COLLECTION} AND volume_id IS NOT NULL"

    if view_type == "series":
        base = "FROM volumes v LEFT JOIN publishers p ON v.publisher = p.id"
        select_fields = "v.*, p.name as publisher_name, 'volume' as type, (SELECT COUNT(*) FROM issues i WHERE i.volume_id = v.id) as issue_count, (SELECT COUNT(*) FROM collections c WHERE c.volume_id = v.id) as collection_count, (SELECT COUNT(*) FROM issues i WHERE i.volume_id = v.id AND NOT EXISTS (SELECT 1 FROM collection_issues ci WHERE ci.issue_id = i.id)) as unconverted_issue_count, (SELECT COUNT(*) FROM volume_translations vt WHERE vt.parent_id = v.id) as translation_count"
        primary_sort = CATALOG_SORT_COLUMNS.get(sort, "v.created_at")
        unique_key = "v.id"
        
        if content_type == "manga":
            filter_clauses.append(f"v.id IN ({manga_id_sql})")
        elif content_type == "comics":
            filter_clauses.append(f"v.id NOT IN ({manga_id_sql})")

        if collection:
            filter_clauses.append(f"v.id IN ({collection_id_sql})")
        else:
            filter_clauses.append(f"v.id NOT IN ({collection_id_sql})")

        if search:
            words = [w.strip() for w in search.split() if w.strip()]
            if words:
                search_parts = []
                for word in words:
                    part = "(LOWER(v.name) LIKE %s OR LOWER(v.name_en) LIKE %s OR LOWER(v.name_uk) LIKE %s OR LOWER(v.name_native) LIKE %s)"
                    search_parts.append(part)
                    filter_params.extend([f"%{word.lower()}%"] * 4)
                filter_clauses.append(f"({' AND '.join(search_parts)})")

    else:
        if not collection:
            base = """
                FROM issues i
                JOIN volumes v ON i.volume_id = v.id
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
                        part = "(LOWER(i.name) LIKE %s OR LOWER(v.name) LIKE %s OR LOWER(v.name_en) LIKE %s OR LOWER(v.name_uk) LIKE %s OR LOWER(v.name_native) LIKE %s)"
                        search_parts.append(part)
                        filter_params.extend([f"%{word.lower()}%"] * 5)
                    filter_clauses.append(f"({' AND '.join(search_parts)})")
        else:
            base = """
                FROM collections c
                LEFT JOIN volumes v ON c.volume_id = v.id
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
                        part = "(LOWER(c.name) LIKE %s OR LOWER(v.name) LIKE %s OR LOWER(v.name_en) LIKE %s OR LOWER(v.name_uk) LIKE %s OR LOWER(v.name_native) LIKE %s)"
                        search_parts.append(part)
                        filter_params.extend([f"%{word.lower()}%"] * 5)
                    filter_clauses.append(f"({' AND '.join(search_parts)})")

        if content_type == "manga":
            filter_clauses.append(f"v.id IN ({manga_id_sql})")
        elif content_type == "comics":
            filter_clauses.append(f"v.id NOT IN ({manga_id_sql})")

    # Common Filters (Publishers, Themes, Magazines, Languages, Sources)
    source_map = {
        "hikka": {
            "include": "(v.hikka_slug IS NOT NULL AND v.hikka_slug != '')",
            "exclude": "(v.hikka_slug IS NULL OR v.hikka_slug = '')"
        },
        "mal": {
            "include": "v.mal_id IS NOT NULL",
            "exclude": "v.mal_id IS NULL"
        },
        "cv": {
            "include": "v.cv_id IS NOT NULL",
            "exclude": "v.cv_id IS NULL"
        }
    }

    if sources:
        # Use OR for multiple inclusion sources (any of the selected)
        clauses = [source_map[s]["include"] for s in sources.split(',') if s in source_map]
        if clauses:
            filter_clauses.append(f"({' OR '.join(clauses)})")
    
    if exclude_sources:
        # Use AND for multiple exclusion sources (none of the selected)
        for s in exclude_sources.split(','):
            if s in source_map:
                filter_clauses.append(source_map[s]["exclude"])

    publisher_filter_ids = parse_id_list(publisher_ids)
    if publisher_filter_ids:
        placeholders = ",".join("%s" for _ in publisher_filter_ids)
        filter_clauses.append(f"v.publisher IN ({placeholders})")
        filter_params.extend(publisher_filter_ids)

    person_filter_ids = parse_id_list(person_ids)
    if person_filter_ids:
        placeholders = ",".join("%s" for _ in person_filter_ids)
        if view_type == "series":
            filter_clauses.append(f"v.id IN (SELECT volume_id FROM volume_persons WHERE person_id IN ({placeholders}))")
        else:
            filter_clauses.append(f"i.id IN (SELECT issue_id FROM issue_persons WHERE person_id IN ({placeholders}))")
        filter_params.extend(person_filter_ids)

    magazine_filter_ids = parse_id_list(magazine_ids)
    if magazine_filter_ids:
        placeholders = ",".join("%s" for _ in magazine_filter_ids)
        filter_clauses.append(f"v.id IN (SELECT volume_id FROM magazine_volumes WHERE magazine_id IN ({placeholders}))")
        filter_params.extend(magazine_filter_ids)

    if langs:
        lang_list = langs.split(',')
        placeholders = ",".join("%s" for _ in lang_list)
        filter_clauses.append(f"v.lang IN ({placeholders})")
        filter_params.extend(lang_list)

    for theme_id in parse_id_list(theme_ids):
        filter_clauses.append("EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.theme_id = %s AND vt.volume_id = v.id)")
        filter_params.append(theme_id)

    for theme_id in parse_id_list(exclude_theme_ids):
        filter_clauses.append("NOT EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.theme_id = %s AND vt.volume_id = v.id)")
        filter_params.append(theme_id)

    if date_min or date_max:
        if sort == "recent":
            # created_at — timestamp, каст безпечний
            if date_min:
                filter_clauses.append(f"({primary_sort})::date >= %s::date")
                filter_params.append(date_min)
            if date_max:
                filter_clauses.append(f"({primary_sort})::date <= %s::date")
                filter_params.append(date_max)
        elif sort == "date":
            if view_type == "series":
                # v.start_year — INTEGER, порівнюємо тільки рік
                try:
                    if date_min:
                        filter_clauses.append("v.start_year >= %s")
                        filter_params.append(int(date_min[:4]))
                    if date_max:
                        filter_clauses.append("v.start_year <= %s")
                        filter_params.append(int(date_max[:4]))
                except (ValueError, IndexError):
                    pass
            else:
                # release_date/cover_date — TEXT у форматі YYYY-MM-DD.
                # НЕ кастуємо в DATE, бо деякі записи мають невалідні значення
                # на зразок "1972-07-00" (день = 0 з Comic Vine). Текстове
                # порівняння ISO-рядків дає правильний лексикографічний результат.
                date_col = "COALESCE(i.release_date, i.cover_date)" if not collection \
                    else "COALESCE(c.release_date, c.cover_date)"
                if date_min:
                    filter_clauses.append(f"{date_col} >= %s")
                    filter_params.append(date_min)
                if date_max:
                    filter_clauses.append(f"{date_col} <= %s")
                    filter_params.append(date_max)

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
                items_clauses.append(f"({primary_sort}, {unique_key}) {op} (%s, %s)")
                items_params.extend([cursor_val, int(cursor_id)])
        except Exception as e:
            print(f"Cursor error: {e}")

    items_where = f" WHERE {' AND '.join(items_clauses)}" if items_clauses else ""
    # Add v.id as an ultimate tie-breaker if unique_key (i.id) is not enough (e.g. joined duplicates)
    order_clause = f" ORDER BY {primary_sort} {order_dir.upper()}, {unique_key} {order_dir.upper()}, v.id {order_dir.upper()}"

    # If cursor is present, we start from the beginning of the result set after the cursor
    # rather than applying an offset from the original start.
    effective_offset = 0 if cursor and not search else (page - 1) * limit
    
    items = db.get_all(f"SELECT {select_fields} {base}{items_where}{order_clause} LIMIT %s OFFSET %s", items_params + [limit + 1, effective_offset])
    
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
    ids: Optional[str] = None,
    cv_id: Optional[int] = None,
    mal_id: Optional[int] = None,
    hikka_slug: Optional[str] = None,
    theme_id: Optional[int] = None,
    has_mal: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=100)
):
    db = get_db()
    clauses = []
    params = []

    if id:
        clauses.append("v.id = %s")
        params.append(id)
    if ids:
        id_list = [int(x.strip()) for x in ids.split(",") if x.strip().isdigit()]
        if id_list:
            placeholders = ",".join("%s" for _ in id_list)
            clauses.append(f"v.id IN ({placeholders})")
            params.extend(id_list)
    if cv_id:
        clauses.append("v.cv_id = %s")
        params.append(cv_id)
    if mal_id:
        clauses.append("v.mal_id = %s")
        params.append(mal_id)
    if hikka_slug:
        clauses.append("LOWER(v.hikka_slug) LIKE %s")
        params.append(f"%{hikka_slug.lower()}%")
    if theme_id:
        clauses.append("EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.theme_id = %s AND vt.volume_id = v.id)")
        params.append(theme_id)
    if has_mal:
        clauses.append("v.mal_id IS NOT NULL")
    if search:
        clauses.append("(LOWER(v.name) LIKE %s OR LOWER(v.name_en) LIKE %s OR LOWER(v.name_uk) LIKE %s OR LOWER(v.name_native) LIKE %s)")
        params.extend([f"%{search.lower()}%"] * 4)

    if not clauses:
        return {"items": [], "total": 0}

    where = " WHERE " + " AND ".join(clauses)
    query = f"""
        SELECT v.*, p.name as publisher_name, 'volume' as type
        FROM volumes v
        LEFT JOIN publishers p ON v.publisher = p.id
        {where}
        ORDER BY v.name ASC
        LIMIT %s
    """
    items = db.get_all(query, params + [limit])
    return {"items": [dict(x) for x in items], "total": len(items)}

@router.get("/volumes/suggestions")
async def get_volume_suggestions(
    theme_id: Optional[int] = None,
    limit: int = Query(10, ge=1, le=50)
):
    db = get_db()
    
    # If theme_id is THEME_MAGAZINE (Magazine), order by number of children in magazine_volumes
    if theme_id == THEME_MAGAZINE:
        query = f"""
            SELECT v.*, p.name as publisher_name, 'volume' as type,
                   (SELECT COUNT(*) FROM magazine_volumes vm WHERE vm.magazine_id = v.id) as children_count
            FROM volumes v
            JOIN volume_themes vt ON v.id = vt.volume_id
            LEFT JOIN publishers p ON v.publisher = p.id
            WHERE vt.theme_id = {THEME_MAGAZINE}
            ORDER BY children_count DESC, v.name ASC
            LIMIT %s
        """
        items = db.get_all(query, [limit])
    else:
        # Default suggestions: just latest volumes with this theme
        where = ""
        params = []
        if theme_id:
            where = "JOIN volume_themes vt ON v.id = vt.volume_id WHERE vt.theme_id = %s"
            params.append(theme_id)
            
        query = f"""
            SELECT v.*, p.name as publisher_name, 'volume' as type
            FROM volumes v
            LEFT JOIN publishers p ON v.publisher = p.id
            {where}
            ORDER BY v.created_at DESC
            LIMIT %s
        """
        items = db.get_all(query, params + [limit])
        
    return {"items": items, "total": len(items)}