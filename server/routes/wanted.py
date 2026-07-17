from fastapi import APIRouter, Query, Request, HTTPException
from typing import Optional
from ..db import get_db

router = APIRouter(prefix="/api/wanted", tags=["wanted"])

# ── Theme IDs ────────────────────────────────────────────────
THEME_MANGA       = 36
THEME_TRANSLATED  = 51
THEME_COLLECTION  = 44

# ── Sections config ──────────────────────────────────────────
SECTIONS = ["volumes", "collections", "issues", "characters", "personnel", "publishers"]

# ── Volume categories ────────────────────────────────────────
VOLUME_CATEGORIES = {
    "no_uk_name": {
        "label": "Без укр. назви",
        "clause": "(v.name_uk IS NULL OR v.name_uk = '')",
        "missing_fields": ["укр. назва"],
    },
    "no_lang": {
        "label": "Без мови",
        "clause": "(v.lang IS NULL OR v.lang = '')",
        "missing_fields": ["мова"],
    },
    "no_year": {
        "label": "Без року",
        "clause": "v.start_year IS NULL",
        "missing_fields": ["рік"],
    },
    "no_publisher": {
        "label": "Без видавництва",
        "clause": "v.publisher IS NULL",
        "missing_fields": ["видавець"],
    },
    "no_theme": {
        "label": "Без теми",
        "clause": "NOT EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.volume_id = v.id)",
        "missing_fields": ["тема"],
    },
    "translated_no_source": {
        "label": "Переклад без джерела",
        "clause": (
            f"EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.volume_id = v.id AND vt.theme_id = {THEME_TRANSLATED})"
            " AND NOT EXISTS (SELECT 1 FROM magazine_volumes vm WHERE vm.volume_id = v.id)"
        ),
        "missing_fields": ["джерело"],
    },
    "manga_no_journal": {
        "label": "Манґа без журналу",
        "clause": (
            f"EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.volume_id = v.id AND vt.theme_id = {THEME_MANGA})"
            " AND v.mal_id IS NOT NULL"
            " AND NOT EXISTS (SELECT 1 FROM magazine_volumes vm WHERE vm.volume_id = v.id)"
        ),
        "missing_fields": ["журнал"],
    },
    "collection_unconverted": {
        "label": "Неконвертовані збірники",
        "clause": (
            f"EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.volume_id = v.id AND vt.theme_id = {THEME_COLLECTION})"
            " AND EXISTS (SELECT 1 FROM issues i WHERE i.volume_id = v.id)"
        ),
        "missing_fields": ["збірник → collection"],
    },
    "collection_no_origin": {
        "label": "Манґа-збірник без оригіналу",
        "clause": (
            f"EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.volume_id = v.id AND vt.theme_id = {THEME_COLLECTION})"
            f" AND EXISTS (SELECT 1 FROM volume_themes vt2 WHERE vt2.volume_id = v.id AND vt2.theme_id = {THEME_MANGA})"
            " AND NOT EXISTS ("
            "   SELECT 1 FROM volume_translations vt3"
            "   JOIN volumes ov ON ov.id = vt3.parent_id"
            "   WHERE vt3.child_id = v.id AND ov.mal_id IS NOT NULL"
            " )"
        ),
        "missing_fields": ["оригінал"],
    },
    "mixed_sources": {
        "label": "Змішані джерела",
        "clause": "v.mal_id IS NOT NULL AND v.cv_id IS NOT NULL",
        "missing_fields": ["змішані джерела"],
    },
    "manga_no_staff": {
        "label": "Манґа-том без стафу",
        "clause": (
            "v.mal_id IS NOT NULL"
            " AND NOT EXISTS (SELECT 1 FROM volume_persons vp WHERE vp.volume_id = v.id)"
        ),
        "missing_fields": ["стаф"],
    },
    "manga_no_characters": {
        "label": "Манґа-том без персонажів",
        "clause": (
            "v.mal_id IS NOT NULL"
            " AND NOT EXISTS (SELECT 1 FROM volume_characters vc WHERE vc.volume_id = v.id)"
        ),
        "missing_fields": ["персонажі"],
    },
}

