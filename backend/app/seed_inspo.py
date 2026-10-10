"""Seed shop1 (INSPO) from real product photos — matches ``deploy/backup`` catalog.

Uploads ``SampleImages/inspo`` to MinIO (same assets as the deploy export). Skips if
shop1 already has products (e.g. after ``deploy/import-data.sh``).

Usage:

    docker cp SampleImages/inspo inspo-backend:/tmp/inspo
    docker exec inspo-backend python -m app.seed_inspo
"""

import os
from datetime import datetime
from pathlib import Path

from sqlalchemy import select

from .config import settings
from .database import SessionLocal
from .minio_client import save_file
from .models import (
    BlogPost,
    Category,
    Collection,
    HomeContent,
    Media,
    Page,
    PageBlock,
    Product,
    ProductImage,
    SiteSettings,
    Tenant,
    User,
)
from .security import hash_password

IMAGES_DIR = Path(os.getenv("INSPO_IMAGES_DIR", "/tmp/inspo"))
SLUG = "shop1"
TENANT_NAME = "INSPO"

INSPO_PRODUCT_SLUGS = frozenset(
    {"eden-dress-blue", "eden-dress-green", "eden-dress-pink"}
)

SIZES = ["XS", "S", "M", "L", "XL"]
TECH_SPECS = [
    {
        "label": "FABRIC",
        "value": "RECYCLED PERFORMANCE CREPE",
        "label_vi": "CHẤT LIỆU",
        "value_vi": "VẢI CREPE TÁI CHẾ HIỆU SUẤT CAO",
    },
    {"label": "LENGTH", "value": "MIDI", "label_vi": "CHIỀU DÀI", "value_vi": "MIDI"},
    {
        "label": "CARE",
        "value": "COLD MACHINE WASH",
        "label_vi": "BẢO QUẢN",
        "value_vi": "GIẶT MÁY NƯỚC LẠNH",
    },
]
FEATURES = [
    {
        "icon": "water_drop",
        "title": "MOISTURE WICKING",
        "description": "Engineered to keep you dry through every set.",
        "title_vi": "THẤM HÚT ẨM",
        "description_vi": "Được thiết kế giữ cho bạn khô thoáng suốt mọi bài tập.",
    },
    {
        "icon": "straighten",
        "title": "PRECISION CUT",
        "description": "A silhouette tailored for movement and elegance.",
        "title_vi": "ĐƯỜNG CẮT CHÍNH XÁC",
        "description_vi": "Kiểu dáng được may đo cho vận động và sự thanh lịch.",
    },
    {
        "icon": "eco",
        "title": "RECYCLED FIBERS",
        "description": "Crafted from responsibly sourced performance fabric.",
        "title_vi": "SỢI TÁI CHẾ",
        "description_vi": "Được tạo nên từ chất liệu hiệu suất có nguồn gốc bền vững.",
    },
]

PRODUCTS = [
    {
        "slug": "eden-dress-blue",
        "folder": "Eden dress blue",
        "name": "EDEN DRESS — BLUE",
        "name_vi": "VÁY EDEN — XANH DƯƠNG",
        "description": "A timeless blue midi dress with sculpted seams and a soft drape.",
        "description_vi": "Chiếc đầm midi xanh dương vượt thời gian với đường may tạo khối và lớp vải rũ mềm mại.",
        "colors": ["BLUE"],
        "gallery_layout": "collage",
    },
    {
        "slug": "eden-dress-green",
        "folder": "Eden dress green",
        "name": "EDEN DRESS — GREEN",
        "name_vi": "VÁY EDEN — XANH LÁ",
        "description": "An elegant forest-green dress cut for movement and club heritage.",
        "description_vi": "Chiếc đầm midi xanh lá đầy cá tính với đường may tạo khối và lớp vải rũ mềm mại.",
        "colors": ["GREEN"],
        "gallery_layout": "slideshow",
    },
    {
        "slug": "eden-dress-pink",
        "folder": "Eden dress pink",
        "name": "EDEN DRESS — PINK",
        "name_vi": "",
        "description": "A refined blush-pink dress with a fluid, flattering silhouette.",
        "description_vi": "",
        "colors": [{"name": "PINK", "hex": "#ffffff"}],
        "gallery_layout": "slideshow",
    },
]


