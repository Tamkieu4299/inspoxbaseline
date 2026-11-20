"""Set Baseline category menu order (lower = higher in nav; Phụ kiện last).

    docker exec inspo-backend python -m app.seed_baseline_category_nav_order --apply
"""

from __future__ import annotations

import argparse

from sqlalchemy import select

from .database import SessionLocal
from .models import Category, Tenant

# Root storefront categories (slug → nav_order)
BASELINE_NAV_ORDER: dict[str, int] = {
    "tops": 10,
    "rackets": 20,
    "custom-rackets": 30,
    "used-rackets": 35,
    "accessories": 90,
    "tennis-strings": 10,
    "overgrips": 20,
}


def run(*, dry_run: bool = True, tenant_slug: str = "baseline") -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
        if tenant is None:
            raise SystemExit(f"Tenant not found: {tenant_slug}")

        updated = 0
        for slug, order in BASELINE_NAV_ORDER.items():
            cat = db.scalar(
                select(Category).where(Category.tenant_id == tenant.id, Category.slug == slug)
            )
            if cat is None:
                print(f"SKIP missing slug={slug}")
                continue
            if cat.nav_order == order:
                continue
            print(f"{'WOULD' if dry_run else 'SET'} {slug} nav_order {cat.nav_order} -> {order}")
            updated += 1
            if not dry_run:
                cat.nav_order = order
        if dry_run:
            print(f"Dry run: {updated} category nav_order update(s)")
            return
        db.commit()
        print(f"Applied: {updated} category nav_order update(s)")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--tenant", default="baseline")
    args = parser.parse_args()
    run(dry_run=not args.apply, tenant_slug=args.tenant)


if __name__ == "__main__":
    main()