# ── Collection categories ────────────────────────────────────
COLLECTION_CATEGORIES = {
    "no_isbn": {
        "label": "Без ISBN",
        "clause": "(c.isbn IS NULL OR c.isbn = '')",
        "missing_fields": ["ISBN"],
    },
    "no_release_date": {
        "label": "Без релізу",
        "clause": "(c.release_date IS NULL OR c.release_date = '')",
        "missing_fields": ["дата релізу"],
    },
    "no_synopsis": {
        "label": "Без опису",
        "clause": "(c.synopsis IS NULL OR c.synopsis = '') AND (c.synopsis_ua IS NULL OR c.synopsis_ua = '')",
        "missing_fields": ["опис"],
    },
    "no_pages": {
        "label": "Без сторінок",
        "clause": "(c.pages IS NULL OR c.pages = '')",
        "missing_fields": ["сторінки"],
    },
    "no_site_link": {
        "label": "Без посилання",
        "clause": "(c.site_link IS NULL OR c.site_link = '')",
        "missing_fields": ["посилання"],
    },
    "no_issues": {
        "label": "Без випусків",
        "clause": "NOT EXISTS (SELECT 1 FROM collection_issues ci WHERE ci.collection_id = c.id)",
        "missing_fields": ["випуски"],
    },
    "no_contents": {
        "label": "Без змісту",
        "clause": "(c.contents IS NULL OR c.contents = '')",
        "missing_fields": ["зміст"],
    },
}

# ── Issue categories ─────────────────────────────────────────
ISSUE_CATEGORIES = {
    "no_uk_name": {
        "label": "Без укр. назви",
        "clause": "(i.name_uk IS NULL OR i.name_uk = '') AND (i.name IS NOT NULL AND i.name != '')",
        "missing_fields": ["укр. назва"],
    },
    "no_cover_date": {
        "label": "Без дати обкладинки",
        "clause": "(i.cover_date IS NULL OR i.cover_date = '')",
        "missing_fields": ["дата обкладинки"],
    },
    "no_release_date": {
        "label": "Без дати релізу",
        "clause": "(i.release_date IS NULL OR i.release_date = '')",
        "missing_fields": ["дата релізу"],
    },
    "no_pages": {
        "label": "Без сторінок",
        "clause": "(i.pages IS NULL OR i.pages = '')",
        "missing_fields": ["сторінки"],
    },
}

# ── Character categories ─────────────────────────────────────
CHARACTER_CATEGORIES = {
    "no_uk_name": {
        "label": "Без укр. імені",
        "clause": "(c.name_uk IS NULL OR c.name_uk = '')",
        "missing_fields": ["укр. ім'я"],
    },
    "no_uk_real_name": {
        "label": "Без укр. реального імені",
        "clause": "(c.real_name_uk IS NULL OR c.real_name_uk = '') AND (c.real_name IS NOT NULL AND c.real_name != '')",
        "missing_fields": ["укр. реальне ім'я"],
    },
    "no_image": {
        "label": "Без зображення",
        "clause": "(c.image IS NULL OR c.image = '')",
        "missing_fields": ["зображення"],
    },
}

# ── Personnel categories ─────────────────────────────────────
PERSONNEL_CATEGORIES = {
    "no_uk_name": {
        "label": "Без укр. імені",
        "clause": "(p.name_uk IS NULL OR p.name_uk = '')",
        "missing_fields": ["укр. ім'я"],
    },
    "no_pseudo": {
        "label": "Без псевдо",
        "clause": "(p.pseudo IS NULL OR p.pseudo = '')",
        "missing_fields": ["псевдо"],
    },
    "no_image": {
        "label": "Без зображення",
        "clause": "(p.image IS NULL OR p.image = '')",
        "missing_fields": ["зображення"],
    },
}

# ── Publisher categories ─────────────────────────────────────
PUBLISHER_CATEGORIES = {
    "no_founded": {
        "label": "Без дати заснування",
        "clause": "(p.founded_date IS NULL OR p.founded_date = '')",
        "missing_fields": ["дата заснування"],
    },
    "no_location": {
        "label": "Без країни/місця",
        "clause": "(p.country IS NULL OR p.country = '') AND (p.place IS NULL OR p.place = '')",
        "missing_fields": ["країна/місце"],
    },
    "no_work_type": {
        "label": "Без типу робіт",
        "clause": "(p.work_type IS NULL OR p.work_type = '')",
        "missing_fields": ["тип робіт"],
    },
}

