"""Footer contact block (phone, address, social, map) for site settings."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from .models import Media

SOCIAL_NETWORKS = (
    "facebook",
    "instagram",
    "threads",
    "youtube",
    "tiktok",
    "zalo",
)


def default_footer_contact() -> dict[str, Any]:
    return {
        "phone": None,
        "email": None,
        "address": None,
        "address_vi": None,
        "business_registration": None,
        "business_registration_vi": None,
        "showroom_note": None,
        "showroom_note_vi": None,
        "opening_hours": None,
        "opening_hours_vi": None,
        "map_embed_url": None,
        "facebook_page_embed_url": None,
        "registration_badge_media_id": None,
        "useful_links_title": None,
        "useful_links_title_vi": None,
        "categories_title": None,
        "categories_title_vi": None,
        "copyright_text": None,
        "copyright_text_vi": None,
        "show_product_categories": True,
        "social": {key: None for key in SOCIAL_NETWORKS},
    }


def normalize_footer_contact(raw: dict | None) -> dict[str, Any]:
    base = default_footer_contact()
    if not raw or not isinstance(raw, dict):
        return base
    social_in = raw.get("social") if isinstance(raw.get("social"), dict) else {}
    social = {key: social_in.get(key) or None for key in SOCIAL_NETWORKS}
    out = {**base, **{k: raw.get(k) for k in base if k != "social"}, "social": social}
    return out


def _loc(lang: str, en: str | None, vi: str | None) -> str | None:
    en = (en or "").strip() or None
    vi = (vi or "").strip() or None
    if lang == "vi":
        return vi or en
    return en or vi


def resolve_footer_contact(
    raw: dict | None,
    lang: str,
    db: Session | None = None,
) -> dict[str, Any]:
    data = normalize_footer_contact(raw)
    social = {k: v for k, v in (data.get("social") or {}).items() if v and str(v).strip()}
    badge_url = None
    badge_id = data.get("registration_badge_media_id")
    if badge_id and db is not None:
        media = db.get(Media, int(badge_id))
        if media:
            badge_url = media.url

    return {
        "phone": (data.get("phone") or "").strip() or None,
        "email": (data.get("email") or "").strip() or None,
        "address": _loc(lang, data.get("address"), data.get("address_vi")),
        "business_registration": _loc(
            lang, data.get("business_registration"), data.get("business_registration_vi")
        ),
        "showroom_note": _loc(lang, data.get("showroom_note"), data.get("showroom_note_vi")),
        "opening_hours": _loc(lang, data.get("opening_hours"), data.get("opening_hours_vi")),
        "map_embed_url": (data.get("map_embed_url") or "").strip() or None,
        "facebook_page_embed_url": (data.get("facebook_page_embed_url") or "").strip() or None,
        "registration_badge_url": badge_url,
        "useful_links_title": _loc(
            lang, data.get("useful_links_title"), data.get("useful_links_title_vi")
        ),
        "categories_title": _loc(lang, data.get("categories_title"), data.get("categories_title_vi")),
        "copyright_line": _loc(lang, data.get("copyright_text"), data.get("copyright_text_vi")),
        "show_product_categories": bool(data.get("show_product_categories", True)),
        "social": social,
    }
