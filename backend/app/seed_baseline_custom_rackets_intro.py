"""Seed Baseline ``custom-rackets`` category storefront intro (pricing graphic + copy).

Idempotent: runs only while ``content_blocks`` is empty unless
``REFRESH_CUSTOM_RACKETS_INTRO=1``.

    docker exec inspo-backend python -m app.seed_baseline_custom_rackets_intro
"""

from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import select

from .database import SessionLocal
from .minio_client import save_file
from .models import Category, Media, Tenant

SLUG = "baseline"
CATEGORY_SLUG = "custom-rackets"
ASSET = Path(__file__).resolve().parent.parent / "assets" / "custom_racket_pricing.jpeg"


def _ensure_media(db, tenant_id: int) -> Media:
    filename = ASSET.name
    row = db.scalar(
        select(Media).where(Media.tenant_id == tenant_id, Media.filename == filename)
    )
    if row is not None:
        return row
    if not ASSET.is_file():
        raise FileNotFoundError(f"Missing asset: {ASSET}")
    return save_file(db, ASSET.read_bytes(), filename, "image/jpeg", tenant_id=tenant_id)


def _blocks(media: Media) -> list[dict]:
    return [
        {
            "block_type": "heading",
            "position": 0,
            "data": {
                "text": "CUSTOM PACKAGE",
                "text_vi": "CUSTOM PACKAGE",
            },
        },
        {
            "block_type": "text",
            "position": 1,
            "data": {
                "body": (
                    "Customize your racket finish to match your style. "
                    "Packages from 2,000,000₫ to 3,000,000₫ depending on design complexity."
                ),
                "body_vi": (
                    "Tùy chỉnh ngoại hình vợt theo phong cách của bạn. "
                    "Từ 2.000.000₫ – 3.000.000₫ tùy theo độ phức tạp của thiết kế."
                ),
            },
        },
        {
            "block_type": "image",
            "position": 2,
            "data": {
                "media_id": media.id,
                "url": media.url,
                "caption": "Custom package — pricing & benefits",
                "caption_vi": "Gói custom — bảng giá & quyền lợi",
            },
        },
        {
            "block_type": "list",
            "position": 3,
            "data": {
                "items": [
                    "Color direction",
                    "Custom design to your brief",
                    "Design preview before paint",
                    "6-month paint warranty",
                    "Exclusive design — never reused",
                    "Professional finishing process",
                ],
                "items_vi": [
                    "Định hướng màu sắc",
                    "Thiết kế theo yêu cầu",
                    "Xem trước thiết kế",
                    "6 tháng bảo hành lớp sơn",
                    "Thiết kế độc quyền không lặp lại",
                    "Quy trình chuyên nghiệp",
                ],
            },
        },
        {
            "block_type": "pricing_table",
            "position": 4,
            "data": {
                "title": "Custom paint package",
                "title_vi": "Gói sơn custom",
                "note": "Final price is confirmed after concept and level of completion are agreed.",
                "note_vi": "Giá cuối cùng được xác nhận sau khi thống nhất ý tưởng và mức độ hoàn thiện.",
                "rows": [
                    {
                        "service": "Custom package (design + paint)",
                        "service_vi": "Gói custom (thiết kế + sơn)",
                        "price": "2.000.000₫ – 3.000.000₫",
                        "price_vi": "2.000.000₫ – 3.000.000₫",
                        "note": "By complexity",
                        "note_vi": "Theo độ phức tạp",
                    },
                ],
                "footer": (
                    "Warranty excludes scratches, impact, abrasion and damage from external causes."
                ),
                "footer_vi": (
                    "Bảo hành không bao gồm trầy xước, va đập hoặc hư hại từ tác động bên ngoài."
                ),
            },
        },
    ]


def run() -> None:
    force = os.getenv("REFRESH_CUSTOM_RACKETS_INTRO", "").strip() in ("1", "true", "yes")
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == SLUG))
        if tenant is None:
            print("custom-rackets intro seed: baseline tenant not found")
            return
        cat = db.scalar(
            select(Category).where(
                Category.tenant_id == tenant.id,
                Category.slug == CATEGORY_SLUG,
            )
        )
        if cat is None:
            print(f"custom-rackets intro seed: category {CATEGORY_SLUG!r} not found")
            return
        if cat.content_blocks and not force:
            print("custom-rackets intro seed: skipped (content_blocks already set)")
            return
        media = _ensure_media(db, tenant.id)
        cat.tagline = "Customize your racket look"
        cat.tagline_vi = "Tùy chỉnh ngoại hình vợt theo phong cách của bạn"
        cat.description = (
            "Baseline Club custom paint packages include design direction, preview, "
            "and warranty-backed finishing."
        )
        cat.description_vi = (
            "Gói sơn custom Baseline Club gồm định hướng thiết kế, xem trước "
            "và hoàn thiện có bảo hành."
        )
        cat.content_blocks = _blocks(media)
        db.commit()
        print(f"custom-rackets intro seed: updated category id={cat.id}")
    finally:
        db.close()


if __name__ == "__main__":
    run()