SECTION_CATEGORIES = {
    "volumes":     VOLUME_CATEGORIES,
    "collections": COLLECTION_CATEGORIES,
    "issues":      ISSUE_CATEGORIES,
    "characters":  CHARACTER_CATEGORIES,
    "personnel":   PERSONNEL_CATEGORIES,
    "publishers":  PUBLISHER_CATEGORIES,
}

VOLUME_SORT_COLUMNS = {
    "name":   "v.name",
    "recent": "v.created_at",
    "date":   "v.start_year",
}

GENERIC_SORT_COLUMNS = {
    "name":   "name",
    "recent": "created_at",
    "date":   "created_at",
}


def get_admin_user(request: Request):
    """Перевіряє, що юзер є admin або moderator, інакше 403."""
    role = request.cookies.get("role")
    if role not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Доступ заборонено")
    return role


# ── Summary endpoint ─────────────────────────────────────────
@router.get("/summary")
async def get_wanted_summary(request: Request):
    get_admin_user(request)
    db = get_db()

    summary = {}

    # Volumes: sum of all category counts
    vol_total = 0
    for key, cat in VOLUME_CATEGORIES.items():
        clause = cat["clause"]
        row = db.get_one(
            f"SELECT COUNT(*) as cnt FROM volumes v WHERE {clause}",
            [],
        )
        vol_total += row["cnt"]
    summary["volumes"] = vol_total

    # Collections
    col_total = _count_all_categories(db, "collections", COLLECTION_CATEGORIES, "c")
    summary["collections"] = col_total

    # Issues
    iss_total = _count_all_categories(db, "issues", ISSUE_CATEGORIES, "i")
    summary["issues"] = iss_total

    # Characters
    char_total = _count_all_categories(db, "characters", CHARACTER_CATEGORIES, "c")
    summary["characters"] = char_total

    # Personnel
    per_total = _count_all_categories(db, "persons", PERSONNEL_CATEGORIES, "p")
    summary["personnel"] = per_total

    # Publishers
    pub_total = _count_all_categories(db, "publishers", PUBLISHER_CATEGORIES, "p")
    summary["publishers"] = pub_total

    return summary


def _count_all_categories(db, table: str, categories: dict, alias: str) -> int:
    """Підраховує суму по всіх категоріях для заданої таблиці."""
    total = 0
    for key, cat in categories.items():
        row = db.get_one(
            f"SELECT COUNT(*) as cnt FROM {table} {alias} WHERE {cat['clause']}",
            [],
        )
        total += row["cnt"]
    return total


