from fastapi import APIRouter, Request, HTTPException, Query
from typing import Optional
from datetime import datetime
from server.db import get_db
from server.helpers.scores import get_level_title

router = APIRouter(prefix="/api/users", tags=["users"])

ROLE_TITLES = {
    "admin": "Адміністратор",
    "moderator": "Модератор",
    "editor": "Редактор",
    "user": "Користувач",
    "viewer": "Читач"
}

def format_last_activity(dt) -> tuple[str, bool]:
    if not dt:
        return "Давно", False
    
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", ""))
        except Exception:
            return "Давно", False

    now = datetime.now()
    diff_sec = (now - dt).total_seconds()
    if diff_sec < 0:
        diff_sec = 0

    is_online = diff_sec < 300  # активні впродовж 5 хв

    if diff_sec < 60:
        return "щойно", is_online
    
    mins = int(diff_sec // 60)
    if mins < 60:
        return f"{mins} хв. тому", is_online
    
    hours = int(mins // 60)
    if hours < 24:
        return f"{hours} год. тому", is_online
    
    days = int(hours // 24)
    if days < 30:
        return f"{days} дн. тому", is_online
    
    return dt.strftime("%d.%m.%Y"), is_online

@router.get("/online")
async def get_online_users():
    from server.helpers.activity import get_active_guests_count, get_active_usernames, ACTIVE_USERS, ACTIVE_GUESTS
    db = get_db()
    
    active_usernames = get_active_usernames(300)
    
    if active_usernames:
        sql = """
            SELECT 
                u.id, u.username, COALESCE(u.nickname, u.username) AS nickname,
                COALESCE(u.role, 'user') AS role, COALESCE(u.level, 1) AS level
            FROM users u
            WHERE u.username = ANY(%s) OR COALESCE(u.last_activity, u.last_login) >= NOW() - INTERVAL '5 minutes'
            ORDER BY COALESCE(u.last_activity, u.last_login) DESC
        """
        rows = db.get_all(sql, [active_usernames])
    else:
        sql = """
            SELECT 
                u.id, u.username, COALESCE(u.nickname, u.username) AS nickname,
                COALESCE(u.role, 'user') AS role, COALESCE(u.level, 1) AS level
            FROM users u
            WHERE COALESCE(u.last_activity, u.last_login) >= NOW() - INTERVAL '5 minutes'
            ORDER BY COALESCE(u.last_activity, u.last_login) DESC
        """
        rows = db.get_all(sql)

    online_users = []
    for r in rows:
        r_role = r.get("role", "user")
        online_users.append({
            "id": r["id"],
            "username": r["username"],
            "nickname": r["nickname"],
            "role": r_role,
            "role_title": ROLE_TITLES.get(r_role, r_role),
            "level": r["level"],
            "level_title": get_level_title(r["level"])
        })
    
    guests_count = get_active_guests_count(300)
    print(f"[ONLINE DEBUG] ACTIVE_USERS: {list(ACTIVE_USERS.keys())}, ACTIVE_GUESTS: {list(ACTIVE_GUESTS.keys())}, count: {guests_count}")
    return {
        "online_users": online_users,
        "guests_count": guests_count
    }

@router.get("")
async def get_users(
    search: Optional[str] = Query(None),
    sort: Optional[str] = Query("score"),
    role: Optional[str] = Query(None)
):
    db = get_db()
    
    where_clauses = []
    params = []

    if search and search.strip():
        s = f"%{search.strip()}%"
        where_clauses.append("(u.username ILIKE %s OR u.nickname ILIKE %s)")
        params.extend([s, s])

    if role and role.strip() and role != "all":
        where_clauses.append("u.role = %s")
        params.append(role.strip())

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    # Сортування
    if sort == "last_activity":
        order_sql = "ORDER BY COALESCE(u.last_activity, u.last_login, u.created_at) DESC, u.score DESC, u.username ASC"
    elif sort == "username":
        order_sql = "ORDER BY LOWER(u.username) ASC"
    else:  # score
        order_sql = "ORDER BY u.score DESC, COALESCE(e.approved_count, 0) DESC, u.username ASC"

    sql = f"""
        SELECT 
            u.id,
            u.username,
            COALESCE(u.nickname, u.username) AS nickname,
            COALESCE(u.role, 'user') AS role,
            COALESCE(u.score, 0) AS score,
            COALESCE(u.level, 1) AS level,
            COALESCE(u.last_activity, u.last_login, u.created_at) AS last_activity,
            u.created_at,
            COALESCE(e.approved_count, 0) AS approved_edits,
            COALESCE(e.rejected_count, 0) AS rejected_edits,
            COALESCE(e.closed_count, 0) AS closed_edits,
            COALESCE(e.pending_count, 0) AS pending_edits,
            COALESCE(e.total_count, 0) AS total_edits
        FROM users u
        LEFT JOIN (
            SELECT 
                user_id,
                COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
                COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
                COUNT(*) FILTER (WHERE status = 'closed') AS closed_count,
                COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
                COUNT(*) AS total_count
            FROM edit_requests
            GROUP BY user_id
        ) e ON u.id = e.user_id
        {where_sql}
        {order_sql}
    """

    rows = db.get_all(sql, params)

    items = []
    for r in rows:
        last_act_dt = r.get("last_activity")
        act_text, is_online = format_last_activity(last_act_dt)
        r_role = r.get("role", "user")

        items.append({
            "id": r["id"],
            "username": r["username"],
            "nickname": r["nickname"],
            "role": r_role,
            "role_title": ROLE_TITLES.get(r_role, r_role),
            "score": r["score"],
            "level": r["level"],
            "level_title": get_level_title(r["level"]),
            "last_activity_text": act_text,
            "is_online": is_online,
            "edits": {
                "approved": r["approved_edits"],
                "rejected": r["rejected_edits"],
                "closed": r["closed_edits"],
                "pending": r["pending_edits"],
                "total": r["total_edits"]
            }
        })

    return {
        "items": items,
        "total": len(items)
    }
