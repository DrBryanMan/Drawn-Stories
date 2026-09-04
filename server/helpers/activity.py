import time
import uuid
from typing import Optional
from fastapi import Request

ACTIVE_USERS: dict[str, float] = {}
ACTIVE_GUESTS: dict[str, float] = {}

def get_active_logins(ttl_seconds: int = 300) -> list[str]:
    now = time.time()
    expired = [u for u, ts in list(ACTIVE_USERS.items()) if now - ts > ttl_seconds]
    for u in expired:
        ACTIVE_USERS.pop(u, None)
    return list(ACTIVE_USERS.keys())

def get_active_usernames(ttl_seconds: int = 300) -> list[str]:
    return get_active_logins(ttl_seconds)

def get_active_guests_count(ttl_seconds: int = 300) -> int:
    now = time.time()
    expired = [gid for gid, ts in list(ACTIVE_GUESTS.items()) if now - ts > ttl_seconds]
    for gid in expired:
        ACTIVE_GUESTS.pop(gid, None)
    return len(ACTIVE_GUESTS)

def track_request_activity(request: Request) -> Optional[str]:
    path = request.url.path
    new_guest_cookie = None

    if not path.startswith(("/static/", "/images/")) and not any(path.endswith(ext) for ext in (".css", ".js", ".png", ".jpg", ".jpeg", ".ico", ".woff2")):
        user_login = request.cookies.get("login") or request.cookies.get("username")
        guest_id = request.cookies.get("guest_id")
        client_ip = request.client.host if request.client else "unknown"

        now = time.time()

        if user_login:
            ACTIVE_USERS[user_login] = now
            if guest_id:
                ACTIVE_GUESTS.pop(guest_id, None)
        else:
            if not guest_id:
                guest_id = f"g_{uuid.uuid4().hex[:8]}_{client_ip}"
                new_guest_cookie = guest_id
            ACTIVE_GUESTS[guest_id] = now
            print(f"[TRACK GUEST] guest_id={guest_id}, ip={client_ip}, path={path}, total_guests={len(ACTIVE_GUESTS)}")

    return new_guest_cookie