# ── Volumes ──────────────────────────────────────────────────
@router.get("/volumes")
async def get_wanted_volumes(
    request: Request,
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = Query("recent", pattern="^(name|recent|date)$"),
    order_dir: str = Query("desc", pattern="^(asc|desc)$"),
    content_type: Optional[str] = Query(None, pattern="^(comics|manga)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=200),
):
    get_admin_user(request)
    db = get_db()

    manga_subquery = f"SELECT volume_id FROM volume_themes WHERE theme_id = {THEME_MANGA} AND volume_id IS NOT NULL"
    clauses = []
    params = []

    if category and category in VOLUME_CATEGORIES:
        clauses.append(VOLUME_CATEGORIES[category]["clause"])

    if content_type == "manga":
        clauses.append(f"v.id IN ({manga_subquery})")
    elif content_type == "comics":
        clauses.append(f"v.id NOT IN ({manga_subquery})")

    if search:
        words = [w.strip() for w in search.split() if w.strip()]
        if words:
            search_parts = []
            for word in words:
                search_parts.append(
                    "(LOWER(v.name) LIKE %s OR LOWER(v.name_en) LIKE %s OR LOWER(v.name_uk) LIKE %s)"
                )
                params.extend([f"%{word.lower()}%"] * 3)
            clauses.append(f"({' AND '.join(search_parts)})")

    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    sort_col = VOLUME_SORT_COLUMNS.get(sort, "v.created_at")
    order_clause = f" ORDER BY {sort_col} {order_dir.upper()}, v.id {order_dir.upper()}"

    total = db.get_one(
        f"SELECT COUNT(*) as cnt FROM volumes v LEFT JOIN publishers p ON v.publisher = p.id{where}",
        params,
    )["cnt"]

    offset = (page - 1) * limit
    items_raw = db.get_all(
        f"""SELECT v.*, p.name as publisher_name,
               (SELECT COUNT(*) FROM issues i WHERE i.volume_id = v.id) as issue_count
            FROM volumes v LEFT JOIN publishers p ON v.publisher = p.id
            {where}{order_clause} LIMIT %s OFFSET %s""",
        params + [limit, offset],
    )

    items = []
    for row in items_raw:
        row = dict(row)
        row["missing_fields"] = _compute_volume_missing(row, category)
        row["_type"] = "volume"
        items.append(row)

    return _paginate(items, total, page, limit)


@router.get("/category-counts/volumes")
async def get_volume_category_counts(
    request: Request,
    content_type: Optional[str] = Query(None, pattern="^(comics|manga)$"),
):
    """Повертає кількість томів для кожної категорії."""
    get_admin_user(request)
    db = get_db()

    manga_subquery = f"SELECT volume_id FROM volume_themes WHERE theme_id = {THEME_MANGA} AND volume_id IS NOT NULL"
    ct_clause = ""
    if content_type == "manga":
        ct_clause = f" AND v.id IN ({manga_subquery})"
    elif content_type == "comics":
        ct_clause = f" AND v.id NOT IN ({manga_subquery})"

    counts = {}
    for key, cat in VOLUME_CATEGORIES.items():
        row = db.get_one(
            f"SELECT COUNT(*) as cnt FROM volumes v WHERE {cat['clause']}{ct_clause}",
            [],
        )
        counts[key] = row["cnt"]

    return counts


# ── Collections ───────────────────────────────────────────────
@router.get("/collections")
async def get_wanted_collections(
    request: Request,
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = Query("recent", pattern="^(name|recent|date)$"),
    order_dir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=200),
):
    get_admin_user(request)
    db = get_db()

    clauses = []
    params = []

    if category and category in COLLECTION_CATEGORIES:
        clauses.append(COLLECTION_CATEGORIES[category]["clause"])

    if search:
        words = [w.strip() for w in search.split() if w.strip()]
        if words:
            parts = []
            for word in words:
                parts.append("LOWER(c.name) LIKE %s")
                params.append(f"%{word.lower()}%")
            clauses.append(f"({' AND '.join(parts)})")

    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    sort_col = {"name": "c.name", "recent": "c.created_at", "date": "c.release_date"}.get(sort, "c.created_at")
    order_clause = f" ORDER BY {sort_col} {order_dir.upper()}, c.id {order_dir.upper()}"

    total = db.get_one(f"SELECT COUNT(*) as cnt FROM collections c{where}", params)["cnt"]

    offset = (page - 1) * limit
    items_raw = db.get_all(
        f"""SELECT c.*, p.name as publisher_name
            FROM collections c
            LEFT JOIN publishers p ON c.publisher = p.id
            {where}{order_clause} LIMIT %s OFFSET %s""",
        params + [limit, offset],
    )

    items = []
    for row in items_raw:
        row = dict(row)
        row["missing_fields"] = _compute_collection_missing(row, category)
        row["_type"] = "collection"
        items.append(row)

    return _paginate(items, total, page, limit)


@router.get("/category-counts/collections")
async def get_collection_category_counts(request: Request):
    get_admin_user(request)
    db = get_db()
    counts = {}
    for key, cat in COLLECTION_CATEGORIES.items():
        row = db.get_one(f"SELECT COUNT(*) as cnt FROM collections c WHERE {cat['clause']}", [])
        counts[key] = row["cnt"]
    return counts


