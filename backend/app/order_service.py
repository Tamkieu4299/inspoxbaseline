"""Create orders from storefront checkout."""

from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import settings
from .currency import normalize_base_currency
from .models import Order, OrderLine, Product, SiteSettings
from .order_notify import post_order_webhook, send_order_email


def _normalize_phone(phone: str) -> str:
    return "".join(ch for ch in phone if ch.isdigit() or ch == "+")


def _generate_order_number(db: Session, tenant_id: int) -> str:
    prefix = datetime.utcnow().strftime("%Y%m%d")
    like = f"{prefix}-%"
    count = (
        db.scalar(
            select(func.count())
            .select_from(Order)
            .where(Order.tenant_id == tenant_id, Order.order_number.like(like))
        )
        or 0
    )
    return f"{prefix}-{count + 1:04d}"


def _storefront_base(site: SiteSettings | None) -> str | None:
    raw = (site.storefront_url if site else None) or settings.STOREFRONT_URL or ""
    base = raw.strip().rstrip("/")
    return base or None


def _admin_orders_url(site: SiteSettings | None) -> str | None:
    base = _storefront_base(site)
    if not base:
        return None
    return f"{base}/admin?tab=orders"


def _format_money(amount: float, currency: str) -> str:
    return f"{amount:,.0f} {currency}"


def _order_email_body(order: Order, site_name: str, site: SiteSettings | None) -> str:
    item_lines = []
    for idx, line in enumerate(order.lines, start=1):
        variant = []
        if line.color:
            variant.append(line.color)
        if line.size:
            variant.append(line.size)
        suffix = f" ({', '.join(variant)})" if variant else ""
        item_lines.append(
            f"  {idx}. {line.product_name}{suffix}\n"
            f"     Qty: {line.quantity} × {_format_money(line.unit_price, order.currency_code)}"
            f" = {_format_money(line.line_total, order.currency_code)}"
        )
    items = "\n".join(item_lines) or "  (no line items)"
    placed = order.created_at.strftime("%Y-%m-%d %H:%M UTC") if order.created_at else "—"
    admin_url = _admin_orders_url(site)
    admin_block = (
        f"\nManage this order in admin:\n{admin_url}\n"
        if admin_url
        else "\n(Open your shop admin → Orders / Đơn hàng to view this order.)\n"
    )
    return (
        f"New COD order — {site_name}\n"
        f"{'=' * 40}\n\n"
        f"Order code: {order.order_number}\n"
        f"Order ID:   {order.id}\n"
        f"Placed:     {placed}\n"
        f"Status:     {order.status}\n\n"
        f"CUSTOMER\n"
        f"  Name:    {order.customer_name}\n"
        f"  Phone:   {order.customer_phone}\n"
        f"  Email:   {order.customer_email or '—'}\n"
        f"  Address: {order.shipping_address.replace(chr(10), ', ')}\n\n"
        f"  Note:    {order.note or '—'}\n\n"
        f"ITEMS\n{items}\n\n"
        f"PAYMENT: Cash on delivery (COD)\n"
        f"TOTAL:   {_format_money(order.total, order.currency_code)}\n"
        f"{admin_block}"
        f"\n— {site_name} storefront\n"
    )


def _order_webhook_payload(order: Order, site_name: str) -> dict:
    return {
        "event": "order.created",
        "site_name": site_name,
        "order": {
            "id": order.id,
            "order_number": order.order_number,
            "status": order.status,
            "payment_method": order.payment_method,
            "currency_code": order.currency_code,
            "customer_name": order.customer_name,
            "customer_phone": order.customer_phone,
            "customer_email": order.customer_email,
            "shipping_address": order.shipping_address,
            "note": order.note,
            "subtotal": order.subtotal,
            "total": order.total,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "lines": [
                {
                    "product_id": line.product_id,
                    "product_slug": line.product_slug,
                    "product_name": line.product_name,
                    "color": line.color,
                    "size": line.size,
                    "quantity": line.quantity,
                    "unit_price": line.unit_price,
                    "line_total": line.line_total,
                }
                for line in order.lines
            ],
        },
    }


def create_order(
    db: Session,
    *,
    tenant_id: int,
    customer_name: str,
    customer_phone: str,
    shipping_address: str,
    customer_email: str | None,
    note: str | None,
    items: list[dict],
) -> Order:
    name = (customer_name or "").strip()
    phone = _normalize_phone((customer_phone or "").strip())
    address = (shipping_address or "").strip()
    if not name or len(phone) < 9 or not address:
        raise HTTPException(status_code=400, detail="Name, phone, and shipping address are required")
    if not items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    site = db.scalar(select(SiteSettings).where(SiteSettings.tenant_id == tenant_id))
    currency = normalize_base_currency(site.currency_code if site else "VND")

    order = Order(
        tenant_id=tenant_id,
        order_number=_generate_order_number(db, tenant_id),
        status="new",
        payment_method="cod",
        currency_code=currency,
        customer_name=name,
        customer_phone=phone,
        customer_email=(customer_email or "").strip() or None,
        shipping_address=address,
        note=(note or "").strip() or None,
        subtotal=0.0,
        total=0.0,
    )
    db.add(order)
    db.flush()

    subtotal = 0.0
    for raw in items:
        product_id = int(raw["product_id"])
        qty = int(raw.get("quantity") or 1)
        if qty < 1 or qty > 99:
            raise HTTPException(status_code=400, detail="Invalid quantity")
        product = db.get(Product, product_id)
        if not product or product.tenant_id != tenant_id or not product.is_active:
            raise HTTPException(status_code=400, detail=f"Product unavailable: {product_id}")
        color = (raw.get("color") or "").strip() or None
        size = (raw.get("size") or "").strip() or None
        if product.sizes and size and size not in product.sizes:
            raise HTTPException(status_code=400, detail=f"Invalid size for {product.slug}")
        unit = float(product.price or 0)
        line_total = unit * qty
        subtotal += line_total
        db.add(
            OrderLine(
                order_id=order.id,
                product_id=product.id,
                product_slug=product.slug,
                product_name=product.name,
                color=color,
                size=size,
                quantity=qty,
                unit_price=unit,
                line_total=line_total,
            )
        )

    order.subtotal = subtotal
    order.total = subtotal
    db.commit()
    db.refresh(order)

    site_name = (site.site_name if site else "Store") or "Store"
    notify_to = (site.order_notification_email if site else None) or ""
    email_err = None
    if notify_to:
        total_label = _format_money(order.total, order.currency_code)
        email_err = send_order_email(
            to_email=notify_to,
            subject=f"[{site_name}] New order {order.order_number} — {total_label}",
            body=_order_email_body(order, site_name, site),
        )

    webhook_url = (site.order_webhook_url if site else None) or ""
    status, err = post_order_webhook(url=webhook_url, payload=_order_webhook_payload(order, site_name))
    order.webhook_delivery_status = status
    parts = [p for p in (email_err, err) if p]
    order.webhook_last_error = "; ".join(parts)[:500] if parts else None
    db.commit()
    db.refresh(order)
    return order
