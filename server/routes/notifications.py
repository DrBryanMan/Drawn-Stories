import json
from fastapi import APIRouter, HTTPException, Request, Query
from typing import Optional
from server.db import get_db

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

def get_current_user(request: Request):
    username = request.cookies.get("username")
    if not username:
        return None
    db = get_db()
    user = db.get_one("SELECT id, username, role FROM users WHERE username = %s", [username])
    return user


@router.get("")
async def get_notifications(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False)
):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Необхідна авторизація")

    db = get_db()
    user_id = user["id"]
    offset = (page - 1) * limit

    where_clause = "WHERE user_id = %s"
    params = [user_id]

    if unread_only:
        where_clause += " AND is_read = FALSE"

    count_sql = f"SELECT COUNT(*) as total FROM notifications {where_clause}"
    total_res = db.get_one(count_sql, params)
    total = total_res["total"] if total_res else 0

    unread_sql = "SELECT COUNT(*) as unread FROM notifications WHERE user_id = %s AND is_read = FALSE"
    unread_res = db.get_one(unread_sql, [user_id])
    unread_count = unread_res["unread"] if unread_res else 0

    sql = f"""
        SELECT id, user_id, type, title, message, link, is_read, created_at, payload
        FROM notifications
        {where_clause}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
    """
    items = db.get_all(sql, params + [limit, offset])

    # Збагачуємо та виправляємо посилання для сповіщень
    for item in items:
        payload = item.get("payload") or {}
        
        # 1. Авто-коригування старих посилань правок з /edits?id=X на /edits/X
        if item.get("link") and item["link"].startswith("/edits?id="):
            edit_id = payload.get("edit_id") or item["link"].split("=")[-1]
            item["link"] = f"/edits/{edit_id}"
            db.execute("UPDATE notifications SET link = %s WHERE id = %s", [item["link"], item["id"]])

        # 2. Сповіщення про підписку -> посилання на nickname/username актора
        if item["type"] == "new_follower" and payload.get("actor_name"):
            item["link"] = f"/user/{payload['actor_name']}"
            db.execute("UPDATE notifications SET link = %s WHERE id = %s", [item["link"], item["id"]])

        # 3. Збагачення даними модератора для правок
        if item["type"] in ("edit_approved", "edit_rejected") and not payload.get("actor_username"):
            edit_id = payload.get("edit_id")
            if edit_id:
                mod_info = db.get_one("""
                    SELECT u.username, COALESCE(u.nickname, u.username) as name
                    FROM edit_requests er
                    JOIN users u ON er.moderator_id = u.id
                    WHERE er.id = %s
                """, [edit_id])
                if mod_info:
                    payload["actor_username"] = mod_info["username"]
                    payload["actor_name"] = mod_info["name"]
                    item["payload"] = payload
                    item["link"] = f"/edits/{edit_id}"
                    action_word = "прийняв" if item["type"] == "edit_approved" else "відхилив"
                    item["title"] = "Правка прийнята" if item["type"] == "edit_approved" else "Правку відхилено"
                    item["message"] = f"Модератор {mod_info['name']} {action_word} Вашу правку"
                    try:
                        db.execute(
                            "UPDATE notifications SET payload = %s::jsonb, title = %s, message = %s, link = %s WHERE id = %s",
                            [json.dumps(payload, ensure_ascii=False), item["title"], item["message"], item["link"], item["id"]]
                        )
                    except Exception:
                        pass

    return {
        "notifications": items,
        "total": total,
        "page": page,
        "limit": limit,
        "unread_count": unread_count
    }


@router.get("/unread-count")
async def get_unread_count(request: Request):
    user = get_current_user(request)
    if not user:
        return {"unread_count": 0}

    db = get_db()
    unread_res = db.get_one(
        "SELECT COUNT(*) as unread FROM notifications WHERE user_id = %s AND is_read = FALSE",
        [user["id"]]
    )
    return {"unread_count": unread_res["unread"] if unread_res else 0}


@router.post("/{notification_id}/read")
async def mark_as_read(notification_id: int, request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Необхідна авторизація")

    db = get_db()
    db.execute(
        "UPDATE notifications SET is_read = TRUE WHERE id = %s AND user_id = %s",
        [notification_id, user["id"]]
    )
    return {"status": "ok", "message": "Сповіщення позначено як прочитане"}


@router.post("/read-all")
async def mark_all_as_read(request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Необхідна авторизація")

    db = get_db()
    db.execute(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = %s AND is_read = FALSE",
        [user["id"]]
    )
    return {"status": "ok", "message": "Усі сповіщення позначено як прочитані"}


@router.delete("/{notification_id}")
async def delete_notification(notification_id: int, request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Необхідна авторизація")

    db = get_db()
    db.execute(
        "DELETE FROM notifications WHERE id = %s AND user_id = %s",
        [notification_id, user["id"]]
    )
    return {"status": "ok", "message": "Сповіщення видалено"}
