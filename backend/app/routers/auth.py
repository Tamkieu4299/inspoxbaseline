from fastapi import APIRouter, Depends, HTTPException
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


@router.post("/login", response_model=TokenOut)
def login(
    payload: LoginIn,
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    user = db.scalar(
        select(User).where(
            User.tenant_id == tenant.id, User.username == payload.username
        )
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")
    return TokenOut(access_token=create_access_token(user), tenant=tenant)


@router.get("/me", response_model=MeOut)
def me(
    user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    return MeOut(user=UserOut.model_validate(user), tenant=tenant)
