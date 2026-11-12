"""Mark baseline racket lines as HOT (is_featured) for recommended sort.

Usage:

    docker exec inspo-backend python -m app.setup_featured_racket_lines --apply
"""

from __future__ import annotations

import argparse
import re
import sys

from sqlalchemy import select

from .database import SessionLocal
from .import_external_racquets import _rackets_category
from .models import Product, Tenant

_PURE_LINE = re.compile(
    r"pure[\s-]+(aero|strike|drive)\b",
    re.IGNORECASE,
)


def product_matches_hot_line(product: Product) -> bool:
    brand = (product.brand or "").lower()
    blob = f"{product.name or ''} {product.slug or ''}".lower()

    if brand == "head":
        return "speed" in blob or "gravity" in blob
    if brand == "wilson":
        if "defyer" in blob or "defier" in blob:
            return True
        return "blade" in blob and "v10" in blob
    if brand == "babolat":
        return _PURE_LINE.search(blob) is not None
    return False


def setup_featured_racket_lines(*, tenant_slug: str = "baseline", dry_run: bool = True) -> dict:
    db = SessionLocal()
    stats = {"tagged": 0, "already": 0, "skipped_non_racket": 0}
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
        if tenant is None:
            raise SystemExit(f"Tenant not found: {tenant_slug}")

        rackets = _rackets_category(db, tenant.id)
        products = db.scalars(
            select(Product).where(
                Product.tenant_id == tenant.id,
                Product.is_active.is_(True),
                Product.category_id == rackets.id,
            )
        ).all()

        for product in products:
            if not product_matches_hot_line(product):
                continue
            if product.is_featured:
                stats["already"] += 1
                continue
            product.is_featured = True
            stats["tagged"] += 1

        if dry_run:
            db.rollback()
        else:
            db.commit()
    finally:
        db.close()
    return stats


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Tag Head/Wilson/Babolat racket lines as HOT.")
    p.add_argument("--tenant", default="baseline")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--apply", action="store_true")
    args = p.parse_args(argv)
    dry_run = args.dry_run or not args.apply
    stats = setup_featured_racket_lines(tenant_slug=args.tenant, dry_run=dry_run)
    mode = "dry-run" if dry_run else "applied"
    print(f"Featured racket lines ({mode}): {stats}")


if __name__ == "__main__":
    main(sys.argv[1:])
