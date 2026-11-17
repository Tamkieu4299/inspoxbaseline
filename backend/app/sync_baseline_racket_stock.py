"""Activate only in-stock Baseline rackets (by product id).

Prices for Babolat SKUs are maintained via sync_hongan_racket_prices; other lines use MANUAL_PRICES.

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

IN_STOCK_IDS: frozenset[int] = frozenset(
    {
        122,  # Babolat Pure Aero 98
        124,  # Babolat Pure Aero 100 300g
        127,  # Babolat Pure Aero 100 Lite
        18,  # Wilson Blade 100L
        9,  # Wilson Blade 100
        10,  # Wilson Blade 98
        7,  # Wilson Defyer 100
        55,  # Head Squared
        131,  # Babolat Pure Drive 98 Gen11
        134,  # Babolat Pure Drive Gen11
        141,  # Babolat Pure Drive Lite Gen11
        39,  # Head Gravity MP Zverev 2026
        40,  # Head Gravity Tour Zverev 2026
        76,  # Head Gravity Tour 2025
    }
)

# Wilson / Head lines (not on Hồng Ân tennis category) — set price when running stock sync
MANUAL_PRICES: dict[int, float] = {
    18: 5_555_000,
    9: 5_555_000,
    10: 5_555_000,
    7: 5_555_000,
    55: 4_321_000,
    39: 5_290_000,
    40: 5_390_000,
    76: 4_500_000,
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
            keep = product.id in IN_STOCK_IDS
            if keep:
                if not product.is_active:
                    activated += 1
                    if not dry_run:
                        product.is_active = True
                if product.id in MANUAL_PRICES:
                    target = MANUAL_PRICES[product.id]
                    if product.price != target:
                        priced += 1
                        if not dry_run:
                            product.price = target
                if dry_run:
                    price_note = (
                        f" -> {MANUAL_PRICES[product.id]:,.0f}₫"
                        if product.id in MANUAL_PRICES
                        else " (price unchanged; use sync_hongan_racket_prices for Babolat)"
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
                f"Dry run: keep {len(IN_STOCK_IDS)}, activate {activated}, "
                f"deactivate {deactivated}, manual price updates {priced}"
            )
            return
        db.commit()
        print(
            f"Applied: {len(IN_STOCK_IDS)} in-stock rackets active; "
            f"deactivated {deactivated}, manual price updates {priced}, reactivated {activated}"
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