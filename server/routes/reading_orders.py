from fastapi import APIRouter, HTTPException
from ..db import get_db

router = APIRouter(prefix="/api/reading-orders", tags=["reading-orders"])

@router.post("")
async def create_reading_order(data: dict):
    db = get_db()
    
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="Назва списку обов'язкова")

    columns = []
    placeholders = []
    params = []
    
    allowed_fields = ["name", "description", "cv_img"]
    
    for key, value in data.items():
        if key in allowed_fields and value is not None:
            columns.append(key)
            placeholders.append("%s")
            params.append(value)
            
    sql = f"INSERT INTO reading_orders ({', '.join(columns)}) VALUES ({', '.join(placeholders)}) RETURNING id"
    new_id = db.get_one(sql, params)["id"]
    return {"message": "Порядок читання створено", "id": new_id}