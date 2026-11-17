"""Activate in-stock Baseline rackets: Hồng Ân–matched SKUs + Wilson/Head manual list.

Babolat prices: sync_hongan_racket_prices. Wilson/Head: MANUAL_PRICES below.

    docker exec inspo-backend python -m app.sync_baseline_racket_stock
    docker exec inspo-backend python -m app.sync_baseline_racket_stock --apply
"""

from __future__ import annotations

import argparse

import httpx
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .database import SessionLocal
from .map_racket_string_pairs import _is_racquet
from .models import Category, Product, Tenant
from .sync_hongan_racket_prices import (
    HTTP_HEADERS,
    _fetch_hongan_tennis_catalog,
    hongan_matched_product_ids,
)

# Wilson / Head (not on Hồng Ân tennis category)
MANUAL_ACTIVE_IDS: frozenset[int] = frozenset({7, 9, 10, 18, 55, 39, 40, 76})

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

        with httpx.Client(headers=dict(HTTP_HEADERS), follow_redirects=True) as client:
            catalog = _fetch_hongan_tennis_catalog(client)
        keep_ids = hongan_matched_product_ids(products, rackets_id, catalog) | MANUAL_ACTIVE_IDS

        activated = deactivated = priced = 0
        for product in products:
            if not _is_racquet(product, rackets_id):
                continue
            keep = product.id in keep_ids
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
                        else " (Babolat price via sync_hongan_racket_prices)"
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
                f"Dry run: keep {len(keep_ids)} ({len(keep_ids) - len(MANUAL_ACTIVE_IDS)} Hồng Ân + "
                f"{len(MANUAL_ACTIVE_IDS)} manual), activate {activated}, "
                f"deactivate {deactivated}, manual price updates {priced}"
            )
            return
        db.commit()
        print(
            f"Applied: {len(keep_ids)} rackets active; "
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