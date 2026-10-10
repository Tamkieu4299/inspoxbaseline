"""Platform admin users and tenant access checks."""

from __future__ import annotations

import re
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Tenant, User, UserTenantMembership

USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,48}[a-z0-9]$|^[a-z0-9]{3,50}$")


def normalize_username(username: str) -> str:
    return username.strip().lower()


def validate_username(username: str) -> str:
    u = normalize_username(username)
    if not USERNAME_RE.match(u):
        raise ValueError(
            "Username must be 3–50 chars, lowercase letters, numbers, dots, hyphens, underscores."
        )
    return u


def generate_password() -> str:
    """Meets admin password policy (10+ chars, upper, digit)."""
    core = secrets.token_urlsafe(9)
    return f"{core}A1!"


def user_tenant_ids(db: Session, user: User) -> set[int]:
    if user.is_super_admin:
        rows = db.execute(select(Tenant.id).where(Tenant.is_active.is_(True))).scalars().all()
        return set(rows)
    ids = {m.tenant_id for m in user.tenant_memberships}
    if user.tenant_id:
        ids.add(user.tenant_id)
    return ids


def user_can_access_tenant(db: Session, user: User, tenant_id: int) -> bool:
    if not user.is_active:
        return False
    if user.is_super_admin:
        return True
    return tenant_id in user_tenant_ids(db, user)


def ensure_memberships(db: Session, user: User, tenant_ids: list[int]) -> None:
    existing = {m.tenant_id for m in user.tenant_memberships}
    target = set(tenant_ids)
    for tid in target - existing:
        db.add(UserTenantMembership(user_id=user.id, tenant_id=tid))
    for tid in existing - target:
        for m in list(user.tenant_memberships):
            if m.tenant_id == tid:
                db.delete(m)
