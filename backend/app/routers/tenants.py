import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..admin_access import validate_username
from ..config import settings
from ..database import get_db
from ..models import HomeContent, SiteSettings, Tenant, User
from ..schemas import (
    ResetPasswordIn,
    TenantAdminOut,
    TenantCreateIn,
    TenantUpdateIn,
)
from ..admin_access import user_tenant_ids
from ..security import get_current_user, hash_password, require_super_admin

router = APIRouter(prefix="/api/admin/tenants", tags=["tenants"])

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def _to_out(t: Tenant, db: Session) -> TenantAdminOut:
    admin = db.scalar(
        select(User).where(User.tenant_id == t.id, User.username.like(f"admin-{t.slug}"))
    )
    if admin is None:
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
    user: User = Depends(get_current_user),
):
    if user.is_super_admin:
        tenants = db.execute(select(Tenant).order_by(Tenant.id)).scalars().all()
    else:
        ids = user_tenant_ids(db, user)
        if not ids:
            return []
        tenants = (
            db.execute(select(Tenant).where(Tenant.id.in_(ids)).order_by(Tenant.name))
            .scalars()
            .all()
        )
    return [_to_out(t, db) for t in tenants]


@router.post("", response_model=TenantAdminOut, status_code=201)
def create_tenant(
    payload: TenantCreateIn,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
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

    bootstrap_username = validate_username(f"admin-{slug}")
    if db.scalar(select(User).where(User.username == bootstrap_username)):
        bootstrap_username = validate_username(f"admin-{slug}-{tenant.id}")

    db.add(
        User(
            tenant_id=tenant.id,
            username=bootstrap_username,
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
    if not user.is_super_admin and tenant_id not in user_tenant_ids(db, user):
        raise HTTPException(status_code=403, detail="No access to this tenant")
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if payload.is_active is False and tenant.id == user.tenant_id and not user.is_super_admin:
        raise HTTPException(status_code=400, detail="You cannot disable your own tenant.")
    if payload.name is not None and payload.name.strip():
        tenant.name = payload.name.strip()
    if payload.is_active is not None and user.is_super_admin:
        tenant.is_active = payload.is_active
    db.commit()
    db.refresh(tenant)
    return _to_out(tenant, db)


@router.post("/{tenant_id}/reset-password")
def reset_password(
    tenant_id: int,
    payload: ResetPasswordIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user.is_super_admin and tenant_id not in user_tenant_ids(db, user):
        raise HTTPException(status_code=403, detail="No access to this tenant")
    password = payload.password
    if (
        len(password) < 10
        or not any(c.isdigit() for c in password)
        or not any(c.isupper() for c in password)
    ):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 10 characters and include a number and an uppercase letter",
        )
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    admin = db.scalar(
        select(User).where(User.tenant_id == tenant.id, User.username.like(f"admin-{tenant.slug}%"))
    )
    if admin is None:
        admin = db.scalar(
            select(User).where(User.tenant_id == tenant.id, User.username == "admin")
        )
    if admin is None:
        bootstrap_username = validate_username(f"admin-{tenant.slug}")
        admin = User(tenant_id=tenant.id, username=bootstrap_username, password_hash="")
        db.add(admin)
        db.flush()
    admin.password_hash = hash_password(password)
    db.commit()
    return {"ok": True}
