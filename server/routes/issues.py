from fastapi import APIRouter, HTTPException, Request, Query
from ..db import get_db
from typing import Optional

router = APIRouter(prefix="/api/issues", tags=["issues"])

@router.get("")
async def get_issues(
    name: Optional[str] = None,
    volume_name: Optional[str] = None,
    issue_number: Optional[str] = None,
    ds_id: Optional[int] = None,
    volume_id: Optional[int] = None,
    hikka_slug: Optional[str] = None,
    cv_vol_id: Optional[int] = None,
    exact: bool = False,
    limit: int = Query(50, ge=1, le=100)
):
    db = get_db()
    clauses = []
    params = []

    if ds_id:
        clauses.append("i.id = ?")
        params.append(ds_id)
    if volume_id:
        clauses.append("i.volume_id = ?")
        params.append(volume_id)
    if hikka_slug:
        clauses.append("ULOWER(v.hikka_slug) LIKE ?")
        params.append(f"%{hikka_slug.lower()}%")
    if cv_vol_id:
        clauses.append("v.cv_id = ?")
        params.append(cv_vol_id)
    
    if name:
        if exact:
            clauses.append("ULOWER(i.name) = ?")
            params.append(name.lower())
        else:
            words = [w.strip() for w in name.split() if w.strip()]
            if words:
                name_parts = []
                for word in words:
                    name_parts.append("ULOWER(i.name) LIKE ?")
                    params.append(f"%{word.lower()}%")
                clauses.append(f"({' AND '.join(name_parts)})")

    if volume_name:
        if exact:
            clauses.append("(ULOWER(v.name) = ? OR ULOWER(v.name_uk) = ?)")
            params.extend([volume_name.lower(), volume_name.lower()])
        else:
            words = [w.strip() for w in volume_name.split() if w.strip()]
            if words:
                vol_parts = []
                for word in words:
                    vol_parts.append("(ULOWER(v.name) LIKE ? OR ULOWER(v.name_uk) LIKE ?)")
                    params.extend([f"%{word.lower()}%", f"%{word.lower()}%"])
                clauses.append(f"({' AND '.join(vol_parts)})")

    if issue_number:
        clauses.append("i.issue_number = ?")
        params.append(issue_number)

    if not clauses:
        return {"data": [], "total": 0}

    where = " WHERE " + " AND ".join(clauses)
    query = f"""
        SELECT i.*, v.name as volume_name, v.name_uk as volume_name_uk
        FROM issues i
        LEFT JOIN volumes v ON i.volume_id = v.id
        {where}
        ORDER BY COALESCE(v.name_uk, v.name) ASC, CAST(i.issue_number AS FLOAT) ASC, i.issue_number ASC
        LIMIT ?
    """
    items = db.get_all(query, params + [limit])
    return {"data": items, "total": len(items)}

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
