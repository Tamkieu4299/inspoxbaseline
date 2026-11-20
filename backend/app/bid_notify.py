"""Email + Zalo webhook notifications for auction bids."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from .config import settings
from .order_notify import send_order_email

logger = logging.getLogger(__name__)


def _shop_email(site) -> str | None:
    addr = (getattr(site, "order_notification_email", None) or "").strip()
    return addr or None


def post_zalo_webhook(*, url: str, payload: dict[str, Any]) -> tuple[str, str | None]:
    """POST JSON to tenant Zalo bridge (OA / n8n / Make). Returns (status, error)."""
    target = (url or "").strip() or (settings.ZALO_WEBHOOK_URL or "").strip()
    if not target:
        return "skipped", None
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json", "User-Agent": "inspo-auctions/1.0"}
    secret = (settings.ZALO_WEBHOOK_SECRET or "").strip()
    if secret:
        headers["X-Inspo-Signature"] = secret
    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.post(target, content=body, headers=headers)
        if res.status_code >= 400:
            return "failed", f"HTTP {res.status_code}: {res.text[:200]}"
        return "sent", None
    except Exception as exc:
        logger.exception("Zalo webhook failed")
        return "failed", str(exc)[:500]


def notify_bid_event(
    *,
    site,
    event: str,
    lot_title: str,
    product_slug: str,
    amount: float,
    min_next: float | None,
    bidder_name: str,
    bidder_phone: str,
    bidder_email: str | None,
    message: str,
    message_vi: str,
) -> None:
    zalo_url = (getattr(site, "zalo_webhook_url", None) or "").strip()
    payload = {
        "event": event,
        "product_slug": product_slug,
        "lot_title": lot_title,
        "amount_vnd": amount,
        "min_next_bid_vnd": min_next,
        "bidder_name": bidder_name,
        "bidder_phone": bidder_phone,
        "bidder_email": bidder_email,
        "message": message,
        "message_vi": message_vi,
    }
    post_zalo_webhook(url=zalo_url, payload=payload)

    shop = _shop_email(site)
    if shop:
        send_order_email(
            to_email=shop,
            subject=f"[Auction] {event} — {lot_title}",
            body=(
                f"{message}\n\n"
                f"Bidder: {bidder_name}\n"
                f"Phone: {bidder_phone}\n"
                f"Email: {bidder_email or '—'}\n"
                f"Amount: {amount:,.0f} VND\n"
                f"Product: {product_slug}\n"
            ),
        )

    if bidder_email and bidder_email.strip():
        vi = message_vi or message
        send_order_email(
            to_email=bidder_email.strip(),
            subject=f"Baseline đấu giá — {lot_title}",
            body=vi,
        )