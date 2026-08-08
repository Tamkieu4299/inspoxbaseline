"""Seed the Baseline Club tenant (slug "baseline") with brand assets uploaded to MinIO.

Expects the raw image files under a base directory (default /tmp/baseline):

    Logo/logo baseline.png
    OnCourtTshirt/z8125552262398_....jpg
    ... (5 images)

Usage inside the backend container:

    docker cp SampleImages/baseline inspo-backend:/tmp/baseline
    docker exec inspo-backend python -m app.seed_baseline

Idempotent: skips if the baseline tenant already has products.
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
    EditorialItem,
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

IMAGES_DIR = Path(os.getenv("BASELINE_IMAGES_DIR", "/tmp/baseline"))

LOGO = "Logo/logo baseline.png"
TSHIRT_IMAGES = [
    "OnCourtTshirt/z8125552262398_d7d0a534d5e2006be5af87053d6a342d.jpg",
    "OnCourtTshirt/z8125552300924_76a7a88583a7be1431c049196a34f8c4.jpg",
    "OnCourtTshirt/z8125555766449_d01cf719261d9e7e149f0413f1bae5d5.jpg",
    "OnCourtTshirt/z8125561545822_ca5490be17e9601b0e786940878f9e75.jpg",
    "OnCourtTshirt/z8126175590585_114bf77826af147401afdf5b39134728.jpg",
]

BRAND_EN = (
    "To bring a fresh and modern take on tennis style, combining timeless "
    "elegance with fun, everyday design."
)
BRAND_VI = (
    "Mang đến một góc nhìn mới và hiện đại cho phong cách tennis, kết hợp "
    "nét thanh lịch với thiết kế trẻ trung, dễ mặc mỗi ngày."
)

SLUG = "baseline"
NAME = "BASELINE CLUB"
SITE_NAME = "BASELINE CLUB"
PRODUCT_SLUG = "oncourt-t-shirt"

WHITE = {"name": "OPTIC WHITE", "hex": "#ffffff"}
GREEN = {"name": "FOREST GREEN", "hex": "#2C5530"}
NAVY = {"name": "NAVY", "hex": "#1B263B"}
STEALTH = {"name": "STEALTH / WHITE", "hex": "#121212"}
CLAY = {"name": "CLAY", "hex": "#c05a3b"}
SIZES = ["XS", "S", "M", "L", "XL", "XXL"]


def _upload_bytes(db, relpath: str) -> Media:
    path = IMAGES_DIR / relpath
    existing = db.scalar(select(Media).where(Media.filename == path.name))
    if existing is not None:
        return existing
    content_type = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    return save_file(db, path.read_bytes(), path.name, content_type)


def run():
    db = SessionLocal()
    tenant = db.scalar(select(Tenant).where(Tenant.slug == SLUG))
    if tenant is None:
        tenant = Tenant(slug=SLUG, name=NAME)
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        print(f"Tenant created: {tenant.name} ({tenant.slug})")

    if db.scalar(select(Product.id).where(Product.tenant_id == tenant.id).limit(1)) is not None:
        db.close()
        print("Baseline seed skipped: data already present.")
        return

    admin = db.scalar(select(User).where(User.tenant_id == tenant.id, User.username == "admin"))
    if admin is None:
        admin = User(
            tenant_id=tenant.id,
            username="admin",
            password_hash=hash_password(settings.ADMIN_DEFAULT_PASSWORD),
        )
        db.add(admin)

    logo = _upload_bytes(db, LOGO)
    shirts = [_upload_bytes(db, p) for p in TSHIRT_IMAGES]

    site = SiteSettings(
        tenant_id=tenant.id,
        site_name=SITE_NAME,
        logo_media_id=logo.id,
        favicon_media_id=logo.id,
        nav_items=[
            {"type": "home", "enabled": True},
            {"type": "page", "ref": "about-us", "enabled": True},
            {"type": "collections", "enabled": True},
            {"type": "categories", "enabled": True},
            {"type": "brand", "enabled": True},
        ],
    )
    db.add(site)

    tops = Category(slug="tops", name="TOPS", tenant_id=tenant.id)
    db.add(tops)
    db.flush()

    oncourt = Collection(
        tenant_id=tenant.id,
        slug="oncourt",
        name="ONCOURT",
        tagline="MATCH DAY ESSENTIALS",
        description="Fresh, modern tennis style for everyday wear — combining timeless elegance with fun design.",
        hero_image_id=shirts[0].id,
        badge="NEW",
        is_featured=True,
        is_active=True,
        display_order=1,
    )
    db.add(oncourt)
    db.flush()

    product = Product(
        tenant_id=tenant.id,
        slug=PRODUCT_SLUG,
        name="ONCOURT T-SHIRT",
        subtitle="COURT COTTON",
        price=75.0,
        category_id=tops.id,
        collection_id=oncourt.id,
        badge="NEW",
        description=(
            "The OnCourt T-Shirt reworks classic court cotton for modern, "
            "everyday wear — a fresh, clean take on tennis style."
        ),
        colors=[WHITE, GREEN, NAVY, STEALTH, CLAY],
        sizes=SIZES,
        tech_specs=[
            {"label": "FABRIC", "value": "PREMIUM COTTON"},
            {"label": "FIT", "value": "CLASSIC REGULAR"},
        ],
        features=[
            {
                "icon": "checkroom",
                "title": "TIMELESS ELEGANCE",
                "description": "Clean lines cut to look sharp on and off the court.",
            },
            {
                "icon": "eco",
                "title": "EVERYDAY COMFORT",
                "description": "Breathable cotton made for long days in motion.",
            },
            {
                "icon": "sports_tennis",
                "title": "MODERN TENNIS STYLE",
                "description": "A fresh and modern take on the tennis wardrobe.",
            },
        ],
        is_active=True,
        is_featured=True,
        is_bestseller=True,
    )
    db.add(product)
    db.flush()

    for position, media in enumerate(shirts):
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
        hero_kicker="BASELINE CLUB",
        hero_title="FRESH TENNIS STYLE",
        hero_subtitle=BRAND_EN,
        hero_subtitle_vi=BRAND_VI,
        hero_image_id=shirts[0].id,
        hero_primary_cta="SHOP ONCOURT",
        hero_primary_url="/collections/oncourt",
        hero_secondary_cta="OUR STORY",
        hero_secondary_url="/brand",
        trending_title="ONCOURT",
        master_title="BASELINE CLUB",
        master_description=BRAND_EN,
        master_description_vi=BRAND_VI,
        master_media_id=shirts[1].id,
        features=[
            {"index": "01", "title": "TIMELESS ELEGANCE", "title_vi": "THANH LỊCH VƯỢT THỜI GIAN"},
            {"index": "02", "title": "EVERYDAY COMFORT", "title_vi": "THOẢI MÁI MỖI NGÀY"},
            {"index": "03", "title": "MODERN TENNIS STYLE", "title_vi": "PHONG CÁCH TENNIS HIỆN ĐẠI"},
        ],
    )
    db.add(home)

    editorial = [
        EditorialItem(
            tenant_id=tenant.id,
            kind="image",
            title="OnCourt T-Shirt",
            subtitle="MATCH DAY ESSENTIALS",
            media_id=shirts[2].id,
            link_text="SHOP NOW",
            link_url="/products/oncourt-t-shirt",
            position=1,
        ),
        EditorialItem(
            tenant_id=tenant.id,
            kind="quote",
            quote=BRAND_EN,
            quote_vi=BRAND_VI,
            author="— BASELINE CLUB",
            position=2,
        ),
        EditorialItem(
            tenant_id=tenant.id,
            kind="image",
            title="Everyday Tennis Style",
            subtitle="MODERN DESIGN",
            media_id=shirts[3].id,
            link_text="VIEW COLLECTION",
            link_url="/collections/oncourt",
            position=3,
        ),
    ]
    db.add_all(editorial)

    def _block(block_type: str, data: dict, position: int) -> PageBlock:
        return PageBlock(block_type=block_type, data=data, position=position)

    db.add_all(
        [
            Page(
                tenant_id=tenant.id,
                slug="about-us",
                title="ABOUT US",
                subtitle="The story behind Baseline Club.",
                title_vi="VỀ CHÚNG TÔI",
                subtitle_vi="Câu chuyện đằng sau Baseline Club.",
                hero_image_id=shirts[0].id,
                is_active=True,
                show_in_nav=True,
                nav_label="ABOUT",
                nav_label_vi="GIỚI THIỆU",
                position=1,
                blocks=[
                    _block("heading", {"text": "OUR STORY"}, 1),
                    _block("text", {"body": BRAND_EN, "body_vi": BRAND_VI}, 2),
                    _block("image", {"url": shirts[2].url, "caption": "The OnCourt T-Shirt"}, 3),
                    _block("cta", {"label": "SHOP ONCOURT", "url": "/collections/oncourt"}, 4),
                ],
            ),
            Page(
                tenant_id=tenant.id,
                slug="blogs",
                title="JOURNAL",
                subtitle="Notes from the Baseline Club studio.",
                title_vi="NHẬT KÝ",
                subtitle_vi="Ghi chú từ studio Baseline Club.",
                hero_image_id=shirts[1].id,
                is_active=True,
                show_in_nav=True,
                nav_label="BLOGS",
                nav_label_vi="BLOG",
                position=2,
                blocks=[],
            ),
        ]
    )

    db.add(
        BlogPost(
            tenant_id=tenant.id,
            slug="meet-the-oncourt",
            title="Meet the OnCourt T-Shirt",
            excerpt="A fresh and modern take on tennis style — built for the court and made for every day.",
            cover_image_id=shirts[4].id,
            is_active=True,
            published_at=datetime(2026, 2, 10),
            content=[
                {
                    "type": "text",
                    "data": {"body": BRAND_EN, "body_vi": BRAND_VI},
                },
                {"type": "image", "data": {"url": shirts[2].url, "caption": "OnCourt T-Shirt"}},
                {
                    "type": "cta",
                    "data": {"label": "SHOP ONCOURT", "url": "/collections/oncourt"},
                },
            ],
        )
    )

    db.commit()
    db.close()
    print("Baseline Club seeded: logo, brand brief, OnCourt T-Shirt (5 images).")


if __name__ == "__main__":
    run()
