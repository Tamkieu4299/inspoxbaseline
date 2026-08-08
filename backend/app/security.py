import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, Header, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import Tenant, User

_PBKDF2_ITER = 260_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _PBKDF2_ITER)
    return f"pbkdf2_sha256${_PBKDF2_ITER}${salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _algo, iter_s, salt, hash_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt), int(iter_s)
        )
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, TypeError):
        return False


def create_access_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "tenant_id": user.tenant_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRES_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/admin/auth/login", auto_error=False)


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.get(User, int(payload.get("sub", 0)))
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user


def _subdomain_from_host(host: str) -> str | None:
    host = host.strip()
    if ":" in host:
        host = host.split(":", 1)[0]
    labels = host.split(".")
    first = labels[0] if labels else ""
    if len(labels) >= 2 and first and first != "www":
        return first
    return None


def get_tenant(
    x_tenant: str | None = Header(default=None, alias="X-Tenant"),
    host: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Tenant:
    requested = (x_tenant or "").strip()
    if not requested and host:
        requested = _subdomain_from_host(host) or ""
    tenant = None
    if requested:
        tenant = db.scalar(
            select(Tenant).where(Tenant.slug == requested, Tenant.is_active.is_(True))
        )
    if tenant is None:
        tenant = db.scalar(
            select(Tenant).where(Tenant.is_active.is_(True)).order_by(Tenant.id)
        )
    if tenant is None:
        raise HTTPException(status_code=404, detail="No tenant configured")
    return tenant


def require_admin(
    user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_tenant),
) -> Tenant:
    return tenant


AdminDep = Depends(require_admin)
