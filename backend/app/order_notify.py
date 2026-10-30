"""Email + webhook notifications for new orders."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import smtplib
from email.message import EmailMessage
from typing import Any

import httpx

from .config import settings

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM)


def send_order_email(*, to_email: str, subject: str, body: str) -> None:
    if not to_email.strip():
        logger.info("Order email skipped: no recipient")
        return
    if not _smtp_configured():
        logger.warning(
            "Order email not sent (SMTP not configured). To=%s Subject=%s\n%s",
            to_email,
            subject,
            body,
        )
        return
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email.strip()
    msg.set_content(body)
    port = settings.SMTP_PORT
    if settings.SMTP_USE_TLS:
        with smtplib.SMTP(settings.SMTP_HOST, port, timeout=30) as smtp:
            smtp.starttls()
            if settings.SMTP_USER:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(settings.SMTP_HOST, port, timeout=30) as smtp:
            if settings.SMTP_USER:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    logger.info("Order email sent to %s", to_email)


def post_order_webhook(*, url: str, payload: dict[str, Any]) -> tuple[str, str | None]:
    """Returns (status, error_message). status: sent | failed | skipped."""
    target = (url or "").strip()
    if not target:
        return "skipped", None
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json", "User-Agent": "inspo-storefront/1.0"}
    secret = (settings.ORDER_WEBHOOK_SECRET or "").strip()
    if secret:
        sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        headers["X-Inspo-Signature"] = sig
    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.post(target, content=body, headers=headers)
        if res.status_code >= 400:
            return "failed", f"HTTP {res.status_code}: {res.text[:200]}"
        return "sent", None
    except Exception as exc:
        logger.exception("Order webhook failed")
        return "failed", str(exc)[:500]
