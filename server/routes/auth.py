from fastapi import APIRouter, Request, Response, HTTPException, status, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import hashlib
import os
import shutil
import urllib.parse
import re
from server.db import get_db
from fastapi.responses import FileResponse
from server.helpers.scores import get_level_for_score, get_level_title
from server.helpers.avatar import generate_default_avatar_svg

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Resolve target directory relative to this file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
USERS_IMAGES_DIR = os.path.join(BASE_DIR, "images", "users")

def get_auth_login_from_cookie(request: Request) -> Optional[str]:
    return request.cookies.get("login") or request.cookies.get("username")

@router.post("/upload-avatar")
async def upload_avatar(request: Request, avatar: UploadFile = File(...)):
    user_login = get_auth_login_from_cookie(request)
    if not user_login:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    db = get_db()
    user = db.get_one("SELECT login, nickname FROM users WHERE login = %s", [user_login])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    display_name = user.get("nickname") or user["login"]

    if avatar.content_type not in ["image/jpeg", "image/webp"]:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    ext = ".jpg" if avatar.content_type == "image/jpeg" else ".webp"
    filename = f"{display_name}_avatar{ext}"
    
    # Ensure directory exists
    os.makedirs(USERS_IMAGES_DIR, exist_ok=True)
    
    with open(os.path.join(USERS_IMAGES_DIR, filename), "wb") as buffer:
        shutil.copyfileobj(avatar.file, buffer)
    
    return {"url": f"/api/auth/avatar/{display_name}?t={os.urandom(4).hex()}"}

@router.get("/avatar/{identifier}")
async def get_avatar(identifier: str):
    db = get_db()
    # 1. Direct file check by identifier (which can be nickname or login)
    for ext in [".jpg", ".webp"]:
        path = os.path.join(USERS_IMAGES_DIR, f"{identifier}_avatar{ext}")
        if os.path.exists(path):
            return FileResponse(path, headers={"Cache-Control": "no-cache, must-revalidate"})
    
    # 2. Lookup user by nickname or login to find target filename
    user = db.get_one(
        "SELECT login, COALESCE(nickname, login) as nickname FROM users WHERE LOWER(nickname) = LOWER(%s) OR LOWER(login) = LOWER(%s)",
        [identifier, identifier]
    )
    if user:
        for name_to_try in [user.get("nickname"), user["login"]]:
            if not name_to_try:
                continue
            for ext in [".jpg", ".webp"]:
                path = os.path.join(USERS_IMAGES_DIR, f"{name_to_try}_avatar{ext}")
                if os.path.exists(path):
                    return FileResponse(path, headers={"Cache-Control": "no-cache, must-revalidate"})

    # 3. Return a dynamic default avatar SVG. It must also be revalidated after an upload.
    svg_content = generate_default_avatar_svg(identifier)
    return Response(
        content=svg_content,
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-cache, must-revalidate"}
    )

def validate_field(val: str) -> bool:
    if not val or len(val) > 20:
        return False
    return bool(re.match(r"^[a-zA-Z0-9а-яА-ЯёЁіІїЇєЄґҐ_]+$", val))

class ProfileUpdateRequest(BaseModel):
    new_login: Optional[str] = None
    new_username: Optional[str] = None  # fallback alias
    new_nickname: Optional[str] = None

