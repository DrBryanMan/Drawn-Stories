from fastapi import APIRouter, Query, HTTPException, Request
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
        SELECT c.id, c.cv_id, c.name, c.name_uk, c.name_ro, c.real_name, c.cv_slug, c.image, c.gender,
               (SELECT COUNT(*) FROM issue_characters ic WHERE ic.character_id = c.id) as issue_count
        FROM characters c
        {where_clause}
        ORDER BY {order_clause}
        LIMIT ? OFFSET ?
        """,
        params + [limit, offset],
    )

    return { "items": rows, "total": total, "page": page, "limit": limit }


@router.put("/{character_id}")
async def update_character(character_id: int, data: dict, request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")
    
    db = get_db()
    char = db.get_one("SELECT id FROM characters WHERE id = ?", [character_id])
    if not char:
        raise HTTPException(status_code=404, detail="Персонажа не знайдено")
        
    def to_null(val):
        return None if val == "" else val

    name = to_null(data.get("name"))
    name_uk = to_null(data.get("name_uk"))
    name_ro = to_null(data.get("name_ro"))
    real_name = to_null(data.get("real_name"))
    real_name_uk = to_null(data.get("real_name_uk"))
    creators = to_null(data.get("creators"))
    image = to_null(data.get("image"))
    portret_img = to_null(data.get("portret_img"))
    costume_img = to_null(data.get("costume_img"))
    portret_costume_img = to_null(data.get("portret_costume_img"))
    
    if not name:
        raise HTTPException(status_code=400, detail="Оригінальне ім'я обов'язкове")
        
    db.execute(
        """
        UPDATE characters
        SET name = ?, name_uk = ?, name_ro = ?, real_name = ?, real_name_uk = ?, creators = ?, 
            image = ?, portret_img = ?, costume_img = ?, portret_costume_img = ?, 
            date_last_updated = NOW()
        WHERE id = ?
        """,
        [name, name_uk, name_ro, real_name, real_name_uk, creators, image, portret_img, costume_img, portret_costume_img, character_id]
    )
    return {"message": "Персонаж успішно оновлений"}


@router.delete("/{character_id}")
async def delete_character(character_id: int, request: Request):
    role = request.cookies.get("role")
    if role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Потрібні права модератора")
    
    db = get_db()
    char = db.get_one("SELECT id FROM characters WHERE id = ?", [character_id])
    if not char:
        raise HTTPException(status_code=404, detail="Персонажа не знайдено")
        
    # Видаляємо зв'язки з випусками та томами
    db.execute("DELETE FROM issue_characters WHERE character_id = ?", [character_id])
    db.execute("DELETE FROM volume_characters WHERE character_id = ?", [character_id])
    # Видаляємо самого персонажа
    db.execute("DELETE FROM characters WHERE id = ?", [character_id])
    return {"message": "Персонаж успішно видалений"}