# ── Issues ───────────────────────────────────────────────────
@router.get("/issues")
async def get_wanted_issues(
    request: Request,
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = Query("recent", pattern="^(name|recent|date)$"),
    order_dir: str = Query("desc", pattern="^(asc|desc)$"),
    content_type: Optional[str] = Query(None, pattern="^(comics|manga)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=200),
):
    get_admin_user(request)
    db = get_db()

    manga_subquery = f"SELECT volume_id FROM volume_themes WHERE theme_id = {THEME_MANGA} AND volume_id IS NOT NULL"
    clauses = []
    params = []

    if category and category in ISSUE_CATEGORIES:
        clauses.append(ISSUE_CATEGORIES[category]["clause"])

    if content_type == "manga":
        clauses.append(f"i.volume_id IN ({manga_subquery})")
    elif content_type == "comics":
        clauses.append(f"i.volume_id NOT IN ({manga_subquery})")

    if search:
        words = [w.strip() for w in search.split() if w.strip()]
        if words:
            parts = []
            for word in words:
                parts.append("(LOWER(i.name) LIKE %s OR LOWER(i.name_uk) LIKE %s)")
                params.extend([f"%{word.lower()}%"] * 2)
            clauses.append(f"({' AND '.join(parts)})")

    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    sort_col = {"name": "i.name", "recent": "i.created_at", "date": "i.cover_date"}.get(sort, "i.created_at")
    order_clause = f" ORDER BY {sort_col} {order_dir.upper()}, i.id {order_dir.upper()}"

    total = db.get_one(f"SELECT COUNT(*) as cnt FROM issues i{where}", params)["cnt"]

    offset = (page - 1) * limit
    items_raw = db.get_all(
        f"""SELECT i.*, v.name as volume_name, v.image as volume_img
            FROM issues i
            LEFT JOIN volumes v ON i.volume_id = v.id
            {where}{order_clause} LIMIT %s OFFSET %s""",
        params + [limit, offset],
    )

    items = []
    for row in items_raw:
        row = dict(row)
        row["missing_fields"] = _compute_issue_missing(row, category)
        row["_type"] = "issue"
        items.append(row)

    return _paginate(items, total, page, limit)


@router.get("/category-counts/issues")
async def get_issue_category_counts(
    request: Request,
    content_type: Optional[str] = Query(None, pattern="^(comics|manga)$"),
):
    get_admin_user(request)
    db = get_db()

    manga_subquery = f"SELECT volume_id FROM volume_themes WHERE theme_id = {THEME_MANGA} AND volume_id IS NOT NULL"
    ct_clause = ""
    if content_type == "manga":
        ct_clause = f" AND i.volume_id IN ({manga_subquery})"
    elif content_type == "comics":
        ct_clause = f" AND i.volume_id NOT IN ({manga_subquery})"

    counts = {}
    for key, cat in ISSUE_CATEGORIES.items():
        row = db.get_one(
            f"SELECT COUNT(*) as cnt FROM issues i WHERE {cat['clause']}{ct_clause}",
            [],
        )
        counts[key] = row["cnt"]

    return counts


# ── Characters ───────────────────────────────────────────────
@router.get("/characters")
async def get_wanted_characters(
    request: Request,
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = Query("recent", pattern="^(name|recent|date)$"),
    order_dir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=200),
):
    get_admin_user(request)
    db = get_db()

    clauses = []
    params = []

    if category and category in CHARACTER_CATEGORIES:
        clauses.append(CHARACTER_CATEGORIES[category]["clause"])

    if search:
        words = [w.strip() for w in search.split() if w.strip()]
        if words:
            parts = []
            for word in words:
                parts.append("(LOWER(c.name) LIKE %s OR LOWER(c.name_uk) LIKE %s)")
                params.extend([f"%{word.lower()}%"] * 2)
            clauses.append(f"({' AND '.join(parts)})")

    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    sort_col = {"name": "c.name", "recent": "c.created_at", "date": "c.created_at"}.get(sort, "c.created_at")
    order_clause = f" ORDER BY {sort_col} {order_dir.upper()}, c.id {order_dir.upper()}"

    total = db.get_one(f"SELECT COUNT(*) as cnt FROM characters c{where}", params)["cnt"]

    offset = (page - 1) * limit
    items_raw = db.get_all(
        f"SELECT c.* FROM characters c{where}{order_clause} LIMIT %s OFFSET %s",
        params + [limit, offset],
    )

    items = []
    for row in items_raw:
        row = dict(row)
        row["missing_fields"] = _compute_character_missing(row, category)
        row["_type"] = "character"
        items.append(row)

    return _paginate(items, total, page, limit)


