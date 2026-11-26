"""Public event collection and admin analytics dashboard."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..analytics_service import build_dashboard, ingest_events
from ..database import get_db
from ..models import Tenant
from ..security import AdminDep, get_tenant
from sqlalchemy.orm import Session

public_router = APIRouter(prefix="/api/analytics", tags=["analytics"])
admin_router = APIRouter(prefix="/api/admin/analytics", tags=["analytics-admin"])


class AnalyticsEventIn(BaseModel):
    event: str
    path: str = ""
    product_slug: str | None = None
    visitor_key: str
    session_key: str
    referrer: str | None = None


class AnalyticsCollectIn(BaseModel):
    events: list[AnalyticsEventIn] = Field(default_factory=list)


@public_router.post("/events")
def collect_analytics_events(
    body: AnalyticsCollectIn,
    request: Request,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    ua = request.headers.get("user-agent")
    payload = [e.model_dump() for e in body.events]
    accepted = ingest_events(db, tenant.id, payload, user_agent=ua)
    return {"ok": True, "accepted": accepted}


@admin_router.get("")
def get_analytics_dashboard(
    days: int = 30,
    db: Session = Depends(get_db),
    tenant: Tenant = AdminDep,
):
    return build_dashboard(db, tenant.id, days=days)