from fastapi import APIRouter, HTTPException, Request, Query
from ..db import get_db
from typing import Optional

router = APIRouter(prefix="/api/issues", tags=["issues"])


def get_context_issue(db, issue_id):
    if not issue_id:
        return None
    return db.get_one(
        """
        SELECT id, issue_number, name, cv_img
        FROM issues
        WHERE id = ?
        """,
        [issue_id],
    )


def hydrate_context_issue_nav(db, contexts):
    hydrated = []
    for context in contexts:
        item = dict(context)
        item["prev_issue"] = get_context_issue(db, item.get("prev_issue_id"))
        item["next_issue"] = get_context_issue(db, item.get("next_issue_id"))
        hydrated.append(item)
    return hydrated


def get_issue_appearances(db, issue_id):
    characters = db.get_all(
        """
        SELECT c.id, c.name, c.real_name, c.name_uk, c.real_name_uk, c.creators, c.cv_slug, c.image, 
               c.portret_img, c.costume_img, c.portret_costume_img,
               ic.story_num, ic.status, ic.comment, ic.role, ic.team_id 
        FROM issue_characters ic 
        JOIN characters c ON ic.character_id = c.id 
        WHERE ic.issue_id = ? 
        ORDER BY COALESCE(c.name_uk, c.name) ASC
        """,
        [issue_id]
    )
    teams = db.get_all(
        """
        SELECT t.id, t.name, t.name_uk, t.cv_slug, it.story_num, it.status, it.comment 
        FROM issue_teams it 
        JOIN teams t ON it.team_id = t.id 
        WHERE it.issue_id = ? 
        ORDER BY COALESCE(t.name_uk, t.name) ASC
        """,
        [issue_id]
    )
    locations = db.get_all(
        """
        SELECT l.id, l.name, l.name_uk, l.cv_slug, il.story_num, il.status, il.comment 
        FROM issue_locations il 
        JOIN locations l ON il.location_id = l.id 
        WHERE il.issue_id = ? 
        ORDER BY COALESCE(l.name_uk, l.name) ASC
        """,
        [issue_id]
    )
    concepts = db.get_all(
        """
        SELECT c.id, c.name, c.name_uk, c.cv_slug, ic.story_num, ic.status, ic.comment 
        FROM issue_concepts ic 
        JOIN concepts c ON ic.concept_id = c.id 
        WHERE ic.issue_id = ? 
        ORDER BY COALESCE(c.name_uk, c.name) ASC
        """,
        [issue_id]
    )
    objects = db.get_all(
        """
        SELECT o.id, o.name, o.name_uk, o.cv_slug, io.story_num, io.status, io.comment 
        FROM issue_objects io 
        JOIN objects o ON io.object_id = o.id 
        WHERE io.issue_id = ? 
        ORDER BY COALESCE(o.name_uk, o.name) ASC
        """,
        [issue_id]
    )
    return {
        "characters": [dict(x) for x in characters],
        "teams": [dict(x) for x in teams],
        "locations": [dict(x) for x in locations],
        "concepts": [dict(x) for x in concepts],
        "objects": [dict(x) for x in objects]
    }

@router.get("/appearances/search/{app_type}")
async def search_appearance_entities(app_type: str, search: str = ""):
    db = get_db()
    if app_type not in ["characters", "teams", "locations", "concepts", "objects"]:
        raise HTTPException(status_code=400, detail="Некоректний тип появи")
    
    query = f"%{search}%"
    
    if app_type == "characters":
        rows = db.get_all(
            """
            SELECT id, name, real_name, name_uk, real_name_uk, creators, cv_slug, image, 
                   portret_img, costume_img, portret_costume_img
            FROM characters 
            WHERE name LIKE ? OR real_name LIKE ? OR name_uk LIKE ? OR real_name_uk LIKE ?
            ORDER BY COALESCE(name_uk, name) ASC LIMIT 30
            """,
            [query, query, query, query]
        )
    else:
        rows = db.get_all(
            f"""
            SELECT id, name, name_uk, cv_slug 
            FROM {app_type} 
            WHERE name LIKE ? OR name_uk LIKE ?
            ORDER BY COALESCE(name_uk, name) ASC LIMIT 30
            """,
            [query, query]
        )
        
    return [dict(r) for r in rows]


