from fastapi import APIRouter, HTTPException, Request, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from server.db import get_db
from server.helpers.scores import get_level_title, get_level_for_score, LEVELS
from server.helpers.notifications import notify_user_follow

router = APIRouter(prefix="/api/users", tags=["users"])

ROLE_TITLES = {
    "admin": "Адміністратор",
    "moderator": "Модератор",
    "editor": "Редактор",
    "viewer": "Читач",
    "user": "Користувач"
}
MANAGEABLE_ROLES = {"viewer", "editor", "moderator", "admin"}


class UpdateUserRoleRequest(BaseModel):
    role: str

def format_last_activity(dt: datetime | None) -> tuple[str, bool]:
    """
    Повертає (текстовий опис активності, чи_онлайн).
    Онлайн якщо активність була менше 5 хв тому.
    """
    if not dt:
        return "Невідомо", False

    now = datetime.now()
    if dt.tzinfo:
        now = datetime.now(timezone.utc)
    diff = now - dt

    seconds = diff.total_seconds()
    if seconds < 300:  # 5 хвилин
        return "Зараз онлайн", True
    elif seconds < 3600:
        mins = max(1, int(seconds // 60))
        return f"{mins} хв тому", False
    elif seconds < 86400:
        hours = int(seconds // 3600)
        return f"{hours} год тому", False
    elif seconds < 86400 * 2:
        return "Вчора", False
    elif seconds < 86400 * 7:
        days = int(seconds // 86400)
        return f"{days} дн. тому", False
    return dt.strftime("%d.%m.%Y"), False

@router.get("/online")
async def get_online_users():
    from server.helpers.activity import get_active_guests_count, get_active_logins, ACTIVE_USERS, ACTIVE_GUESTS
    db = get_db()
    
    active_logins = get_active_logins(300)
    
    if active_logins:
        sql = """
            SELECT 
                u.id, u.login, COALESCE(u.nickname, u.login) AS nickname,
                COALESCE(u.role, 'user') AS role, COALESCE(u.level, 1) AS level
            FROM users u
            WHERE u.login = ANY(%s) OR COALESCE(u.last_activity, u.last_login) >= NOW() - INTERVAL '5 minutes'
            ORDER BY COALESCE(u.last_activity, u.last_login) DESC
        """
        rows = db.get_all(sql, [active_logins])
    else:
        sql = """
            SELECT 
                u.id, u.login, COALESCE(u.nickname, u.login) AS nickname,
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
            "login": r["login"],
            "username": r["login"],
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
        where_clauses.append("(u.login ILIKE %s OR u.nickname ILIKE %s)")
        params.extend([s, s])

    if role and role.strip() and role != "all":
        where_clauses.append("u.role = %s")
        params.append(role.strip())

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    # Сортування
    if sort == "last_activity":
        order_sql = "ORDER BY COALESCE(u.last_activity, u.last_login, u.created_at) DESC, u.score DESC, u.login ASC"
    elif sort == "username" or sort == "nickname":
        order_sql = "ORDER BY LOWER(COALESCE(u.nickname, u.login)) ASC"
    else:  # score
        order_sql = "ORDER BY u.score DESC, COALESCE(e.approved_count, 0) DESC, u.login ASC"

    sql = f"""
        SELECT 
            u.id,
            u.login,
            COALESCE(u.nickname, u.login) AS nickname,
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
            "login": r["login"],
            "username": r["login"],
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
    user_login = request.cookies.get("login") or request.cookies.get("username")
    if not user_login:
        return None
    db = get_db()
    user = db.get_one("SELECT id FROM users WHERE login = %s", [user_login])
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

@router.get("/profile/{identifier}")
async def get_user_profile(identifier: str, request: Request):
    db = get_db()
    
    user = db.get_one("""
        SELECT id, login, COALESCE(nickname, login) AS nickname, role, score, level, created_at,
               COALESCE(last_activity, last_login, created_at) AS last_activity
        FROM users
        WHERE LOWER(nickname) = LOWER(%s) OR LOWER(login) = LOWER(%s)
    """, [identifier, identifier])
    
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
            er.id, er.entity_type, er.entity_id, er.status, er.created_at, er.moderated_at,
            er.patch_data, er.comment, er.moderator_comment, er.is_creation,
            COALESCE((
                SELECT SUM(sh.delta)
                FROM score_history sh
                WHERE sh.edit_id = er.id AND sh.user_id = er.user_id
            ), 0) AS awarded_score,
            COALESCE(v.name, i.name, c.name, p.name, pub.name, col.name, mc.name) AS entity_name,
            COALESCE(v.name_uk, i.name_uk, c.name_uk, p.name_uk, mc.name_uk) AS entity_name_uk,
            col.volume_id AS col_volume_id,
            col.issue_number AS col_issue_number,
            col_v.name AS col_vol_name,
            col_v.name_uk AS col_vol_name_uk
        FROM edit_requests er
        LEFT JOIN volumes v ON er.entity_type = 'volume' AND v.id = er.entity_id
        LEFT JOIN issues i ON er.entity_type = 'issue' AND i.id = er.entity_id
        LEFT JOIN characters c ON er.entity_type = 'character' AND c.id = er.entity_id
        LEFT JOIN persons p ON er.entity_type = 'person' AND p.id = er.entity_id
        LEFT JOIN publishers pub ON er.entity_type = 'publisher' AND pub.id = er.entity_id
        LEFT JOIN collections col ON er.entity_type = 'collection' AND col.id = er.entity_id
        LEFT JOIN volumes col_v ON col.volume_id = col_v.id
        LEFT JOIN manga_chapters mc ON er.entity_type = 'manga_chapter' AND mc.id = er.entity_id
        WHERE er.user_id = %s
        ORDER BY er.created_at DESC
        LIMIT 10
    """, [u_id])

    recent_edits = []
    for er in recent_edits_rows:
        e_created = er["created_at"].strftime("%d.%m.%Y %H:%M") if er["created_at"] else ""
        patch_obj = {}
        if er.get("patch_data"):
            try:
                patch_obj = json.loads(er["patch_data"]) if isinstance(er["patch_data"], str) else er["patch_data"]
            except Exception:
                patch_obj = {}
        after_data = patch_obj.get("after", patch_obj) if isinstance(patch_obj, dict) else {}

        ent_name = er["entity_name_uk"] or er["entity_name"]
        if not ent_name:
            if er["entity_type"] == "collection":
                vol_id = er.get("col_volume_id") or after_data.get("volume_id")
                issue_num = er.get("col_issue_number") or after_data.get("issue_number")
                vol_name = er.get("col_vol_name_uk") or er.get("col_vol_name")
                if not vol_name and vol_id:
                    v_row = db.get_one("SELECT name, name_uk FROM volumes WHERE id = %s", [vol_id])
                    if v_row:
                        vol_name = v_row.get("name_uk") or v_row.get("name")
                if vol_name:
                    ent_name = f"{vol_name}, Книга {issue_num}" if issue_num else vol_name
                elif issue_num:
                    ent_name = f"Збірник, Книга {issue_num}"
                elif after_data.get("name"):
                    ent_name = after_data.get("name")
            elif er["entity_type"] == "issue":
                issue_num = after_data.get("issue_number")
                ent_name = f"Випуск #{issue_num}" if issue_num else after_data.get("name")
            else:
                ent_name = after_data.get("name_uk") or after_data.get("name")

        if not ent_name:
            ent_name = f"#{er['entity_id']}" if er['entity_id'] else "Нова сутність"

        recent_edits.append({
            "id": er["id"],
            "entity_type": er["entity_type"],
            "entity_id": er["entity_id"],
            "entity_name": ent_name,
            "status": er["status"],
            "is_creation": bool(er.get("is_creation")),
            "created_at": e_created,
            "awarded_score": er["awarded_score"]
        })

        
    # Підписники та підписки
    followers_cnt = db.get_one("SELECT COUNT(*) AS count FROM user_follows WHERE following_id = %s", [u_id]) or {}
    following_cnt = db.get_one("SELECT COUNT(*) AS count FROM user_follows WHERE follower_id = %s", [u_id]) or {}
    readlists_cnt = db.get_one(
        "SELECT COUNT(DISTINCT volume_id) AS count FROM user_volumes_readlist WHERE user_id = %s",
        [u_id]
    ) or {}
    collections_cnt = db.get_one(
        "SELECT COUNT(DISTINCT collection_id) AS count FROM user_volumes_collection WHERE user_id = %s",
        [u_id]
    ) or {}
    favorites_cnt = db.get_one("SELECT COUNT(*) AS count FROM user_favorites WHERE user_id = %s", [u_id]) or {}
    
    # Перевірка чи поточний користувач підписаний на цього
    curr_user_id = get_current_user_id(request)
    is_following = False
    if curr_user_id and curr_user_id != u_id:
        fol_check = db.get_one("SELECT 1 FROM user_follows WHERE follower_id = %s AND following_id = %s", [curr_user_id, u_id])
        is_following = fol_check is not None

    return {
        "id": u_id,
        "login": user["login"],
        "username": user["login"],
        "nickname": user["nickname"],
        "role": u_role,
        "role_title": ROLE_TITLES.get(u_role, u_role),
        "score": score,
        "level": level_info["level"],
        "level_title": level_info["level_title"],
        "next_min_score": level_info["next_min_score"],
        "current_min_score": level_info["current_min_score"],
        "progress_percent": level_info["progress_percent"],
        "created_at": created_str,
        "last_activity_text": act_text,
        "is_online": is_online,
        "is_following": is_following,
        "followers_count": followers_cnt.get("count", 0),
        "following_count": following_cnt.get("count", 0),
        "readlists_count": readlists_cnt.get("count", 0),
        "collections_count": collections_cnt.get("count", 0),
        "favorites_count": favorites_cnt.get("count", 0),
        "edits_stats": {
            "approved": edits_row.get("approved_count", 0),
            "rejected": edits_row.get("rejected_count", 0),
            "closed": edits_row.get("closed_count", 0),
            "pending": edits_row.get("pending_count", 0),
            "total": edits_row.get("total_count", 0)
        },
        "recent_edits": recent_edits
    }


@router.put("/{user_id}/role")
async def update_user_role(user_id: int, req: UpdateUserRoleRequest, request: Request):
    actor_login = request.cookies.get("login") or request.cookies.get("username")
    if not actor_login:
        raise HTTPException(status_code=401, detail="Необхідна авторизація")

    db = get_db()
    actor = db.get_one("SELECT id, role FROM users WHERE login = %s", [actor_login])
    if not actor or actor.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Лише адміністратор може змінювати статус користувача")

    if actor["id"] == user_id:
        raise HTTPException(status_code=400, detail="Не можна змінити власний статус")

    if req.role not in MANAGEABLE_ROLES:
        raise HTTPException(status_code=400, detail="Невідомий статус користувача")

    user = db.get_one("SELECT id FROM users WHERE id = %s", [user_id])
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")

    db.execute("UPDATE users SET role = %s WHERE id = %s", [req.role, user_id])
    return {"role": req.role, "role_title": ROLE_TITLES[req.role]}

@router.post("/follow/{target_id}")
async def toggle_follow_user(target_id: int, request: Request):
    curr_user_id = get_current_user_id(request)
    if not curr_user_id:
        raise HTTPException(status_code=401, detail="Необхідна авторизація")
        
    if curr_user_id == target_id:
        raise HTTPException(status_code=400, detail="Не можна підписатися на самого себе")
        
    db = get_db()
    existing = db.get_one("SELECT 1 FROM user_follows WHERE follower_id = %s AND following_id = %s", [curr_user_id, target_id])
    
    if existing:
        db.execute("DELETE FROM user_follows WHERE follower_id = %s AND following_id = %s", [curr_user_id, target_id])
        following = False
    else:
        db.execute("INSERT INTO user_follows (follower_id, following_id) VALUES (%s, %s)", [curr_user_id, target_id])
        following = True
        try:
            notify_user_follow(curr_user_id, target_id)
        except Exception as err:
            print(f"Помилка відправки сповіщення про підписку: {err}")
        
    followers_cnt = db.get_one("SELECT COUNT(*) AS count FROM user_follows WHERE following_id = %s", [target_id]) or {}
    return {
        "following": following,
        "followers_count": followers_cnt.get("count", 0)
    }

@router.get("/follows/{identifier}")
async def get_user_follows(identifier: str, type: str = Query("followers"), request: Request = None):
    db = get_db()
    user = db.get_one("SELECT id FROM users WHERE LOWER(nickname) = LOWER(%s) OR LOWER(login) = LOWER(%s)", [identifier, identifier])
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
        
    u_id = user["id"]
    curr_user_id = get_current_user_id(request) if request else None
    
    if type == "following":
        sql = """
            SELECT u.id, u.login, COALESCE(u.nickname, u.login) AS nickname,
                   COALESCE(u.role, 'user') AS role, COALESCE(u.level, 1) AS level,
                   COALESCE(u.score, 0) AS score
            FROM user_follows uf
            JOIN users u ON uf.following_id = u.id
            WHERE uf.follower_id = %s
            ORDER BY uf.created_at DESC
        """
    else:  # followers
        sql = """
            SELECT u.id, u.login, COALESCE(u.nickname, u.login) AS nickname,
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
            "login": r["login"],
            "username": r["login"],
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
