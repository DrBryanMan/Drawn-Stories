from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import uuid
import shutil

router = APIRouter(prefix="/api/images", tags=["images"])

# Map types to subdirectories
TYPE_MAP = {
    "volume": "volumes",
    "issue": "issues",
    "collection": "collections",
    "reading-order": "reading-orders",
    "event": "events",
    "manga-chapter": "issues",
    "publisher": "publishers",
    "character": "characters",
    "essence": "essences"
}

# Resolve target directory relative to this file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@router.post("/upload/{type_id}")
async def upload_image(type_id: str, file: UploadFile = File(...)):
    if type_id not in TYPE_MAP:
        raise HTTPException(status_code=400, detail="Invalid content type")
    
    # Check extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".webp"]:
        raise HTTPException(status_code=400, detail="Unsupported file format")
    
    # Target directory
    subdir = TYPE_MAP[type_id]
    target_dir = os.path.join(BASE_DIR, "images", subdir)
    os.makedirs(target_dir, exist_ok=True)
    
    # Unique filename
    filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(target_dir, filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Return path relative to /images mount
    return {"url": f"/images/{subdir}/{filename}"}
