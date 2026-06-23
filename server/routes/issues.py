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
            ir.story_id,
            ir.story_foreign_name,
            
            o.name AS original_name,
            o.issue_number AS original_number,
            vo.name AS original_volume_name,
            vo.name_uk AS original_volume_name_uk,
            vo.lang AS original_volume_lang,
            
            r.name AS reprint_name,
            r.issue_number AS reprint_number,
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
        LEFT JOIN issue_stories s ON ir.story_id = s.id
        WHERE ir.original_id = ? OR ir.reprint_id = ?
        """,
        [issue_id, issue_id]
    )

    return {
        "issue": issue,
        "collections": collections,
        "prev_issue": prev_issue,
        "next_issue": next_issue,
        "event_contexts": event_contexts,
        "arc_contexts": arc_contexts,
        "stories": stories,
        "persons": persons,
        "reprints": reprints
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
                
            if s_id and int(s_id) in current_story_ids:
                s_id_int = int(s_id)
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
    story_id = data.get("story_id")
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
        WHERE original_id = ? AND reprint_id = ? AND (story_id = ? OR (story_id IS NULL AND ? IS NULL))
        """,
        [original_id, reprint_id, story_id, story_id]
    )
    if existing:
        raise HTTPException(status_code=400, detail="Цей зв'язок репринту вже додано")
        
    db.execute(
        """
        INSERT INTO issue_reprints (original_id, reprint_id, story_id, story_foreign_name)
        VALUES (?, ?, ?, ?)
        """,
        [original_id, reprint_id, story_id, story_foreign_name]
    )
    return {"message": "Репринт успішно додано"}


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
