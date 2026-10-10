"""Remove stray SKUs on shop1 and point operators at real data restore.

Does **not** inject demo catalog rows. To restore your exported catalog:

    bash deploy/import-data.sh

Usage (backend container):

    python -m app.repair_tenant_catalog
"""

from sqlalchemy import delete, select

from .database import SessionLocal
from .models import Collection, Product, ProductImage, Tenant
from .seed_inspo import INSPO_PRODUCT_SLUGS

BASELINE_ONLY_SLUGS = frozenset({"oncourt-t-shirt"})
BASELINE_COLLECTION_SLUGS = frozenset({"oncourt"})


def prune_shop1_extras():
    """Drop shop1 products outside the real INSPO Eden catalog."""
    db = SessionLocal()
    try:
        shop1 = db.scalar(select(Tenant).where(Tenant.slug == "shop1"))
        if shop1 is None:
            return
        extras = db.execute(
            select(Product.id, Product.slug).where(
                Product.tenant_id == shop1.id,
                Product.slug.not_in(INSPO_PRODUCT_SLUGS),
            )
        ).all()
        if not extras:
            print("prune: shop1 has only Eden dress SKUs")
            return
        ids = [r[0] for r in extras]
        slugs = [r[1] for r in extras]
        db.execute(delete(ProductImage).where(ProductImage.product_id.in_(ids)))
        db.execute(delete(Product).where(Product.id.in_(ids)))
        db.commit()
        print(f"prune: removed demo/extra products from shop1: {', '.join(slugs)}")
    finally:
        db.close()


def repair_shop1():
    db = SessionLocal()
    try:
        shop1 = db.scalar(select(Tenant).where(Tenant.slug == "shop1"))
        if shop1 is None:
            print("repair: no shop1 tenant")
            return
        wrong = db.execute(
            select(Product.id, Product.slug).where(
                Product.tenant_id == shop1.id, Product.slug.in_(BASELINE_ONLY_SLUGS)
            )
        ).all()
        if wrong:
            ids = [row[0] for row in wrong]
            slugs = [row[1] for row in wrong]
            db.execute(delete(ProductImage).where(ProductImage.product_id.in_(ids)))
            db.execute(delete(Product).where(Product.id.in_(ids)))
            db.commit()
            print(f"repair: removed baseline SKU from shop1: {', '.join(slugs)}")
        cols = db.execute(
            select(Collection.id, Collection.slug).where(
                Collection.tenant_id == shop1.id,
                Collection.slug.in_(BASELINE_COLLECTION_SLUGS),
            )
        ).all()
        if cols:
            col_ids = [c[0] for c in cols]
            db.execute(delete(Collection).where(Collection.id.in_(col_ids)))
            db.commit()
            print(f"repair: removed baseline collection from shop1: {', '.join(c[1] for c in cols)}")
    finally:
        db.close()

    print(
        "repair: to restore full DB + MinIO from export, run on the host: "
        "bash deploy/import-data.sh"
    )


if __name__ == "__main__":
    prune_shop1_extras()
    repair_shop1()
