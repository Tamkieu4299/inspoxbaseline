"""Footer link presets and resolution for storefront / admin site settings."""

from __future__ import annotations

from typing import Any

FOOTER_PRESET_DEFAULTS: dict[str, dict[str, str | None]] = {
    "terms": {
        "label": "Terms of service",
        "label_vi": "Điều khoản sử dụng",
        "url": None,
    },
    "shipping": {
        "label": "Shipping & returns",
        "label_vi": "Giao hàng & đổi trả",
        "url": None,
    },
    "brand": {
        "label": "Brand experience",
        "label_vi": "Trải nghiệm thương hiệu",
        "url": "/brand",
    },
    "admin": {
        "label": "Admin",
        "label_vi": "Quản trị",
        "url": "/admin",
    },
}

FOOTER_PRESET_KEYS = list(FOOTER_PRESET_DEFAULTS.keys())

# Quoc Sport-style presets removed from admin; drop if still stored in JSON.
REMOVED_FOOTER_PRESET_KEYS = frozenset(
    {
        "privacy",
        "shipping_policy",
        "return_policy",
        "careers",
        "contact",
        "order_lookup",
    }
)

# Legacy rows default on for terms/shipping/brand/admin.
DEFAULT_ENABLED_FOOTER_KEYS = frozenset({"terms", "shipping", "brand", "admin"})


def _preset_enabled_by_default(key: str) -> bool:
    return key in DEFAULT_ENABLED_FOOTER_KEYS


def default_footer_link_configs() -> list[dict[str, Any]]:
    return [
        {
            "key": key,
            "enabled": _preset_enabled_by_default(key),
            "label": None,
            "label_vi": None,
            "url": None,
        }
        for key in FOOTER_PRESET_KEYS
    ]


def normalize_footer_link_configs(stored: list | None) -> list[dict[str, Any]]:
    """Merge stored rows with presets; unset stored => opt-in defaults per preset."""
    if not stored:
        return default_footer_link_configs()
    by_key = {str(item.get("key")): item for item in stored if item.get("key")}
    out: list[dict[str, Any]] = []
    for key in FOOTER_PRESET_KEYS:
        row = by_key.get(key, {})
        enabled = row.get("enabled")
        if enabled is None:
            enabled = _preset_enabled_by_default(key)
        out.append(
            {
                "key": key,
                "enabled": bool(enabled),
                "label": row.get("label"),
                "label_vi": row.get("label_vi"),
                "url": row.get("url"),
            }
        )
    for key, row in by_key.items():
        if key in FOOTER_PRESET_DEFAULTS or key in REMOVED_FOOTER_PRESET_KEYS:
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
        url = (url or "").strip() or None
        if not url:
            continue
        resolved.append({"label": label, "url": url})
    return resolved
