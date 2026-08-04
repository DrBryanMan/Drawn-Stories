from fastapi import APIRouter, Query, HTTPException, Request
from typing import Optional
from ..db import get_db

router = APIRouter(prefix="/api/personnel", tags=["personnel"])

def require_moderator(request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")

def require_admin(request: Request):
    role = request.cookies.get("role")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Потрібні права адміністратора")

@router.delete("/{person_id}")
async def delete_person(person_id: int, request: Request):
    require_admin(request)
    db = get_db()
    person = db.get_one("SELECT id FROM persons WHERE id = %s", [person_id])
    if not person:
        raise HTTPException(status_code=404, detail="Персону не знайдено")
    db.execute("DELETE FROM issue_persons WHERE person_id = %s", [person_id])
    db.execute("DELETE FROM volume_persons WHERE person_id = %s", [person_id])
    db.execute("DELETE FROM persons WHERE id = %s", [person_id])
    return {"message": "Персону успішно видалено з БД"}

@router.get("/{person_id}")
async def get_person_detail(person_id: int):
    db = get_db()

    person = db.get_one(
        """
        SELECT p.id, p.cv_id, p.name, p.name_uk, p.pseudo, p.cv_slug, p.image,
               p.aliases, p.birth, p.death, p.country, p.gender, p.hometown,
               p.website, p.occupation, p.created_at,
               (SELECT COUNT(DISTINCT vp.volume_id) FROM volume_persons vp WHERE vp.person_id = p.id) as volume_count,
               (SELECT COUNT(DISTINCT ip.issue_id) FROM issue_persons ip WHERE ip.person_id = p.id) as issue_count
        FROM persons p
        WHERE p.id = %s
        """,
        [person_id]
    )

    if not person:
        raise HTTPException(status_code=404, detail="Особу не знайдено")

    # Latest volumes contributed to
    person["latest_volumes"] = db.get_all(
        """
        SELECT DISTINCT v.id, v.name, v.name_uk, v.cover_img, v.image, v.lang, v.created_at,
               (SELECT COUNT(*) FROM issues i WHERE i.volume_id = v.id) as issue_count
        FROM volumes v
        JOIN volume_persons vp ON vp.volume_id = v.id
        WHERE vp.person_id = %s
        ORDER BY v.created_at DESC, v.id DESC
        LIMIT 5
        """,
        [person_id]
    )

    # Latest issues contributed to
    person["latest_issues"] = db.get_all(
        """
        SELECT DISTINCT i.id, i.name, i.image, i.issue_number, i.release_date, i.cover_date, i.created_at,
               v.id as volume_id, v.name_uk as volume_name_uk, v.name as volume_name
        FROM issues i
        JOIN issue_persons ip ON ip.issue_id = i.id
        JOIN volumes v ON i.volume_id = v.id
        WHERE ip.person_id = %s
        ORDER BY i.created_at DESC, i.id DESC
        LIMIT 5
        """,
        [person_id]
    )

    return person

@router.put("/{person_id}")
async def update_person(person_id: int, data: dict, request: Request):
    require_moderator(request)
    db = get_db()

    person = db.get_one("SELECT id FROM persons WHERE id = %s", [person_id])
    if not person:
        raise HTTPException(status_code=404, detail="Особу не знайдено")

    def to_null(val):
        return None if val == "" else val

    name = to_null(data.get("name"))
    if not name:
        raise HTTPException(status_code=400, detail="Ім'я особи обов'язкове")

    db.execute(
        """
        UPDATE persons
        SET name = %s,
            name_uk = %s,
            pseudo = %s,
            cv_id = %s,
            cv_slug = %s,
            image = %s,
            aliases = %s,
            birth = %s,
            death = %s,
            country = %s,
            gender = %s,
            hometown = %s,
            website = %s,
            occupation = %s
        WHERE id = %s
        """,
        [
            name,
            to_null(data.get("name_uk")),
            to_null(data.get("pseudo")),
            to_null(data.get("cv_id")),
            to_null(data.get("cv_slug")),
            to_null(data.get("image")),
            to_null(data.get("aliases")),
            to_null(data.get("birth")),
            to_null(data.get("death")),
            to_null(data.get("country")),
            to_null(data.get("gender")),
            to_null(data.get("hometown")),
            to_null(data.get("website")),
            to_null(data.get("occupation")),
            person_id,
        ],
    )

    return {"message": "Дані особи успішно оновлено"}

@router.get("")
async def get_personnel(
    search: Optional[str] = None,
    ids: Optional[str] = None,
    sort: Optional[str] = "issues",
    order_dir: Optional[str] = "desc",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    db = get_db()
    where_parts = []
    params = []

    if search:
        where_parts.append("LOWER(p.name) LIKE %s")
        params.append(f"%{search.lower()}%")

    if ids:
        id_list = [int(x.strip()) for x in ids.split(",") if x.strip().isdigit()]
        if id_list:
            placeholders = ",".join("%s" for _ in id_list)
            where_parts.append(f"p.id IN ({placeholders})")
            params.extend(id_list)

    where_clause = "WHERE " + " AND ".join(where_parts) if where_parts else ""

    # Sort logic
    if sort == "name":
        order_clause = f"p.name {order_dir.upper()}"
    elif sort == "recent":
        order_clause = f"p.created_at {order_dir.upper()}, p.name ASC"
    else:
        # Default to issue appearances
        order_clause = f"issue_count {order_dir.upper()}, p.name ASC"

    count_sql = f"""
        SELECT COUNT(DISTINCT p.id) as count
        FROM persons p
        {where_clause}
    """
    total_row = db.get_one(count_sql, params)
    total = total_row["count"] if total_row else 0

    offset = (page - 1) * limit

    rows = db.get_all(
        f"""
        SELECT p.id, p.cv_id, p.name, p.cv_slug, p.image, p.country, p.hometown, p.occupation,
               (SELECT COUNT(*) FROM issue_persons ip WHERE ip.person_id = p.id) as issue_count
        FROM persons p
        {where_clause}
        ORDER BY {order_clause}
        LIMIT %s OFFSET %s
        """,
        params + [limit, offset],
    )

    return { "items": rows, "total": total, "page": page, "limit": limit }
