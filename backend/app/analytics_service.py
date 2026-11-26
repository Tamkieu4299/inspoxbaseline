"""Ingest and aggregate storefront analytics."""

from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import Date, cast, delete, distinct, func, select
from sqlalchemy.orm import Session

from .models import AnalyticsEvent, Order, Product

EVENT_TYPES = frozenset({"page_view", "product_view", "add_to_cart", "checkout_start", "search"})
RETENTION_DAYS = 180
_BOT_UA = re.compile(r"bot|crawl|spider|slurp|facebookexternalhit|whatsapp", re.I)
_VISITOR_RE = re.compile(r"^[a-zA-Z0-9_-]{8,64}$")


def device_class_from_ua(user_agent: str | None) -> str | None:
    if not user_agent:
        return None
    if _BOT_UA.search(user_agent):
        return "bot"
    u = user_agent.lower()
    if "ipad" in u or "tablet" in u:
        return "tablet"
    if "mobile" in u or "android" in u or "iphone" in u:
        return "mobile"
    return "desktop"


def referrer_host(referrer: str | None) -> str | None:
    if not referrer or not referrer.strip():
        return None
    try:
        parsed = urlparse(referrer.strip())
        host = (parsed.netloc or "").lower()
        if host.startswith("www."):
            host = host[4:]
        return host or None
    except Exception:
        return None


def _since(days: int) -> datetime:
    return datetime.utcnow() - timedelta(days=max(1, min(days, 365)))


def ingest_events(
    db: Session,
    tenant_id: int,
    events: list[dict[str, Any]],
    *,
    user_agent: str | None = None,
) -> int:
    if device_class_from_ua(user_agent) == "bot":
        return 0

    product_slugs = {
        str(e.get("product_slug") or "").strip()
        for e in events
        if str(e.get("event") or "") == "product_view" and e.get("product_slug")
    }
    slug_to_id: dict[str, int] = {}
    if product_slugs:
        rows = db.execute(
            select(Product.slug, Product.id).where(
                Product.tenant_id == tenant_id,
                Product.slug.in_(product_slugs),
            )
        ).all()
        slug_to_id = {slug: pid for slug, pid in rows}

    device = device_class_from_ua(user_agent)
    added = 0
    for raw in events[:30]:
        event_type = str(raw.get("event") or "").strip()
        if event_type not in EVENT_TYPES:
            continue
        visitor = str(raw.get("visitor_key") or "").strip()
        session = str(raw.get("session_key") or "").strip()
        if not _VISITOR_RE.match(visitor) or not _VISITOR_RE.match(session):
            continue
        path = str(raw.get("path") or "")[:500]
        ref = str(raw.get("referrer") or "")[:500] or None
        pid = None
        if event_type == "product_view":
            slug = str(raw.get("product_slug") or "").strip()
            pid = slug_to_id.get(slug)
        db.add(
            AnalyticsEvent(
                tenant_id=tenant_id,
                event_type=event_type,
                path=path,
                product_id=pid,
                visitor_key=visitor,
                session_key=session,
                referrer=ref,
                referrer_host=referrer_host(ref),
                device_class=device,
            )
        )
        added += 1
    if added:
        db.commit()
        if added > 0 and __import__("random").random() < 0.02:
            cutoff = datetime.utcnow() - timedelta(days=RETENTION_DAYS)
            db.execute(delete(AnalyticsEvent).where(AnalyticsEvent.occurred_at < cutoff))
            db.commit()
    return added


def _event_filters(tenant_id: int, start: datetime, end: datetime | None):
    clauses = [
        AnalyticsEvent.tenant_id == tenant_id,
        AnalyticsEvent.occurred_at >= start,
    ]
    if end is not None:
        clauses.append(AnalyticsEvent.occurred_at < end)
    return clauses


def _summary_stats(db: Session, tenant_id: int, start: datetime, end: datetime | None = None) -> dict[str, int]:
    filt = _event_filters(tenant_id, start, end)
    row = db.execute(
        select(
            func.count(AnalyticsEvent.id).label("events"),
            func.count(distinct(AnalyticsEvent.visitor_key)).label("visitors"),
            func.count(distinct(AnalyticsEvent.session_key)).label("sessions"),
        ).where(*filt)
    ).one()
    by_type = dict(
        db.execute(
            select(AnalyticsEvent.event_type, func.count(AnalyticsEvent.id))
            .where(*filt)
            .group_by(AnalyticsEvent.event_type)
        ).all()
    )

    orders_q = select(func.count(Order.id)).where(
        Order.tenant_id == tenant_id,
        Order.created_at >= start,
    )
    if end is not None:
        orders_q = orders_q.where(Order.created_at < end)
    orders = int(db.scalar(orders_q) or 0)

    return {
        "page_views": int(by_type.get("page_view", 0)),
        "product_views": int(by_type.get("product_view", 0)),
        "add_to_cart": int(by_type.get("add_to_cart", 0)),
        "checkout_starts": int(by_type.get("checkout_start", 0)),
        "searches": int(by_type.get("search", 0)),
        "unique_visitors": int(row.visitors or 0),
        "sessions": int(row.sessions or 0),
        "orders": orders,
        "total_events": int(row.events or 0),
    }


