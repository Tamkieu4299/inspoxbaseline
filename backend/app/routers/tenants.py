import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import HomeContent, SiteSettings, Tenant, User
from ..schemas import (
    ResetPasswordIn,
    TenantAdminOut,
    TenantCreateIn,
    TenantUpdateIn,
)
from ..security import get_current_user, hash_password

router = APIRouter(prefix="/api/admin/tenants", tags=["tenants"])

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def _to_out(t: Tenant, db: Session) -> TenantAdminOut:
    admin = db.scalar(
        select(User).where(User.tenant_id == t.id, User.username == "admin")
    )
    return TenantAdminOut(
        id=t.id,
        slug=t.slug,
        name=t.name,
        is_active=t.is_active,
        created_at=t.created_at,
        admin_username=admin.username if admin else None,
    )


@router.get("", response_model=list[TenantAdminOut])
def list_tenants(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    tenants = db.execute(select(Tenant).order_by(Tenant.id)).scalars().all()
    return [_to_out(t, db) for t in tenants]


@router.post("", response_model=TenantAdminOut, status_code=201)
def create_tenant(
    payload: TenantCreateIn,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    slug = payload.slug.strip().lower()
    if not _SLUG_RE.match(slug):
        raise HTTPException(
            status_code=400,
            detail="Slug can only contain lowercase letters, numbers and hyphens.",
        )
    if db.scalar(select(Tenant).where(Tenant.slug == slug)):
        raise HTTPException(status_code=409, detail="Tenant slug already exists")
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tenant name is required")

    tenant = Tenant(slug=slug, name=name)
    db.add(tenant)
    db.flush()

    db.add(
        User(
            tenant_id=tenant.id,
            username="admin",
            password_hash=hash_password(payload.admin_password or settings.ADMIN_DEFAULT_PASSWORD),
        )
    )
    db.add(SiteSettings(tenant_id=tenant.id, site_name=name.upper()))
    db.add(HomeContent(tenant_id=tenant.id))
    db.commit()
    db.refresh(tenant)
    return _to_out(tenant, db)


@router.put("/{tenant_id}", response_model=TenantAdminOut)
def update_tenant(
    tenant_id: int,
    payload: TenantUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if payload.is_active is False and tenant.id == user.tenant_id:
        raise HTTPException(
            status_code=400, detail="You cannot disable your own tenant."
        )
    if payload.name is not None and payload.name.strip():
        tenant.name = payload.name.strip()
    if payload.is_active is not None:
        tenant.is_active = payload.is_active
    db.commit()
    db.refresh(tenant)
    return _to_out(tenant, db)


@router.post("/{tenant_id}/reset-password")
def reset_password(
    tenant_id: int,
    payload: ResetPasswordIn,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    admin = db.scalar(
        select(User).where(User.tenant_id == tenant.id, User.username == "admin")
    )
    if admin is None:
        admin = User(tenant_id=tenant.id, username="admin", password_hash="")
        db.add(admin)
    admin.password_hash = hash_password(payload.password)
    db.commit()
    return {"ok": True}
