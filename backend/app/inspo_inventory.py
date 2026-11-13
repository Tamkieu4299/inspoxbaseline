"""Apply TamHub stock flags to Inspo product grip/size availability."""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .database import SessionLocal
from .models import Product, Tenant
from .product_sizes import merge_size_availability, normalize_product_sizes

_INSPO_SKU = re.compile(
    r"^inspo:(?P<tenant>[^:]+):(?P<product>[^:]+)(?::(?P<color>[^:]+):(?P<size>.+))?$",
    re.I,
)


def parse_inspo_variant_sku(sku: str) -> tuple[str, str, str | None, str | None] | None:
    m = _INSPO_SKU.match((sku or "").strip())
    if not m:
        return None
    return m.group("tenant"), m.group("product"), m.group("color"), m.group("size")


def apply_stock_by_sku(inspo_slug: str, stock_by_sku: dict[str, bool]) -> dict[str, int]:
    if not stock_by_sku:
        return {"products_updated": 0}
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == inspo_slug))
        if not tenant:
            raise ValueError(f"Unknown tenant slug: {inspo_slug}")
        products = db.scalars(
            select(Product).where(Product.tenant_id == tenant.id).options(selectinload(Product.images))
        ).all()
        by_slug = {p.slug: p for p in products}
        changed = 0
        for sku, in_stock in stock_by_sku.items():
            parsed = parse_inspo_variant_sku(sku)
            if not parsed or parsed[0] != inspo_slug:
                continue
            _, product_slug, _color, size = parsed
            if not size:
                continue
            product = by_slug.get(product_slug)
            if not product:
                continue
            sizes = normalize_product_sizes(product.sizes)
            if not sizes:
                continue
            updated = merge_size_availability(sizes, size, in_stock)
            if updated != sizes:
                product.sizes = updated
                changed += 1
        if changed:
            db.commit()
        return {"products_updated": changed}
    finally:
        db.close()
