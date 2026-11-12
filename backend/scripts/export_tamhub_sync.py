"""Export inspo tenant data for TamHub bulk sync (run inside inspo-backend container).

Usage:
  python3 scripts/export_tamhub_sync.py <tenant_slug> [categories|products|orders|all]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Allow `python3 scripts/export_tamhub_sync.py` from repo /app root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import SessionLocal
from app.models import Category, Order, Product, Tenant


def _category_row(c: Category) -> dict:
    return {
        "id": c.id,
        "slug": c.slug,
        "name": c.name,
        "name_vi": c.name_vi,
    }


def _product_row(p: Product) -> dict:
    colors = p.colors if isinstance(p.colors, list) else []
    from app.product_sizes import size_option_names

    sizes = size_option_names(p.sizes if isinstance(p.sizes, list) else [])
    colorways = []
    for item in colors:
        if isinstance(item, dict):
            colorways.append(item.get("name") or item.get("label") or str(item))
        elif item:
            colorways.append(str(item))
    images = []
    for img in sorted(p.images or [], key=lambda i: i.position):
        if img.enabled and img.url:
            images.append({"url": img.url, "alt": img.alt})
    cat_slugs = []
    if p.category:
        cat_slugs.append(p.category.slug)
    for c in p.categories or []:
        if c.slug not in cat_slugs:
            cat_slugs.append(c.slug)
    return {
        "id": p.id,
        "slug": p.slug,
        "name": p.name,
        "description": p.description,
        "tagline": p.subtitle,
        "price": float(p.price or 0),
        "is_active": bool(p.is_active),
        "colorways": colorways,
        "sizes": sizes,
        "images": images,
        "category_slugs": cat_slugs,
    }


def _order_row(o: Order) -> dict:
    return {
        "event": "order.created",
        "site_name": "inspo",
        "tenant_slug": "",  # filled by caller
        "order": {
            "id": o.id,
            "order_number": o.order_number,
            "status": o.status,
            "payment_method": o.payment_method,
            "currency_code": o.currency_code,
            "customer_name": o.customer_name,
            "customer_phone": o.customer_phone,
            "customer_email": o.customer_email,
            "shipping_address": o.shipping_address,
            "note": o.note,
            "subtotal": float(o.subtotal or 0),
            "total": float(o.total or 0),
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "lines": [
                {
                    "product_id": line.product_id,
                    "product_slug": line.product_slug,
                    "product_name": line.product_name,
                    "color": line.color,
                    "size": line.size,
                    "quantity": line.quantity,
                    "unit_price": float(line.unit_price or 0),
                    "line_total": float(line.line_total or 0),
                }
                for line in (o.lines or [])
            ],
        },
    }


def export_tenant(slug: str, mode: str) -> dict:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == slug))
        if tenant is None:
            raise SystemExit(f"Unknown tenant slug: {slug}")

        out: dict = {"tenant_slug": slug}
        if mode in ("categories", "all"):
            cats = db.scalars(
                select(Category)
                .where(Category.tenant_id == tenant.id, ~Category.slug.like("brand-%"))
                .order_by(Category.name)
            ).all()
            out["categories"] = [_category_row(c) for c in cats]

        if mode in ("products", "all"):
            products = db.scalars(
                select(Product)
                .where(Product.tenant_id == tenant.id)
                .options(
                    selectinload(Product.images),
                    selectinload(Product.category),
                    selectinload(Product.categories),
                )
                .order_by(Product.id)
            ).all()
            out["products"] = [_product_row(p) for p in products]

        if mode in ("orders", "all"):
            orders = db.scalars(
                select(Order)
                .where(Order.tenant_id == tenant.id)
                .options(selectinload(Order.lines))
                .order_by(Order.created_at.asc())
            ).all()
            rows = []
            for o in orders:
                row = _order_row(o)
                row["tenant_slug"] = slug
                rows.append(row)
            out["orders"] = rows

        return out
    finally:
        db.close()


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: export_tamhub_sync.py <tenant_slug> [categories|products|orders|all]")
    slug = sys.argv[1].strip()
    mode = (sys.argv[2] if len(sys.argv) > 2 else "all").strip().lower()
    if mode not in ("categories", "products", "orders", "all"):
        raise SystemExit(f"Invalid mode: {mode}")
    print(json.dumps(export_tenant(slug, mode), ensure_ascii=False))


if __name__ == "__main__":
    main()
