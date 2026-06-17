from fastapi import APIRouter, HTTPException
from ..db import get_db

router = APIRouter(prefix="/api/events", tags=["events"])

@router.post("")
async def create_event(data: dict):
    db = get_db()
    
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="Назва події обов'язкова")

    columns = []
    placeholders = []
    params = []
    
    allowed_fields = ["name", "description", "start_year", "end_year", "cv_img"]
    
    for key, value in data.items():
        if key in allowed_fields and value is not None:
            columns.append(key)
            placeholders.append("?")
            params.append(value)
            
    sql = f"INSERT INTO events ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
    db.execute(sql, params)
    
    new_id = db.get_one("SELECT last_insert_rowid() as id")["id"]
    return {"message": "Подію створено", "id": new_id}
