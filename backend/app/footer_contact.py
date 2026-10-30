"""Footer contact block (phone, address, social, map) for site settings."""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy.orm import Session

from .models import Media

SOCIAL_NETWORKS = (
    "facebook",
    "instagram",
    "youtube",
    "tiktok",
    "zalo",
    "threads",
)

_FOOTER_BOOL_KEYS = (
    "show_product_categories",
    "floating_contact_enabled",
    "show_footer_brand",
    "show_footer_tagline",
    "show_footer_contact_details",
    "show_footer_social_icons",
    "show_footer_registration_badge",
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
        "follow_section_title": None,
        "follow_section_title_vi": None,
        "messenger_url": None,
        "floating_contact_enabled": True,
        "show_footer_brand": True,
        "show_footer_tagline": True,
        "show_footer_contact_details": True,
        "show_footer_social_icons": True,
        "show_footer_registration_badge": True,
        "social_links": [],
    }


def normalize_social_links(raw: dict[str, Any]) -> list[dict[str, str]]:
    """Footer social badges: ordered list of {icon, url}. Migrates legacy social dict."""
    links_in = raw.get("social_links")
    if isinstance(links_in, list) and links_in:
        out: list[dict[str, str]] = []
        for item in links_in:
            if not isinstance(item, dict):
                continue
            icon = (item.get("icon") or "").strip().lower()
            url = (item.get("url") or "").strip()
            if icon not in SOCIAL_NETWORKS or not url:
                continue
            out.append({"icon": icon, "url": url})
        return out

    social_in = raw.get("social") if isinstance(raw.get("social"), dict) else {}
    out = []
    for icon in SOCIAL_NETWORKS:
        url = (social_in.get(icon) or "").strip()
        if url:
            out.append({"icon": icon, "url": url})
    return out


def normalize_footer_contact(raw: dict | None) -> dict[str, Any]:
    base = default_footer_contact()
    if not raw or not isinstance(raw, dict):
        return base
    skip = {"social", "social_links"}
    out = {**base, **{k: raw.get(k) for k in base if k not in skip}, "social_links": normalize_social_links(raw)}
    for key in _FOOTER_BOOL_KEYS:
        if out.get(key) is None:
            out[key] = base[key]
        else:
            out[key] = bool(out[key])
    return out


def _phone_digits(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone.strip())
    if not digits:
        return None
    if digits.startswith("84") and len(digits) >= 10:
        digits = "0" + digits[2:]
    return digits


def _zalo_chat_url(data: dict[str, Any], social_links: list[dict[str, str]]) -> str | None:
    for item in social_links:
        if item.get("icon") == "zalo":
            zalo = (item.get("url") or "").strip()
            if zalo and "zalo.me" in zalo.lower():
                return zalo
    digits = _phone_digits(data.get("phone"))
    if digits:
        return f"https://zalo.me/{digits}"
    return None


def _resolve_floating_contact(
    data: dict[str, Any], social_links: list[dict[str, str]]
) -> dict[str, str] | None:
    if not bool(data.get("floating_contact_enabled", True)):
        return None
    zalo_url = _zalo_chat_url(data, social_links)
    messenger_url = (data.get("messenger_url") or "").strip() or None
    phone = (data.get("phone") or "").strip() or None
    phone_href = None
    if phone:
        digits = _phone_digits(phone)
        if digits:
            phone_href = f"tel:{digits}"
    if not zalo_url and not messenger_url and not phone_href:
        return None
    out: dict[str, str] = {}
    if zalo_url:
        out["zalo_url"] = zalo_url
    if messenger_url:
        out["messenger_url"] = messenger_url
    if phone_href:
        out["phone_href"] = phone_href
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
    social_links = data.get("social_links") or []
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
        "show_footer_brand": bool(data.get("show_footer_brand", True)),
        "show_footer_tagline": bool(data.get("show_footer_tagline", True)),
        "show_footer_contact_details": bool(data.get("show_footer_contact_details", True)),
        "show_footer_social_icons": bool(data.get("show_footer_social_icons", True)),
        "show_footer_registration_badge": bool(data.get("show_footer_registration_badge", True)),
        "follow_section_title": _loc(
            lang, data.get("follow_section_title"), data.get("follow_section_title_vi")
        ),
        "social_links": social_links,
        "floating_contact": _resolve_floating_contact(data, social_links),
    }
