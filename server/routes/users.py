from fastapi import APIRouter, Request, HTTPException, Query
from typing import Optional
from datetime import datetime
from server.db import get_db
from server.helpers.scores import get_level_title, get_level_for_score, LEVELS

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

def get_current_user_id(request: Request):
    username = request.cookies.get("username")
    if not username:
        return None
    db = get_db()
    user = db.get_one("SELECT id FROM users WHERE username = %s", [username])
    return user["id"] if user else None

def calculate_level_progress(score: int):
    current_level = get_level_for_score(score)  # 1-based
    idx = max(1, min(current_level, len(LEVELS))) - 1
    current_min = LEVELS[idx][0]
    
    if idx + 1 < len(LEVELS):
        next_min = LEVELS[idx + 1][0]
        span = next_min - current_min
        earned = max(0, score - current_min)
        percent = min(100, max(0, int((earned / span) * 100))) if span > 0 else 100
    else:
        next_min = current_min
        percent = 100

    return {
        "level": current_level,
        "level_title": LEVELS[idx][1],
        "current_min_score": current_min,
        "next_min_score": next_min,
        "progress_percent": percent
    }

@router.get("/profile/{username}")
async def get_user_profile(username: str, request: Request):
    db = get_db()
    
    user = db.get_one("""
        SELECT id, username, COALESCE(nickname, username) AS nickname, role, score, level, created_at,
               COALESCE(last_activity, last_login, created_at) AS last_activity
        FROM users
        WHERE LOWER(username) = LOWER(%s)
    """, [username])
    
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
        
    u_id = user["id"]
    u_role = user["role"] or "user"
    score = user["score"] or 0
    
    level_info = calculate_level_progress(score)
    act_text, is_online = format_last_activity(user["last_activity"])
    
    created_dt = user["created_at"]
    created_str = created_dt.strftime("%d.%m.%Y") if created_dt else "Невідомо"
    
    # Статистика правок
    edits_row = db.get_one("""
        SELECT 
            COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
            COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
            COUNT(*) FILTER (WHERE status = 'closed') AS closed_count,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
            COUNT(*) AS total_count
        FROM edit_requests
        WHERE user_id = %s
    """, [u_id]) or {}
    
    # Останні 10 правок користувача
    recent_edits_rows = db.get_all("""
        SELECT 
            er.id, er.entity_type, er.entity_id, er.status, er.created_at,
            COALESCE((
                SELECT SUM(sh.delta)
                FROM score_history sh
                WHERE sh.edit_id = er.id AND sh.user_id = er.user_id
            ), 0) AS score_awarded,
            COALESCE(v.name_uk, i.name_uk, c.name_uk, p.name_uk, v.name, i.name, c.name, p.name, pub.name, col.name) AS entity_title
        FROM edit_requests er
        LEFT JOIN volumes v ON er.entity_type = 'volume' AND er.entity_id = v.id
        LEFT JOIN issues i ON er.entity_type = 'issue' AND er.entity_id = i.id
        LEFT JOIN characters c ON er.entity_type = 'character' AND er.entity_id = c.id
        LEFT JOIN persons p ON er.entity_type = 'person' AND er.entity_id = p.id
        LEFT JOIN publishers pub ON er.entity_type = 'publisher' AND er.entity_id = pub.id
        LEFT JOIN collections col ON er.entity_type = 'collection' AND er.entity_id = col.id
        WHERE er.user_id = %s
        ORDER BY er.created_at DESC
        LIMIT 10
    """, [u_id])
    
    recent_edits = []
    for r in recent_edits_rows:
        e_created = r["created_at"].strftime("%d.%m.%Y %H:%M") if r["created_at"] else ""
        recent_edits.append({
            "id": r["id"],
            "entity_type": r["entity_type"],
            "entity_id": r["entity_id"],
            "status": r["status"],
            "score_awarded": r["score_awarded"] or 0,
            "created_at": e_created,
            "volume_title": r["entity_title"] or f"Об'єкт #{r['entity_id']}"
        })
        
    # Лічильники закладок, колекцій, улюбленого
    readlist_cnt = db.get_one("SELECT COUNT(DISTINCT volume_id) AS count FROM user_volumes_readlist WHERE user_id = %s", [u_id]) or {}
    collections_cnt = db.get_one("SELECT COUNT(DISTINCT collection_id) AS count FROM user_volumes_collection WHERE user_id = %s", [u_id]) or {}
    favorites_cnt = db.get_one("SELECT COUNT(*) AS count FROM user_favorites WHERE user_id = %s", [u_id]) or {}
    
    # Підписки та підписники
    followers_cnt = db.get_one("SELECT COUNT(*) AS count FROM user_follows WHERE following_id = %s", [u_id]) or {}
    following_cnt = db.get_one("SELECT COUNT(*) AS count FROM user_follows WHERE follower_id = %s", [u_id]) or {}
    
    curr_user_id = get_current_user_id(request)
    is_following = False
    if curr_user_id and curr_user_id != u_id:
        row_f = db.get_one("SELECT 1 FROM user_follows WHERE follower_id = %s AND following_id = %s", [curr_user_id, u_id])
        is_following = row_f is not None

    return {
        "id": u_id,
        "username": user["username"],
        "nickname": user["nickname"],
        "role": u_role,
        "role_title": ROLE_TITLES.get(u_role, u_role),
        "score": score,
        "level": level_info["level"],
        "level_title": level_info["level_title"],
        "next_min_score": level_info["next_min_score"],
        "current_min_score": level_info["current_min_score"],
        "progress_percent": level_info["progress_percent"],
        "created_at_text": f"На сайті з {created_str}",
        "last_activity_text": act_text,
        "is_online": is_online,
        "followers_count": followers_cnt.get("count", 0),
        "following_count": following_cnt.get("count", 0),
        "is_following": is_following,
        "edits_stats": {
            "approved": edits_row.get("approved_count", 0),
            "rejected": edits_row.get("rejected_count", 0),
            "closed": edits_row.get("closed_count", 0),
            "pending": edits_row.get("pending_count", 0),
            "total": edits_row.get("total_count", 0)
        },
        "recent_edits": recent_edits,
        "readlists_count": readlist_cnt.get("count", 0),
        "collections_count": collections_cnt.get("count", 0),
        "favorites_count": favorites_cnt.get("count", 0)
    }

