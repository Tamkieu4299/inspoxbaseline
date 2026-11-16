"""Seed Baseline ``custom-rackets`` category storefront intro (service package block).

Idempotent via ``intro_version`` on block data. Force refresh:

    REFRESH_CUSTOM_RACKETS_INTRO=1 docker exec inspo-backend python -m app.seed_baseline_custom_rackets_intro
"""

from __future__ import annotations

import os

from sqlalchemy import select

from .database import SessionLocal
from .models import Category, Tenant

SLUG = "baseline"
CATEGORY_SLUG = "custom-rackets"
INTRO_VERSION = 3


def _blocks() -> list[dict]:
    return [
        {
            "block_type": "service_package",
            "position": 0,
            "data": {
                "intro_version": INTRO_VERSION,
                "theme": "baseline-dark",
                "kicker": "BASELINE CLUB",
                "kicker_vi": "BASELINE CLUB",
                "est": "EST. 2026",
                "title": "CUSTOM PACKAGE",
                "title_vi": "CUSTOM PACKAGE",
                "tagline": "Customize your racket look to match your style.",
                "tagline_vi": "Tùy chỉnh ngoại hình vợt theo phong cách của bạn.",
                "price": "FROM 2,000,000₫ – 3,000,000₫",
                "price_vi": "TỪ 2.000.000₫ – 3.000.000₫",
                "price_note": "Depending on design complexity",
                "price_note_vi": "Tùy theo độ phức tạp của thiết kế",
                "includes_label": "INCLUDES",
                "includes_label_vi": "BAO GỒM",
                "includes": [
                    {
                        "icon": "palette",
                        "title": "COLOR DIRECTION",
                        "title_vi": "ĐỊNH HƯỚNG MÀU SẮC",
                    },
                    {
                        "icon": "edit_note",
                        "title": "CUSTOM DESIGN",
                        "title_vi": "THIẾT KẾ THEO YÊU CẦU",
                    },
                    {
                        "icon": "layers",
                        "title": "DESIGN PREVIEW",
                        "title_vi": "XEM TRƯỚC THIẾT KẾ",
                    },
                ],
                "guarantees_label": "SERVICE",
                "guarantees_label_vi": "CAM KẾT",
                "guarantees": [
                    {
                        "icon": "verified_user",
                        "title": "6-MONTH PAINT WARRANTY",
                        "title_vi": "6 THÁNG BẢO HÀNH LỚP SƠN",
                    },
                    {
                        "icon": "crown",
                        "title": "EXCLUSIVE — NEVER REUSED",
                        "title_vi": "THIẾT KẾ ĐỘC QUYỀN KHÔNG LẶP LẠI",
                    },
                    {
                        "icon": "diamond",
                        "title": "PROFESSIONAL PROCESS",
                        "title_vi": "QUY TRÌNH CHUYÊN NGHIỆP",
                    },
                ],
                "cta_hint": "Explore our custom racket gallery",
                "cta_hint_vi": "Khám phá các mẫu đã thực hiện",
                "cta_label": "VIEW GALLERY",
                "cta_label_vi": "XEM MẪU NGAY",
                "cta_url": "/collections/custom-rackets",
                "footer": (
                    "Final pricing is confirmed after the concept and level of complexity are agreed.\n"
                    "Warranty excludes scratches, impact, abrasion and damage from external causes."
                ),
                "footer_vi": (
                    "Giá cuối cùng được xác nhận sau khi thống nhất ý tưởng và mức độ hoàn thiện.\n"
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

        def _intro_version(blocks: list | None) -> int | None:
            for b in blocks or []:
                if isinstance(b, dict):
                    v = (b.get("data") or {}).get("intro_version")
                    if v is not None:
                        try:
                            return int(v)
                        except (TypeError, ValueError):
                            return None
            return None

        if _intro_version(cat.content_blocks) == INTRO_VERSION and not force:
            print("custom-rackets intro seed: skipped (intro version up to date)")
            return
        cat.tagline = None
        cat.tagline_vi = None
        cat.description = None
        cat.description_vi = None
        cat.content_blocks = _blocks()
        db.commit()
        print(f"custom-rackets intro seed: updated category id={cat.id}")
    finally:
        db.close()


if __name__ == "__main__":
    run()