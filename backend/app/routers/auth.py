import time
from collections import defaultdict
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Tenant, User
from ..schemas import LoginIn, MeOut, TokenOut, UserOut
from ..security import (
    create_access_token,
    get_current_user,
    get_tenant,
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


@router.post("/login", response_model=TokenOut)
def login(
    payload: LoginIn,
    request: Request,
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    throttle_key = f"{_client_ip(request)}:{payload.username}"
    _throttle(throttle_key)
    user = db.scalar(
        select(User).where(
            User.tenant_id == tenant.id, User.username == payload.username
        )
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")
    _clear_throttle(throttle_key)
    return TokenOut(access_token=create_access_token(user), tenant=tenant)


@router.get("/me", response_model=MeOut)
def me(
    user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    return MeOut(user=UserOut.model_validate(user), tenant=tenant)