@router.post("/follow/{target_id}")
async def toggle_follow_user(target_id: int, request: Request):
    curr_user_id = get_current_user_id(request)
    if not curr_user_id:
        raise HTTPException(status_code=401, detail="Необхідна авторизація")
    if curr_user_id == target_id:
        raise HTTPException(status_code=400, detail="Неможливо підписатися на самого себе")
        
    db = get_db()
    existing = db.get_one("SELECT 1 FROM user_follows WHERE follower_id = %s AND following_id = %s", [curr_user_id, target_id])
    
    if existing:
        db.execute("DELETE FROM user_follows WHERE follower_id = %s AND following_id = %s", [curr_user_id, target_id])
        following = False
    else:
        db.execute("INSERT INTO user_follows (follower_id, following_id) VALUES (%s, %s)", [curr_user_id, target_id])
        following = True
        
    followers_cnt = db.get_one("SELECT COUNT(*) AS count FROM user_follows WHERE following_id = %s", [target_id]) or {}
    return {
        "following": following,
        "followers_count": followers_cnt.get("count", 0)
    }

@router.get("/follows/{username}")
async def get_user_follows(username: str, type: str = Query("followers"), request: Request = None):
    db = get_db()
    user = db.get_one("SELECT id FROM users WHERE LOWER(username) = LOWER(%s)", [username])
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
        
    u_id = user["id"]
    curr_user_id = get_current_user_id(request) if request else None
    
    if type == "following":
        sql = """
            SELECT u.id, u.username, COALESCE(u.nickname, u.username) AS nickname,
                   COALESCE(u.role, 'user') AS role, COALESCE(u.level, 1) AS level,
                   COALESCE(u.score, 0) AS score
            FROM user_follows uf
            JOIN users u ON uf.following_id = u.id
            WHERE uf.follower_id = %s
            ORDER BY uf.created_at DESC
        """
    else:  # followers
        sql = """
            SELECT u.id, u.username, COALESCE(u.nickname, u.username) AS nickname,
                   COALESCE(u.role, 'user') AS role, COALESCE(u.level, 1) AS level,
                   COALESCE(u.score, 0) AS score
            FROM user_follows uf
            JOIN users u ON uf.follower_id = u.id
            WHERE uf.following_id = %s
            ORDER BY uf.created_at DESC
        """
        
    rows = db.get_all(sql, [u_id])
    
    items = []
    for r in rows:
        r_role = r["role"]
        is_fol = False
        if curr_user_id and curr_user_id != r["id"]:
            is_fol = db.get_one("SELECT 1 FROM user_follows WHERE follower_id = %s AND following_id = %s", [curr_user_id, r["id"]]) is not None
            
        items.append({
            "id": r["id"],
            "username": r["username"],
            "nickname": r["nickname"],
            "role": r_role,
            "role_title": ROLE_TITLES.get(r_role, r_role),
            "level": r["level"],
            "score": r["score"],
            "is_following": is_fol
        })
        
    return {
        "items": items,
        "total": len(items)
    }