@router.put("/update-profile")
async def update_profile(req: ProfileUpdateRequest, request: Request, response: Response):
    old_login = get_auth_login_from_cookie(request)
    if not old_login:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    db = get_db()
    user = db.get_one("SELECT * FROM users WHERE login = %s", [old_login])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    old_nickname = user.get("nickname") or old_login
    target_new_login = req.new_login or req.new_username
    
    # 1. Зміна логіну (login)
    if target_new_login is not None:
        new_login = target_new_login.strip()
        if not new_login:
            raise HTTPException(status_code=400, detail="Логін не може бути порожнім")
        if not validate_field(new_login):
            raise HTTPException(status_code=400, detail="Логін має бути до 20 символів і містити лише літери та цифри (без крапок та пробілів)")
            
        if new_login.lower() != old_login.lower():
            existing = db.get_one("SELECT id FROM users WHERE LOWER(login) = LOWER(%s)", [new_login])
            if existing:
                raise HTTPException(status_code=400, detail="Користувач з таким логіном вже існує")
            
            db.execute("UPDATE users SET login = %s WHERE id = %s", [new_login, user["id"]])
            
            response.set_cookie(key="login", value=urllib.parse.quote(new_login), httponly=True)
            response.set_cookie(key="username", value=urllib.parse.quote(new_login), httponly=True)
            
    # 2. Зміна нікнейму (nickname)
    if req.new_nickname is not None:
        new_nickname = req.new_nickname.strip()
        if not new_nickname:
            raise HTTPException(status_code=400, detail="Нікнейм не може бути порожнім")
        if not validate_field(new_nickname):
            raise HTTPException(status_code=400, detail="Нікнейм має бути до 20 символів і містити лише літери та цифри (без крапок та пробілів)")
            
        if new_nickname.lower() != old_nickname.lower():
            existing = db.get_one("SELECT id FROM users WHERE LOWER(nickname) = LOWER(%s) AND id != %s", [new_nickname, user["id"]])
            if existing:
                raise HTTPException(status_code=400, detail="Користувач з таким нікнеймом вже існує")
            
            db.execute("UPDATE users SET nickname = %s WHERE id = %s", [new_nickname, user["id"]])
            
            # Перейменовуємо аватари з old_nickname на new_nickname
            os.makedirs(USERS_IMAGES_DIR, exist_ok=True)
            for ext in [".jpg", ".webp"]:
                old_path = os.path.join(USERS_IMAGES_DIR, f"{old_nickname}_avatar{ext}")
                new_path = os.path.join(USERS_IMAGES_DIR, f"{new_nickname}_avatar{ext}")
                if os.path.exists(old_path):
                    try:
                        os.rename(old_path, new_path)
                    except Exception as e:
                        print(f"Error renaming avatar: {e}")

    # Отримуємо свіжі дані
    updated_user = db.get_one("SELECT login, nickname, role FROM users WHERE id = %s", [user["id"]])
    return {
        "status": "ok", 
        "login": updated_user["login"],
        "username": updated_user["login"], 
        "nickname": updated_user["nickname"]
    }

class LoginRequest(BaseModel):
    login: Optional[str] = None
    username: Optional[str] = None
    password: str

class RegisterRequest(BaseModel):
    login: Optional[str] = None
    username: Optional[str] = None
    password: str
    nickname: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str

def hash_password(password: str, salt: Optional[str] = None) -> str:
    if salt is None:
        salt = os.urandom(16).hex()
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
    return f"{salt}${pwd_hash}"

def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, hash_val = stored_hash.split('$')
        return hash_password(password, salt) == stored_hash
    except ValueError:
        return False

@router.post("/register")
async def register(req: RegisterRequest):
    db = get_db()
    raw_login = req.login or req.username
    if not raw_login:
        raise HTTPException(status_code=400, detail="Логін є обов'язковим")
        
    user_login = raw_login.strip()
    nickname = req.nickname.strip() if req.nickname else user_login
    
    if not validate_field(user_login):
        raise HTTPException(status_code=400, detail="Логін має бути від 1 до 20 символів і містити лише літери та цифри (без крапок)")
    if not validate_field(nickname):
        raise HTTPException(status_code=400, detail="Нікнейм має бути від 1 до 20 символів і містити лише літери та цифри (без крапок)")
    if not req.password or len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Пароль має містити не менше 6 символів")
        
    # Check if login exists
    existing_user = db.get_one("SELECT id FROM users WHERE LOWER(login) = LOWER(%s)", [user_login])
    if existing_user:
        raise HTTPException(status_code=400, detail="Користувач з таким логіном вже існує")
        
    # Check if nickname exists
    existing_nick = db.get_one("SELECT id FROM users WHERE LOWER(nickname) = LOWER(%s)", [nickname])
    if existing_nick:
        raise HTTPException(status_code=400, detail="Користувач з таким нікнеймом вже існує")
    
    pwd_hash = hash_password(req.password)
    db.execute("INSERT INTO users (login, nickname, password_hash, role) VALUES (%s, %s, %s, 'viewer')", [user_login, nickname, pwd_hash])
    return {"status": "ok"}

