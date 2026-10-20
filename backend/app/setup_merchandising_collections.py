"""Create brand + custom racket collections, assign products, optional local gallery upload.

Usage (repo root, stack running):

    docker cp "SampleImages/baseline/Custom rackets/Speed MPL" inspo-backend:/tmp/speed-mpl-images
    docker exec inspo-backend python -m app.setup_merchandising_collections --apply \\
        --speed-mpl-images /tmp/speed-mpl-images
"""

from __future__ import annotations

import argparse
import mimetypes
import sys
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from .database import SessionLocal
from .import_external_racquets import _brand_from_product_row, _rackets_category
from .minio_client import save_file
from .models import Collection, HomeContent, Product, ProductImage, Tenant

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

COLLECTION_DEFS: tuple[dict, ...] = (
    {
        "slug": "custom-rackets",
        "name": "Custom Rackets",
        "name_vi": "Vợt tùy chỉnh",
        "tagline": "Paint, specs, and builds tailored to your game.",
        "tagline_vi": "Sơn, thông số và cấu hình theo phong cách của bạn.",
        "display_order": 0,
    },
    {
        "slug": "wilson-rackets",
        "name": "Wilson Rackets",
        "name_vi": "Vợt Wilson",
        "tagline": "Pro Staff, Blade, Ultra, and more.",
        "tagline_vi": "Pro Staff, Blade, Ultra và nhiều dòng khác.",
        "brand": "wilson",
        "display_order": 1,
    },
    {
        "slug": "head-rackets",
        "name": "Head Rackets",
        "name_vi": "Vợt Head",
        "tagline": "Speed, Radical, Gravity, and Prestige.",
        "tagline_vi": "Speed, Radical, Gravity và Prestige.",
        "brand": "head",
        "display_order": 2,
    },
    {
        "slug": "babolat-rackets",
        "name": "Babolat Rackets",
        "name_vi": "Vợt Babolat",
        "tagline": "Pure Aero, Pure Drive, and Pure Strike.",
        "tagline_vi": "Pure Aero, Pure Drive và Pure Strike.",
        "brand": "babolat",
        "display_order": 3,
    },
)

CUSTOM_PRODUCT_SLUGS = ("head-speed-mpl-pretty-fast",)
UNFEATURE_COLLECTION_SLUGS = ("oncourt", "baseline-gear")
TRENDING_LIMIT = 4


def _get_or_create_collection(db, tenant_id: int, spec: dict) -> Collection:
    col = db.scalar(
        select(Collection).where(Collection.tenant_id == tenant_id, Collection.slug == spec["slug"])
    )
    if col is None:
        col = Collection(tenant_id=tenant_id, slug=spec["slug"], name=spec["name"])
        db.add(col)
        db.flush()
    col.name = spec["name"]
    col.name_vi = spec.get("name_vi")
    col.tagline = spec.get("tagline")
    col.tagline_vi = spec.get("tagline_vi")
    col.display_order = spec.get("display_order", 0)
    col.is_featured = True
    col.is_active = True
    return col


def _image_paths(folder: Path) -> list[Path]:
    if not folder.is_dir():
        return []
    files = [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES]
    return sorted(files, key=lambda p: p.name.lower())


def _replace_product_images_from_files(db, tenant_id: int, product: Product, paths: list[Path]) -> int:
    if not paths:
        return 0
    db.execute(delete(ProductImage).where(ProductImage.product_id == product.id))
    added = 0
    for pos, path in enumerate(paths):
        content = path.read_bytes()
        ctype = mimetypes.guess_type(path.name)[0] or "image/jpeg"
        media = save_file(db, content, path.name, ctype, tenant_id)
        db.add(
            ProductImage(
                product_id=product.id,
                media_id=media.id,
                url=media.url,
                alt=product.name,
                position=pos,
                enabled=True,
            )
        )
        added += 1
    return added


def _hero_from_product(db, product: Product | None) -> int | None:
    if product is None:
        return None
    for img in sorted(product.images or [], key=lambda i: i.position):
        if img.enabled and img.media_id:
            return img.media_id
    return None


def _hero_from_first_file(db, tenant_id: int, paths: list[Path]) -> int | None:
    if not paths:
        return None
    path = paths[0]
    content = path.read_bytes()
    ctype = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    media = save_file(db, content, f"hero-{path.name}", ctype, tenant_id)
    return media.id


