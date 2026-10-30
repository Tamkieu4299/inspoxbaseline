"""Populate Baseline Club footer from public Facebook page metadata.

Source: https://www.facebook.com/profile.php?id=61592847184311

    docker exec inspo-backend python -m app.seed_baseline_footer
    docker exec inspo-backend python -m app.seed_baseline_footer --dry-run
"""

from __future__ import annotations

import argparse
import sys
from urllib.parse import quote

from sqlalchemy import select

from .database import SessionLocal
from .footer_contact import normalize_footer_contact
from .models import SiteSettings, Tenant

FB_PAGE_URL = "https://www.facebook.com/profile.php?id=61592847184311"
FB_EMBED_URL = (
    "https://www.facebook.com/plugins/page.php?href="
    + quote(FB_PAGE_URL, safe="")
    + "&tabs&width=340&height=130&small_header=false&adapt_container_width=true"
    + "&hide_cover=false&show_facepile=false"
)

FOOTER_TAGLINE_EN = (
    "Tennis, with personality. Apparel, rackets, custom gear, and overgrips — "
    "based in Ho Chi Minh City, Vietnam."
)
FOOTER_TAGLINE_VI = (
    "Tennis, with personality. 🎾 Apparel • Rackets • Custom • Overgrips "
    "📍 Thành phố Hồ Chí Minh, Việt Nam"
)


def baseline_footer_contact_patch() -> dict:
    return {
        "address": "Ho Chi Minh City, Vietnam",
        "address_vi": "Thành phố Hồ Chí Minh, Việt Nam",
        "showroom_note": (
            "View rackets and gear in person — message us on Facebook to arrange a visit."
        ),
        "showroom_note_vi": (
            "Xem vợt và phụ kiện trực tiếp — nhắn tin Facebook để đặt lịch ghé cửa hàng."
        ),
        "facebook_page_embed_url": FB_EMBED_URL,
        "social": {
            "facebook": FB_PAGE_URL,
        },
        "useful_links_title": None,
        "useful_links_title_vi": "Liên kết hữu ích",
        "categories_title": None,
        "categories_title_vi": "Danh mục sản phẩm",
    }


def apply_baseline_footer(*, dry_run: bool = True) -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == "baseline"))
        if tenant is None:
            raise SystemExit("Tenant baseline not found")
        site = db.scalar(select(SiteSettings).where(SiteSettings.tenant_id == tenant.id))
        if site is None:
            site = SiteSettings(tenant_id=tenant.id)
            db.add(site)
            db.flush()

        site.footer_tagline = FOOTER_TAGLINE_EN
        site.footer_tagline_vi = FOOTER_TAGLINE_VI
        merged = normalize_footer_contact(site.footer_contact)
        patch = baseline_footer_contact_patch()
        merged.update({k: v for k, v in patch.items() if k != "social"})
        social = dict(merged.get("social") or {})
        for key, url in (patch.get("social") or {}).items():
            if url:
                social[key] = url
        merged["social"] = social
        site.footer_contact = merged

        if dry_run:
            db.rollback()
            print("dry-run: would update baseline site footer_tagline + footer_contact")
            print(site.footer_contact)
        else:
            db.commit()
            print("Applied Baseline Club footer from Facebook public info.")
    finally:
        db.close()


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--apply", action="store_true")
    args = p.parse_args(argv)
    apply_baseline_footer(dry_run=args.dry_run or not args.apply)


if __name__ == "__main__":
    main(sys.argv[1:])
