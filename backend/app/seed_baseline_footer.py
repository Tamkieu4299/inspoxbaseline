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

# City-wide map until a pinned store address is set in Admin → Site.
MAP_EMBED_HCM = (
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1567469.4!2d106.6297!3d10.8231!"
    "2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752b14aa2ddc79%3A0x9eb85fb551a123c!"
    "2sHo%20Chi%20Minh%20City%2C%20Vietnam!5e0!3m2!1svi!2s!4v1766368248701!5m2!1svi!2s"
)


def baseline_social_links() -> dict[str, str]:
    """Placeholder: all networks point to Facebook until real URLs are set in admin."""
    return {key: FB_PAGE_URL for key in ("facebook", "instagram", "threads", "tiktok", "zalo")}


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
        "map_embed_url": MAP_EMBED_HCM,
        "facebook_page_embed_url": FB_EMBED_URL,
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