def build_dashboard(db: Session, tenant_id: int, days: int = 30) -> dict[str, Any]:
    days = max(1, min(days, 365))
    now = datetime.utcnow()
    start = _since(days)
    start_today = datetime(now.year, now.month, now.day)
    summary = _summary_stats(db, tenant_id, start)
    today = _summary_stats(db, tenant_id, start_today)
    yesterday_start = start_today - timedelta(days=1)
    yesterday = _summary_stats(db, tenant_id, yesterday_start, start_today)

    day_col = cast(AnalyticsEvent.occurred_at, Date).label("day")
    daily_rows = db.execute(
        select(
            day_col,
            func.count(AnalyticsEvent.id).label("page_views"),
            func.count(distinct(AnalyticsEvent.visitor_key)).label("unique_visitors"),
            func.count(distinct(AnalyticsEvent.session_key)).label("sessions"),
        )
        .where(
            AnalyticsEvent.tenant_id == tenant_id,
            AnalyticsEvent.occurred_at >= start,
            AnalyticsEvent.event_type == "page_view",
        )
        .group_by(day_col)
        .order_by(day_col)
    ).all()

    product_views_daily = db.execute(
        select(
            day_col,
            func.count(AnalyticsEvent.id).label("views"),
        )
        .where(
            AnalyticsEvent.tenant_id == tenant_id,
            AnalyticsEvent.occurred_at >= start,
            AnalyticsEvent.event_type == "product_view",
        )
        .group_by(day_col)
        .order_by(day_col)
    ).all()
    pv_by_day = {str(r.day): int(r.views) for r in product_views_daily}

    daily = [
        {
            "date": str(r.day),
            "page_views": int(r.page_views),
            "product_views": pv_by_day.get(str(r.day), 0),
            "unique_visitors": int(r.unique_visitors),
            "sessions": int(r.sessions),
        }
        for r in daily_rows
    ]

    top_products = db.execute(
        select(
            AnalyticsEvent.product_id,
            Product.slug,
            Product.name,
            func.count(AnalyticsEvent.id).label("views"),
            func.count(distinct(AnalyticsEvent.visitor_key)).label("unique_visitors"),
        )
        .join(Product, Product.id == AnalyticsEvent.product_id)
        .where(
            AnalyticsEvent.tenant_id == tenant_id,
            AnalyticsEvent.occurred_at >= start,
            AnalyticsEvent.event_type == "product_view",
            AnalyticsEvent.product_id.isnot(None),
        )
        .group_by(AnalyticsEvent.product_id, Product.slug, Product.name)
        .order_by(func.count(AnalyticsEvent.id).desc())
        .limit(25)
    ).all()

    top_paths = db.execute(
        select(
            AnalyticsEvent.path,
            func.count(AnalyticsEvent.id).label("views"),
            func.count(distinct(AnalyticsEvent.visitor_key)).label("unique_visitors"),
        )
        .where(
            AnalyticsEvent.tenant_id == tenant_id,
            AnalyticsEvent.occurred_at >= start,
            AnalyticsEvent.event_type == "page_view",
        )
        .group_by(AnalyticsEvent.path)
        .order_by(func.count(AnalyticsEvent.id).desc())
        .limit(20)
    ).all()

    top_referrers = db.execute(
        select(
            AnalyticsEvent.referrer_host,
            func.count(AnalyticsEvent.id).label("views"),
        )
        .where(
            AnalyticsEvent.tenant_id == tenant_id,
            AnalyticsEvent.occurred_at >= start,
            AnalyticsEvent.referrer_host.isnot(None),
            AnalyticsEvent.referrer_host != "",
        )
        .group_by(AnalyticsEvent.referrer_host)
        .order_by(func.count(AnalyticsEvent.id).desc())
        .limit(15)
    ).all()

    devices = dict(
        db.execute(
            select(AnalyticsEvent.device_class, func.count(AnalyticsEvent.id))
            .where(
                AnalyticsEvent.tenant_id == tenant_id,
                AnalyticsEvent.occurred_at >= start,
            )
            .group_by(AnalyticsEvent.device_class)
        ).all()
    )

    recent = db.execute(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.tenant_id == tenant_id)
        .order_by(AnalyticsEvent.occurred_at.desc())
        .limit(40)
    ).scalars().all()

    pv = summary["page_views"] or 0
    conversion = {
        "view_to_product_pct": round(100 * summary["product_views"] / pv, 1) if pv else 0.0,
        "product_to_cart_pct": (
            round(100 * summary["add_to_cart"] / summary["product_views"], 1)
            if summary["product_views"]
            else 0.0
        ),
        "cart_to_checkout_pct": (
            round(100 * summary["checkout_starts"] / summary["add_to_cart"], 1)
            if summary["add_to_cart"]
            else 0.0
        ),
        "checkout_to_order_pct": (
            round(100 * summary["orders"] / summary["checkout_starts"], 1)
            if summary["checkout_starts"]
            else 0.0
        ),
    }

    return {
        "range_days": days,
        "generated_at": now.isoformat() + "Z",
        "summary": summary,
        "today": today,
        "yesterday": yesterday,
        "daily": daily,
        "top_products": [
            {
                "product_id": r.product_id,
                "slug": r.slug,
                "name": r.name,
                "views": int(r.views),
                "unique_visitors": int(r.unique_visitors),
            }
            for r in top_products
        ],
        "top_paths": [
            {
                "path": r.path or "/",
                "views": int(r.views),
                "unique_visitors": int(r.unique_visitors),
            }
            for r in top_paths
        ],
        "top_referrers": [
            {"host": r.referrer_host or "", "views": int(r.views)} for r in top_referrers
        ],
        "devices": {
            k or "unknown": int(v) for k, v in devices.items()
        },
        "conversion": conversion,
        "recent_events": [
            {
                "occurred_at": e.occurred_at.isoformat() + "Z",
                "event_type": e.event_type,
                "path": e.path,
                "product_id": e.product_id,
                "device_class": e.device_class,
                "referrer_host": e.referrer_host,
            }
            for e in recent
        ],
    }