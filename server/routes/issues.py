from fastapi import APIRouter, HTTPException, Request
from ..db import get_db

router = APIRouter(prefix="/api/issues", tags=["issues"])

@router.post("")
async def create_issue(data: dict):
    db = get_db()
    
    if not data.get("issue_number") and not data.get("name"):
        raise HTTPException(status_code=400, detail="Номер випуску або назва обов'язкові")

    columns = []
    placeholders = []
    params = []
    
    allowed_fields = [
        "name", "issue_number", "volume_id", "cv_id", "cv_slug", 
        "cv_img", "cover_date", "release_date", "description"
    ]
    
    for key, value in data.items():
        if key in allowed_fields and value is not None:
            columns.append(key)
            placeholders.append("?")
            params.append(value)
            
    if not columns:
        raise HTTPException(status_code=400, detail="Немає даних для збереження")

    sql = f"INSERT INTO issues ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
    db.execute(sql, params)
    
    new_id = db.get_one("SELECT last_insert_rowid() as id")["id"]
    return {"message": "Випуск успішно створено", "id": new_id}
