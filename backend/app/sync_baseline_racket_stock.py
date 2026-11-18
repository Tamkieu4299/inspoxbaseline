"""Activate Baseline physical-stock rackets + Head Gravity; set fixed web retail prices.

    docker exec inspo-backend python -m app.sync_baseline_racket_stock
    docker exec inspo-backend python -m app.sync_baseline_racket_stock --apply
"""

from __future__ import annotations

import argparse

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .baseline_physical_stock import PHYSICAL_STOCK_IDS, PHYSICAL_STOCK_RETAIL
from .database import SessionLocal
from .map_racket_string_pairs import _is_racquet
from .models import Category, Product, Tenant

# Head Gravity (not on physical-stock sheet)
GRAVITY_ACTIVE_IDS: frozenset[int] = frozenset({39, 40, 76})

GRAVITY_RETAIL: dict[int, float] = {
    39: 4_900_000,  # Gravity MP 2026
    40: 5_200_000,  # Gravity Tour 2026
    76: 4_500_000,  # Gravity Tour 2025
}

KEEP_ACTIVE_IDS = PHYSICAL_STOCK_IDS | GRAVITY_ACTIVE_IDS
FIXED_RETAIL = {**PHYSICAL_STOCK_RETAIL, **GRAVITY_RETAIL}


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
            keep = product.id in KEEP_ACTIVE_IDS
            if keep:
                if not product.is_active:
                    activated += 1
                    if not dry_run:
                        product.is_active = True
                if product.id in FIXED_RETAIL:
                    target = FIXED_RETAIL[product.id]
                    if product.price != target:
                        priced += 1
                        if not dry_run:
                            product.price = target
                if dry_run:
                    price_note = (
                        f" -> {FIXED_RETAIL[product.id]:,.0f}₫"
                        if product.id in FIXED_RETAIL
                        else ""
                    )
                    print(f"KEEP id={product.id} {product.slug}{price_note}")
            else:
                if product.is_active:
                    deactivated += 1
                    if not dry_run:
                        product.is_active = False
                    if dry_run:
                        print(f"DEACTIVATE id={product.id} {product.slug}")

        if dry_run:
            print(
                f"Dry run: keep {len(KEEP_ACTIVE_IDS)}, activate {activated}, "
                f"deactivate {deactivated}, retail price updates {priced}"
            )
            return
        db.commit()
        print(
            f"Applied: {len(KEEP_ACTIVE_IDS)} rackets active; "
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