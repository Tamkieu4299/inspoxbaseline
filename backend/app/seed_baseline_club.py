"""Seed Baseline Club catalog from ``BaselineClub/`` (overgrips + custom racket).

Idempotent: creates or updates the two club products by slug; uploads images to MinIO.

Usage (Docker):

    docker compose up -d
    docker exec inspo-backend python -m app.seed_baseline_club

Set ``BASELINE_CLUB_DIR`` if assets are not at ``/app/BaselineClub``.
"""

from __future__ import annotations

import os
import sys
from hashlib import sha256
from pathlib import Path

from sqlalchemy import delete, select

from .config import settings
from .database import SessionLocal
from .minio_client import replace_file, save_file
from .models import (
    Category,
    Collection,
    Media,
    Product,
    ProductImage,
    Tenant,
    User,
)
from .security import hash_password

SLUG = "baseline"
TENANT_NAME = "BASELINE CLUB"

_REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CLUB_DIR = _REPO_ROOT / "BaselineClub"
CLUB_DIR = Path(os.getenv("BASELINE_CLUB_DIR", str(DEFAULT_CLUB_DIR)))

RACKET_IMAGE = CLUB_DIR / "CustomRacket" / "HeadSpeedMPL.jpeg"

OVERGRIP_SPECS = [
    {
        "key": "baseline-club",
        "color": {"name": "BASELINE CLUB", "hex": "#111111"},
        "aliases": ("baseline-club", "baselineclub", "baseline-club"),
        "pdf_stem": "Baselineclub",
    },
    {
        "key": "culture",
        "color": {"name": "CULTURE", "hex": "#8a8a8a"},
        "aliases": ("culture",),
        "pdf_stem": "Culture",
    },
    {
        "key": "food",
        "color": {"name": "FOOD", "hex": "#5c1a1a"},
        "aliases": ("food",),
        "pdf_stem": "Food",
    },
    {
        "key": "iconics-vietnam",
        "color": {"name": "ICONICS VIETNAM", "hex": "#7ec8d8"},
        "aliases": ("iconics-vietnam", "iconicsvietnam"),
        "pdf_stem": "IconicsVietnam",
    },
]


def _norm_stem(name: str) -> str:
    return name.lower().replace(" ", "-").replace("_", "-")


def _resolve_overgrip_png(spec: dict) -> Path:
    grip_dir = CLUB_DIR / "Overgrips"
    search_dirs = [grip_dir, grip_dir / "rendered"]
    alias_set = {_norm_stem(a) for a in spec["aliases"]}
    alias_set.add(_norm_stem(spec["key"]))
    alias_set.add(_norm_stem(spec["pdf_stem"]))

    for directory in search_dirs:
        if not directory.is_dir():
            continue
        for path in sorted(directory.glob("*.png")) + sorted(directory.glob("*.PNG")):
            if _norm_stem(path.stem) in alias_set:
                return path
        for stem in (spec["pdf_stem"], spec["key"], *spec["aliases"]):
            for ext in (".png", ".PNG"):
                candidate = directory / f"{stem}{ext}"
                if candidate.is_file():
                    return candidate

    raise FileNotFoundError(
        f"No PNG for overgrip “{spec['key']}” under {grip_dir} (drop e.g. {spec['pdf_stem']}.png)"
    )


def _discover_overgrip_variants() -> list[dict]:
    variants = []
    for spec in OVERGRIP_SPECS:
        path = _resolve_overgrip_png(spec)
        variants.append({**spec, "file": path})
    return variants

RACKET_DESCRIPTION_EN = (
    "The HEAD Speed MP is a versatile, stable frame with a blend of power, control, "
    "and spin. This Baseline Club custom keeps the same performance — we only replaced "
    "the boring colors with a fresh, bold look that is fun, energetic, and made for "
    "modern players. Same frame. More fun. Same performance."
)
RACKET_DESCRIPTION_VI = (
    "HEAD Speed MP là cây vợt đa năng, ổn định với sự cân bằng giữa sức mạnh, kiểm "
    "soát và độ xoáy. Phiên bản Baseline Club giữ nguyên hiệu năng — chỉ thay màu "
    "nhàm chán bằng diện mạo táo bạo, trẻ trung dành cho người chơi hiện đại. "
    "Cùng khung vợt. Vui hơn. Hiệu năng như cũ."
)