@router.get("/{issue_id}")
async def get_issue_detail(issue_id: int):
    db = get_db()

    issue = db.get_one(
        """
        SELECT i.*,
               v.id          AS volume_id,
               v.name        AS volume_name,
               v.name_uk     AS volume_name_uk,
               v.cv_img      AS volume_cv_img,
               v.cv_slug     AS volume_cv_slug,
               v.hikka_slug  AS volume_hikka_slug,
               p.id          AS publisher_id,
               p.name        AS publisher_name,
               p.cv_slug     AS publisher_cv_slug
        FROM issues i
        LEFT JOIN volumes v ON i.volume_id = v.id
        LEFT JOIN publishers p ON v.publisher = p.id
        WHERE i.id = ?
        """,
        [issue_id],
    )

    if not issue:
        raise HTTPException(status_code=404, detail="Випуск не знайдено")

    issue = dict(issue)

    # Збірники які містять цей випуск
    collections = db.get_all(
        """
        SELECT c.id, c.name, c.cv_img, c.cv_id, c.cv_slug,
               c.volume_id, c.release_date, c.cover_date,
               v.name AS volume_name, v.name_uk AS volume_name_uk
        FROM collection_issues ci
        JOIN collections c ON ci.collection_id = c.id
        LEFT JOIN volumes v ON c.volume_id = v.id
        WHERE ci.issue_id = ?
        ORDER BY c.name ASC
        """,
        [issue_id],
    )

    # Навігація: попередній та наступний випуски в межах тому
    prev_issue = None
    next_issue = None

    if issue.get("volume_id"):
        volume_id = issue["volume_id"]
        issue_num = issue.get("issue_number")

        # Усі випуски тому, відсортовані
        siblings = db.get_all(
            """
            SELECT id, issue_number, name, cv_img
            FROM issues
            WHERE volume_id = ?
            ORDER BY CAST(issue_number AS REAL) ASC, issue_number ASC
            """,
            [volume_id],
        )

        current_idx = next(
            (i for i, s in enumerate(siblings) if s["id"] == issue_id), None
        )

        if current_idx is not None:
            if current_idx > 0:
                prev_issue = dict(siblings[current_idx - 1])
            if current_idx < len(siblings) - 1:
                next_issue = dict(siblings[current_idx + 1])

    event_contexts = db.get_all(
        """
        SELECT e.id, e.name, e.cv_img, e.start_year, e.end_year,
               ei.importance, ei.order_num,
               (
                   SELECT COUNT(*)
                   FROM event_items ei_count
                   WHERE ei_count.event_id = e.id
                     AND ei_count.item_type = 'issue'
               ) AS issue_count,
               (
                   SELECT i_prev.id
                   FROM event_items ei_prev
                   JOIN issues i_prev ON i_prev.id = ei_prev.item_id
                   WHERE ei_prev.event_id = e.id
                     AND ei_prev.item_type = 'issue'
                     AND ei_prev.order_num < ei.order_num
                   ORDER BY ei_prev.order_num DESC
                   LIMIT 1
               ) AS prev_issue_id,
               (
                   SELECT i_next.id
                   FROM event_items ei_next
                   JOIN issues i_next ON i_next.id = ei_next.item_id
                   WHERE ei_next.event_id = e.id
                     AND ei_next.item_type = 'issue'
                     AND ei_next.order_num > ei.order_num
                   ORDER BY ei_next.order_num ASC
                   LIMIT 1
               ) AS next_issue_id
        FROM event_items ei
        JOIN events e ON e.id = ei.event_id
        WHERE ei.item_id = ?
          AND ei.item_type = 'issue'
        ORDER BY ei.order_num ASC, e.name ASC
        """,
        [issue_id],
    )

    arc_contexts = db.get_all(
        """
        SELECT ro.id, ro.name, ro.cv_img, roi.order_num,
               (
                   SELECT COUNT(*)
                   FROM reading_order_issues roi_count
                   WHERE roi_count.reading_order_id = ro.id
               ) AS issue_count,
               (
                   SELECT i_prev.id
                   FROM reading_order_issues roi_prev
                   JOIN issues i_prev ON i_prev.id = roi_prev.issue_id
                   WHERE roi_prev.reading_order_id = ro.id
                     AND roi_prev.order_num < roi.order_num
                   ORDER BY roi_prev.order_num DESC
                   LIMIT 1
               ) AS prev_issue_id,
               (
                   SELECT i_next.id
                   FROM reading_order_issues roi_next
                   JOIN issues i_next ON i_next.id = roi_next.issue_id
                   WHERE roi_next.reading_order_id = ro.id
                     AND roi_next.order_num > roi.order_num
                   ORDER BY roi_next.order_num ASC
                   LIMIT 1
               ) AS next_issue_id
        FROM reading_order_issues roi
        JOIN reading_orders ro ON ro.id = roi.reading_order_id
        WHERE roi.issue_id = ?
        ORDER BY roi.order_num ASC, ro.name ASC
        """,
        [issue_id],
    )
    event_contexts = hydrate_context_issue_nav(db, event_contexts)
    arc_contexts = hydrate_context_issue_nav(db, arc_contexts)

    # Отримуємо історії, наявні у випуску
    stories = db.get_all(
        """
        SELECT id, name_original, name_ua, plot, order_num
        FROM issue_stories
        WHERE issue_id = ?
        ORDER BY order_num ASC, id ASC
        """,
        [issue_id],
    )

    # Отримуємо творців випуску
    persons = db.get_all(
        """
        SELECT ip.id, ip.person_id, ip.role, ip.story_id,
               p.name, p.image, p.cv_slug
        FROM issue_persons ip
        JOIN persons p ON ip.person_id = p.id
        WHERE ip.issue_id = ?
        ORDER BY p.name ASC
        """,
        [issue_id],
    )

    # Отримуємо репринти
    reprints = db.get_all(
        """
        SELECT 
            ir.id,
            ir.original_id,
            ir.reprint_id,
            ir.story_num,
            ir.story_foreign_name,
            
            o.name AS original_name,
            o.issue_number AS original_number,
            o.cv_img AS original_cv_img,
            o.description AS original_description,
            vo.name AS original_volume_name,
            vo.name_uk AS original_volume_name_uk,
            vo.lang AS original_volume_lang,
            
            r.name AS reprint_name,
            r.issue_number AS reprint_number,
            r.cv_img AS reprint_cv_img,
            vr.name AS reprint_volume_name,
            vr.name_uk AS reprint_volume_name_uk,
            vr.lang AS reprint_volume_lang,
            
            s.name_original AS story_name_original,
            s.name_ua AS story_name_ua
        FROM issue_reprints ir
        JOIN issues o ON ir.original_id = o.id
        JOIN volumes vo ON o.volume_id = vo.id
        JOIN issues r ON ir.reprint_id = r.id
        JOIN volumes vr ON r.volume_id = vr.id
        LEFT JOIN issue_stories s ON s.issue_id = ir.original_id AND ir.story_num = s.order_num
        WHERE ir.original_id = ? OR ir.reprint_id = ?
        """,
        [issue_id, issue_id]
    )


    # Динамічно імпортуємо історії та стаф з оригінальних випусків (якщо цей випуск є репринтом)
    originals = [r for r in reprints if r["reprint_id"] == issue_id]
    imported_stories = []
    imported_persons = []
    
    for orig in originals:
        orig_id = orig["original_id"]
        orig_vol_name = orig["original_volume_name_uk"] or orig["original_volume_name"]
        orig_issue_num = orig["original_number"]
        story_order = orig["story_num"] # Тепер story_num зберігає order_num історії
        story_foreign_name = orig["story_foreign_name"]
        
        # 1. Якщо вказано конкретну оригінальну історію (0 або більше)
        if story_order is not None:
            # Шукаємо оригінальну історію за її order_num та issue_id
            s = None
            if story_order > 0:
                s = db.get_one(
                    "SELECT id, name_original, name_ua, plot, order_num FROM issue_stories WHERE issue_id = ? AND order_num = ?",
                    [orig_id, story_order]
                )
            
            if s:
                s = dict(s)
                if story_foreign_name:
                    s["name_ua"] = story_foreign_name
                
                s["is_imported"] = True
                s["original_volume_name"] = orig_vol_name
                s["original_issue_number"] = orig_issue_num
                s["original_issue_id"] = orig_id
                s["story_order"] = story_order
                
                client_story_id = f"imported_{s['id']}"
                s["client_story_id"] = client_story_id
                
                # Запобігаємо дублюванню історій
                if not any(x.get("client_story_id") == client_story_id for x in imported_stories):
                    imported_stories.append(s)
                
                p_list = db.get_all(
                    """
                    SELECT ip.id, ip.person_id, ip.role, ip.story_id,
                           p.name, p.image, p.cv_slug
                    FROM issue_persons ip
                    JOIN persons p ON ip.person_id = p.id
                    WHERE ip.issue_id = ? AND ip.story_id = ?
                    """,
                    [orig_id, s["id"]]
                )
                for p in p_list:
                    p = dict(p)
                    p["is_imported"] = True
                    p["original_issue_id"] = orig_id
                    p["original_volume_name"] = orig_vol_name
                    p["original_issue_number"] = orig_issue_num
                    p["story_id"] = client_story_id
                    imported_persons.append(p)
            else:
                # Якщо історія з таким order_num не знайдена, або це 0 (основна історія без конкретної сутності в issue_stories)
                virtual_story_id = f"virtual_{orig_id}_{story_order}"
                
                # Спробуємо знайти назву першої історії або назву самого випуску для 0
                default_name = orig["original_name"] or "Основна історія"
                
                virtual_story = {
                    "id": virtual_story_id,
                    "name_original": default_name,
                    "name_ua": story_foreign_name or default_name,
                    "plot": orig["original_description"] or "",
                    "order_num": story_order,
                    "story_order": story_order,
                    "is_imported": True,
                    "original_volume_name": orig_vol_name,
                    "original_issue_number": orig_issue_num,
                    "original_issue_id": orig_id,
                    "client_story_id": virtual_story_id
                }
                if not any(x.get("client_story_id") == virtual_story_id for x in imported_stories):
                    imported_stories.append(virtual_story)
                
                # Завантажуємо стаф випуску, не прив'язаний до конкретних історій (тобто основний стаф оригінального випуску)
                p_list = db.get_all(
                    """
                    SELECT ip.id, ip.person_id, ip.role, ip.story_id,
                           p.name, p.image, p.cv_slug
                    FROM issue_persons ip
                    JOIN persons p ON ip.person_id = p.id
                    WHERE ip.issue_id = ? AND ip.story_id IS NULL
                    """,
                    [orig_id]
                )
                for p in p_list:
                    p = dict(p)
                    p["is_imported"] = True
                    p["original_issue_id"] = orig_id
                    p["original_volume_name"] = orig_vol_name
                    p["original_issue_number"] = orig_issue_num
                    p["story_id"] = virtual_story_id
                    imported_persons.append(p)
        else:
            # 2. Якщо історію взагалі не вказано (story_id IS NULL), завантажуємо всі історії та весь стаф оригіналу
            orig_stories = db.get_all(
                "SELECT id, name_original, name_ua, plot, order_num FROM issue_stories WHERE issue_id = ? ORDER BY order_num ASC, id ASC",
                [orig_id]
            )
            
            if not orig_stories:
                virtual_story_id = f"virtual_{orig_id}_all"
                virtual_story = {
                    "id": virtual_story_id,
                    "name_original": orig["original_name"] or "Основна історія",
                    "name_ua": story_foreign_name or (orig["original_name"] or "Основна історія"),
                    "plot": orig["original_description"] or "",
                    "order_num": 1,
                    "is_imported": True,
                    "original_volume_name": orig_vol_name,
                    "original_issue_number": orig_issue_num,
                    "original_issue_id": orig_id,
                    "client_story_id": virtual_story_id
                }
                if not any(x.get("client_story_id") == virtual_story_id for x in imported_stories):
                    imported_stories.append(virtual_story)
                
                p_list = db.get_all(
                    """
                    SELECT ip.id, ip.person_id, ip.role, ip.story_id,
                           p.name, p.image, p.cv_slug
                    FROM issue_persons ip
                    JOIN persons p ON ip.person_id = p.id
                    WHERE ip.issue_id = ? AND ip.story_id IS NULL
                    """,
                    [orig_id]
                )
                for p in p_list:
                    p = dict(p)
                    p["is_imported"] = True
                    p["original_issue_id"] = orig_id
                    p["original_volume_name"] = orig_vol_name
                    p["original_issue_number"] = orig_issue_num
                    p["story_id"] = virtual_story_id
                    imported_persons.append(p)
            else:
                for s in orig_stories:
                    s = dict(s)
                    if story_foreign_name and len(orig_stories) == 1:
                        s["name_ua"] = story_foreign_name
                    s["is_imported"] = True
                    s["original_volume_name"] = orig_vol_name
                    s["original_issue_number"] = orig_issue_num
                    s["original_issue_id"] = orig_id
                    
                    client_story_id = f"imported_{s['id']}"
                    s["client_story_id"] = client_story_id
                    if not any(x.get("client_story_id") == client_story_id for x in imported_stories):
                        imported_stories.append(s)
                    
                    p_list = db.get_all(
                        """
                        SELECT ip.id, ip.person_id, ip.role, ip.story_id,
                               p.name, p.image, p.cv_slug
                        FROM issue_persons ip
                        JOIN persons p ON ip.person_id = p.id
                        WHERE ip.issue_id = ? AND ip.story_id = ?
                        """,
                        [orig_id, s["id"]]
                    )
                    for p in p_list:
                        p = dict(p)
                        p["is_imported"] = True
                        p["original_issue_id"] = orig_id
                        p["original_volume_name"] = orig_vol_name
                        p["original_issue_number"] = orig_issue_num
                        p["story_id"] = client_story_id
                        imported_persons.append(p)
                
                p_list = db.get_all(
                    """
                    SELECT ip.id, ip.person_id, ip.role, ip.story_id,
                           p.name, p.image, p.cv_slug
                    FROM issue_persons ip
                    JOIN persons p ON ip.person_id = p.id
                    WHERE ip.issue_id = ? AND ip.story_id IS NULL
                    """,
                    [orig_id]
                )
                for p in p_list:
                    p = dict(p)
                    p["is_imported"] = True
                    p["original_issue_id"] = orig_id
                    p["original_volume_name"] = orig_vol_name
                    p["original_issue_number"] = orig_issue_num
                    p["story_id"] = None
                    imported_persons.append(p)

    # ── Побудова stories_list та додавання появ ─────
    current_appearances = get_issue_appearances(db, issue_id)
    has_local_appearances = any(current_appearances.values())
    raw_issue_persons = [p for p in persons if not p["story_id"]]
    has_local_staff = len(raw_issue_persons) > 0
    has_local_plot = bool(issue.get("description"))
    has_local_main_content = has_local_appearances or has_local_staff or has_local_plot

    stories_list = [dict(s) for s in stories]

    # Якщо немає локальних історій в БД, але є контент (або це не репринт)
    if not stories_list:
        if not originals or has_local_main_content:
            stories_list.append({
                "id": f"local_main_{issue_id}",
                "name_original": issue["name"] or "Основна історія",
                "name_ua": issue["name"] or "Основна історія",
                "plot": issue["description"] or "",
                "order_num": 0,
                "is_imported": False,
                "is_virtual": True
            })

    if imported_stories:
        stories_list = stories_list + imported_stories

    def filter_appearances_by_story(appearances, story_num):
        return {
            "characters": [c for c in appearances.get("characters", []) if c.get("story_num") == story_num],
            "teams": [t for t in appearances.get("teams", []) if t.get("story_num") == story_num],
            "locations": [l for l in appearances.get("locations", []) if l.get("story_num") == story_num],
            "concepts": [c for c in appearances.get("concepts", []) if c.get("story_num") == story_num],
            "objects": [o for o in appearances.get("objects", []) if o.get("story_num") == story_num],
        }

    # Прив'язуємо появи
    for story in stories_list:
        if story.get("is_imported"):
            orig_issue_id = story.get("original_issue_id")
            story_order = story.get("story_order", 0)
            orig_apps = get_issue_appearances(db, orig_issue_id)
            story["appearances"] = filter_appearances_by_story(orig_apps, story_order)
        else:
            story_order = story.get("order_num", 0)
            story["appearances"] = filter_appearances_by_story(current_appearances, story_order)

    if imported_persons:
        persons = list(persons) + imported_persons

    return {
        "issue": issue,
        "collections": collections,
        "prev_issue": prev_issue,
        "next_issue": next_issue,
        "event_contexts": event_contexts,
        "arc_contexts": arc_contexts,
        "stories": stories_list,
        "persons": persons,
        "reprints": reprints,
        "appearances": current_appearances
    }

