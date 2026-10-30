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


def _send_smtp_message(msg: EmailMessage) -> None:
    host = settings.SMTP_HOST
    port = int(settings.SMTP_PORT or 587)
    user = (settings.SMTP_USER or "").strip()
    password = settings.SMTP_PASSWORD or ""
    errors: list[str] = []

    def attempt_starttls() -> None:
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            if user:
                smtp.login(user, password)
            smtp.send_message(msg)

    def attempt_ssl() -> None:
        with smtplib.SMTP_SSL(host, 465, timeout=30) as smtp:
            smtp.ehlo()
            if user:
                smtp.login(user, password)
            smtp.send_message(msg)

    if port == 465:
        try:
            attempt_ssl()
            return
        except Exception as exc:
            errors.append(f"ssl465: {exc}")
    elif settings.SMTP_USE_TLS:
        try:
            attempt_starttls()
            return
        except Exception as exc:
            errors.append(f"starttls{port}: {exc}")
            try:
                attempt_ssl()
                return
            except Exception as exc2:
                errors.append(f"ssl465-fallback: {exc2}")
    else:
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            if user:
                smtp.login(user, password)
            smtp.send_message(msg)
        return

    raise RuntimeError("; ".join(errors))


def send_order_email(*, to_email: str, subject: str, body: str) -> str | None:
    """Send order alert email. Returns error text or None on success/skip."""
    if not to_email.strip():
        logger.info("Order email skipped: no recipient")
        return None
    if not _smtp_configured():
        logger.warning(
            "Order email not sent (SMTP not configured). To=%s Subject=%s\n%s",
            to_email,
            subject,
            body,
        )
        return "smtp_not_configured"
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email.strip()
    msg.set_content(body)
    try:
        _send_smtp_message(msg)
        logger.info("Order email sent to %s", to_email)
        return None
    except Exception as exc:
        logger.exception("Order email failed for %s", to_email)
        return str(exc)[:500]


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