OVERGRIPS_DESCRIPTION_EN = (
    "Premium tennis overgrips wrapped in Baseline Club graphics — from the wordmark "
    "strip to Culture court icons, Vietnamese street-food patterns, and Iconics "
    "Vietnam landmarks. Tacky feel, sweat absorption, and personality for every match."
)
OVERGRIPS_DESCRIPTION_VI = (
    "Overgrip tennis cao cấp với họa tiết Baseline Club — từ dải logo, icon sân đấu "
    "Culture, ẩm thực đường phố Việt, đến landmark Iconics Vietnam. Bám tay, thấm "
    "mồ hôi và đậm chất riêng trên sân."
)


def _content_type(path: Path) -> str:
    ext = path.suffix.lower()
    if ext == ".png":
        return "image/png"
    if ext in {".jpg", ".jpeg"}:
        return "image/jpeg"
    return "application/octet-stream"


def _upload(
    db,
    path: Path,
    tenant_id: int,
    cache_key: str,
    *,
    refresh: bool = False,
) -> Media:
    if not path.is_file():
        raise FileNotFoundError(path)
    content = path.read_bytes()
    content_type = _content_type(path)
    digest = sha256(content).hexdigest()
    existing = db.scalar(
        select(Media).where(Media.tenant_id == tenant_id, Media.filename == cache_key)
    )
    if existing is not None:
        same = existing.size == len(content)
        if refresh or not same:
            replace_file(db, existing, content, content_type)
            existing.filename = cache_key
            print(f"  refreshed media {cache_key} ({path.name}, {len(content)} bytes, sha256={digest[:12]}…)")
            return existing
        return existing
    media = save_file(db, content, cache_key, content_type, tenant_id=tenant_id)
    print(f"  uploaded media {cache_key} ({path.name}, {len(content)} bytes)")
    return media


def _ensure_tenant(db) -> Tenant:
    tenant = db.scalar(select(Tenant).where(Tenant.slug == SLUG))
    if tenant is None:
        tenant = Tenant(slug=SLUG, name=TENANT_NAME)
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        print(f"Tenant created: {tenant.name} ({tenant.slug})")
    return tenant


def _ensure_admin(db, tenant_id: int) -> None:
    user = db.scalar(select(User).where(User.tenant_id == tenant_id, User.username == "admin"))
    if user is None:
        db.add(
            User(
                tenant_id=tenant_id,
                username="admin",
                password_hash=hash_password(settings.ADMIN_DEFAULT_PASSWORD),
            )
        )
        db.commit()


def _get_or_create_category(db, tenant_id: int, slug: str, name: str) -> Category:
    cat = db.scalar(
        select(Category).where(Category.tenant_id == tenant_id, Category.slug == slug)
    )
    if cat is None:
        cat = Category(tenant_id=tenant_id, slug=slug, name=name)
        db.add(cat)
        db.flush()
    return cat


def _get_or_create_collection(
    db,
    tenant_id: int,
    slug: str,
    name: str,
    *,
    tagline: str,
    hero_image_id: int | None,
    display_order: int,
) -> Collection:
    col = db.scalar(
        select(Collection).where(Collection.tenant_id == tenant_id, Collection.slug == slug)
    )
    if col is None:
        col = Collection(
            tenant_id=tenant_id,
            slug=slug,
            name=name,
            tagline=tagline,
            hero_image_id=hero_image_id,
            is_featured=True,
            is_active=True,
            display_order=display_order,
        )
        db.add(col)
        db.flush()
    elif hero_image_id and col.hero_image_id is None:
        col.hero_image_id = hero_image_id
    return col


def _replace_product_images(db, product: Product, media_rows: list[tuple[Media, str]]) -> None:
    db.execute(delete(ProductImage).where(ProductImage.product_id == product.id))
    for position, (media, alt) in enumerate(media_rows):
        db.add(
            ProductImage(
                product_id=product.id,
                media_id=media.id,
                url=media.url,
                alt=alt,
                position=position,
            )
        )