@router.get("/category-counts/characters")
async def get_character_category_counts(request: Request):
    get_admin_user(request)
    db = get_db()
    counts = {}
    for key, cat in CHARACTER_CATEGORIES.items():
        row = db.get_one(f"SELECT COUNT(*) as cnt FROM characters c WHERE {cat['clause']}", [])
        counts[key] = row["cnt"]
    return counts


# ── Personnel ─────────────────────────────────────────────────
@router.get("/personnel")
async def get_wanted_personnel(
    request: Request,
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = Query("recent", pattern="^(name|recent|date)$"),
    order_dir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=200),
):
    get_admin_user(request)
    db = get_db()

    clauses = []
    params = []

    if category and category in PERSONNEL_CATEGORIES:
        clauses.append(PERSONNEL_CATEGORIES[category]["clause"])

    if search:
        words = [w.strip() for w in search.split() if w.strip()]
        if words:
            parts = []
            for word in words:
                parts.append("(LOWER(p.name) LIKE %s OR LOWER(p.name_uk) LIKE %s)")
                params.extend([f"%{word.lower()}%"] * 2)
            clauses.append(f"({' AND '.join(parts)})")

    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    sort_col = {"name": "p.name", "recent": "p.created_at", "date": "p.created_at"}.get(sort, "p.created_at")
    order_clause = f" ORDER BY {sort_col} {order_dir.upper()}, p.id {order_dir.upper()}"

    total = db.get_one(f"SELECT COUNT(*) as cnt FROM persons p{where}", params)["cnt"]

    offset = (page - 1) * limit
    items_raw = db.get_all(
        f"SELECT p.* FROM persons p{where}{order_clause} LIMIT %s OFFSET %s",
        params + [limit, offset],
    )

    items = []
    for row in items_raw:
        row = dict(row)
        row["missing_fields"] = _compute_personnel_missing(row, category)
        row["_type"] = "person"
        items.append(row)

    return _paginate(items, total, page, limit)


@router.get("/category-counts/personnel")
async def get_personnel_category_counts(request: Request):
    get_admin_user(request)
    db = get_db()
    counts = {}
    for key, cat in PERSONNEL_CATEGORIES.items():
        row = db.get_one(f"SELECT COUNT(*) as cnt FROM persons p WHERE {cat['clause']}", [])
        counts[key] = row["cnt"]
    return counts


# ── Publishers ────────────────────────────────────────────────
@router.get("/publishers")
async def get_wanted_publishers(
    request: Request,
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = Query("recent", pattern="^(name|recent|date)$"),
    order_dir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=200),
):
    get_admin_user(request)
    db = get_db()

    clauses = []
    params = []

    if category and category in PUBLISHER_CATEGORIES:
        clauses.append(PUBLISHER_CATEGORIES[category]["clause"])

    if search:
        words = [w.strip() for w in search.split() if w.strip()]
        if words:
            parts = []
            for word in words:
                parts.append("LOWER(p.name) LIKE %s")
                params.append(f"%{word.lower()}%")
            clauses.append(f"({' AND '.join(parts)})")

    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    sort_col = {"name": "p.name", "recent": "p.created_at", "date": "p.founded_date"}.get(sort, "p.created_at")
    order_clause = f" ORDER BY {sort_col} {order_dir.upper()}, p.id {order_dir.upper()}"

    total = db.get_one(f"SELECT COUNT(*) as cnt FROM publishers p{where}", params)["cnt"]

    offset = (page - 1) * limit
    items_raw = db.get_all(
        f"SELECT p.* FROM publishers p{where}{order_clause} LIMIT %s OFFSET %s",
        params + [limit, offset],
    )

    items = []
    for row in items_raw:
        row = dict(row)
        row["missing_fields"] = _compute_publisher_missing(row, category)
        row["_type"] = "publisher"
        items.append(row)

    return _paginate(items, total, page, limit)


