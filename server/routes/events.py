from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from ..db import get_db


router = APIRouter(prefix="/api/events", tags=["events"])

IMPORTANCE_VALUES = {"main", "tie-in", "prologue", "epilogue"}


def normalize_importance(value):
    return value if value in IMPORTANCE_VALUES else "main"


def require_moderator(request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")


def get_event_or_404(db, event_id):
    event = db.get_one(
        """
        SELECT e.*,
               (
                   SELECT COUNT(*)
                   FROM event_items ei
                   WHERE ei.event_id = e.id
                     AND ei.item_type = 'issue'
               ) AS issue_count
        FROM events e
        WHERE e.id = %s
        """,
        [event_id],
    )
    if not event:
        raise HTTPException(status_code=404, detail="Подію не знайдено")
    return event


@router.get("")
async def get_events(search: Optional[str] = None, limit: int = 50, offset: int = 0):
    db = get_db()
    params = []
    where = ""

    if search:
        where = "WHERE LOWER(e.name) LIKE %s"
        params.append(f"%{search.lower()}%")

    events = db.get_all(
        f"""
        SELECT e.*,
               (
                   SELECT COUNT(*)
                   FROM event_items ei
                   WHERE ei.event_id = e.id
                     AND ei.item_type = 'issue'
               ) AS issue_count
        FROM events e
        {where}
        ORDER BY e.start_year DESC, e.created_at DESC
        LIMIT %s OFFSET %s
        """,
        [*params, limit, offset],
    )
    total = db.get_one(f"SELECT COUNT(*) AS count FROM events e {where}", params)
    return {"data": events, "total": total["count"] if total else 0}


@router.post("")
async def create_event(data: dict, request: Request):
    require_moderator(request)
    db = get_db()

    if not data.get("name"):
        raise HTTPException(status_code=400, detail="Назва події обов'язкова")

    res = db.get_one(
        """
        INSERT INTO events (name, description, cv_img, start_year, end_year)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
        """,
        [
            data.get("name"),
            data.get("description"),
            data.get("cv_img"),
            data.get("start_year"),
            data.get("end_year"),
        ],
    )
    new_id = res["id"]
    return {"message": "Подію створено", "id": new_id}


@router.get("/{event_id}/issues")
async def get_event_issues(event_id: int):
    db = get_db()
    get_event_or_404(db, event_id)

    items = db.get_all(
        """
        SELECT ei.id AS link_id, ei.order_num, ei.importance,
               i.id, i.cv_id, i.cv_slug, i.name, i.image,
               i.issue_number, i.cover_date, i.release_date,
               v.id AS volume_id,
               v.name AS volume_name,
               v.name_uk AS volume_name_uk
        FROM event_items ei
        JOIN issues i ON i.id = ei.item_id
        LEFT JOIN volumes v ON v.id = i.volume_id
        WHERE ei.event_id = %s
          AND ei.item_type = 'issue'
        ORDER BY ei.order_num ASC, ei.id ASC
        """,
        [event_id],
    )
    return {"data": items}


@router.get("/{event_id}")
async def get_event(event_id: int):
    db = get_db()
    return get_event_or_404(db, event_id)


@router.put("/{event_id}")
async def update_event(event_id: int, data: dict, request: Request):
    require_moderator(request)
    db = get_db()
    get_event_or_404(db, event_id)

    def to_null(val):
        return None if val == "" else val

    name = to_null(data.get("name"))
    if not name:
        raise HTTPException(status_code=400, detail="Назва події обов'язкова")

    db.execute(
        """
        UPDATE events
        SET name = %s,
            description = %s,
            cv_img = %s,
            start_year = %s,
            end_year = %s
        WHERE id = %s
        """,
        [
            name,
            to_null(data.get("description")),
            to_null(data.get("cv_img")),
            to_null(data.get("start_year")),
            to_null(data.get("end_year")),
            event_id,
        ],
    )
    return {"message": "Подію оновлено"}


@router.delete("/{event_id}")
async def delete_event(event_id: int, request: Request):
    require_moderator(request)
    db = get_db()
    get_event_or_404(db, event_id)
    db.conn.execute("DELETE FROM event_items WHERE event_id = %s", [event_id])
    db.conn.execute("DELETE FROM events WHERE id = %s", [event_id])
    db.conn.commit()
    return {"message": "Подію видалено"}


@router.post("/{event_id}/issues")
async def add_issue_to_event(event_id: int, data: dict, request: Request):
    require_moderator(request)
    db = get_db()
    get_event_or_404(db, event_id)

    issue_id = data.get("issue_id")
    if not issue_id:
        raise HTTPException(status_code=400, detail="issue_id обов'язковий")

    if isinstance(issue_id, dict):
        issue_id = issue_id.get("id")
        if not issue_id:
            raise HTTPException(status_code=400, detail="Некоректний формат issue_id")

    issue = db.get_one("SELECT id FROM issues WHERE id = %s", [issue_id])
    if not issue:
        raise HTTPException(status_code=404, detail="Випуск не знайдено")

    max_order = db.get_one(
        """
        SELECT COALESCE(MAX(order_num), 0) AS order_num
        FROM event_items
        WHERE event_id = %s
          AND item_type = 'issue'
        """,
        [event_id],
    )

    try:
        db.execute(
            """
            INSERT INTO event_items (event_id, item_id, item_type, order_num, importance)
            VALUES (%s, %s, 'issue', %s, %s)
            """,
            [
                event_id,
                issue_id,
                (max_order["order_num"] if max_order else 0) + 1,
                normalize_importance(data.get("importance")),
            ],
        )
    except Exception as exc:
        if "UNIQUE" in str(exc).upper():
            raise HTTPException(status_code=400, detail="Випуск уже є в події")
        raise

    return {"message": "Випуск додано до події"}


@router.patch("/{event_id}/items/{link_id}")
async def update_event_item(event_id: int, link_id: int, data: dict, request: Request):
    require_moderator(request)
    db = get_db()
    item = db.get_one(
        "SELECT id FROM event_items WHERE id = %s AND event_id = %s",
        [link_id, event_id],
    )
    if not item:
        raise HTTPException(status_code=404, detail="Елемент події не знайдено")

    fields = []
    params = []
    if "importance" in data:
        fields.append("importance = ?")
        params.append(normalize_importance(data.get("importance")))
    if "order_num" in data:
        fields.append("order_num = ?")
        params.append(int(data.get("order_num") or 0))
    if not fields:
        return {"message": "Немає змін"}

    db.execute(
        f"UPDATE event_items SET {', '.join(fields)} WHERE id = %s AND event_id = %s",
        [*params, link_id, event_id],
    )
    return {"message": "Елемент події оновлено"}


@router.put("/{event_id}/items/{link_id}/reorder")
async def reorder_event_item(event_id: int, link_id: int, data: dict, request: Request):
    require_moderator(request)
    db = get_db()
    position = int(data.get("position") or 0)
    if position < 1:
        raise HTTPException(status_code=400, detail="position обов'язковий")

    item = db.get_one(
        "SELECT id, item_type FROM event_items WHERE id = %s AND event_id = %s",
        [link_id, event_id],
    )
    if not item:
        raise HTTPException(status_code=404, detail="Елемент події не знайдено")

    items = db.get_all(
        """
        SELECT id
        FROM event_items
        WHERE event_id = %s
          AND item_type = %s
        ORDER BY order_num ASC, id ASC
        """,
        [event_id, item["item_type"]],
    )
    ordered = [row["id"] for row in items if row["id"] != link_id]
    target = max(0, min(position - 1, len(ordered)))
    ordered.insert(target, link_id)

    for index, item_id in enumerate(ordered, start=1):
        db.conn.execute("UPDATE event_items SET order_num = %s WHERE id = %s", [index, item_id])
    db.conn.commit()
    return {"message": "Порядок оновлено"}


@router.delete("/{event_id}/items/{link_id}")
async def remove_event_item(event_id: int, link_id: int, request: Request):
    require_moderator(request)
    db = get_db()
    db.execute(
        "DELETE FROM event_items WHERE id = %s AND event_id = %s",
        [link_id, event_id],
    )
    return {"message": "Елемент видалено з події"}
