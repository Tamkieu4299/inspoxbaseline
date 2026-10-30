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
FB_MESSENGER_URL = "https://m.me/61592847184311"
BASELINE_PHONE = "0834 086 256"
ZALO_CHAT_URL = "https://zalo.me/0834086256"
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

# 21 Võ Trường Toản, An Khánh (10.8043, 106.7476) — Google Maps embed.
MAP_EMBED_SHOWROOM = (
    "https://www.google.com/maps?q=10.8043,106.7476&hl=vi&z=17&output=embed"
)


def baseline_social_links() -> dict[str, str]:
    """Placeholder: most networks point to Facebook until real URLs are set in admin."""
    links = {
        key: FB_PAGE_URL for key in ("facebook", "instagram", "youtube", "tiktok", "threads")
    }
    links["zalo"] = ZALO_CHAT_URL
    return links


def baseline_footer_contact_patch() -> dict:
    return {
        "phone": BASELINE_PHONE,
        "address": "21 Võ Trường Toản, An Khánh Ward, Ho Chi Minh City, Vietnam",
        "address_vi": "21 Võ Trường Toản, Phường An Khánh, TP. HCM",
        "showroom_note": (
            "View rackets and gear in person — message us on Facebook to arrange a visit."
        ),
        "showroom_note_vi": (
            "Xem vợt và phụ kiện trực tiếp — nhắn tin Facebook để đặt lịch ghé cửa hàng."
        ),
        "map_embed_url": MAP_EMBED_SHOWROOM,
        "facebook_page_embed_url": FB_EMBED_URL,
        "messenger_url": FB_MESSENGER_URL,
        "floating_contact_enabled": True,
        "social": baseline_social_links(),
        "useful_links_title": None,
        "useful_links_title_vi": "Liên kết hữu ích",
        "categories_title": None,
        "categories_title_vi": "Danh mục sản phẩm",
        "follow_section_title": "Follow Baseline Club",
        "follow_section_title_vi": "Theo dõi Baseline Club",
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
        for key, url in baseline_social_links().items():
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
