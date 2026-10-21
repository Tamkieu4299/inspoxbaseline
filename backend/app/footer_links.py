"""Footer link presets and resolution for storefront / admin site settings."""

from __future__ import annotations

from typing import Any

FOOTER_PRESET_DEFAULTS: dict[str, dict[str, str | None]] = {
    "privacy": {
        "label": "PRIVACY POLICY",
        "label_vi": "CHÍNH SÁCH BẢO MẬT",
        "url": None,
    },
    "terms": {
        "label": "TERMS OF SERVICE",
        "label_vi": "ĐIỀU KHOẢN SỬ DỤNG",
        "url": None,
    },
    "shipping": {
        "label": "SHIPPING & RETURNS",
        "label_vi": "GIAO HÀNG & ĐỔI TRẢ",
        "url": None,
    },
    "brand": {
        "label": "BRAND EXPERIENCE",
        "label_vi": "TRẢI NGHIỆM THƯƠNG HIỆU",
        "url": "/brand",
    },
    "admin": {
        "label": "ADMIN",
        "label_vi": "QUẢN TRỊ",
        "url": "/admin",
    },
}

FOOTER_PRESET_KEYS = list(FOOTER_PRESET_DEFAULTS.keys())


def default_footer_link_configs() -> list[dict[str, Any]]:
    return [
        {"key": key, "enabled": True, "label": None, "label_vi": None, "url": None}
        for key in FOOTER_PRESET_KEYS
    ]


def normalize_footer_link_configs(stored: list | None) -> list[dict[str, Any]]:
    """Merge stored rows with presets; null/empty stored => all presets enabled."""
    if not stored:
        return default_footer_link_configs()
    by_key = {str(item.get("key")): item for item in stored if item.get("key")}
    out: list[dict[str, Any]] = []
    for key in FOOTER_PRESET_KEYS:
        row = by_key.get(key, {})
        out.append(
            {
                "key": key,
                "enabled": bool(row.get("enabled", True)),
                "label": row.get("label"),
                "label_vi": row.get("label_vi"),
                "url": row.get("url"),
            }
        )
    for key, row in by_key.items():
        if key in FOOTER_PRESET_DEFAULTS:
            continue
        out.append(
            {
                "key": key,
                "enabled": bool(row.get("enabled", True)),
                "label": row.get("label"),
                "label_vi": row.get("label_vi"),
                "url": row.get("url"),
            }
        )
    return out


def resolve_footer_links(stored: list | None, lang: str) -> list[dict[str, str | None]]:
    configs = normalize_footer_link_configs(stored)
    resolved: list[dict[str, str | None]] = []
    for item in configs:
        if not item.get("enabled", True):
            continue
        key = str(item.get("key") or "")
        preset = FOOTER_PRESET_DEFAULTS.get(key, {})
        label_en = (item.get("label") or preset.get("label") or "").strip()
        label_vi = (item.get("label_vi") or preset.get("label_vi") or "").strip()
        if lang == "vi":
            label = label_vi or label_en
        else:
            label = label_en or label_vi
        if not label:
            continue
        url = item.get("url")
        if url is None or url == "":
            url = preset.get("url")
        resolved.append({"label": label, "url": url})
    return resolved