@router.get("/category-counts/publishers")
async def get_publisher_category_counts(request: Request):
    get_admin_user(request)
    db = get_db()
    counts = {}
    for key, cat in PUBLISHER_CATEGORIES.items():
        row = db.get_one(f"SELECT COUNT(*) as cnt FROM publishers p WHERE {cat['clause']}", [])
        counts[key] = row["cnt"]
    return counts


# ── Helpers: compute missing fields ──────────────────────────

def _compute_volume_missing(row: dict, category: Optional[str]) -> list[str]:
    missing = []
    if not row.get("name_uk"):
        missing.append("укр. назва")
    if not row.get("lang"):
        missing.append("мова")
    if not row.get("start_year"):
        missing.append("рік")
    if not row.get("publisher"):
        missing.append("видавець")
    if category and category in VOLUME_CATEGORIES:
        cat_fields = VOLUME_CATEGORIES[category]["missing_fields"]
        return list(dict.fromkeys(cat_fields + missing))
    return missing


def _compute_collection_missing(row: dict, category: Optional[str]) -> list[str]:
    missing = []
    if not row.get("isbn"):
        missing.append("ISBN")
    if not row.get("release_date"):
        missing.append("дата релізу")
    if not row.get("synopsis") and not row.get("synopsis_ua"):
        missing.append("опис")
    if not row.get("pages"):
        missing.append("сторінки")
    if not row.get("site_link"):
        missing.append("посилання")
    if category and category in COLLECTION_CATEGORIES:
        cat_fields = COLLECTION_CATEGORIES[category]["missing_fields"]
        return list(dict.fromkeys(cat_fields + missing))
    return missing


def _compute_issue_missing(row: dict, category: Optional[str]) -> list[str]:
    missing = []
    if not row.get("name_uk") and row.get("name"):
        missing.append("укр. назва")
    if not row.get("cover_date"):
        missing.append("дата обкладинки")
    if not row.get("release_date"):
        missing.append("дата релізу")
    if not row.get("pages"):
        missing.append("сторінки")
    if category and category in ISSUE_CATEGORIES:
        cat_fields = ISSUE_CATEGORIES[category]["missing_fields"]
        return list(dict.fromkeys(cat_fields + missing))
    return missing


def _compute_character_missing(row: dict, category: Optional[str]) -> list[str]:
    missing = []
    if not row.get("name_uk"):
        missing.append("укр. ім'я")
    if not row.get("real_name_uk") and row.get("real_name"):
        missing.append("укр. реальне ім'я")
    if not row.get("image"):
        missing.append("зображення")
    if category and category in CHARACTER_CATEGORIES:
        cat_fields = CHARACTER_CATEGORIES[category]["missing_fields"]
        return list(dict.fromkeys(cat_fields + missing))
    return missing


def _compute_personnel_missing(row: dict, category: Optional[str]) -> list[str]:
    missing = []
    if not row.get("name_uk"):
        missing.append("укр. ім'я")
    if not row.get("pseudo"):
        missing.append("псевдо")
    if not row.get("image"):
        missing.append("зображення")
    if category and category in PERSONNEL_CATEGORIES:
        cat_fields = PERSONNEL_CATEGORIES[category]["missing_fields"]
        return list(dict.fromkeys(cat_fields + missing))
    return missing


def _compute_publisher_missing(row: dict, category: Optional[str]) -> list[str]:
    missing = []
    if not row.get("founded_date"):
        missing.append("дата заснування")
    if not row.get("country") and not row.get("place"):
        missing.append("країна/місце")
    if not row.get("work_type"):
        missing.append("тип робіт")
    if category and category in PUBLISHER_CATEGORIES:
        cat_fields = PUBLISHER_CATEGORIES[category]["missing_fields"]
        return list(dict.fromkeys(cat_fields + missing))
    return missing


def _paginate(items: list, total: int, page: int, limit: int) -> dict:
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, (total + limit - 1) // limit),
    }
