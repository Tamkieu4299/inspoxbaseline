import time
from collections import defaultdict
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..admin_access import user_tenant_ids
from ..database import get_db
from ..models import Tenant, User
from ..schemas import LoginIn, MeOut, TenantOut, TokenOut, UserOut
from ..security import (
    create_access_token,
    get_current_user,
    get_tenant,
    require_tenant_admin,
    verify_password,
)

router = APIRouter(prefix="/api/admin/auth", tags=["auth"])

_MAX_ATTEMPTS = 10
_WINDOW_SECONDS = 300
_lock = Lock()
_attempts: dict[str, list[float]] = defaultdict(list)


def _throttle(key: str) -> None:
    now = time.monotonic()
    with _lock:
        bucket = [t for t in _attempts[key] if t >= now - _WINDOW_SECONDS]
        if len(bucket) >= _MAX_ATTEMPTS:
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts. Please try again later.",
            )
        bucket.append(now)
        _attempts[key] = bucket


def _clear_throttle(key: str) -> None:
    with _lock:
        _attempts.pop(key, None)


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _default_tenant_for_user(db: Session, user: User) -> Tenant:
    ids = user_tenant_ids(db, user)
    if ids:
        tenant = db.scalar(select(Tenant).where(Tenant.id.in_(ids)).order_by(Tenant.id))
        if tenant:
            return tenant
    tenant = db.scalar(select(Tenant).where(Tenant.is_active.is_(True)).order_by(Tenant.id))
    if tenant is None:
        raise HTTPException(status_code=503, detail="No tenant configured")
    return tenant


def _accessible_tenants(db: Session, user: User) -> list[Tenant]:
    ids = user_tenant_ids(db, user)
    if not ids:
        return []
    return (
        db.execute(select(Tenant).where(Tenant.id.in_(ids)).order_by(Tenant.name))
        .scalars()
        .all()
    )


@router.post("/login", response_model=TokenOut)
def login(
    payload: LoginIn,
    request: Request,
    db: Session = Depends(get_db),
):
    username = payload.username.strip().lower()
    throttle_key = f"{_client_ip(request)}:{username}"
    _throttle(throttle_key)
    user = db.scalar(select(User).where(User.username == username))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")
    if not user.is_super_admin and not user_tenant_ids(db, user):
        raise HTTPException(status_code=403, detail="No tenant access assigned")
    _clear_throttle(throttle_key)
    tenant = _default_tenant_for_user(db, user)
    accessible = _accessible_tenants(db, user)
    return TokenOut(
        access_token=create_access_token(user),
        tenant=TenantOut.model_validate(tenant),
        user=UserOut.model_validate(user),
        accessible_tenants=[TenantOut.model_validate(t) for t in accessible],
    )


@router.get("/me", response_model=MeOut)
def me(
    user: User = Depends(get_current_user),
    tenant: Tenant = Depends(require_tenant_admin),
    db: Session = Depends(get_db),
):
    accessible = _accessible_tenants(db, user)
    return MeOut(
        user=UserOut.model_validate(user),
        tenant=TenantOut.model_validate(tenant),
        accessible_tenants=[TenantOut.model_validate(t) for t in accessible],
    )
