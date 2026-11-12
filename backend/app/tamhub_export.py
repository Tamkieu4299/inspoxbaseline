"""Inspo tenant export for TamHub sync (in-process; no subprocess)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .database import SessionLocal
from .models import Category, Order, Product, Tenant
from .product_sizes import normalize_product_sizes, size_option_names


def _category_row(c: Category) -> dict:
    return {
        "id": c.id,
        "slug": c.slug,
        "name": c.name,
        "name_vi": c.name_vi,
    }


def _product_row(p: Product) -> dict:
    colors = p.colors if isinstance(p.colors, list) else []
    sizes = normalize_product_sizes(p.sizes if isinstance(p.sizes, list) else [])
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
        "size_names": size_option_names(p.sizes),
        "images": images,
        "category_slugs": cat_slugs,
    }


def export_tenant(slug: str, *, categories: bool = True, products: bool = True) -> dict:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == slug))
        if tenant is None:
            raise ValueError(f"Unknown tenant slug: {slug}")

        out: dict = {"tenant_slug": slug}
        if categories:
            cats = db.scalars(
                select(Category)
                .where(Category.tenant_id == tenant.id, ~Category.slug.like("brand-%"))
                .order_by(Category.name)
            ).all()
            out["categories"] = [_category_row(c) for c in cats]

        if products:
            rows = db.scalars(
                select(Product)
                .where(Product.tenant_id == tenant.id)
                .options(
                    selectinload(Product.images),
                    selectinload(Product.category),
                    selectinload(Product.categories),
                )
                .order_by(Product.id)
            ).all()
            out["products"] = [_product_row(p) for p in rows]

        return out
    finally:
        db.close()