@router.get("")
async def get_issues(
    name: Optional[str] = None,
    volume_name: Optional[str] = None,
    issue_number: Optional[str] = None,
    ds_id: Optional[int] = None,
    volume_id: Optional[int] = None,
    hikka_slug: Optional[str] = None,
    cv_vol_id: Optional[int] = None,
    exact: bool = False,
    limit: int = Query(100, ge=1, le=500)
):
    db = get_db()
    clauses = []
    params = []

    if ds_id:
        clauses.append("i.id = ?")
        params.append(ds_id)
    if volume_id:
        clauses.append("i.volume_id = ?")
        params.append(volume_id)
    if hikka_slug:
        clauses.append("ULOWER(v.hikka_slug) LIKE ?")
        params.append(f"%{hikka_slug.lower()}%")
    if cv_vol_id:
        clauses.append("v.cv_id = ?")
        params.append(cv_vol_id)
    
    if name:
        if exact:
            clauses.append("ULOWER(i.name) = ?")
            params.append(name.lower())
        else:
            words = [w.strip() for w in name.split() if w.strip()]
            if words:
                name_parts = []
                for word in words:
                    name_parts.append("ULOWER(i.name) LIKE ?")
                    params.append(f"%{word.lower()}%")
                clauses.append(f"({' AND '.join(name_parts)})")

    if volume_name:
        if exact:
            clauses.append("(ULOWER(v.name) = ? OR ULOWER(v.name_uk) = ?)")
            params.extend([volume_name.lower(), volume_name.lower()])
        else:
            words = [w.strip() for w in volume_name.split() if w.strip()]
            if words:
                vol_parts = []
                for word in words:
                    vol_parts.append("(ULOWER(v.name) LIKE ? OR ULOWER(v.name_uk) LIKE ?)")
                    params.extend([f"%{word.lower()}%", f"%{word.lower()}%"])
                clauses.append(f"({' AND '.join(vol_parts)})")

    if issue_number:
        clauses.append("i.issue_number = ?")
        params.append(issue_number)

    if not clauses:
        return {"data": [], "total": 0}

    where = " WHERE " + " AND ".join(clauses)
    query = f"""
        SELECT i.*, v.name as volume_name, v.name_uk as volume_name_uk
        FROM issues i
        LEFT JOIN volumes v ON i.volume_id = v.id
        {where}
        ORDER BY COALESCE(v.name_uk, v.name) ASC, CAST(i.issue_number AS FLOAT) ASC, i.issue_number ASC
        LIMIT ?
    """
    items = db.get_all(query, params + [limit])
    return {"data": items, "total": len(items)}

