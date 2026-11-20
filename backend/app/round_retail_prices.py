"""Round all product prices to nearest 10,000₫.

    docker exec inspo-backend python -m app.round_retail_prices
    docker exec inspo-backend python -m app.round_retail_prices --apply
"""

from __future__ import annotations

import argparse

from sqlalchemy import select

from .database import SessionLocal
from .models import Product, Tenant
from .pricing import round_retail_vnd


def main() -> None:
    parser = argparse.ArgumentParser(description="Round product retail prices to 10,000₫")
    parser.add_argument("--apply", action="store_true", help="Write changes (default is dry-run)")
    parser.add_argument("--tenant", default=None, help="Tenant slug (default: all tenants)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        q = select(Product).where(Product.price > 0)
        if args.tenant:
            tid = db.scalar(select(Tenant.id).where(Tenant.slug == args.tenant))
            if tid is None:
                print(f"Unknown tenant: {args.tenant}")
                return
            q = q.where(Product.tenant_id == tid)
        products = list(db.scalars(q))
        changed = 0
        for p in products:
            target = round_retail_vnd(p.price)
            if target != float(p.price or 0):
                print(f"{'UPDATE' if args.apply else 'would'} id={p.id} {p.slug}: {p.price:,.0f} -> {target:,.0f}")
                changed += 1
                if args.apply:
                    p.price = target
        if args.apply and changed:
            db.commit()
        print(f"Done. {'Updated' if args.apply else 'Would update'} {changed} of {len(products)} priced products.")
    finally:
        db.close()


if __name__ == "__main__":
    main()