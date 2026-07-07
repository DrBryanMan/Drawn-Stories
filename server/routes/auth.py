from fastapi import APIRouter, Request, Response, HTTPException, status, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import hashlib
import os
import shutil
from server.db import get_db
from fastapi.responses import FileResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Resolve target directory relative to this file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
USERS_IMAGES_DIR = os.path.join(BASE_DIR, "images", "users")

@router.post("/upload-avatar")
async def upload_avatar(request: Request, avatar: UploadFile = File(...)):
    username = request.cookies.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    if avatar.content_type not in ["image/jpeg", "image/webp"]:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    ext = ".jpg" if avatar.content_type == "image/jpeg" else ".webp"
    filename = f"{username}_avatar{ext}"
    
    # Ensure directory exists
    os.makedirs(USERS_IMAGES_DIR, exist_ok=True)
    
    with open(os.path.join(USERS_IMAGES_DIR, filename), "wb") as buffer:
        shutil.copyfileobj(avatar.file, buffer)
    
    return {"url": f"/api/auth/avatar/{username}?t={os.urandom(4).hex()}"}

@router.get("/avatar/{username}")
async def get_avatar(username: str):
    # Check for jpg or webp
    for ext in [".jpg", ".webp"]:
        path = os.path.join(USERS_IMAGES_DIR, f"{username}_avatar{ext}")
        if os.path.exists(path):
            return FileResponse(path)
    
    # Return 404 if no avatar found, frontend will handle it
    raise HTTPException(status_code=404, detail="Avatar not found")

class ProfileUpdateRequest(BaseModel):
    new_username: str

@router.put("/update-profile")
async def update_profile(req: ProfileUpdateRequest, request: Request, response: Response):
    old_username = request.cookies.get("username")
    if not old_username:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    new_username = req.new_username.strip()
    if not new_username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")
        
    if old_username == new_username:
        return {"status": "ok", "message": "No change needed"}
        
    db = get_db()
    # Check if new username is taken
    existing = db.get_one("SELECT id FROM users WHERE username = ?", [new_username])
    if existing:
        raise HTTPException(status_code=400, detail="Користувач з таким ім'ям вже існує")
    
    # Update username in database
    db.execute("UPDATE users SET username = ? WHERE username = ?", [new_username, old_username])
    
    # Rename avatar files if they exist
    os.makedirs(USERS_IMAGES_DIR, exist_ok=True)
    for ext in [".jpg", ".webp"]:
        old_path = os.path.join(USERS_IMAGES_DIR, f"{old_username}_avatar{ext}")
        new_path = os.path.join(USERS_IMAGES_DIR, f"{new_username}_avatar{ext}")
        if os.path.exists(old_path):
            try:
                os.rename(old_path, new_path)
            except Exception as e:
                print(f"Error renaming avatar: {e}")
    
    # Update cookie
    response.set_cookie(key="username", value=new_username, httponly=True)
    
    return {"status": "ok", "username": new_username}

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str

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
    # Check if user exists
    existing = db.get_one("SELECT id FROM users WHERE username = ?", [req.username])
    if existing:
        raise HTTPException(status_code=400, detail="Користувач з таким ім'ям вже існує")
    
    pwd_hash = hash_password(req.password)
    db.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'viewer')", [req.username, pwd_hash])
    return {"status": "ok"}

@router.post("/login")
async def login(req: LoginRequest, response: Response):
    db = get_db()
    user = db.get_one("SELECT * FROM users WHERE username = ?", [req.username])
    if not user or not verify_password(req.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Невірне ім'я користувача або пароль")
    
    # Update timestamps
    db.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP, last_activity = CURRENT_TIMESTAMP WHERE username = ?", [user['username']])
    
    # Store in session (simple cookie for now)
    # In a real app we'd use a JWT or a proper session store
    response.set_cookie(key="username", value=user['username'], httponly=True)
    response.set_cookie(key="role", value=user['role'], httponly=True)
    
    pref = db.get_one("SELECT site_lang FROM user_preferences WHERE user_id = ?", [user['id']])
    site_lang = pref['site_lang'] if pref else 'uk'
    
    return {"logged_in": True, "username": user['username'], "role": user['role'], "site_lang": site_lang}

@router.get("/me")
async def me(request: Request):
    username = request.cookies.get("username")
    role = request.cookies.get("role")
    if not username:
        return {"logged_in": False}
    
    db = get_db()
    db.execute("UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE username = ?", [username])
    
    user = db.get_one("SELECT id FROM users WHERE username = ?", [username])
    site_lang = 'uk'
    if user:
        pref = db.get_one("SELECT site_lang FROM user_preferences WHERE user_id = ?", [user['id']])
        if pref:
            site_lang = pref['site_lang']
            
    return {"logged_in": True, "username": username, "role": role, "site_lang": site_lang}

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("username")
    response.delete_cookie("role")
    return {"status": "ok"}

class PreferencesUpdateRequest(BaseModel):
    site_lang: str

@router.get("/preferences")
async def get_preferences(request: Request):
    username = request.cookies.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    db = get_db()
    user = db.get_one("SELECT id FROM users WHERE username = ?", [username])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    pref = db.get_one("SELECT site_lang FROM user_preferences WHERE user_id = ?", [user["id"]])
    if not pref:
        return {"site_lang": "uk"}
    return {"site_lang": pref["site_lang"]}

@router.post("/preferences")
async def update_preferences(req: PreferencesUpdateRequest, request: Request):
    username = request.cookies.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Not logged in")
        
    if req.site_lang not in ["uk", "en"]:
        raise HTTPException(status_code=400, detail="Invalid language")
        
    db = get_db()
    user = db.get_one("SELECT id FROM users WHERE username = ?", [username])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.execute("""
        INSERT INTO user_preferences (user_id, site_lang, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            site_lang = excluded.site_lang,
            updated_at = CURRENT_TIMESTAMP
    """, [user["id"], req.site_lang])
    
    return {"status": "ok", "site_lang": req.site_lang}
