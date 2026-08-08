from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from sqlalchemy.orm import Session

from ..database import get_db
from ..minio_client import replace_file, save_file
from ..models import Media, Tenant
from ..schemas import MediaOut
from ..security import AdminDep

router = APIRouter(prefix="/api/admin/media", tags=["media"])


@router.post("/upload", response_model=MediaOut)
def upload_file(
    file: UploadFile = File(...),
    db=Depends(get_db),
    tenant: Tenant = AdminDep,
):
    content = file.file.read()
    media = save_file(db, content, file.filename or "file", file.content_type or "application/octet-stream", tenant_id=tenant.id)
    return media


@router.put("/{media_id}", response_model=MediaOut)
def replace_media_file(
    media_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    tenant: Tenant = AdminDep,
):
    media = db.get(Media, media_id)
    if media is None:
        raise HTTPException(status_code=404, detail="Media not found")
    if media.tenant_id != tenant.id:
        raise HTTPException(status_code=404, detail="Media not found")
    content = file.file.read()
    return replace_file(db, media, content, file.content_type or media.content_type)
