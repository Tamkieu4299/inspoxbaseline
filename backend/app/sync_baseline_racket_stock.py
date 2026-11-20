"""Activate Hồng Ân–matched rackets + Wilson/Head lines; set fixed retail only where listed.

Other active rackets stay visible. Hong An formula prices apply to matched Babolat SKUs
except ids in baseline_physical_stock.PHYSICAL_STOCK_RETAIL.

    docker exec inspo-backend python -m app.sync_baseline_racket_stock
    docker exec inspo-backend python -m app.sync_baseline_racket_stock --apply
"""

from __future__ import annotations

import argparse

import httpx
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .baseline_physical_stock import PHYSICAL_STOCK_RETAIL, PHYSICAL_STOCK_SLUG_RETAIL
from .database import SessionLocal
from .map_racket_string_pairs import _is_racquet
from .models import Category, Product, Tenant
from .sync_hongan_racket_prices import (
    HTTP_HEADERS,
    _fetch_hongan_tennis_catalog,
    hongan_matched_product_ids,
)

MANUAL_ACTIVE_IDS: frozenset[int] = frozenset({7, 9, 10, 18, 55, 39, 40, 76})

GRAVITY_RETAIL: dict[int, float] = {
    39: 4_900_000,
    40: 5_200_000,
    76: 4_500_000,
}

FIXED_RETAIL: dict[int, float] = {**PHYSICAL_STOCK_RETAIL, **GRAVITY_RETAIL}


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
        slug_keep = {
            p.id
            for p in products
            if (p.slug or "") in PHYSICAL_STOCK_SLUG_RETAIL
        }
        keep_ids = hongan_matched_product_ids(products, rackets_id, catalog) | MANUAL_ACTIVE_IDS | slug_keep

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
                target = FIXED_RETAIL.get(product.id) or PHYSICAL_STOCK_SLUG_RETAIL.get(
                    product.slug or ""
                )
                if target is not None:
                    if product.price != target:
                        priced += 1
                        if not dry_run:
                            product.price = target
                    if dry_run:
                        print(f"RETAIL id={product.id} {product.slug} -> {target:,.0f}₫")
                elif dry_run:
                    print(f"KEEP id={product.id} {product.slug}")
            elif product.is_active:
                deactivated += 1
                if not dry_run:
                    product.is_active = False
                if dry_run:
                    print(f"DEACTIVATE id={product.id} {product.slug}")

        if dry_run:
            print(
                f"Dry run: keep {len(keep_ids)}, activate {activated}, "
                f"deactivate {deactivated}, fixed retail updates {priced}"
            )
            return
        db.commit()
        print(
            f"Applied: keep {len(keep_ids)} active; deactivated {deactivated}, "
            f"fixed retail {priced}, reactivated {activated}"
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