def _upsert_overgrips(
    db,
    tenant_id: int,
    accessories: Category,
    collection: Collection,
    variants: list[dict],
) -> Product:
    slug = "baseline-overgrips"
    product = db.scalar(
        select(Product).where(Product.tenant_id == tenant_id, Product.slug == slug)
    )
    media_rows: list[tuple[Media, str]] = []
    print("Overgrip assets:")
    for variant in variants:
        cache_key = f"baseline-overgrip-{variant['key']}.png"
        media = _upload(db, variant["file"], tenant_id, cache_key, refresh=True)
        media_rows.append((media, f"Baseline Overgrips — {variant['color']['name']}"))

    colors = [v["color"] for v in variants]

    if product is None:
        product = Product(
            tenant_id=tenant_id,
            slug=slug,
            name="BASELINE OVERGRIPS",
            name_vi="OVERGRIP BASELINE CLUB",
            subtitle="SIGNATURE WRAP DESIGNS",
            subtitle_vi="HỌA TIẾT ĐẶC TRƯNG",
            description=OVERGRIPS_DESCRIPTION_EN,
            description_vi=OVERGRIPS_DESCRIPTION_VI,
            price=14.0,
            category_id=accessories.id,
            collection_id=collection.id,
            badge="NEW",
            gallery_layout="slideshow",
            colors=colors,
            sizes=["ONE SIZE"],
            tech_specs=[
                {"label": "PACK", "value": "3 OVERGRIPS", "label_vi": "GÓI", "value_vi": "3 OVERGRIP"},
                {"label": "FEEL", "value": "TACKY & ABSORBENT", "label_vi": "CẢM GIÁC", "value_vi": "BÁM TAY, THẤM MỒ HÔI"},
            ],
            features=[
                {
                    "icon": "palette",
                    "title": "FOUR BASELINE DESIGNS",
                    "description": "Club wordmark, Culture, Food, and Iconics Vietnam patterns.",
                    "title_vi": "BỐN HỌA TIẾT",
                    "description_vi": "Logo club, Culture, Food và Iconics Vietnam.",
                },
                {
                    "icon": "sports_tennis",
                    "title": "MATCH-READY GRIP",
                    "description": "Built for long sets and hot courts.",
                    "title_vi": "SẴN SÀNG THI ĐẤU",
                    "description_vi": "Cho những set đấu dài và sân nắng.",
                },
            ],
            is_active=True,
            is_featured=True,
            is_bestseller=False,
        )
        db.add(product)
        db.flush()
    else:
        product.name = "BASELINE OVERGRIPS"
        product.description = OVERGRIPS_DESCRIPTION_EN
        product.description_vi = OVERGRIPS_DESCRIPTION_VI
        product.colors = colors
        product.category_id = accessories.id
        product.collection_id = collection.id
        product.is_active = True
        product.is_featured = True

    _replace_product_images(db, product, media_rows)
    return product


