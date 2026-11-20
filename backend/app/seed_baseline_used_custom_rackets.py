"""Baseline: Vợt đã qua sử dụng category + Head Legend used SKUs + Babolat Pure Strike Gen4 custom.

Assets (repo):

    SampleImages/baseline/usedrackets/headspeedlegendpro2025/
    SampleImages/baseline/usedrackets/headspeedlegendmp2025/
    SampleImages/baseline/Custom rackets/babolatstrikegen4/

Usage:

    docker cp SampleImages/baseline inspo-backend:/tmp/baseline
    docker exec inspo-backend python -m app.seed_baseline_used_custom_rackets --apply
"""

from __future__ import annotations

import argparse
import mimetypes
import sys
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from .database import SessionLocal
from .import_external_racquets import _get_or_create_category
from .minio_client import save_file
from .models import Category, Collection, Product, ProductImage, Tenant

_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_IMAGES = _REPO_ROOT / "SampleImages" / "baseline"

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

USED_CATEGORY = {
    "slug": "used-rackets",
    "name": "USED RACKETS",
    "name_vi": "Vợt đã qua sử dụng",
    "tagline": "Pre-owned frames — inspected and priced to play.",
    "tagline_vi": "Vợt đã qua sử dụng — kiểm tra và báo giá sẵn sàng lên sân.",
}

CUSTOM_CATEGORY = {
    "slug": "custom-rackets",
    "name": "CUSTOM RACKETS",
    "name_vi": "Vợt custom",
}

USED_PRODUCTS: tuple[dict, ...] = (
    {
        "slug": "head-speed-pro-legend-2025-used",
        "folder": "usedrackets/headspeedlegendpro2025",
        "name": "HEAD SPEED PRO LEGEND 2025",
        "name_vi": "HEAD SPEED PRO LEGEND 2025",
        "subtitle": "PRE-OWNED",
        "subtitle_vi": "ĐÃ QUA SỬ DỤNG",
        "price": 3_900_000,
        "brand": "head",
        "badge": "USED",
    },
    {
        "slug": "head-speed-legend-mp-2025-used",
        "folder": "usedrackets/headspeedlegendmp2025",
        "name": "HEAD SPEED LEGEND MP 2025",
        "name_vi": "HEAD SPEED LEGEND MP 2025",
        "subtitle": "PRE-OWNED",
        "subtitle_vi": "ĐÃ QUA SỬ DỤNG",
        "price": 3_700_000,
        "brand": "head",
        "badge": "USED",
    },
)

BABOLAT_CUSTOM = {
    "slug": "babolat-pure-strike-gen4-baseline-custom",
    "folder": "Custom rackets/babolatstrikegen4",
    "name": "BABOLAT PURE STRIKE GEN 4 × BASELINE",
    "name_vi": "BABOLAT PURE STRIKE GEN 4 × BASELINE",
    "subtitle": "CUSTOM PAINT",
    "subtitle_vi": "SƠN TÙY CHỈNH",
    "price": 2_800_000,
    "brand": "babolat",
    "badge": "CUSTOM",
}


def _resolve_images_dir(explicit: Path | None) -> Path:
    if explicit is not None:
        return explicit.expanduser().resolve()
    return _DEFAULT_IMAGES.resolve()


def _image_paths(folder: Path) -> list[Path]:
    if not folder.is_dir():
        return []
    files = [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES]
    by_stem: dict[str, Path] = {}
    for p in sorted(files, key=lambda x: x.name.lower()):
        stem = p.stem.replace(" (1)", "").strip()
        prev = by_stem.get(stem)
        if prev is None or (" (1)" in prev.stem and " (1)" not in p.stem):
            by_stem[stem] = p
    return sorted(by_stem.values(), key=lambda x: x.name.lower())


def _replace_product_images(db, tenant_id: int, product: Product, paths: list[Path]) -> int:
    if not paths:
        return 0
    db.execute(delete(ProductImage).where(ProductImage.product_id == product.id))
    for pos, path in enumerate(paths):
        content = path.read_bytes()
        ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        media = save_file(db, content, f"{product.slug}-{path.name}", ctype, tenant_id)
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
    return len(paths)


def _get_or_create_collection(db, tenant_id: int, slug: str, name: str, *, name_vi: str | None) -> Collection:
    col = db.scalar(select(Collection).where(Collection.tenant_id == tenant_id, Collection.slug == slug))
    if col is None:
        col = Collection(tenant_id=tenant_id, slug=slug, name=name, name_vi=name_vi)
        db.add(col)
        db.flush()
    col.name = name
    col.name_vi = name_vi
    col.is_active = True
    col.is_featured = True
    return col