def setup_merchandising_collections(
    *,
    tenant_slug: str = "baseline",
    dry_run: bool = True,
    speed_mpl_images: Path | None = None,
) -> dict:
    stats: dict[str, int | list[str]] = {
        "collections": 0,
        "wilson": 0,
        "head": 0,
        "babolat": 0,
        "custom": 0,
        "images_replaced": 0,
    }
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
        if tenant is None:
            raise SystemExit(f"Tenant not found: {tenant_slug}")
        rackets = _rackets_category(db, tenant_id=tenant.id)

        by_slug: dict[str, Collection] = {}
        for spec in COLLECTION_DEFS:
            by_slug[spec["slug"]] = _get_or_create_collection(db, tenant.id, spec)
            stats["collections"] = int(stats["collections"]) + 1

        for slug in UNFEATURE_COLLECTION_SLUGS:
            legacy = db.scalar(
                select(Collection).where(Collection.tenant_id == tenant.id, Collection.slug == slug)
            )
            if legacy is not None:
                legacy.is_featured = False

        products = db.scalars(
            select(Product)
            .where(Product.tenant_id == tenant.id, Product.category_id == rackets.id, Product.is_active.is_(True))
            .options(selectinload(Product.images), selectinload(Product.categories))
        ).all()

        custom_slugs = set(CUSTOM_PRODUCT_SLUGS)
        custom_col = by_slug["custom-rackets"]
        brand_cols = {
            "wilson": by_slug["wilson-rackets"],
            "head": by_slug["head-rackets"],
            "babolat": by_slug["babolat-rackets"],
        }

        speed_mpl = db.scalar(
            select(Product)
            .where(Product.tenant_id == tenant.id, Product.slug == "head-speed-mpl-pretty-fast")
            .options(selectinload(Product.images))
        )

        image_paths = _image_paths(speed_mpl_images) if speed_mpl_images else []
        if speed_mpl and image_paths and not dry_run:
            stats["images_replaced"] = _replace_product_images_from_files(db, tenant.id, speed_mpl, image_paths)
            db.flush()
            hero_id = _hero_from_first_file(db, tenant.id, image_paths)
            if hero_id:
                custom_col.hero_image_id = hero_id

        if speed_mpl:
            speed_mpl.collection_id = custom_col.id
            stats["custom"] = 1

        for product in products:
            if product.slug in custom_slugs:
                continue
            brand = _brand_from_product_row(product)
            col = brand_cols.get(brand or "")
            if col is None:
                continue
            product.collection_id = col.id
            key = brand
            stats[key] = int(stats[key]) + 1

        if not dry_run:
            for spec in COLLECTION_DEFS:
                col = by_slug[spec["slug"]]
                if col.hero_image_id:
                    continue
                brand = spec.get("brand")
                if brand:
                    sample = next(
                        (p for p in products if _brand_from_product_row(p) == brand and p.slug not in custom_slugs),
                        None,
                    )
                    hero_id = _hero_from_product(db, sample)
                    if hero_id:
                        col.hero_image_id = hero_id

        home = db.scalar(select(HomeContent).where(HomeContent.tenant_id == tenant.id))
        if home is not None:
            sections = list(home.sections or [])
            if not sections:
                sections = [
                    {"id": "hero", "enabled": True},
                    {"id": "trending", "enabled": True, "limit": TRENDING_LIMIT},
                    {"id": "latest_drops", "enabled": True, "limit": 8, "show_view_all": True},
                    {"id": "master", "enabled": True},
                ]
            else:
                patched = []
                for row in sections:
                    item = dict(row)
                    if item.get("id") == "trending":
                        item["enabled"] = True
                        item["limit"] = TRENDING_LIMIT
                    patched.append(item)
                sections = patched
            if not dry_run:
                home.sections = sections
                home.trending_title = home.trending_title or "SHOP BY COLLECTION"
                home.trending_title_vi = home.trending_title_vi or "MUA THEO BỘ SƯU TẬP"
                home.trending_view_all_url = "/collections"

        if dry_run:
            db.rollback()
        else:
            db.commit()
    finally:
        db.close()

    return stats


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Brand + custom racket collections for baseline tenant.")
    p.add_argument("--tenant", default="baseline")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--apply", action="store_true")
    p.add_argument(
        "--speed-mpl-images",
        default=None,
        help="Folder with JPG/PNG gallery for head-speed-mpl-pretty-fast",
    )
    args = p.parse_args(argv)
    dry_run = args.dry_run or not args.apply
    img_dir = Path(args.speed_mpl_images).expanduser() if args.speed_mpl_images else None
    stats = setup_merchandising_collections(
        tenant_slug=args.tenant,
        dry_run=dry_run,
        speed_mpl_images=img_dir,
    )
    mode = "dry-run" if dry_run else "applied"
    print(f"Merchandising collections ({mode}): {stats}")


if __name__ == "__main__":
    main(sys.argv[1:])
