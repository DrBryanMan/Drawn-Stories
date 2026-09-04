from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from server.db import get_db

router = APIRouter(prefix="/api/ratings", tags=["ratings"])

class RatingUpdate(BaseModel):
    entity_type: str
    entity_id: int
    rating: int

def get_current_user_id(request: Request):
    user_login = request.cookies.get("login") or request.cookies.get("username")
    if not user_login:
        return None
    db = get_db()
    user = db.get_one("SELECT id FROM users WHERE login = %s", [user_login])
    return user["id"] if user else None

@router.get("/{entity_type}/{entity_id}")
async def get_rating(entity_type: str, entity_id: int, request: Request):
    if entity_type not in ["volume", "issue", "manga_chapter"]:
        raise HTTPException(status_code=400, detail="Некоректний тип сутності")
    
    db = get_db()
    user_id = get_current_user_id(request)
    
    # Get user rating if logged in
    user_rating = None
    if user_id:
        row = db.get_one(
            "SELECT rating FROM user_ratings WHERE user_id = %s AND entity_type = %s AND entity_id = %s",
            [user_id, entity_type, entity_id]
        )
        if row:
            user_rating = row["rating"]

    # Calculate average rating
    stats = db.get_one(
        """
        SELECT AVG(rating) as avg_rating, COUNT(*) as count 
        FROM user_ratings 
        WHERE entity_type = %s AND entity_id = %s
        """,
        [entity_type, entity_id]
    )
    
    return {
        "user_rating": user_rating,
        "average": round(stats["avg_rating"], 2) if stats and stats["avg_rating"] is not None else 0,
        "count": stats["count"] if stats else 0
    }

@router.post("/update")
async def update_rating(data: RatingUpdate, request: Request):
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Необхідно увійти в систему")
        
    if data.entity_type not in ["volume", "issue", "manga_chapter"]:
        raise HTTPException(status_code=400, detail="Некоректний тип сутності")
        
    if data.rating < 1 or data.rating > 10:
        raise HTTPException(status_code=400, detail="Оцінка повинна бути від 1 до 10")
        
    db = get_db()
    
    # Insert or update
    db.execute(
        """
        INSERT INTO user_ratings (user_id, entity_type, entity_id, rating)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT(user_id, entity_type, entity_id) DO UPDATE SET rating = excluded.rating
        """,
        [user_id, data.entity_type, data.entity_id, data.rating]
    )
    
    # Recalculate average
    stats = db.get_one(
        """
        SELECT AVG(rating) as avg_rating, COUNT(*) as count 
        FROM user_ratings 
        WHERE entity_type = %s AND entity_id = %s
        """,
        [data.entity_type, data.entity_id]
    )
    
    return {
        "user_rating": data.rating,
        "average": round(stats["avg_rating"], 2) if stats and stats["avg_rating"] is not None else 0,
        "count": stats["count"] if stats else 0
    }

@router.delete("/{entity_type}/{entity_id}")
async def delete_rating(entity_type: str, entity_id: int, request: Request):
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Необхідно увійти в систему")
        
    if entity_type not in ["volume", "issue", "manga_chapter"]:
        raise HTTPException(status_code=400, detail="Некоректний тип сутності")
        
    db = get_db()
    db.execute(
        "DELETE FROM user_ratings WHERE user_id = %s AND entity_type = %s AND entity_id = %s",
        [user_id, entity_type, entity_id]
    )
    
    # Recalculate average
    stats = db.get_one(
        """
        SELECT AVG(rating) as avg_rating, COUNT(*) as count 
        FROM user_ratings 
        WHERE entity_type = %s AND entity_id = %s
        """,
        [entity_type, entity_id]
    )
    
    return {
        "user_rating": None,
        "average": round(stats["avg_rating"], 2) if stats and stats["avg_rating"] is not None else 0,
        "count": stats["count"] if stats else 0
    }