def _used_description_en(frame: str) -> str:
    return (
        f"{frame} in solid pre-owned condition. Photos show the actual frame; "
        "minor cosmetic wear is normal for used rackets. One available — first come, first served."
    )


def _used_description_vi(frame: str) -> str:
    return (
        f"{frame} đã qua sử dụng, tình trạng tốt. Hình ảnh là vợt thực tế; "
        "trầy xước nhẹ là bình thường với vợt cũ. Số lượng có hạn."
    )


def _custom_description_en() -> str:
    return (
        "Babolat Pure Strike Gen 4 keeps tour-level precision and feel — "
        "Baseline Club applied a custom paint finish for a bold, modern look. "
        "Same frame DNA. Your style on court."
    )


def _custom_description_vi() -> str:
    return (
        "Babolat Pure Strike Gen 4 giữ độ chính xác và cảm giác chuẩn tour — "
        "Baseline Club hoàn thiện lớp sơn tùy chỉnh, diện mạo táo bạo và hiện đại. "
        "Cùng khung vợt. Phong cách của bạn."
    )


def seed(
    *,
    tenant_slug: str = "baseline",
    images_root: Path,
    dry_run: bool = True,
) -> dict[str, int | str]:
    stats: dict[str, int | str] = {"used_category": 0, "used_products": 0, "custom_product": 0, "images": 0}
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
        if tenant is None:
            raise SystemExit(f"Tenant not found: {tenant_slug}")

        used_cat = _get_or_create_category(
            db,
            tenant.id,
            USED_CATEGORY["slug"],
            USED_CATEGORY["name"],
            name_vi=USED_CATEGORY["name_vi"],
        )
        used_cat.tagline = USED_CATEGORY.get("tagline")
        used_cat.tagline_vi = USED_CATEGORY.get("tagline_vi")
        stats["used_category"] = used_cat.id

        custom_cat = _get_or_create_category(
            db,
            tenant.id,
            CUSTOM_CATEGORY["slug"],
            CUSTOM_CATEGORY["name"],
            name_vi=CUSTOM_CATEGORY["name_vi"],
        )
        custom_col = _get_or_create_collection(
            db,
            tenant.id,
            "custom-rackets",
            "Custom Rackets",
            name_vi="Vợt custom",
        )

        for spec in USED_PRODUCTS:
            folder = images_root / spec["folder"]
            paths = _image_paths(folder)
            if not paths:
                raise SystemExit(f"No images in {folder}")

            product = db.scalar(
                select(Product).where(Product.tenant_id == tenant.id, Product.slug == spec["slug"])
            )
            frame = spec["name"]
            if product is None:
                product = Product(
                    tenant_id=tenant.id,
                    slug=spec["slug"],
                    name=spec["name"],
                    name_vi=spec["name_vi"],
                    subtitle=spec["subtitle"],
                    subtitle_vi=spec["subtitle_vi"],
                    description=_used_description_en(frame),
                    description_vi=_used_description_vi(frame),
                    price=float(spec["price"]),
                    brand=spec["brand"],
                    category_id=used_cat.id,
                    badge=spec["badge"],
                    gallery_layout="slideshow",
                    colors=[{"name": "AS SHOWN", "hex": "#4a4a4a"}],
                    sizes=[{"name": "GRIP 2", "available": True}],
                    tech_specs=[
                        {
                            "label": "CONDITION",
                            "value": "PRE-OWNED",
                            "label_vi": "TÌNH TRẠNG",
                            "value_vi": "ĐÃ QUA SỬ DỤNG",
                        },
                    ],
                    features=[
                        {
                            "icon": "verified",
                            "title": "INSPECTED LISTING",
                            "description": "Listed with real photos from our shop floor.",
                            "title_vi": "ĐĂNG BÁN MINH BẠCH",
                            "description_vi": "Hình thật, báo giá rõ ràng tại Baseline.",
                        },
                    ],
                    is_active=True,
                    is_featured=False,
                )
                db.add(product)
                db.flush()
            else:
                product.name = spec["name"]
                product.name_vi = spec["name_vi"]
                product.price = float(spec["price"])
                product.brand = spec["brand"]
                product.category_id = used_cat.id
                product.badge = spec["badge"]
                product.is_active = True
                product.description = _used_description_en(frame)
                product.description_vi = _used_description_vi(frame)

            product.categories = [used_cat]
            if not dry_run:
                n = _replace_product_images(db, tenant.id, product, paths)
                stats["images"] = int(stats["images"]) + n
            stats["used_products"] = int(stats["used_products"]) + 1

        bspec = BABOLAT_CUSTOM
        bfolder = images_root / bspec["folder"]
        bpaths = _image_paths(bfolder)
        if not bpaths:
            raise SystemExit(f"No images in {bfolder}")

        babolat = db.scalar(
            select(Product)
            .where(Product.tenant_id == tenant.id, Product.slug == bspec["slug"])
            .options(selectinload(Product.images))
        )
        accent = {"name": "BASELINE CUSTOM", "hex": "#c9a227"}
        if babolat is None:
            babolat = Product(
                tenant_id=tenant.id,
                slug=bspec["slug"],
                name=bspec["name"],
                name_vi=bspec["name_vi"],
                subtitle=bspec["subtitle"],
                subtitle_vi=bspec["subtitle_vi"],
                description=_custom_description_en(),
                description_vi=_custom_description_vi(),
                price=float(bspec["price"]),
                brand=bspec["brand"],
                category_id=custom_cat.id,
                collection_id=custom_col.id,
                badge=bspec["badge"],
                gallery_layout="slideshow",
                colors=[accent],
                sizes=[
                    {"name": "GRIP 2", "available": True},
                    {"name": "GRIP 3", "available": True},
                ],
                tech_specs=[
                    {
                        "label": "FRAME",
                        "value": "PURE STRIKE GEN 4",
                        "label_vi": "KHUNG",
                        "value_vi": "PURE STRIKE GEN 4",
                    },
                    {
                        "label": "FINISH",
                        "value": "BASELINE CUSTOM PAINT",
                        "label_vi": "HOÀN THIỆN",
                        "value_vi": "SƠN CUSTOM BASELINE",
                    },
                ],
                features=[
                    {
                        "icon": "brush",
                        "title": "CUSTOM FINISH",
                        "description": "Painted by Baseline Club — 6-month paint warranty.",
                        "title_vi": "HOÀN THIỆN TÙY CHỈNH",
                        "description_vi": "Sơn bởi Baseline Club — bảo hành lớp sơn 6 tháng.",
                    },
                ],
                is_active=True,
                is_featured=True,
            )
            db.add(babolat)
            db.flush()
        else:
            babolat.name = bspec["name"]
            babolat.name_vi = bspec["name_vi"]
            babolat.price = float(bspec["price"])
            babolat.brand = bspec["brand"]
            babolat.category_id = custom_cat.id
            babolat.collection_id = custom_col.id
            babolat.is_active = True
            babolat.is_featured = True
            babolat.description = _custom_description_en()
            babolat.description_vi = _custom_description_vi()

        babolat.categories = [custom_cat]
        if not dry_run:
            n = _replace_product_images(db, tenant.id, babolat, bpaths)
            stats["images"] = int(stats["images"]) + n
            db.flush()
            if custom_col.hero_image_id is None:
                first_img = db.scalar(
                    select(ProductImage)
                    .where(ProductImage.product_id == babolat.id)
                    .order_by(ProductImage.position)
                    .limit(1)
                )
                if first_img and first_img.media_id:
                    custom_col.hero_image_id = first_img.media_id
        stats["custom_product"] = babolat.id

        if dry_run:
            db.rollback()
        else:
            db.commit()
    finally:
        db.close()
    return stats


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Baseline used rackets + Babolat Strike Gen4 custom seed")
    parser.add_argument("--tenant", default="baseline")
    parser.add_argument("--images-dir", default=None, help=f"Baseline sample root (default: {_DEFAULT_IMAGES})")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args(argv)
    if not args.apply and not args.dry_run:
        raise SystemExit("Pass --dry-run or --apply")
    root = _resolve_images_dir(Path(args.images_dir) if args.images_dir else None)
    if not root.is_dir():
        raise SystemExit(f"Images root not found: {root}")
    dry = args.dry_run or not args.apply
    stats = seed(tenant_slug=args.tenant, images_root=root, dry_run=dry)
    mode = "dry-run" if dry else "applied"
    print(f"seed_baseline_used_custom_rackets ({mode}): {stats}")


if __name__ == "__main__":
    main(sys.argv[1:])