@router.post("/login")
async def login(req: LoginRequest, response: Response):
    db = get_db()
    raw_login = req.login or req.username or ""
    user_login = raw_login.strip()
    user = db.get_one("SELECT * FROM users WHERE login = %s", [user_login])
    if not user or not verify_password(req.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Невірний логін або пароль")
    
    # Update timestamps
    db.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP, last_activity = CURRENT_TIMESTAMP WHERE login = %s", [user['login']])
    
    # Store in session
    response.set_cookie(key="login", value=urllib.parse.quote(user['login']), httponly=True)
    response.set_cookie(key="username", value=urllib.parse.quote(user['login']), httponly=True)
    response.set_cookie(key="role", value=user['role'], httponly=True)
    
    pref = db.get_one("SELECT site_lang, site_theme FROM user_preferences WHERE user_id = %s", [user['id']])
    site_lang = pref['site_lang'] if pref else 'uk'
    site_theme = pref['site_theme'] if pref and pref.get('site_theme') else 'light'

    score = user.get('score', 0) or 0
    level = user.get('level', 1) or 1

    return {
        "logged_in": True,
        "login": user['login'],
        "username": user['login'],
        "nickname": user['nickname'] or user['login'],
        "role": user['role'],
        "site_lang": site_lang,
        "site_theme": site_theme,
        "score": score,
        "level": level,
        "level_title": get_level_title(level),
    }

@router.get("/me")
async def me(request: Request):
    user_login = get_auth_login_from_cookie(request)
    role = request.cookies.get("role")
    if not user_login:
        return {"logged_in": False}
    
    db = get_db()
    db.execute("UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE login = %s", [user_login])

    user = db.get_one("SELECT id, login, nickname, score, level, role FROM users WHERE login = %s", [user_login])
    site_lang = 'uk'
    site_theme = 'light'
    nickname = user_login
    score = 0
    level = 1
    if user:
        nickname = user['nickname'] or user_login
        score = user.get('score', 0) or 0
        level = user.get('level', 1) or 1
        role = user.get('role', role)
        pref = db.get_one("SELECT site_lang, site_theme FROM user_preferences WHERE user_id = %s", [user['id']])
        if pref:
            site_lang = pref['site_lang']
            site_theme = pref.get('site_theme', 'light')

    return {
        "logged_in": True,
        "login": user_login,
        "username": user_login,
        "nickname": nickname,
        "role": role,
        "site_lang": site_lang,
        "site_theme": site_theme,
        "score": score,
        "level": level,
        "level_title": get_level_title(level),
    }

@router.post("/change-password")
async def change_password(req: PasswordChangeRequest, request: Request):
    user_login = get_auth_login_from_cookie(request)
    if not user_login:
        raise HTTPException(status_code=401, detail="Not logged in")
        
    db = get_db()
    user = db.get_one("SELECT id, password_hash FROM users WHERE login = %s", [user_login])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if not verify_password(req.old_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Невірний старий пароль")

    if not req.new_password or len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Новий пароль має містити не менше 6 символів")
        
    new_hash = hash_password(req.new_password)
    db.execute("UPDATE users SET password_hash = %s WHERE id = %s", [new_hash, user["id"]])
    return {"status": "ok", "message": "Пароль успішно змінено"}

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("login")
    response.delete_cookie("username")
    response.delete_cookie("role")
    return {"status": "ok"}

class PreferencesUpdateRequest(BaseModel):
    site_lang: Optional[str] = None
    site_theme: Optional[str] = None

@router.get("/preferences")
async def get_preferences(request: Request):
    user_login = get_auth_login_from_cookie(request)
    if not user_login:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    db = get_db()
    user = db.get_one("SELECT id FROM users WHERE login = %s", [user_login])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    pref = db.get_one("SELECT site_lang, site_theme FROM user_preferences WHERE user_id = %s", [user["id"]])
    if not pref:
        return {"site_lang": "uk", "site_theme": "light"}
    return {"site_lang": pref["site_lang"], "site_theme": pref.get("site_theme", "light")}

@router.post("/preferences")
async def update_preferences(req: PreferencesUpdateRequest, request: Request):
    user_login = get_auth_login_from_cookie(request)
    if not user_login:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    if req.site_lang is not None and req.site_lang not in ["uk", "en"]:
        raise HTTPException(status_code=400, detail="Invalid language")
    if req.site_theme is not None and req.site_theme not in ["light", "dark"]:
        raise HTTPException(status_code=400, detail="Invalid theme")
    if req.site_lang is None and req.site_theme is None:
        raise HTTPException(status_code=400, detail="No preferences to update")
        
    db = get_db()
    user = db.get_one("SELECT id FROM users WHERE login = %s", [user_login])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.execute("""
        INSERT INTO user_preferences (user_id, site_lang, site_theme, updated_at)
        VALUES (%s, COALESCE(%s, 'uk'), COALESCE(%s, 'light'), CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            site_lang = COALESCE(%s, user_preferences.site_lang),
            site_theme = COALESCE(%s, user_preferences.site_theme),
            updated_at = CURRENT_TIMESTAMP
    """, [user["id"], req.site_lang, req.site_theme, req.site_lang, req.site_theme])
    
    result = {"status": "ok"}
    if req.site_lang is not None:
        result["site_lang"] = req.site_lang
    if req.site_theme is not None:
        result["site_theme"] = req.site_theme
    return result
