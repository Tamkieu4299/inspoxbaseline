"""Baseline tenant: Phụ kiện parent + Dây vợt tennis / Overgrip child categories.

    docker exec inspo-backend python -m app.seed_baseline_accessory_categories --apply
    docker exec inspo-backend python -m app.seed_baseline_accessory_categories --dry-run
"""

from __future__ import annotations

import argparse

from sqlalchemy import select

from .database import SessionLocal, engine
from .import_external_racquets import _get_or_create_category
from .models import Category, Product, Tenant
from .seed import _add_column_if_missing

ACCESSORIES_SLUG = "accessories"
STRINGS_SLUG = "tennis-strings"
OVERGRIPS_SLUG = "overgrips"


def _ensure_schema(db) -> None:
    _add_column_if_missing(db, "categories", "parent_id", "INTEGER")
    from .models import Base

    Base.metadata.create_all(bind=engine)


def restructure(*, tenant_slug: str = "baseline", dry_run: bool = False) -> None:
    db = SessionLocal()
    try:
        _ensure_schema(db)
        tenant = db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
        if tenant is None:
            raise SystemExit(f"Tenant not found: {tenant_slug}")

        accessories = _get_or_create_category(
            db,
            tenant.id,
            ACCESSORIES_SLUG,
            "ACCESSORIES",
            name_vi="Phụ kiện",
        )
        strings = _get_or_create_category(
            db,
            tenant.id,
            STRINGS_SLUG,
            "TENNIS STRINGS",
            name_vi="Dây vợt tennis",
            parent_id=accessories.id,
        )
        overgrips = _get_or_create_category(
            db,
            tenant.id,
            OVERGRIPS_SLUG,
            "OVERGRIPS",
            name_vi="Overgrip",
            parent_id=accessories.id,
        )

        moved_strings = moved_overgrips = 0
        products = db.scalars(select(Product).where(Product.tenant_id == tenant.id)).all()
        for p in products:
            target: Category | None = None
            if p.slug.startswith("gs-"):
                target = strings
            elif p.slug == "baseline-overgrips" or p.slug.startswith("baseline-overgrip"):
                target = overgrips
            elif p.category_id == accessories.id and p.slug.startswith("gs-"):
                target = strings

            if target is None:
                continue
            if p.category_id != target.id or [c.id for c in (p.categories or [])] != [target.id]:
                if dry_run:
                    print(f"would move {p.slug} → {target.slug}")
                else:
                    p.category_id = target.id
                    p.categories = [target]
                if target.slug == STRINGS_SLUG:
                    moved_strings += 1
                elif target.slug == OVERGRIPS_SLUG:
                    moved_overgrips += 1

        if dry_run:
            print(
                f"Dry run: accessories={accessories.slug}, strings={strings.slug}, "
                f"overgrips={overgrips.slug}; would move {moved_strings} string(s), "
                f"{moved_overgrips} overgrip product(s)."
            )
            return

        db.commit()
        print(
            f"Accessory categories on '{tenant_slug}': Phụ kiện → "
            f"Dây vợt tennis ({strings.id}), Overgrip ({overgrips.id}). "
            f"Moved {moved_strings} string product(s), {moved_overgrips} overgrip product(s)."
        )
    finally:
        db.close()


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Baseline Phụ kiện category tree")
    p.add_argument("--tenant", default="baseline")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--apply", action="store_true")
    args = p.parse_args(argv)
    if not args.apply and not args.dry_run:
        raise SystemExit("Pass --dry-run or --apply")
    restructure(tenant_slug=args.tenant, dry_run=args.dry_run and not args.apply)


if __name__ == "__main__":
    main()