def _upload_file(db, path: Path, tenant_id: int) -> Media:
    existing = db.scalar(
        select(Media).where(Media.filename == path.name, Media.tenant_id == tenant_id)
    )
    if existing is not None:
        return existing
    return save_file(
        db,
        path.read_bytes(),
        path.name,
        "image/jpeg",
        tenant_id=tenant_id,
    )


def _upload_folder(db, folder: str, tenant_id: int) -> list[Media]:
    root = IMAGES_DIR / folder
    if not root.is_dir():
        raise FileNotFoundError(f"Missing image folder: {root}")
    files = sorted(p for p in root.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    if not files:
        raise FileNotFoundError(f"No images in {root}")
    return [_upload_file(db, p, tenant_id) for p in files]


def run():
    db = SessionLocal()
    tenant = db.scalar(select(Tenant).where(Tenant.slug == SLUG))
    if tenant is None:
        tenant = Tenant(slug=SLUG, name=TENANT_NAME)
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        print(f"Tenant created: {tenant.name} ({tenant.slug})")

    if db.scalar(select(Product.id).where(Product.tenant_id == tenant.id).limit(1)) is not None:
        db.close()
        print("INSPO seed skipped: shop1 catalog already present (use deploy/import-data.sh to restore backup).")
        return

    if not IMAGES_DIR.is_dir():
        db.close()
        print(
            f"INSPO seed skipped: no images at {IMAGES_DIR}. "
            "Copy SampleImages/inspo into the container or restore deploy/backup."
        )
        return

    admin = db.scalar(select(User).where(User.tenant_id == tenant.id, User.username == "admin"))
    if admin is None:
        db.add(
            User(
                tenant_id=tenant.id,
                username="admin",
                password_hash=hash_password(settings.ADMIN_DEFAULT_PASSWORD),
            )
        )

    logo_path = IMAGES_DIR / "Logo"
    logo_files = sorted(logo_path.glob("*.jpg")) if logo_path.is_dir() else []
    logo = _upload_file(db, logo_files[0], tenant.id) if logo_files else None

    for slug, name in [
        ("dresses", "DRESSES"),
        ("skirt", "SKIRT"),
        ("bra", "BRA"),
        ("short", "SHORT"),
        ("legging", "LEGGING"),
    ]:
        if db.scalar(
            select(Category.id).where(Category.tenant_id == tenant.id, Category.slug == slug)
        ) is None:
            db.add(Category(slug=slug, name=name, tenant_id=tenant.id))
    db.flush()

    dresses = db.scalar(
        select(Category).where(Category.tenant_id == tenant.id, Category.slug == "dresses")
    )
    assert dresses is not None

    blue_media = _upload_folder(db, PRODUCTS[0]["folder"], tenant.id)
    eden = Collection(
        tenant_id=tenant.id,
        slug="eden-collection",
        name="EDEN COLLECTION",
        tagline="THE EDEN DRESS",
        description="A midi dress cut for movement. Precision seams, recycled crepe, and a drape that follows every line.",
        hero_image_id=blue_media[0].id,
        badge="NEW",
        is_featured=True,
        is_active=True,
        display_order=1,
    )
    new_arrivals = Collection(
        tenant_id=tenant.id,
        slug="new-arrivals",
        name="NEW ARRIVALS",
        tagline="JUST LANDED",
        description="Fresh from the studio.",
        hero_image_id=blue_media[0].id,
        is_featured=False,
        is_active=True,
        display_order=2,
    )
    db.add_all([eden, new_arrivals])
    db.flush()

    for spec in PRODUCTS:
        images = _upload_folder(db, spec["folder"], tenant.id)
        product = Product(
            tenant_id=tenant.id,
            slug=spec["slug"],
            name=spec["name"],
            name_vi=spec.get("name_vi") or None,
            subtitle="EDEN COLLECTION",
            subtitle_vi="BỘ SƯU TẬP EDEN",
            price=145.0,
            category_id=dresses.id,
            collection_id=eden.id,
            badge="NEW ARRIVAL",
            gallery_layout=spec["gallery_layout"],
            description=spec["description"],
            description_vi=spec.get("description_vi") or None,
            colors=spec["colors"],
            sizes=SIZES,
            tech_specs=TECH_SPECS,
            features=FEATURES,
            is_active=True,
            is_featured=True,
        )
        db.add(product)
        db.flush()
        for position, media in enumerate(images):
            db.add(
                ProductImage(
                    product_id=product.id,
                    media_id=media.id,
                    url=media.url,
                    alt=product.name,
                    position=position,
                )
            )

    home = HomeContent(
        tenant_id=tenant.id,
        hero_kicker="EDEN COLLECTION",
        hero_title="THE EDEN\nDRESS",
        hero_subtitle="A midi dress cut for movement. Precision seams, recycled crepe, and a drape that follows every line.",
        hero_image_id=blue_media[0].id,
        hero_primary_cta="SHOP THE DRESS",
        hero_primary_url="/collections/eden-collection",
        hero_secondary_cta="OUR STORY",
        hero_secondary_url="/pages/about-us",
        trending_title="THE EDEN COLLECTION",
        master_title="THE EDEN\nDRESS",
        master_description="Recycled performance crepe, sculpted seams, and three colorways cut on the same block.",
        master_media_id=blue_media[min(1, len(blue_media) - 1)].id,
        features=[
            {"index": "01", "title": "LIGHTWEIGHT BREATHABILITY", "title_vi": "THOÁNG KHÍ NHẸ NHÀNG"},
            {"index": "02", "title": "PRECISION TAILORING", "title_vi": "MAY ĐO CHÍNH XÁC"},
            {"index": "03", "title": "FOUR-WAY STRETCH", "title_vi": "GIÃN BỐN CHIỀU"},
        ],
    )
    db.add(home)

    db.add(
        SiteSettings(
            tenant_id=tenant.id,
            site_name="INSPO",
            logo_media_id=logo.id if logo else None,
            favicon_media_id=logo.id if logo else None,
        )
    )

    def block(block_type: str, data: dict, position: int) -> PageBlock:
        return PageBlock(block_type=block_type, data=data, position=position)

    db.add(
        Page(
            tenant_id=tenant.id,
            slug="about-us",
            title="ABOUT US",
            subtitle="The story, craft, and people behind the Eden Dress.",
            hero_image_id=blue_media[0].id,
            is_active=True,
            show_in_nav=True,
            nav_label="ABOUT",
            position=1,
            blocks=[
                block("heading", {"text": "OUR STORY"}, 1),
                block(
                    "text",
                    {
                        "body": "INSPO began with a simple belief: clothing should move with you. The Eden Dress is a study in precision — recycled performance crepe, sculpted seams, and a drape that follows every line."
                    },
                    2,
                ),
                block(
                    "cta",
                    {"label": "SHOP THE EDEN DRESS", "url": "/collections/eden-collection"},
                    3,
                ),
            ],
        )
    )
    db.add(
        Page(
            tenant_id=tenant.id,
            slug="blogs",
            title="JOURNAL",
            subtitle="Stories from the studio.",
            hero_image_id=blue_media[0].id,
            is_active=True,
            show_in_nav=True,
            nav_label="BLOGS",
            position=2,
            blocks=[],
        )
    )

    db.add_all(
        [
            BlogPost(
                tenant_id=tenant.id,
                slug="the-making-of-eden",
                title="The Making of the Eden Dress",
                excerpt="How recycled crepe, precision seams, and three colorways became a single silhouette.",
                cover_image_id=blue_media[0].id,
                is_active=True,
                published_at=datetime(2026, 1, 15),
                content=[
                    {
                        "type": "text",
                        "data": {
                            "body": "Every Eden Dress begins with recycled performance crepe that drapes like a day dress and moves like an athletic piece."
                        },
                    },
                ],
            ),
            BlogPost(
                tenant_id=tenant.id,
                slug="a-midi-for-everywhere",
                title="A Midi for Everywhere",
                excerpt="From the court to the city — why the midi length is the new uniform.",
                cover_image_id=blue_media[0].id,
                is_active=True,
                published_at=datetime(2026, 2, 2),
                content=[
                    {
                        "type": "text",
                        "data": {"body": "The midi length sits at the perfect midpoint: elegant enough for dinner, easy enough for a full day in motion."},
                    },
                    {
                        "type": "cta",
                        "data": {"label": "SHOP THE EDEN DRESS", "url": "/collections/eden-collection"},
                    },
                ],
            ),
        ]
    )

    db.commit()
    db.close()
    print("INSPO seed complete: 3 Eden dress products with MinIO gallery images.")


if __name__ == "__main__":
    run()
