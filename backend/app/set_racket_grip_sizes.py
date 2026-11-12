"""Ensure racquets have GRIP 1–4 with optional availability flags.

    docker exec inspo-backend python -m app.set_racket_grip_sizes --dry-run
    docker exec inspo-backend python -m app.set_racket_grip_sizes --apply
"""

from __future__ import annotations

import argparse

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .database import SessionLocal
from .import_external_racquets import _rackets_category
from .map_racket_string_pairs import _is_racquet
from .models import Category, Product, Tenant
from .product_sizes import default_racket_grip_sizes, normalize_product_sizes


def _needs_grip_refresh(sizes: list | None) -> bool:
    if not sizes:
        return True
    normalized = normalize_product_sizes(sizes)
    names = [r["name"].upper() for r in normalized]
    expected = [f"GRIP {n}" for n in range(1, 5)]
    if not names:
        return True
    if len(names) == 1 and names[0] in ("ONE SIZE", "ONE-SIZE", "OS", "GRIP 2"):
        return True
    if names != expected:
        return True
    if any(isinstance(s, str) for s in sizes):
        return True
    return False


def _merge_availability(existing: list | None) -> list[dict]:
    prior = {row["name"].upper(): row["available"] for row in normalize_product_sizes(existing)}
    return [
        {"name": name, "available": prior.get(name.upper(), True)}
        for name in (f"GRIP {n}" for n in range(1, 5))
    ]


def set_grip_sizes(*, tenant_slug: str = "baseline", dry_run: bool = False, force: bool = False) -> None:
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

        updated = 0
        for product in products:
            if not _is_racquet(product, rackets_id):
                continue
            if not force and not _needs_grip_refresh(product.sizes):
                continue
            new_sizes = _merge_availability(product.sizes)
            if normalize_product_sizes(product.sizes) == new_sizes:
                continue
            if dry_run:
                print(f"would set {product.slug}: {product.sizes!r} -> {new_sizes!r}")
            else:
                product.sizes = new_sizes
            updated += 1

        if dry_run:
            print(f"Dry run: {updated} racquet(s) would get GRIP 1–4.")
            return
        db.commit()
        print(f"Set GRIP 1–4 on {updated} racquet(s) for tenant '{tenant_slug}'.")
    finally:
        db.close()


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Set GRIP 1–4 size options on racquets")
    p.add_argument("--tenant", default="baseline")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--apply", action="store_true")
    p.add_argument("--force", action="store_true", help="Refresh all racquets to GRIP 1–4 (keep sold-out flags)")
    args = p.parse_args(argv)
    if not args.apply and not args.dry_run:
        raise SystemExit("Pass --dry-run or --apply")
    set_grip_sizes(
        tenant_slug=args.tenant,
        dry_run=args.dry_run and not args.apply,
        force=args.force,
    )


if __name__ == "__main__":
    main()
