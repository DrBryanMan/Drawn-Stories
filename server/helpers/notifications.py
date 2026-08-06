import json
import re
from typing import Optional, Dict, Any
from server.db import get_db

def create_notification(
    user_id: int,
    type_str: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None
):
    """
    Створює нове сповіщення для користувача в таблиці notifications.
    """
    db = get_db()
    payload_json = json.dumps(payload or {}, ensure_ascii=False)
    
    sql = """
        INSERT INTO notifications (user_id, type, title, message, link, payload)
        VALUES (%s, %s, %s, %s, %s, %s::jsonb)
        RETURNING id
    """
    res = db.get_one(sql, [user_id, type_str, title, message, link, payload_json])
    try:
        db.conn.commit()
    except Exception:
        pass
    return res["id"] if res else None


def notify_edit_status_change(
    user_id: int,
    edit_id: int,
    entity_type: str,
    new_status: str,
    moderator_comment: Optional[str] = None,
    moderator_id: Optional[int] = None
):
    """
    Сповіщає користувача про зміну статусу його пропозиції правки (approved/rejected).
    """
    db = get_db()
    mod_info = None
    if moderator_id:
        mod_info = db.get_one("SELECT username, nickname FROM users WHERE id = %s", [moderator_id])

    mod_name = (mod_info.get("nickname") or mod_info.get("username")) if mod_info else "Модератор"
    mod_username = mod_info.get("username") if mod_info else None

    if new_status == "approved":
        type_str = "edit_approved"
        title = "Правка прийнята"
        msg = f"Модератор {mod_name} прийняв Вашу правку"
    elif new_status == "rejected":
        type_str = "edit_rejected"
        title = "Правку відхилено"
        msg = f"Модератор {mod_name} відхилив Вашу правку"
        if moderator_comment:
            msg += f". Коментар: {moderator_comment}"
    else:
        return

    link = f"/edits/{edit_id}"
    payload = {
        "edit_id": edit_id,
        "entity_type": entity_type,
        "status": new_status,
        "moderator_comment": moderator_comment,
        "actor_username": mod_username,
        "actor_name": mod_name
    }
    
    return create_notification(
        user_id=user_id,
        type_str=type_str,
        title=title,
        message=msg,
        link=link,
        payload=payload
    )


def notify_user_follow(follower_id: int, target_id: int):
    """
    Сповіщає користувача (target_id) про те, що інший користувач (follower_id) підписався на його профіль.
    """
    db = get_db()
    follower = db.get_one("SELECT username, nickname FROM users WHERE id = %s", [follower_id])
    if not follower:
        return

    follower_name = follower.get("nickname") or follower.get("username")
    follower_username = follower.get("username")

    title = "Нова підписка"
    msg = f"Користувач {follower_name} підписався на Ваш профіль"
    link = f"/user/{follower_name}"
    payload = {
        "follower_id": follower_id,
        "actor_username": follower_username,
        "actor_name": follower_name
    }

    return create_notification(
        user_id=target_id,
        type_str="new_follower",
        title=title,
        message=msg,
        link=link,
        payload=payload
    )


def is_latest_issue(db, volume_id: int, issue_id: int) -> bool:
    """
    Перевіряє, чи є випуск крайнім (найновішим) у томі за датою або номером випуску.
    Якщо в томі вже існує інший випуск з пізнішою датою або більшим номером, повертає False.
    """
    current_issue = db.get_one(
        "SELECT id, issue_number, cover_date, release_date FROM issues WHERE id = %s",
        [issue_id]
    )
    if not current_issue:
        return False

    current_date = current_issue.get("release_date") or current_issue.get("cover_date")
    current_num_str = str(current_issue.get("issue_number") or "")

    other_issues = db.get_all(
        "SELECT id, issue_number, cover_date, release_date FROM issues WHERE volume_id = %s AND id != %s",
        [volume_id, issue_id]
    )
    
    if not other_issues:
        return True

    for other in other_issues:
        other_date = other.get("release_date") or other.get("cover_date")
        
        # 1. Якщо порівнюємо за датами
        if current_date and other_date:
            if str(other_date) > str(current_date):
                return False
        elif other_date and not current_date:
            # Якщо в існуючого випуску є дата, а в нового немає
            return False

        # 2. Якщо дати рівні або відсутні — порівнюємо числовий номер випуску
        try:
            c_nums = re.findall(r'\d+(?:\.\d+)?', current_num_str)
            o_nums = re.findall(r'\d+(?:\.\d+)?', str(other.get("issue_number") or ""))
            if c_nums and o_nums:
                if float(o_nums[0]) > float(c_nums[0]):
                    return False
        except Exception:
            pass

    return True


def notify_new_issue_subscribers(
    volume_id: int,
    issue_id: int,
    issue_number: str,
    volume_name: Optional[str] = None
):
    """
    Сповіщає користувачів, у яких тома/серія в обраному або у списках 'planned' / 'reading',
    про новий випуск ТІЛЬКИ якщо цей випуск є крайнім (найновішим) за датою або номером.
    """
    db = get_db()

    # Перевірка: якщо випуск є старим (backfill), сповіщення не відправляємо
    if not is_latest_issue(db, volume_id, issue_id):
        return

    vol = db.get_one("SELECT image, cover_img FROM volumes WHERE id = %s", [volume_id])
    cover_image = (vol.get("image") or vol.get("cover_img")) if vol else None

    # Знаходимо користувачів у user_favorites та user_volumes_readlist для списків 'planned' та 'reading'
    sql = """
        SELECT DISTINCT user_id FROM (
            SELECT user_id FROM user_favorites WHERE content_type = 'volume' AND content_id = %s
            UNION
            SELECT user_id FROM user_volumes_readlist WHERE volume_id = %s AND LOWER(list_name) IN ('planned', 'reading')
        ) sub
    """
    subscribers = db.get_all(sql, [volume_id, volume_id])
    
    if not subscribers:
        return
        
    title = f"Новий випуск в '{volume_name or 'серії'}'!"
    msg = f"Опубліковано випуск #{issue_number} у серії '{volume_name or 'серія'}'"
    link = f"/issue/{issue_id}"
    payload = {
        "volume_id": volume_id,
        "issue_id": issue_id,
        "issue_number": issue_number,
        "volume_name": volume_name,
        "cover_image": cover_image
    }
    
    for sub in subscribers:
        create_notification(
            user_id=sub["user_id"],
            type_str="new_issue",
            title=title,
            message=msg,
            link=link,
            payload=payload
        )
