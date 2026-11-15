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


INTRO_VERSION = 2


def _blocks(media: Media) -> list[dict]:
    """Single full poster — all pricing copy lives in the JPEG (no duplicate blocks)."""
    return [
        {
            "block_type": "image",
            "position": 0,
            "data": {
                "media_id": media.id,
                "url": media.url,
                "layout": "banner",
                "fit": "contain",
                "hide_caption": True,
                "caption": "Custom package pricing",
                "caption_vi": "Bảng giá gói custom",
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
        media = _ensure_media(db, tenant.id)
        cat.tagline = None
        cat.tagline_vi = None
        cat.description = None
        cat.description_vi = None
        blocks = _blocks(media)
        blocks[0]["data"]["intro_version"] = INTRO_VERSION
        cat.content_blocks = blocks
        db.commit()
        print(f"custom-rackets intro seed: updated category id={cat.id}")
    finally:
        db.close()


if __name__ == "__main__":
    run()