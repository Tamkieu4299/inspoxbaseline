"""Product pairing / cross-sell links (e.g. suggested strings for a racquet)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .models import Product
from .schemas import ProductComplementLink, ProductComplementOut, ProductSummaryCard


def normalize_complement_links(raw: list | None) -> list[dict[str, Any]]:
    if not raw:
        return []
    out: list[dict[str, Any]] = []
    seen: set[tuple[int, str]] = set()
    for row in raw:
        if not isinstance(row, dict):
            continue
        pid = row.get("product_id")
        if pid is None:
            continue
        try:
            product_id = int(pid)
        except (TypeError, ValueError):
            continue
        role = str(row.get("role") or "pair").strip() or "pair"
        key = (product_id, role)
        if key in seen:
            continue
        seen.add(key)
        out.append({"product_id": product_id, "role": role})
    return out


def _card_from_product(product: Product, lang: str) -> ProductSummaryCard:
    name = product.name
    if lang == "vi" and product.name_vi:
        name = product.name_vi
    image_url = None
    for img in product.images or []:
        if img.enabled and img.url:
            image_url = img.url
            break
    if not image_url and product.images:
        image_url = product.images[0].url
    from .baseline_physical_stock import retail_price_is_exact

    return ProductSummaryCard(
        id=product.id,
        slug=product.slug,
        name=name,
        price=float(product.price or 0),
        retail_price_exact=retail_price_is_exact(product.id, product.slug),
        brand=product.brand,
        image_url=image_url,
    )


def resolve_complements(
    db: Session,
    *,
    tenant_id: int,
    links: list | None,
    lang: str = "en",
    exclude_product_id: int | None = None,
) -> list[ProductComplementOut]:
    normalized = normalize_complement_links(links)
    if not normalized:
        return []
    ids = [row["product_id"] for row in normalized]
    products = db.scalars(
        select(Product)
        .options(selectinload(Product.images))
        .where(
            Product.tenant_id == tenant_id,
            Product.id.in_(ids),
            Product.is_active.is_(True),
        )
    ).all()
    by_id = {p.id: p for p in products}
    out: list[ProductComplementOut] = []
    for row in normalized:
        pid = row["product_id"]
        if exclude_product_id is not None and pid == exclude_product_id:
            continue
        p = by_id.get(pid)
        if p is None:
            continue
        out.append(
            ProductComplementOut(
                role=row["role"],
                product=_card_from_product(p, lang),
            )
        )
    return out


def merge_complement_links(
    existing: list | None,
    *,
    role: str,
    product_ids: list[int],
) -> list[dict[str, Any]]:
    """Replace all links for `role`, keep other roles."""
    kept = [row for row in normalize_complement_links(existing) if row.get("role") != role]
    for pid in product_ids:
        kept.append({"product_id": int(pid), "role": role})
    return normalize_complement_links(kept)
