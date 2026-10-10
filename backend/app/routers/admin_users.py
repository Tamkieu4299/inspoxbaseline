from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..admin_access import (
    ensure_memberships,
    generate_password,
    user_can_access_tenant,
    validate_username,
)
from ..database import get_db
from ..models import Tenant, User, UserTenantMembership
from ..schemas import AdminUserCreateIn, AdminUserCreateOut, AdminUserOut, AdminUserUpdateIn
from ..security import get_current_user, hash_password, require_super_admin

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


def _load_user_out(db: Session, user: User) -> AdminUserOut:
    db.refresh(user)
    user = db.scalar(
        select(User)
        .options(selectinload(User.tenant_memberships))
        .where(User.id == user.id)
    )
    tenant_ids = sorted({m.tenant_id for m in user.tenant_memberships})
    if user.tenant_id and user.tenant_id not in tenant_ids:
        tenant_ids.insert(0, user.tenant_id)
    return AdminUserOut(
        id=user.id,
        username=user.username,
        is_active=user.is_active,
        is_super_admin=user.is_super_admin,
        tenant_ids=tenant_ids,
        created_at=user.created_at,
    )


@router.get("", response_model=list[AdminUserOut])
def list_admin_users(
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    users = (
        db.execute(
            select(User)
            .options(selectinload(User.tenant_memberships))
            .order_by(User.username)
        )
        .scalars()
        .all()
    )
    return [_load_user_out(db, u) for u in users]


@router.post("", response_model=AdminUserCreateOut, status_code=201)
def create_admin_user(
    payload: AdminUserCreateIn,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    try:
        username = validate_username(payload.username)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if db.scalar(select(User).where(User.username == username)):
        raise HTTPException(status_code=409, detail="Username already exists")

    is_super = bool(payload.is_super_admin)
    tenant_ids = list(dict.fromkeys(payload.tenant_ids or []))

    if not is_super and not tenant_ids:
        raise HTTPException(status_code=400, detail="Assign at least one tenant or mark as super admin.")

    for tid in tenant_ids:
        if db.get(Tenant, tid) is None:
            raise HTTPException(status_code=400, detail=f"Tenant id {tid} not found")

    plain_password = generate_password()
    if tenant_ids:
        home_tenant_id = tenant_ids[0]
    else:
        first = db.scalar(select(Tenant).order_by(Tenant.id))
        if first is None:
            raise HTTPException(status_code=400, detail="No tenants exist yet.")
        home_tenant_id = first.id

    user = User(
        username=username,
        tenant_id=home_tenant_id,
        password_hash=hash_password(plain_password),
        is_active=True,
        is_super_admin=is_super,
    )
    db.add(user)
    db.flush()
    if not is_super:
        ensure_memberships(db, user, tenant_ids)
    db.commit()
    db.refresh(user)
    return AdminUserCreateOut(user=_load_user_out(db, user), generated_password=plain_password)


@router.put("/{user_id}", response_model=AdminUserOut)
def update_admin_user(
    user_id: int,
    payload: AdminUserUpdateIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin),
):
    user = db.scalar(
        select(User).options(selectinload(User.tenant_memberships)).where(User.id == user_id)
    )
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == actor.id and payload.is_super_admin is False:
        raise HTTPException(status_code=400, detail="You cannot remove your own super admin role.")
    if payload.is_active is False and user.id == actor.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")

    if payload.is_super_admin is not None:
        user.is_super_admin = payload.is_super_admin
    if payload.is_active is not None:
        user.is_active = payload.is_active

    if payload.tenant_ids is not None:
        if user.is_super_admin:
            ensure_memberships(db, user, [])
        else:
            if not payload.tenant_ids:
                raise HTTPException(status_code=400, detail="Non–super-admin users need at least one tenant.")
            for tid in payload.tenant_ids:
                if db.get(Tenant, tid) is None:
                    raise HTTPException(status_code=400, detail=f"Tenant id {tid} not found")
            ensure_memberships(db, user, payload.tenant_ids)
            user.tenant_id = payload.tenant_ids[0]

    db.commit()
    return _load_user_out(db, user)


@router.post("/{user_id}/reset-password", response_model=AdminUserCreateOut)
def reset_admin_user_password(
    user_id: int,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    plain_password = generate_password()
    user.password_hash = hash_password(plain_password)
    db.commit()
    return AdminUserCreateOut(user=_load_user_out(db, user), generated_password=plain_password)
