"""Activate only in-stock Baseline rackets (by product id) and set storefront prices.

    docker exec inspo-backend python -m app.sync_baseline_racket_stock --dry-run
    docker exec inspo-backend python -m app.sync_baseline_racket_stock --apply
"""

from __future__ import annotations

import argparse

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .database import SessionLocal
from .map_racket_string_pairs import _is_racquet
from .models import Category, Product, Tenant

# Baseline in-stock rackets — product id → web retail price (VND)
IN_STOCK: dict[int, float] = {
    122: 6_299_000,  # Babolat Pure Aero 98 305g
    124: 5_999_000,  # Babolat Pure Aero 100 300g
    127: 5_555_000,  # Babolat Pure Aero 100 285g (Lite)
    18: 5_555_000,  # Wilson Blade 100 285g (100L)
    9: 5_555_000,  # Wilson Blade 100 300g
    10: 5_555_000,  # Wilson Blade 98 305g
    7: 5_555_000,  # Wilson Defyer 100 285g
    55: 4_321_000,  # Head Squared
    # Yonex Ezone Alpha 100 275g — add product id once in catalog (web retail 3,456,000)
}


def sync(*, dry_run: bool = True, tenant_slug: str = "baseline") -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
        if tenant is None:
            raise SystemExit(f"Tenant not found: {tenant_slug}")

        rackets_cat = db.scalar(
            select(Category).where(Category.tenant_id == tenant.id, Category.slug == "rackets")
        )
        rackets_id = rackets_cat.id if rackets_cat else None

        products = db.scalars(
            select(Product)
            .options(selectinload(Product.categories))
            .where(Product.tenant_id == tenant.id)
        ).all()

        activated = deactivated = priced = 0
        for product in products:
            if not _is_racquet(product, rackets_id):
                continue
            keep = product.id in IN_STOCK
            if keep:
                if not product.is_active:
                    activated += 1
                    if not dry_run:
                        product.is_active = True
                target = IN_STOCK[product.id]
                if product.price != target:
                    priced += 1
                    if not dry_run:
                        product.price = target
                if dry_run:
                    print(f"KEEP id={product.id} {product.slug} -> {target:,.0f}₫")
            else:
                if product.is_active:
                    deactivated += 1
                    if not dry_run:
                        product.is_active = False
                    if dry_run:
                        print(f"DEACTIVATE id={product.id} {product.slug}")

        if dry_run:
            print(f"Dry run: keep {len(IN_STOCK)}, activate {activated}, deactivate {deactivated}, price updates {priced}")
            return
        db.commit()
        print(
            f"Applied: {len(IN_STOCK)} in-stock rackets active; "
            f"deactivated {deactivated}, price updates {priced}, reactivated {activated}"
        )
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--tenant", default="baseline")
    args = parser.parse_args()
    sync(dry_run=not args.apply, tenant_slug=args.tenant)


if __name__ == "__main__":
    main()