@router.post("")
async def create_issue(data: dict):
    db = get_db()
    
    if not data.get("issue_number") and not data.get("name"):
        raise HTTPException(status_code=400, detail="Номер випуску або назва обов'язкові")

    columns = []
    placeholders = []
    params = []
    
    allowed_fields = [
        "name", "issue_number", "volume_id", "cv_id", "cv_slug", 
        "cv_img", "cover_date", "release_date", "description"
    ]
    
    for key, value in data.items():
        if key in allowed_fields and value is not None:
            if value == "":
                value = None
            columns.append(key)
            placeholders.append("?")
            params.append(value)
            
    if not columns:
        raise HTTPException(status_code=400, detail="Немає даних для збереження")

    sql = f"INSERT INTO issues ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
    db.execute(sql, params)
    
    new_id = db.get_one("SELECT last_insert_rowid() as id")["id"]
    return {"message": "Випуск успішно створено", "id": new_id}


def require_moderator(request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")


@router.put("/{issue_id}")
async def update_issue(issue_id: int, data: dict, request: Request):
    require_moderator(request)
    db = get_db()
    
    # Check if issue exists
    issue = db.get_one("SELECT id FROM issues WHERE id = ?", [issue_id])
    if not issue:
        raise HTTPException(status_code=404, detail="Випуск не знайдено")

    fields = []
    params = []
    
    allowed_fields = [
        "name", "issue_number", "volume_id", "cv_id", "cv_slug", 
        "cv_img", "cover_date", "release_date", "description", "pages"
    ]
    
    for key, value in data.items():
        if key in allowed_fields:
            if value == "":
                value = None
            fields.append(f"{key} = ?")
            params.append(value)
            
    if fields:
        params.append(issue_id)
        db.execute(
            f"UPDATE issues SET {', '.join(fields)} WHERE id = ?",
            params
        )
        
    # Sync stories and staff if present in the payload
    if "stories" in data:
        incoming_stories = data["stories"]
        current_stories = db.get_all("SELECT id FROM issue_stories WHERE issue_id = ?", [issue_id])
        current_story_ids = {row["id"] for row in current_stories}
        
        incoming_story_ids = set()
        story_ids_by_index = {}
        
        for idx, story in enumerate(incoming_stories):
            s_id = story.get("id")
            name_orig = story.get("name_original")
            name_ua = story.get("name_ua")
            order_num = story.get("order_num", 0)
            
            try:
                order_num = int(order_num) if order_num is not None else 0
            except (ValueError, TypeError):
                order_num = 0
                
            is_local = False
            s_id_int = None
            if s_id is not None:
                try:
                    s_id_int = int(s_id)
                    if s_id_int in current_story_ids:
                        is_local = True
                except (ValueError, TypeError):
                    pass
                
            if is_local:
                db.execute(
                    """
                    UPDATE issue_stories
                    SET name_original = ?, name_ua = ?, order_num = ?
                    WHERE id = ? AND issue_id = ?
                    """,
                    [name_orig, name_ua, order_num, s_id_int, issue_id]
                )
                incoming_story_ids.add(s_id_int)
                story_ids_by_index[idx] = s_id_int
            else:
                db.execute(
                    """
                    INSERT INTO issue_stories (issue_id, name_original, name_ua, order_num)
                    VALUES (?, ?, ?, ?)
                    """,
                    [issue_id, name_orig, name_ua, order_num]
                )
                new_id = db.get_one("SELECT last_insert_rowid() as id")["id"]
                story_ids_by_index[idx] = new_id
                
        to_delete = current_story_ids - incoming_story_ids
        if to_delete:
            placeholders = ",".join("?" for _ in to_delete)
            db.execute(
                f"DELETE FROM issue_stories WHERE issue_id = ? AND id IN ({placeholders})",
                [issue_id, *to_delete]
            )

        # Sync staff if present in the payload
        if "staff" in data:
            incoming_staff = data["staff"]
            db.execute("DELETE FROM issue_persons WHERE issue_id = ?", [issue_id])
            for s in incoming_staff:
                person_id = s.get("person_id")
                role = s.get("role")
                story_idx = s.get("story_index", -1)
                
                real_story_id = None
                if story_idx is not None and story_idx != -1:
                    real_story_id = story_ids_by_index.get(story_idx)
                
                if person_id and role:
                    db.execute(
                        """
                        INSERT OR IGNORE INTO issue_persons (issue_id, person_id, role, story_id)
                        VALUES (?, ?, ?, ?)
                        """,
                        [issue_id, person_id, role, real_story_id]
                    )

        # Sync appearances if present in the payload
        appearance_types = ["characters", "teams", "locations", "concepts", "objects"]
        for t in appearance_types:
            if t in data:
                incoming_list = data[t]
                table_name = f"issue_{t}"
                col_name = "character_id" if t == "characters" else f"{t[:-1]}_id"
                
                # Delete existing entries for this issue
                db.execute(f"DELETE FROM {table_name} WHERE issue_id = ?", [issue_id])
                
                for item in incoming_list:
                    entity_id = item.get("id") or item.get(col_name)
                    story_num = item.get("story_num", 0)
                    status = item.get("status")
                    comment = item.get("comment")
                    
                    if not entity_id:
                        continue
                        
                    if t == "characters":
                        role = item.get("role")
                        team_id = item.get("team_id")
                        db.execute(
                            f"""
                            INSERT OR IGNORE INTO {table_name} (issue_id, character_id, story_num, status, comment, role, team_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                            """,
                            [issue_id, entity_id, story_num, status, comment, role, team_id]
                        )
                    else:
                        db.execute(
                            f"""
                            INSERT OR IGNORE INTO {table_name} (issue_id, {col_name}, story_num, status, comment)
                            VALUES (?, ?, ?, ?, ?)
                            """,
                            [issue_id, entity_id, story_num, status, comment]
                        )
        
    return {"message": "Випуск успішно оновлено"}


@router.delete("/{issue_id}")
async def delete_issue(issue_id: int, request: Request):
    require_moderator(request)
    db = get_db()
    
    # Check if issue exists
    issue = db.get_one("SELECT id FROM issues WHERE id = ?", [issue_id])
    if not issue:
        raise HTTPException(status_code=404, detail="Випуск не знайдено")
        
    # Delete issue
    db.execute("DELETE FROM issues WHERE id = ?", [issue_id])
    
    return {"message": "Випуск успішно видалено"}


@router.post("/{issue_id}/reprints")
async def add_issue_reprint(issue_id: int, data: dict, request: Request):
    require_moderator(request)
    db = get_db()
    
    original_id = data.get("original_id")
    reprint_id = data.get("reprint_id")
    story_num = data.get("story_num")
    story_foreign_name = data.get("story_foreign_name")
    
    if not original_id or not reprint_id:
        raise HTTPException(status_code=400, detail="original_id та reprint_id обов'язкові")
        
    if issue_id not in (original_id, reprint_id):
        raise HTTPException(status_code=400, detail="Один з випусків має відповідати поточному випуску")
        
    # Перевіримо чи випуски існують
    orig_issue = db.get_one("SELECT id FROM issues WHERE id = ?", [original_id])
    repr_issue = db.get_one("SELECT id FROM issues WHERE id = ?", [reprint_id])
    if not orig_issue or not repr_issue:
        raise HTTPException(status_code=404, detail="Випуск не знайдено")
        
    # Перевіримо чи вже є такий зв'язок
    existing = db.get_one(
        """
        SELECT id FROM issue_reprints 
        WHERE original_id = ? AND reprint_id = ? AND (story_num = ? OR (story_num IS NULL AND ? IS NULL))
        """,
        [original_id, reprint_id, story_num, story_num]
    )
    if existing:
        raise HTTPException(status_code=400, detail="Цей зв'язок репринту вже додано")
        
    db.execute(
        """
        INSERT INTO issue_reprints (original_id, reprint_id, story_num, story_foreign_name)
        VALUES (?, ?, ?, ?)
        """,
        [original_id, reprint_id, story_num, story_foreign_name]
    )
    return {"message": "Репринт успішно додано"}


@router.put("/reprints/{reprint_link_id}")
async def update_issue_reprint(reprint_link_id: int, data: dict, request: Request):
    require_moderator(request)
    db = get_db()
    
    original_id = data.get("original_id")
    reprint_id = data.get("reprint_id")
    story_num = None if data.get("story_num") == "" else data.get("story_num")
    story_foreign_name = None if data.get("story_foreign_name") == "" else data.get("story_foreign_name")
    
    if not original_id or not reprint_id:
        raise HTTPException(status_code=400, detail="original_id та reprint_id обов'язкові")
        
    # Перевіримо чи зв'язок існує
    link = db.get_one("SELECT id FROM issue_reprints WHERE id = ?", [reprint_link_id])
    if not link:
        raise HTTPException(status_code=404, detail="Зв'язок репринту не знайдено")
        
    # Перевіримо чи випуски існують
    orig_issue = db.get_one("SELECT id FROM issues WHERE id = ?", [original_id])
    repr_issue = db.get_one("SELECT id FROM issues WHERE id = ?", [reprint_id])
    if not orig_issue or not repr_issue:
        raise HTTPException(status_code=404, detail="Випуск не знайдено")
        
    # Перевіримо чи немає іншого такого зв'язку (виключаючи поточний)
    existing = db.get_one(
        """
        SELECT id FROM issue_reprints 
        WHERE original_id = ? AND reprint_id = ? AND (story_num = ? OR (story_num IS NULL AND ? IS NULL)) AND id != ?
        """,
        [original_id, reprint_id, story_num, story_num, reprint_link_id]
    )
    if existing:
        raise HTTPException(status_code=400, detail="Такий зв'язок репринту вже існує")
        
    db.execute(
        """
        UPDATE issue_reprints
        SET original_id = ?, reprint_id = ?, story_num = ?, story_foreign_name = ?
        WHERE id = ?
        """,
        [original_id, reprint_id, story_num, story_foreign_name, reprint_link_id]
    )
    return {"message": "Репринт успішно оновлено"}


@router.delete("/reprints/{reprint_link_id}")
async def delete_issue_reprint(reprint_link_id: int, request: Request):
    require_moderator(request)
    db = get_db()
    
    # Перевіримо чи зв'язок існує
    link = db.get_one("SELECT id FROM issue_reprints WHERE id = ?", [reprint_link_id])
    if not link:
        raise HTTPException(status_code=404, detail="Зв'язок репринту не знайдено")
        
    db.execute("DELETE FROM issue_reprints WHERE id = ?", [reprint_link_id])
    return {"message": "Репринт успішно видалено"}


@router.put("/appearances/{app_type}/{entity_id}")
async def update_appearance_entity(app_type: str, entity_id: int, data: dict, request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")
    
    if app_type not in ["teams", "locations", "concepts", "objects"]:
        raise HTTPException(status_code=400, detail="Некоректний тип сутності")
        
    db = get_db()
    entity = db.get_one(f"SELECT id FROM {app_type} WHERE id = ?", [entity_id])
    if not entity:
        raise HTTPException(status_code=404, detail="Сутність не знайдено")
        
    name = data.get("name")
    name_uk = data.get("name_uk")
    
    if not name:
        raise HTTPException(status_code=400, detail="Назва обов'язкова")
        
    db.execute(
        f"""
        UPDATE {app_type}
        SET name = ?, name_uk = ?
        WHERE id = ?
        """,
        [name, name_uk, entity_id]
    )
    return {"message": "Сутність успішно оновлена"}