def _upsert_racket(db, tenant_id: int, rackets: Category, collection: Collection) -> Product:
    slug = "head-speed-mp-baseline-club"
    product = db.scalar(
        select(Product).where(Product.tenant_id == tenant_id, Product.slug == slug)
    )
    cache_key = "head-speed-mp-baseline-club-spec.jpeg"
    hero = _upload(db, RACKET_IMAGE, tenant_id, cache_key)
    media_rows = [(hero, "HEAD SPEED MP × BASELINE CLUB")]

    pink = {"name": "POWER PINK", "hex": "#e91e8c"}

    if product is None:
        product = Product(
            tenant_id=tenant_id,
            slug=slug,
            name="HEAD SPEED MP × BASELINE CLUB",
            name_vi="HEAD SPEED MP × BASELINE CLUB",
            subtitle="SAME FRAME MORE FUN",
            subtitle_vi="CÙNG KHUNG VỢT — VUI HƠN",
            description=RACKET_DESCRIPTION_EN,
            description_vi=RACKET_DESCRIPTION_VI,
            price=329.0,
            category_id=rackets.id,
            collection_id=collection.id,
            badge="CUSTOM",
            gallery_layout="collage",
            colors=[pink],
            sizes=["GRIP 1", "GRIP 2", "GRIP 3", "GRIP 4"],
            tech_specs=[
                {"label": "FRAME", "value": "HEAD SPEED MP", "label_vi": "KHUNG", "value_vi": "HEAD SPEED MP"},
                {"label": "FINISH", "value": "BASELINE CLUB CUSTOM", "label_vi": "HOÀN THIỆN", "value_vi": "CUSTOM BASELINE CLUB"},
            ],
            features=[
                {
                    "icon": "bolt",
                    "title": "HIGH PERFORMANCE",
                    "description": "Power, control, and spin in a stable MP layup.",
                    "title_vi": "HIỆU NĂNG CAO",
                    "description_vi": "Sức mạnh, kiểm soát và xoáy trên khung MP ổn định.",
                },
                {
                    "icon": "brush",
                    "title": "BOLD BASELINE LOOK",
                    "description": "Power pink and black graphics designed by Baseline Club.",
                    "title_vi": "DIỆN MẠO BASELINE",
                    "description_vi": "Hồng đậm và đen — thiết kế bởi Baseline Club.",
                },
            ],
            is_active=True,
            is_featured=True,
            is_bestseller=True,
        )
        db.add(product)
        db.flush()
    else:
        product.description = RACKET_DESCRIPTION_EN
        product.description_vi = RACKET_DESCRIPTION_VI
        product.category_id = rackets.id
        product.collection_id = collection.id
        product.is_active = True
        product.is_featured = True

    _replace_product_images(db, product, media_rows)
    return product


def run(*, overgrips_only: bool = False) -> None:
    if not CLUB_DIR.is_dir():
        raise SystemExit(
            f"BaselineClub assets not found at {CLUB_DIR}. "
            "Mount ./BaselineClub into the container or set BASELINE_CLUB_DIR."
        )

    try:
        overgrip_variants = _discover_overgrip_variants()
    except FileNotFoundError as exc:
        raise SystemExit(str(exc)) from exc

    if not overgrips_only and not RACKET_IMAGE.is_file():
        raise SystemExit(f"Missing racket image: {RACKET_IMAGE}")

    db = SessionLocal()
    try:
        tenant = _ensure_tenant(db)
        _ensure_admin(db, tenant.id)

        accessories = _get_or_create_category(db, tenant.id, "accessories", "ACCESSORIES")
        rackets = _get_or_create_category(db, tenant.id, "rackets", "RACKETS")

        racket_media = None
        if not overgrips_only:
            racket_media = _upload(db, RACKET_IMAGE, tenant.id, "head-speed-mp-baseline-club-spec.jpeg")

        gear = db.scalar(
            select(Collection).where(
                Collection.tenant_id == tenant.id, Collection.slug == "baseline-gear"
            )
        )
        if gear is None:
            gear = _get_or_create_collection(
                db,
                tenant.id,
                "baseline-gear",
                "BASELINE GEAR",
                tagline="OVERGRIPS & CUSTOM FRAMES",
                hero_image_id=racket_media.id if racket_media else None,
                display_order=2,
            )
        elif racket_media and gear.hero_image_id is None:
            gear.hero_image_id = racket_media.id

        overgrips = _upsert_overgrips(db, tenant.id, accessories, gear, overgrip_variants)

        racket = None
        if not overgrips_only:
            racket = _upsert_racket(db, tenant.id, rackets, gear)

        db.commit()
        if overgrips_only:
            print(f"Baseline overgrips re-seeded: {overgrips.slug} ({len(overgrip_variants)} images).")
        else:
            print(
                "Baseline Club products ready:",
                f"{overgrips.slug} ({len(overgrip_variants)} images),",
                f"{racket.slug} (1 image)." if racket else "",
            )
    finally:
        db.close()


if __name__ == "__main__":
    only = "--overgrips-only" in sys.argv or "--overgrips" in sys.argv
    run(overgrips_only=only)
