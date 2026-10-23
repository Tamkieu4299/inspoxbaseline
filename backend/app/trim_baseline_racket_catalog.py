"""Deactivate baseline rackets outside the allowed Wilson / Babolat / Head lines.

Also deactivates junior / youth racquets (names containing Junior, JR, youth, kids, etc.).

Keeps (rackets category only):
  Wilson — Defyer, Blade, Clash, Pro Staff, RF, Ultra
  Babolat — Pure Aero, Pure Strike, Pure Drive (not Boost/Evo/etc.)
  Head — Speed, Gravity, Boom, Radical

Other categories (apparel, accessories, …) are untouched.

Usage:

    docker exec inspo-backend python -m app.trim_baseline_racket_catalog --dry-run
    docker exec inspo-backend python -m app.trim_baseline_racket_catalog --apply
"""

from __future__ import annotations

import argparse
import re
import sys

from sqlalchemy import select

from .database import SessionLocal
from .import_external_racquets import _rackets_category
from .models import Product, Tenant
from .racket_catalog_rules import is_junior_racket

_PURE_LINE = re.compile(
    r"pure[\s-]+(aero|strike|drive)\b",
    re.IGNORECASE,
)

_RF_LINE = re.compile(
    r"\brf\b|rf01|rf[\s-]?01|roger[\s-]?federer",
    re.IGNORECASE,
)


def product_kept_in_baseline_catalog(product: Product) -> bool:
    if is_junior_racket(product.name, product.slug, product.name_vi):
        return False
    return product_in_allowed_racket_line(product)


def product_in_allowed_racket_line(product: Product) -> bool:
    brand = (product.brand or "").lower()
    blob = f"{product.name or ''} {product.slug or ''}".lower()

    if brand == "wilson":
        if "defyer" in blob or "defier" in blob:
            return True
        if "blade" in blob:
            return True
        if "clash" in blob:
            return True
        if "prostaff" in blob or "pro staff" in blob or "pro-staff" in blob:
            return True
        if "ultra" in blob:
            return True
        return _RF_LINE.search(blob) is not None

    if brand == "babolat":
        return _PURE_LINE.search(blob) is not None

    if brand == "head":
        return any(line in blob for line in ("speed", "gravity", "boom", "radical"))

    return False


def trim_racket_catalog(*, tenant_slug: str = "baseline", dry_run: bool = True) -> dict:
    db = SessionLocal()
    stats = {
        "kept_active": 0,
        "reactivated": 0,
        "deactivated": 0,
        "deactivated_junior": 0,
        "inactive_unmatched": 0,
    }
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
        if tenant is None:
            raise SystemExit(f"Tenant not found: {tenant_slug}")

        rackets = _rackets_category(db, tenant.id)
        products = db.scalars(
            select(Product).where(
                Product.tenant_id == tenant.id,
                Product.category_id == rackets.id,
            )
        ).all()

        for product in products:
            junior = is_junior_racket(product.name, product.slug, product.name_vi)
            allowed = product_kept_in_baseline_catalog(product)
            if allowed:
                if product.is_active:
                    stats["kept_active"] += 1
                else:
                    product.is_active = True
                    stats["reactivated"] += 1
                continue
            if product.is_active:
                product.is_active = False
                stats["deactivated"] += 1
                if junior:
                    stats["deactivated_junior"] += 1
            else:
                stats["inactive_unmatched"] += 1

        if dry_run:
            db.rollback()
        else:
            db.commit()
    finally:
        db.close()
    return stats


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Trim baseline racket catalog to allowed lines.")
    p.add_argument("--tenant", default="baseline")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--apply", action="store_true")
    args = p.parse_args(argv)
    dry_run = args.dry_run or not args.apply
    stats = trim_racket_catalog(tenant_slug=args.tenant, dry_run=dry_run)
    mode = "dry-run" if dry_run else "applied"
    print(f"Racket catalog trim ({mode}): {stats}")


if __name__ == "__main__":
    main(sys.argv[1:])
